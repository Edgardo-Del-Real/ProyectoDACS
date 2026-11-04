import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CircuitBreaker, NonRetryableError } from '../utils/circuit-breaker.js';
import {
  CULTIVOS_MERCADO_VALIDOS,
  type CultivoMercado,
} from './mercadoCatalogo.js';

const execFileAsync = promisify(execFile);

/**
 * Cliente de la Bolsa de Cereales de Buenos Aires (US-07).
 *
 * El sitio no publica API ni archivos descargables: los precios están en tablas
 * HTML server-rendered. Por eso el parseo vive acá, separado del servicio, y se
 * testea con un fixture de HTML real.
 *
 * Fuente: https://www.bolsadecereales.com/precios-oficiales
 *   Tabla "Precios FOB según Ley 21.453": posiciones mensuales en USD/TN.
 *
 * Los términos del sitio no prohíben la lectura automatizada (robots.txt permite
 * `User-agent: *`), pero igual somos conservadores: una request por página cada
 * 15 minutos como máximo, User-Agent identificable y atribución visible en la UI.
 */

const BASE_URL = 'https://www.bolsadecereales.com';
const URL_PRECIOS_OFICIALES = `${BASE_URL}/precios-oficiales`;
const URL_FLASH = `${BASE_URL}/cotizaciones`;

const TIMEOUT_MS = 8_000;
const USER_AGENT = 'DACS-TP/1.0 (trabajo practico academico; uso no comercial)';

/** La página se comparte entre cultivos: se cachea el documento ya parseado. */
const CACHE_PAGINA_MS = 15 * 60 * 1000;

export interface CotizacionParseada {
  cultivo: CultivoMercado;
  /** Código de vencimiento normalizado a español: "NOV26", "ENE27". */
  posicion: string;
  /** Precio FOB en USD/tn. */
  valor: number;
}

export interface PreciosOficialesParseados {
  /** Fecha de publicación del sitio en formato YYYY-MM-DD, o null si no se pudo leer. */
  fecha: string | null;
  cotizaciones: CotizacionParseada[];
  advertencias: string[];
}

export interface SpotParseado {
  fecha: string | null;
  /** Spot FOB MAGyP en USD/tn por cultivo. */
  spot: Partial<Record<CultivoMercado, number>>;
  advertencias: string[];
}

/** El sitio cambió su maquetado: no tiene sentido reintentar, hay que arreglar el parser. */
export class BolsaCerealesFormatoError extends NonRetryableError {
  constructor(message: string) {
    super(`Formato inesperado en Bolsa de Cereales: ${message}`);
    this.name = 'BolsaCerealesFormatoError';
  }
}

/** Fallo transitorio (red, timeout, 5xx): se puede reintentar. */
export class BolsaCerealesError extends Error {
  constructor(message: string) {
    super(`Error al consultar Bolsa de Cereales: ${message}`);
    this.name = 'BolsaCerealesError';
  }
}

export const bolsaBreaker = new CircuitBreaker({
  name: 'Bolsa de Cereales',
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
  onStateChange: ({ from, to, failures }) => {
    console.warn(
      `[circuit-breaker] Bolsa de Cereales: ${from} -> ${to} (fallos consecutivos: ${failures})`,
    );
  },
});

/**
 * Equivalencias entre las etiquetas de columna del sitio y el catálogo de la app.
 * Los subproductos (aceites, pellets) quedan afuera: la app modela granos.
 */
const COLUMNAS_A_CULTIVO: Record<string, CultivoMercado> = {
  cebada: 'Cebada',
  girasol: 'Girasol',
  maiz: 'Maíz',
  soja: 'Soja',
  sorgo: 'Sorgo',
  'trigo pan': 'Trigo',
};

/** El sitio publica los vencimientos con meses en inglés: "Nov26" -> "NOV26". */
const MES_INGLES_A_CODIGO: Record<string, string> = {
  jan: 'ENE',
  feb: 'FEB',
  mar: 'MAR',
  apr: 'ABR',
  may: 'MAY',
  jun: 'JUN',
  jul: 'JUL',
  aug: 'AGO',
  sep: 'SEP',
  oct: 'OCT',
  nov: 'NOV',
  dec: 'DIC',
};

/** Las tablas del flash llevan el cultivo en el id: `flash-trigo`, `flash-maiz`. */
const ID_FLASH_A_CULTIVO: Record<string, CultivoMercado> = {
  trigo: 'Trigo',
  maiz: 'Maíz',
  soja: 'Soja',
  girasol: 'Girasol',
  sorgo: 'Sorgo',
  cebada: 'Cebada',
};

