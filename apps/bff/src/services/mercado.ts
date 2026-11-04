import { prisma } from '../db.js';
import { obtenerPreciosBolsa } from './bolsaCereales.js';
import {
  CULTIVOS_MERCADO_VALIDOS,
  MercadoClientError,
  normalizarCultivoMercado,
  type CultivoMercado,
} from './mercadoCatalogo.js';
import {
  calcularMetricasTendencia,
  claveOrdenPosicion,
  generarDescripcionPosicion,
  type SerieHistoricaPunto,
} from './mercadoMetricas.js';

export {
  CULTIVOS_MERCADO_VALIDOS,
  MercadoClientError,
  normalizarCultivoMercado,
  generarDescripcionPosicion,
  calcularMetricasTendencia,
};
export type { CultivoMercado, SerieHistoricaPunto };

/** Fuente única de los precios: precios oficiales FOB de la Bolsa de Cereales. */
export const FUENTE_BOLSA = 'Bolsa de Cereales de Buenos Aires (FOB Ley 21.453)';

/** El spot FOB se guarda como una posición más, para no tener dos modelos. */
const POSICION_SPOT = 'DISPONIBLE';

/** Pasado este tiempo el dato se considera desactualizado para la UI. */
const ANTIGUEDAD_MAXIMA_MS = 24 * 60 * 60 * 1000;

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

/**
 * Descarga los precios oficiales y los persiste.
 *
 * Se llama desde el servicio cuando el dato está vencido, o desde un cron si en
 * algún momento se quiere desacoplar del request. Es idempotente por la clave
 * única (cultivo, posicion, fecha, fuente).
 */
export async function sincronizarDesdeBolsa(): Promise<{
  filas: number;
  advertencias: string[];
}> {
  const { oficiales, spot } = await obtenerPreciosBolsa();

  const fechaOficiales = oficiales.fecha ?? aFechaISO(new Date());
  const fechaSpot = spot.fecha ?? fechaOficiales;

  const filas: Array<{
    cultivo: string;
    posicion: string;
    fecha: Date;
    fuente: string;
    valor: number;
    moneda: string;
  }> = oficiales.cotizaciones.map((c) => ({
    cultivo: c.cultivo,
    posicion: c.posicion,
    fecha: aFecha(fechaOficiales),
    fuente: FUENTE_BOLSA,
    valor: c.valor,
    moneda: 'USD',
  }));

  for (const cultivo of CULTIVOS_MERCADO_VALIDOS) {
    const valor = spot.spot[cultivo];
    if (typeof valor !== 'number') continue;

    filas.push({
      cultivo,
      posicion: POSICION_SPOT,
      fecha: aFecha(fechaSpot),
      fuente: FUENTE_BOLSA,
      valor,
      moneda: 'USD',
    });
  }

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

  return {
    filas: filas.length,
    advertencias: [...oficiales.advertencias, ...spot.advertencias],
  };
}

/**
 * Cotizaciones vigentes del cultivo: spot y curva de vencimientos.
 *
 * Estrategia de caché: si el último dato guardado tiene más de 6 h se refresca
 * contra la Bolsa; si el refresco falla, se sirve lo que hay con `stale: true`.
 * No inventa datos: sin fuente disponible y sin histórico, devuelve vacío.
 */
export async function obtenerCotizacionesMercado(
  cultivoInput: string,
): Promise<MercadoResumenResponse> {
  const cultivo = normalizarCultivoMercado(cultivoInput);
  const advertencias: string[] = [];

  const filas = await prisma.precio.findMany({
    where: { cultivo },
    orderBy: { fecha: 'desc' },
    take: 200,
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
      advertencias: [
        `Todavía no hay cotizaciones sincronizadas. Ejecutá \`${COMANDO_SINCRONIZACION}\`.`,
      ],
    };
  }

  const fechaUltima = filas[0].fecha;
  const actuales = filas.filter((f) => f.fecha.getTime() === fechaUltima.getTime());

  const variacion = (posicion: string, valor: number): number => {
    const anterior = filas.find(
      (f) => f.posicion === posicion && f.fecha.getTime() < fechaUltima.getTime(),
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
      variacionDiaPct: variacion(fila.posicion, fila.valor),
    }))
    .sort((a, b) => claveOrdenPosicion(a.posicion) - claveOrdenPosicion(b.posicion));

  const spot = cotizaciones.find((c) => c.posicion === POSICION_SPOT) ?? null;
  const futuros = cotizaciones.filter((c) => c.posicion !== POSICION_SPOT);

  const antiguedad = Date.now() - fechaUltima.getTime();

  return {
    cultivo,
    cultivosDisponibles: [...CULTIVOS_MERCADO_VALIDOS],
    cotizaciones,
    spotActual: spot?.valor ?? null,
    // Ya vienen ordenados por fecha real, así que el primero es el más cercano.
    futuroCercano: futuros[0] ?? null,
    ultimaActualizacion: aFechaISO(fechaUltima),
    stale: antiguedad > ANTIGUEDAD_MAXIMA_MS,
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
  const posicion = posicionInput.toUpperCase().trim();

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
    stale: !ultimoPunto || Date.now() - aFecha(ultimoPunto.fecha).getTime() > ANTIGUEDAD_MAXIMA_MS,
  };
}
