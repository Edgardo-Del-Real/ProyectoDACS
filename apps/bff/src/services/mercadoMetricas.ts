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

const aFechaISO = (d: Date): string => d.toISOString().split('T')[0];

/** Feriados nacionales fijos comunes en Argentina (MM-DD) */
const FERIADOS_FIJOS_ARG: ReadonlySet<string> = new Set([
  '01-01', // Año Nuevo
  '03-24', // Memoria, Verdad y Justicia
  '04-02', // Malvinas
  '05-01', // Trabajador
  '05-25', // Revolución de Mayo
  '06-20', // Belgrano
  '07-09', // Independencia
  '12-08', // Inmaculada Concepción
  '12-25', // Navidad
]);

/**
 * Determina si una cotización es stale considerando días hábiles y feriados.
 * Se considera stale solo si pasaron más de 1 día hábil desde la fecha de publicación.
 * Fines de semana (sábado y domingo) y feriados no suman días hábiles transcurridos.
 */
export function esCotizacionStale(
  fechaPublicacion: Date | string,
  fechaReferencia: Date = new Date(),
  feriadosAdicionales: Set<string> = new Set(),
): boolean {
  const pub = typeof fechaPublicacion === 'string'
    ? new Date(`${fechaPublicacion.split('T')[0]}T00:00:00.000Z`)
    : new Date(`${fechaPublicacion.toISOString().split('T')[0]}T00:00:00.000Z`);

  const ref = new Date(`${fechaReferencia.toISOString().split('T')[0]}T00:00:00.000Z`);

  if (ref.getTime() <= pub.getTime()) return false;

  let diasHabiles = 0;
  const cursor = new Date(pub);

  while (true) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getTime() > ref.getTime()) break;

    const diaSemana = cursor.getUTCDay(); // 0 = Domingo, 6 = Sábado
    if (diaSemana === 0 || diaSemana === 6) continue;

    const iso = aFechaISO(cursor);
    const mmdd = iso.slice(5);
    if (FERIADOS_FIJOS_ARG.has(mmdd) || feriadosAdicionales.has(iso)) continue;

    diasHabiles++;
    if (diasHabiles > 1) return true;
  }

  return diasHabiles > 1;
}
