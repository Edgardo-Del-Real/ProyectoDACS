/**
 * Utilidades puras de presentación y estadística del mercado.
 *
 * Viven separadas del servicio para poder testearlas sin base de datos ni red.
 */

export interface SerieHistoricaPunto {
  fecha: string;
  valor: number;
  posicion: string;
}

const MESES_ES: Record<string, string> = {
  ENE: 'Enero',
  FEB: 'Febrero',
  MAR: 'Marzo',
  ABR: 'Abril',
  MAY: 'Mayo',
  JUN: 'Junio',
  JUL: 'Julio',
  AGO: 'Agosto',
  SEP: 'Septiembre',
  OCT: 'Octubre',
  NOV: 'Noviembre',
  DIC: 'Diciembre',
};

const ORDEN_MES: Record<string, number> = {
  ENE: 1,
  FEB: 2,
  MAR: 3,
  ABR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DIC: 12,
};

/** "NOV26" -> "Noviembre 2026". "DISPONIBLE" -> "Disponible". */
export function generarDescripcionPosicion(posicion: string): string {
  if (posicion === 'DISPONIBLE') return 'Disponible';

  const match = /^([A-Z]{3})(\d{2})$/.exec(posicion);
  if (!match) return posicion;

  const mes = MESES_ES[match[1]];
  if (!mes) return posicion;

  return `${mes} 20${match[2]}`;
}

/**
 * Clave numérica para ordenar vencimientos por fecha real (no alfabéticamente).
 * "NOV26" -> 202611. Las posiciones desconocidas van al final.
 */
export function claveOrdenPosicion(posicion: string): number {
  if (posicion === 'DISPONIBLE') return 0;

  const match = /^([A-Z]{3})(\d{2})$/.exec(posicion);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const mes = ORDEN_MES[match[1]];
  if (!mes) return Number.MAX_SAFE_INTEGER;

  return (2000 + Number(match[2])) * 100 + mes;
}

export interface MetricasTendencia {
  minimo: number;
  maximo: number;
  promedio: number;
  variacionTotalPct: number;
}

/** Estadísticas de una serie ordenada de menor a mayor fecha. */
export function calcularMetricasTendencia(puntos: SerieHistoricaPunto[]): MetricasTendencia {
  if (puntos.length === 0) {
    return { minimo: 0, maximo: 0, promedio: 0, variacionTotalPct: 0 };
  }

  const valores = puntos.map((p) => p.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const promedio = Number((valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(2));

  const primerValor = valores[0];
  const ultimoValor = valores[valores.length - 1];
  // Sin un valor inicial distinto de cero no hay porcentaje que calcular.
  const variacionTotalPct =
    primerValor === 0 ? 0 : Number((((ultimoValor - primerValor) / primerValor) * 100).toFixed(2));

  return { minimo, maximo, promedio, variacionTotalPct };
}
