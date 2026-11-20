import { prisma } from '../db.js';
import { obtenerPreciosBolsa } from './bolsaCereales.js';
import {
  CULTIVOS_MERCADO_VALIDOS,
  MercadoClientError,
  normalizarCultivoMercado,
  validarPosicionMercado,
  type CultivoMercado,
} from './mercadoCatalogo.js';
import {
  calcularMetricasTendencia,
  claveOrdenPosicion,
  esCotizacionStale,
  generarDescripcionPosicion,
  type SerieHistoricaPunto,
} from './mercadoMetricas.js';

export {
  CULTIVOS_MERCADO_VALIDOS,
  MercadoClientError,
  normalizarCultivoMercado,
  validarPosicionMercado,
  generarDescripcionPosicion,
  calcularMetricasTendencia,
  esCotizacionStale,
};
export type { CultivoMercado, SerieHistoricaPunto };

/** Fuente única de los precios: precios oficiales FOB de la Bolsa de Cereales. */
export const FUENTE_BOLSA = 'Bolsa de Cereales de Buenos Aires (FOB Ley 21.453)';

/** El spot FOB se guarda como una posición más, para no tener dos modelos. */
const POSICION_SPOT = 'DISPONIBLE';

/** TTL de 6 horas para el refresco lazy en runtime. */
const TTL_REFRESCO_MS = 6 * 60 * 60 * 1000;

/** Se usa en la advertencia cuando todavía no corrió el worker. */
export const COMANDO_SINCRONIZACION = 'npm run sync:mercado';

const VENTANA_HISTORICO_MAX_DIAS = 365;

export interface CotizacionFuturo {
  id?: string;
  cultivo: string;
  posicion: string;
  descripcionPosicion: string;
  fecha: string;
  fuente: string;
  valor: number;
  /** Variación porcentual contra la fecha anterior disponible, no contra una fórmula. */
  variacionDiaPct: number;
}

export interface MercadoResumenResponse {
  cultivo: string;
  cultivosDisponibles: string[];
  cotizaciones: CotizacionFuturo[];
  spotActual: number | null;
  futuroCercano: CotizacionFuturo | null;
  ultimaActualizacion: string | null;
  stale: boolean;
  fuente: string;
  /** Avisos del parser o del refresco: la UI los muestra para no ocultar degradaciones. */
  advertencias: string[];
}

export interface TendenciaMercadoResponse {
  cultivo: string;
  posicion: string;
  puntos: SerieHistoricaPunto[];
  minimo: number;
  maximo: number;
  promedio: number;
  variacionTotalPct: number;
  stale: boolean;
}

const aFechaISO = (fecha: Date): string => fecha.toISOString().split('T')[0];
const aFecha = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

let sincronizacionEnCurso: Promise<{ filas: number; advertencias: string[] }> | null = null;

/**
 * Reutiliza la promesa de sincronización en curso para evitar que múltiples
 * requests concurrentes disparen scraping simultáneo (Bloqueante 2).
 */
export async function ejecutarSincronizacionCompartida(
  proveedor = obtenerPreciosBolsa,
): Promise<{ filas: number; advertencias: string[] }> {
  if (!sincronizacionEnCurso) {
    sincronizacionEnCurso = sincronizarDesdeBolsa(proveedor).finally(() => {
      sincronizacionEnCurso = null;
    });
  }
  return sincronizacionEnCurso;
}

/**
 * Descarga los precios oficiales y los persiste.
 *
 * Se llama desde el servicio cuando el dato está vencido (> 6 h) o desde el worker `sync:mercado`.
 * Es idempotente por la clave única (cultivo, posicion, fecha, fuente).
 * Si oficiales.fecha es null, no usa new Date() ni persiste esas filas y emite advertencia (Mejora 4).
 */