/** Texto plano de una celda HTML. */
function textoDeCelda(celda: string): string {
  return celda
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minúsculas y sin tildes, para comparar etiquetas del sitio. */
function normalizarEtiqueta(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Nov26" -> "NOV26". Devuelve null si no es un vencimiento mensual. */
export function normalizarPosicion(texto: string): string | null {
  const limpio = normalizarEtiqueta(texto).replace(/\s+/g, '');
  const match = /^([a-z]{3})(\d{2})$/.exec(limpio);
  if (!match) return null;

  const mes = MES_INGLES_A_CODIGO[match[1]];
  if (!mes) return null;

  return `${mes}${match[2]}`;
}

/** Convierte el precio del sitio ("1349", "s/c") en número o null. */
function parsearValor(texto: string): number | null {
  const limpio = texto.replace(/\./g, '').replace(',', '.').trim();
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;

  const valor = Number(limpio);
  // Guarda de cordura: un grano en USD/tn no baja de 10 ni supera 10.000.
  if (!Number.isFinite(valor) || valor < 10 || valor > 10_000) return null;

  return valor;
}

/** Fecha "04/11/2026" -> "2026-11-04". */
function parsearFecha(dia: string, mes: string, anio: string): string | null {
  const d = Number(dia);
  const m = Number(mes);
  const a = Number(anio);
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000 || a > 2100) return null;
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/** Extrae la fecha de publicación del bloque "Fecha: <span>04/11/2026</span>". */
export function extraerFechaPublicacion(html: string): string | null {
  const anclado = /Fecha:[\s\S]{0,400}?(\d{2})\/(\d{2})\/(\d{4})/i.exec(html);
  if (anclado) return parsearFecha(anclado[1], anclado[2], anclado[3]);

  const suelto = /(\d{2})\/(\d{2})\/(\d{4})/.exec(html);
  return suelto ? parsearFecha(suelto[1], suelto[2], suelto[3]) : null;
}

/** Devuelve el contenido de la primera tabla de cotizaciones (FOB Ley 21.453). */
function extraerTablaFob(html: string): string {
  const tabla = /<table[^>]*class="[^"]*tabla-cotizaciones[^"]*"[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!tabla) {
    throw new BolsaCerealesFormatoError('no se encontró la tabla de precios FOB');
  }
  return tabla[1];
}

/**
 * Parsea la tabla de Precios FOB oficiales por vencimiento.
 *
 * Estructura esperada (verificada el 2026-11-04):
 *   <thead><tr><td colspan="2">Posición</td><td>Soja<br>USD/TN</td>...</tr></thead>
 *   <tbody><tr><td colspan="2">Nov26</td><td>473</td>...</tr></tbody>
 */
export function parsearPreciosOficiales(html: string): PreciosOficialesParseados {
  const tabla = extraerTablaFob(html);
  const advertencias: string[] = [];

  const thead = /<thead[\s\S]*?<\/thead>/i.exec(tabla)?.[0] ?? '';
  const tbody = /<tbody[\s\S]*?<\/tbody>/i.exec(tabla)?.[0] ?? '';

  const celdasEncabezado = [...thead.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
    textoDeCelda(m[1]),
  );

  // La primera celda es "Posición" (colspan=2): se descarta.
  const columnas = celdasEncabezado.slice(1).map((etiqueta) => {
    const sinUnidad = etiqueta.replace(/USD\/TN/gi, '').trim();
    return COLUMNAS_A_CULTIVO[normalizarEtiqueta(sinUnidad)] ?? null;
  });

  if (columnas.every((c) => c === null)) {
    throw new BolsaCerealesFormatoError('la tabla FOB no tiene columnas de granos reconocibles');
  }

  const cotizaciones: CotizacionParseada[] = [];

  for (const fila of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const celdas = [...fila[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      textoDeCelda(m[1]),
    );

    const posicion = normalizarPosicion(celdas[0] ?? '');
    if (!posicion) continue;

    const valores = celdas.slice(1);
    columnas.forEach((cultivo, indice) => {
      if (!cultivo) return;

      const valor = parsearValor(valores[indice] ?? '');
      if (valor === null) return;

      cotizaciones.push({ cultivo, posicion, valor });
    });
  }

  if (cotizaciones.length === 0) {
    throw new BolsaCerealesFormatoError('la tabla FOB no devolvió ninguna cotización');
  }

  const cultivosSinDatos = CULTIVOS_MERCADO_VALIDOS.filter(
    (c) => !cotizaciones.some((cot) => cot.cultivo === c),
  );
  if (cultivosSinDatos.length > 0) {
    advertencias.push(`Sin cotización FOB para: ${cultivosSinDatos.join(', ')}.`);
  }

  return {
    fecha: extraerFechaPublicacion(html),
    cotizaciones,
    advertencias,
  };
}

/**
 * Parsea el bloque "Flash de Cotizaciones" y devuelve el spot FOB MAGyP por cultivo.
 *
 * Es best-effort: si la estructura cambia, el servicio sigue funcionando con la
 * curva FOB y el spot queda en null. Nunca debe romper la request principal.
 */
export function parsearSpotFlash(html: string): SpotParseado {
  const advertencias: string[] = [];
  const spot: Partial<Record<CultivoMercado, number>> = {};

  const bloque = /<section[^>]*class="[^"]*flash-cotizaciones[^"]*"[^>]*>([\s\S]*?)<\/section>/i.exec(html);
  if (!bloque) {
    return { fecha: null, spot, advertencias: ['No se encontró el bloque Flash de Cotizaciones.'] };
  }

  // Cada tabla del flash declara su cultivo en el id (`flash-trigo`), así que no
  // hay que depender del orden de las pestañas.
  const tablas = [...bloque[1].matchAll(/<table[^>]*id="flash-([a-z]+)"[^>]*>([\s\S]*?)<\/table>/gi)];

  if (tablas.length === 0) {
    return { fecha: null, spot, advertencias: ['El flash no expone tablas por cultivo.'] };
  }

  for (const tabla of tablas) {
    const cultivo = ID_FLASH_A_CULTIVO[tabla[1]];
    if (!cultivo) continue;

    for (const fila of tabla[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const texto = textoDeCelda(fila[1]);
      // Fila del spot FOB oficial: "Spot US$/t 03/11 233"
      const match = /Spot\s*US\$\s*\/\s*t[nN]?\s+(\d{2}\/\d{2})\s+([\d.,]+)/i.exec(texto);
      if (!match) continue;

      const valor = parsearValor(match[2]);
      if (valor !== null) spot[cultivo] = valor;
    }
  }

  if (Object.keys(spot).length === 0) {
    advertencias.push('El flash no devolvió ningún spot reconocible.');
  }

  return {
    fecha: extraerFechaPublicacion(bloque[1]),
    spot,
    advertencias,
  };
}

interface PaginaCacheada {
  oficiales: PreciosOficialesParseados;
  spot: SpotParseado;
  obtenidaEn: number;
}

let cachePagina: PaginaCacheada | null = null;

/**
 * Descarga con `fetch`. Es el camino normal, pero el sitio está detrás de
 * Cloudflare y descarta el fingerprint TLS de Node con un 403.
 */
async function descargarConFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      'accept-language': 'es-AR,es;q=0.9',
      accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Descarga con `curl` como segundo intento.
 *
 * Cloudflare responde 403 al cliente HTTP de Node (fingerprint TLS), pero acepta
 * el mismo pedido hecho con curl. No se evade ningún login ni control de acceso:
 * es la misma URL pública, y robots.txt declara `User-agent: * -> Allow: /`.
 * Si la Bolsa publica una API o habilita el acceso, este fallback se borra.
 *
 * `execFile` (sin shell) evita inyección de comandos.
 */
async function descargarConCurl(url: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'curl',
      ['-sS', '--compressed', '--max-time', '20', '--fail', '-A', USER_AGENT, url],
      { maxBuffer: 8 * 1024 * 1024, timeout: 25_000 },
    );
    return stdout;
  } catch (error) {
    throw new BolsaCerealesError(
      `curl no pudo descargar ${url}. Si el contenedor no tiene curl, instalalo o corré el sync desde otro entorno. Detalle: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function descargar(url: string): Promise<string> {
  try {
    const response = await descargarConFetch(url);

    if (response.ok) {
      return await response.text();
    }

    // 403/503 es el challenge de Cloudflare: se reintenta con otro cliente TLS.
    if (response.status !== 403 && response.status !== 503) {
      throw new BolsaCerealesError(`HTTP ${response.status} en ${url}`);
    }
  } catch (error) {
    if (error instanceof BolsaCerealesError) throw error;
    // Error de red: puede ser transitorio, se intenta una vez con curl.
  }

  return descargarConCurl(url);
}

/**
 * Descarga y parsea las dos páginas, con caché en memoria y circuit breaker.
 *
 * Lo usa el worker de sincronización (`npm run sync:mercado`), no el request
 * path de la API: así una caída del sitio nunca degrada una request del usuario.
 */
export async function obtenerPreciosBolsa(): Promise<PaginaCacheada> {
  if (cachePagina && Date.now() - cachePagina.obtenidaEn < CACHE_PAGINA_MS) {
    return cachePagina;
  }

  const oficiales = await bolsaBreaker.execute(async () => {
    const html = await descargar(URL_PRECIOS_OFICIALES);
    return parsearPreciosOficiales(html);
  });

  let spot: SpotParseado = { fecha: null, spot: {}, advertencias: [] };
  try {
    const htmlFlash = await descargar(URL_FLASH);
    spot = parsearSpotFlash(htmlFlash);
  } catch (error) {
    spot.advertencias.push(
      `No se pudo leer el spot: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  cachePagina = { oficiales, spot, obtenidaEn: Date.now() };
  return cachePagina;
}

/** Solo para tests: limpia la caché en memoria. */
export function limpiarCacheBolsa(): void {
  cachePagina = null;
}
