import { NonRetryableError } from '../utils/circuit-breaker.js';

/**
 * Catálogo único de cultivos con mercado de granos.
 *
 * Vive en su propio módulo para que el parser de la Bolsa, el servicio y la API
 * compartan la misma lista: antes había cuatro copias (constante del servicio,
 * array en la vista, endpoint y catálogo de Prisma).
 */
export const CULTIVOS_MERCADO_VALIDOS = [
  'Soja',
  'Maíz',
  'Trigo',
  'Girasol',
  'Sorgo',
  'Cebada',
] as const;

export type CultivoMercado = (typeof CULTIVOS_MERCADO_VALIDOS)[number];

/** Cultivo pedido por el cliente que no tiene mercado modelado. */
export class MercadoClientError extends NonRetryableError {
  constructor(message: string) {
    super(`Error en consulta de mercado: ${message}`);
    this.name = 'MercadoClientError';
  }
}

/** Normaliza "soja 1ra", "MAÍZ tardío" o "trigo pan" al cultivo de mercado. */
export function normalizarCultivoMercado(nombre: string): CultivoMercado {
  const norm = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (norm.includes('soja')) return 'Soja';
  if (norm.includes('maiz')) return 'Maíz';
  if (norm.includes('trigo')) return 'Trigo';
  if (norm.includes('girasol')) return 'Girasol';
  if (norm.includes('sorgo')) return 'Sorgo';
  if (norm.includes('cebada')) return 'Cebada';

  throw new MercadoClientError(`Cultivo no soportado para cotizaciones de mercado: "${nombre}"`);
}

const MESES_CODIGOS_VALIDOS = new Set([
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
]);

/**
 * Valida la posición contra las posiciones conocidas:
 * "DISPONIBLE" o un código mensual válido de dos dígitos de año (ej. "NOV26", "ENE27").
 */
export function validarPosicionMercado(posicionInput: string): string {
  const limpia = posicionInput.toUpperCase().trim();
  if (limpia === 'DISPONIBLE') return 'DISPONIBLE';

  const match = /^([A-Z]{3})(\d{2})$/.exec(limpia);
  if (match && MESES_CODIGOS_VALIDOS.has(match[1])) {
    return limpia;
  }

  throw new MercadoClientError(
    `Posición "${posicionInput}" no válida. Debe ser DISPONIBLE o un vencimiento mensual (ej. NOV26).`,
  );
}