export async function sincronizarDesdeBolsa(
  proveedor = obtenerPreciosBolsa,
): Promise<{
  filas: number;
  advertencias: string[];
}> {
  const { oficiales, spot } = await proveedor();
  const advertencias: string[] = [...oficiales.advertencias, ...spot.advertencias];

  const filas: Array<{
    cultivo: string;
    posicion: string;
    fecha: Date;
    fuente: string;
    valor: number;
    moneda: string;
  }> = [];

  // Mejora 4: Si oficiales.fecha es null, no usamos new Date() ni persistimos esas filas
  if (oficiales.fecha) {
    const fechaOficiales = aFecha(oficiales.fecha);
    for (const c of oficiales.cotizaciones) {
      filas.push({
        cultivo: c.cultivo,
        posicion: c.posicion,
        fecha: fechaOficiales,
        fuente: FUENTE_BOLSA,
        valor: c.valor,
        moneda: 'USD',
      });
    }
  } else {
    advertencias.push(
      'No se pudieron persistir los precios oficiales: fecha de publicación ausente.',
    );
  }

  const fechaSpot = spot.fecha ?? oficiales.fecha;
  if (fechaSpot) {
    const fechaSpotDate = aFecha(fechaSpot);
    for (const cultivo of CULTIVOS_MERCADO_VALIDOS) {
      const valor = spot.spot[cultivo];
      if (typeof valor !== 'number') continue;

      filas.push({
        cultivo,
        posicion: POSICION_SPOT,
        fecha: fechaSpotDate,
        fuente: FUENTE_BOLSA,
        valor,
        moneda: 'USD',
      });
    }
  } else {
    advertencias.push('No se pudo persistir el spot: fecha de publicación ausente.');
  }

  if (filas.length > 0) {
    await prisma.$transaction(
      filas.map((fila) =>
        prisma.precio.upsert({
          where: {
            cultivo_posicion_fecha_fuente: {
              cultivo: fila.cultivo,
              posicion: fila.posicion,
              fecha: fila.fecha,
              fuente: fila.fuente,
            },
          },
          update: { valor: fila.valor, moneda: fila.moneda },
          create: fila,
        }),
      ),
    );
  }

  return {
    filas: filas.length,
    advertencias,
  };
}

/**
 * Cotizaciones vigentes del cultivo: spot y curva de vencimientos.
 *
 * Estrategia de caché lazy: si el último dato guardado tiene más de 6 h (o no hay datos),
 * se refresca de forma lazy llamando a sincronizarDesdeBolsa() compartiendo la promesa en curso.
 * Si el refresco falla, se sirve lo que hay en base de datos con `stale: true` y una advertencia.
 * Devuelve la fila más reciente por posición (no filtra por fecha global única) (Bloqueante 1).
 */
