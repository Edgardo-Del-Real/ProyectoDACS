import { prisma } from '../db.js';
import * as turf from '@turf/turf';

// TTL de caché: 3 horas (RNF-08)
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

interface PronosticoDia {
  fecha: string;
  tempMax: number;
  tempMin: number;
  precipitacion: number;
}

interface PronosticoResponse {
  pronostico: PronosticoDia[];
  stale: boolean;
  fetchedAt: string;
}

/**
 * Obtiene el pronóstico de 7 días para una parcela.
 * Usa caché de 3 horas. Si Open-Meteo falla, devuelve el último dato válido con stale=true.
 */
export async function obtenerPronostico(parcelaId: string): Promise<PronosticoResponse | null> {
  // 1. Verificar caché existente
  const cache = await prisma.pronosticoClima.findUnique({
    where: { parcelaId },
  });

  if (cache) {
    const age = Date.now() - cache.fetchedAt.getTime();
    if (age < CACHE_TTL_MS) {
      // Caché válida
      return {
        pronostico: cache.datos as unknown as PronosticoDia[],
        stale: false,
        fetchedAt: cache.fetchedAt.toISOString(),
      };
    }
  }

  // 2. Obtener parcela para calcular centroide
  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
  });

  if (!parcela) {
    return null;
  }

  // 3. Calcular centroide del polígono
  const poligono = parcela.poligono as unknown as GeoJSON.Polygon;
  const centroide = turf.centroid(poligono);
  const [lng, lat] = centroide.geometry.coordinates;

  // 4. Llamar a Open-Meteo API
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();

    // 5. Transformar respuesta de Open-Meteo
    const pronostico: PronosticoDia[] = data.daily.time.map((fecha: string, i: number) => ({
      fecha,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precipitacion: data.daily.precipitation_sum[i],
    }));

    // 6. Guardar en caché (upsert)
    const now = new Date();
    await prisma.pronosticoClima.upsert({
      where: { parcelaId },
      create: {
        parcelaId,
        datos: pronostico as unknown as any,
        fetchedAt: now,
      },
      update: {
        datos: pronostico as unknown as any,
        fetchedAt: now,
      },
    });

    return {
      pronostico,
      stale: false,
      fetchedAt: now.toISOString(),
    };
  } catch (error) {
    // 7. Fallback: si Open-Meteo falla, devolver último dato válido
    if (cache) {
      return {
        pronostico: cache.datos as unknown as PronosticoDia[],
        stale: true,
        fetchedAt: cache.fetchedAt.toISOString(),
      };
    }

    // No hay caché y API falló
    throw error;
  }
}
