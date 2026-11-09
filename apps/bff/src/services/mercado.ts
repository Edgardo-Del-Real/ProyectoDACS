import { prisma } from '../db.js';
import { normalizarTexto } from './rotacion.js';

export interface PreciosReferencia {
  fuente: 'bd' | 'simulado';
  antiguedadDias: number | null;
  moneda: string;
  valores: Record<string, number>;
  advertencia: string | null;
}

const MONEDA = 'USD/t';
const PRECIO_SIMULADO_POR_DEFECTO = 200;
const MS_POR_DIA = 86_400_000;

/** Tabla de respaldo (USD/t) para cuando todavía no hay ingesta real de mercado. */
const PRECIOS_SIMULADOS: Record<string, number> = {
  'soja 1ra': 320,
  'maiz tardio': 190,
  'trigo pan': 230,
  girasol: 400,
  'sorgo granifero': 175,
  'cebada cervecera': 210,
};

interface CultivoSolicitado {
  nombre: string;
  normalizado: string;
}

function preciosSimulados(
  solicitados: CultivoSolicitado[],
  advertencia: string,
): PreciosReferencia {
  const valores: Record<string, number> = {};
  for (const { nombre, normalizado } of solicitados) {
    valores[nombre] = PRECIOS_SIMULADOS[normalizado] ?? PRECIO_SIMULADO_POR_DEFECTO;
  }
  return {
    fuente: 'simulado',
    antiguedadDias: null,
    moneda: MONEDA,
    valores,
    advertencia,
  };
}

/**
 * Devuelve el último precio de referencia por cultivo desde la base y, si no hay
 * datos o la consulta falla, cae a una tabla simulada. Solo incluye los cultivos
 * pedidos: los desconocidos de la tabla simulada usan el valor por defecto.
 */
export async function obtenerPreciosReferencia(
  cultivos: string[],
  fecha: Date = new Date(),
): Promise<PreciosReferencia> {
  const solicitados: CultivoSolicitado[] = cultivos.map((nombre) => ({
    nombre,
    normalizado: normalizarTexto(nombre),
  }));

  const filas = await prisma.precio
    .findMany({ orderBy: { fecha: 'desc' } })
    .catch(() => null);

  if (filas === null) {
    return preciosSimulados(
      solicitados,
      'No se pudo leer la base de precios: se usan valores simulados.',
    );
  }

  if (filas.length === 0) {
    return preciosSimulados(
      solicitados,
      'Sin precios en la base: se usan valores simulados.',
    );
  }

  // `orderBy: fecha desc` deja primero la fila más reciente de cada cultivo.
  const masRecientePorCultivo = new Map<string, { valor: number; fecha: Date }>();
  for (const fila of filas) {
    const clave = normalizarTexto(fila.cultivo);
    if (!masRecientePorCultivo.has(clave)) {
      masRecientePorCultivo.set(clave, { valor: fila.valor, fecha: fila.fecha });
    }
  }

  const valores: Record<string, number> = {};
  let fechaMasReciente: Date | null = null;
  for (const { nombre, normalizado } of solicitados) {
    const encontrado = masRecientePorCultivo.get(normalizado);
    if (!encontrado) continue;
    valores[nombre] = encontrado.valor;
    if (fechaMasReciente === null || encontrado.fecha > fechaMasReciente) {
      fechaMasReciente = encontrado.fecha;
    }
  }

  return {
    fuente: 'bd',
    antiguedadDias:
      fechaMasReciente === null
        ? null
        : Math.floor((fecha.getTime() - fechaMasReciente.getTime()) / MS_POR_DIA),
    moneda: MONEDA,
    valores,
    advertencia: null,
  };
}