export async function obtenerCotizacionesMercado(
  cultivoInput: string,
): Promise<MercadoResumenResponse> {
  const cultivo = normalizarCultivoMercado(cultivoInput);
  const advertencias: string[] = [];

  // Verificamos antigüedad de la última sincronización general para refresco lazy (Bloqueante 2)
  let syncFallo = false;
  try {
    const ultimoSincronizado = await prisma.precio.findFirst({
      where: { fuente: FUENTE_BOLSA },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const necesitaRefresco =
      !ultimoSincronizado ||
      Date.now() - ultimoSincronizado.createdAt.getTime() > TTL_REFRESCO_MS;

    if (necesitaRefresco) {
      const res = await ejecutarSincronizacionCompartida();
      advertencias.push(...res.advertencias);
    }
  } catch (err) {
    syncFallo = true;
    advertencias.push(
      `No se pudo actualizar desde la Bolsa de Cereales: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // Buscamos los precios ordenados por fecha descendente sin límite arbitrario de take: 200 (Mejora 7)
  const filas = await prisma.precio.findMany({
    where: { cultivo },
    orderBy: { fecha: 'desc' },
  });

  if (filas.length === 0) {
    return {
      cultivo,
      cultivosDisponibles: [...CULTIVOS_MERCADO_VALIDOS],
      cotizaciones: [],
      spotActual: null,
      futuroCercano: null,
      ultimaActualizacion: null,
      stale: true,
      fuente: FUENTE_BOLSA,
      advertencias:
        advertencias.length > 0
          ? advertencias
          : [
              `Todavía no hay cotizaciones sincronizadas. Ejecutá \`${COMANDO_SINCRONIZACION}\`.`,
            ],
    };
  }

  // Bloqueante 1: Tomamos la fila más reciente POR POSICIÓN (no por fecha global)
  const posicionesVistas = new Set<string>();
  const actuales: typeof filas = [];
  for (const fila of filas) {
    if (!posicionesVistas.has(fila.posicion)) {
      posicionesVistas.add(fila.posicion);
      actuales.push(fila);
    }
  }

  // Mejora 7: Búsqueda de la fila anterior por posición sin depender de take: 200
  const variacion = (posicion: string, valor: number, fechaActual: Date): number => {
    const anterior = filas.find(
      (f) => f.posicion === posicion && f.fecha.getTime() < fechaActual.getTime(),
    );
    if (!anterior || anterior.valor === 0) return 0;

    return Number((((valor - anterior.valor) / anterior.valor) * 100).toFixed(2));
  };

  const cotizaciones: CotizacionFuturo[] = actuales
    .map((fila) => ({
      id: fila.id,
      cultivo: fila.cultivo,
      posicion: fila.posicion,
      descripcionPosicion: generarDescripcionPosicion(fila.posicion),
      fecha: aFechaISO(fila.fecha),
      fuente: fila.fuente,
      valor: fila.valor,
      moneda: fila.moneda,
      variacionDiaPct: variacion(fila.posicion, fila.valor, fila.fecha),
    }))
    .sort((a, b) => claveOrdenPosicion(a.posicion) - claveOrdenPosicion(b.posicion));

  const spot = cotizaciones.find((c) => c.posicion === POSICION_SPOT) ?? null;
  const futuros = cotizaciones.filter((c) => c.posicion !== POSICION_SPOT);

  // Fecha máxima entre las posiciones vigentes
  const fechaMaxima = new Date(Math.max(...actuales.map((f) => f.fecha.getTime())));

  return {
    cultivo,
    cultivosDisponibles: [...CULTIVOS_MERCADO_VALIDOS],
    cotizaciones,
    spotActual: spot?.valor ?? null,
    // Ya vienen ordenados por fecha real, así que el primero es el más cercano.
    futuroCercano: futuros[0] ?? null,
    ultimaActualizacion: aFechaISO(fechaMaxima),
    // Mejora 5: stale si falló el refresco o si pasó más de 1 día hábil desde la fecha de publicación
    stale: syncFallo || esCotizacionStale(fechaMaxima),
    fuente: actuales[0]?.fuente ?? FUENTE_BOLSA,
    advertencias,
  };
}

/**
 * Serie histórica para el gráfico de tendencia.
 *
 * Lee solo de la base: el histórico se construye con los snapshots diarios que
 * va dejando el refresco. No genera series sintéticas ni escribe en un GET.
 */
export async function obtenerTendenciaMercado(
  cultivoInput: string,
  posicionInput = POSICION_SPOT,
  dias = 30,
): Promise<TendenciaMercadoResponse> {
  const cultivo = normalizarCultivoMercado(cultivoInput);
  const posicion = validarPosicionMercado(posicionInput);

  const ventana = Math.min(
    Math.max(Math.trunc(Number(dias)) || 30, 1),
    VENTANA_HISTORICO_MAX_DIAS,
  );

  const desde = new Date();
  desde.setUTCHours(0, 0, 0, 0);
  desde.setUTCDate(desde.getUTCDate() - ventana);

  const registros = await prisma.precio.findMany({
    where: { cultivo, posicion, fecha: { gte: desde } },
    orderBy: { fecha: 'asc' },
  });

  const puntos: SerieHistoricaPunto[] = registros.map((registro) => ({
    fecha: aFechaISO(registro.fecha),
    valor: registro.valor,
    posicion: registro.posicion,
  }));

  const metricas = calcularMetricasTendencia(puntos);
  const ultimoPunto = puntos[puntos.length - 1];

  return {
    cultivo,
    posicion,
    puntos,
    ...metricas,
    stale: !ultimoPunto || esCotizacionStale(ultimoPunto.fecha),
  };
}

export interface UltimoPrecioCultivo {
  valor: number;
  fecha: Date;
  moneda: string;
}

/**
 * Devuelve el precio más reciente para un cultivo específico, priorizando
 * la posición DISPONIBLE (spot). Filtra por cultivo en base de datos sin
 * traer toda la tabla de precios.
 */
export async function obtenerUltimoPrecioCultivo(
  cultivoInput: string,
): Promise<UltimoPrecioCultivo | null> {
  let cultivo: CultivoMercado;
  try {
    cultivo = normalizarCultivoMercado(cultivoInput);
  } catch {
    return null;
  }

  const spot = await prisma.precio.findFirst({
    where: { cultivo, posicion: POSICION_SPOT },
    orderBy: { fecha: 'desc' },
    select: { valor: true, fecha: true, moneda: true },
  });

  if (spot) return spot;

  return prisma.precio.findFirst({
    where: { cultivo },
    orderBy: { fecha: 'desc' },
    select: { valor: true, fecha: true, moneda: true },
  });
}

