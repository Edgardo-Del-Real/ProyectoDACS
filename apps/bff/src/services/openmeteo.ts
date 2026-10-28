import type { Prisma } from '@prisma/client';
import * as turf from '@turf/turf';
import { prisma } from '../db.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';

// RNF-08: TTL de caché de pronóstico (3 horas)
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

// RNF-10: Parámetros de resiliencia para Open-Meteo
const TIMEOUT_POR_INTENTO_MS = 4_000; // 4 segundos de timeout estricto
const MAX_REINTENTOS = 3;             // 3 intentos máximos
const BACKOFF_INICIAL_MS = 300;       // Espera inicial de 300ms

/**
 * Circuit breaker para proteger las llamadas salientes a Open-Meteo (RNF-10).
 * Si falla 3 veces seguidas, se abre durante 30s evitando timeouts en el BFF.
 */
export const openMeteoBreaker = new CircuitBreaker({
  name: 'Open-Meteo',
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});

interface PronosticoDia {
  fecha: string;
  tempMax: number;
  tempMin: number;
  precipitacion: number;
}

export interface PronosticoResponse {
  pronostico: PronosticoDia[];
  stale: boolean;
  fetchedAt: string;
}

interface OpenMeteoApiResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
}

/**
 * Ejecuta una petición HTTP con timeout estricto y reintentos con espera exponencial (RNF-10).
 */
async function fetchConReintentos(
  url: string,
  reintentosRestantes = MAX_REINTENTOS,
  esperaMs = BACKOFF_INICIAL_MS,
): Promise<Response> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_POR_INTENTO_MS),
    });

    if (!response.ok) {
      // Errores 4xx del cliente (ej. 400 por coordenadas fuera de rango) no son recuperables con reintento
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Open-Meteo client error HTTP ${response.status}`);
      }
      throw new Error(`Open-Meteo server error HTTP ${response.status}`);
    }

    return response;
  } catch (err) {
    const esErrorCliente = err instanceof Error && err.message.includes('client error');
    if (reintentosRestantes <= 1 || esErrorCliente) {
      throw err;
    }

    // Espera exponencial con jitter aleatorio para evitar estampidas
    const jitter = Math.random() * 50;
    await new Promise((resolve) => setTimeout(resolve, esperaMs + jitter));

    return fetchConReintentos(url, reintentosRestantes - 1, esperaMs * 2);
  }
}

/**
 * Obtiene el pronóstico de 7 días para una parcela.
 * Aplica:
 * 1. Caché de 3 horas en Postgres (RNF-08).
 * 2. Circuit Breaker con fail-fast (RNF-10).
 * 3. Timeout de 4s y reintentos con espera exponencial (RNF-10).
 * 4. Fallback a datos en caché (stale=true) si la API externa no responde (RNF-09).
 */
export async function obtenerPronostico(parcelaId: string): Promise<PronosticoResponse | null> {
  // 1. Verificar si existe caché válida
  const cache = await prisma.pronosticoClima.findUnique({
    where: { parcelaId },
  });

  if (cache) {
    const age = Date.now() - cache.fetchedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return {
        pronostico: cache.datos as unknown as PronosticoDia[],
        stale: false,
        fetchedAt: cache.fetchedAt.toISOString(),
      };
    }
  }

  // 2. Obtener geometría de la parcela para calcular su centroide geográfico
  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
  });

  if (!parcela) {
    return null;
  }

  const poligono = parcela.poligono as unknown as GeoJSON.Polygon;
  const centroide = turf.centroid(poligono);
  const [lng, lat] = centroide.geometry.coordinates;

  // 3. Consultar Open-Meteo a través del Circuit Breaker con timeout y reintentos
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`;

  try {
    const response = await openMeteoBreaker.execute(() => fetchConReintentos(url));
    const data = (await response.json()) as OpenMeteoApiResponse;

    // 4. Transformar respuesta estandarizada
    const pronostico: PronosticoDia[] = data.daily.time.map((fecha, i) => ({
      fecha,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precipitacion: data.daily.precipitation_sum[i],
    }));

    // 5. Actualizar caché en la base de datos
    const now = new Date();
    await prisma.pronosticoClima.upsert({
      where: { parcelaId },
      create: {
        parcelaId,
        datos: pronostico as unknown as Prisma.InputJsonValue,
        fetchedAt: now,
      },
      update: {
        datos: pronostico as unknown as Prisma.InputJsonValue,
        fetchedAt: now,
      },
    });

    return {
      pronostico,
      stale: false,
      fetchedAt: now.toISOString(),
    };
  } catch (error) {
    // 6. RNF-09 / RNF-10 Fallback suave: ante fallo externo o circuito abierto, servir último dato válido si existe
    if (cache) {
      return {
        pronostico: cache.datos as unknown as PronosticoDia[],
        stale: true,
        fetchedAt: cache.fetchedAt.toISOString(),
      };
    }

    // Sin caché previa ni proveedor disponible
    throw error;
  }
}
