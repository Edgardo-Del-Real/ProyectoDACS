import {
  codigoFamilia,
  normalizarTexto,
  parsearCampania,
} from './rotacion.js';
import type { CultivoCatalogoItem, ReglaTransicionItem } from './rotacion.js';

import type { PronosticoDia } from './openmeteo.js';

export type { PronosticoDia };

export type FuenteClima = 'live' | 'cache' | 'no_disponible';
export type FuentePrecio = 'bd' | 'simulado' | 'no_disponible';

export interface ClimaDisponible {
  fuente: FuenteClima;
  antiguedadHoras: number | null;
  dias: PronosticoDia[];
}

export interface PrecioDisponible {
  fuente: FuentePrecio;
  antiguedadDias: number | null;
  moneda: string;
  valores: Record<string, number>;
}

export interface RegistroHistorial {
  cultivo: string;
  campania: string;
}

export interface FactorPuntaje {
  nombre: 'rotacion' | 'clima' | 'precio';
  peso: number;
  valor: number;
  aporte: number;
  motivo: string;
}

export interface CandidatoPuntaje {
  cultivo: string;
  familiaBotanica: string;
  puntaje: number;
  motivo: string;
  factores: FactorPuntaje[];
  excluido: boolean;
  motivoExclusion: string | null;
}

export interface ResultadoRecomendacion {
  recomendacion: CandidatoPuntaje | null;
  alternativas: CandidatoPuntaje[];
  cultivosEvaluados: CandidatoPuntaje[];
  pesosAplicados: { rotacion: number; clima: number; precio: number };
  tieneHistorial: boolean;
  ultimoCultivo: {
    cultivo: string;
    campania: string;
    familiaBotanica: string | null;
  } | null;
  sugerencia: string | null;
  advertencias: string[];
}

const PESO_ROTACION = 0.4;
const PESO_CLIMA = 0.35;
const PESO_PRECIO = 0.25;

const clamp = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

export const round1 = (valor: number): number => Math.round(valor * 10) / 10;

export function esPronosticoValido(datos: unknown): datos is PronosticoDia[] {
  if (!Array.isArray(datos) || datos.length === 0) return false;
  return datos.every(
    (d) =>
      typeof d === 'object' &&
      d !== null &&
      typeof (d as { tempMin?: unknown }).tempMin === 'number' &&
      !Number.isNaN((d as { tempMin?: unknown }).tempMin),
  );
}

export function calcularDiasConRiesgoHelada(
  tempMinCritica: number | null | undefined,
  dias: PronosticoDia[],
): number | null {
  if (tempMinCritica == null) return null;
  return dias.filter((d) => d.tempMin <= tempMinCritica).length;
}

/** Corta un texto en su primera oración para no inflar los motivos expuestos. */
function primeraOracion(texto: string): string {
  const match = texto.trim().match(/^[^.!?]*[.!?]?/);
  return (match?.[0] ?? texto).trim();
}

interface EvaluacionRotacion {
  valor: number;
  excluido: boolean;
  motivo: string;
}

function evaluarRotacion(params: {
  item: CultivoCatalogoItem;
  ultimo: RegistroHistorial;
  itemUltimo: CultivoCatalogoItem;
  reglasPorPar: Map<string, ReglaTransicionItem>;
  anioVigente: number;
}): EvaluacionRotacion {
  const { item, ultimo, itemUltimo, reglasPorPar, anioVigente } = params;
  const anterior = ultimo.cultivo;
  const anioUltimo = parsearCampania(ultimo.campania);
  const anioObjetivo = anioVigente + 1;
  const aniosEspera = anioUltimo === null ? null : Math.max(0, anioObjetivo - anioUltimo);

  const clave = `${normalizarTexto(anterior)}->${normalizarTexto(item.nombre)}`;
  const regla = reglasPorPar.get(clave);

  if (regla) {
    const valorBase = clamp(40 + regla.prioridadSugerencia * 12, 0, 100);
    if (aniosEspera !== null && aniosEspera < regla.aniosEsperaMin) {
      return {
        valor: 10,
        excluido: true,
        motivo: `Sucesión ${anterior} → ${item.nombre} requiere ${regla.aniosEsperaMin} año(s) de espera; pasaron ${aniosEspera}.`,
      };
    }
    return {
      valor: valorBase,
      excluido: false,
      motivo: `Sucesor recomendado de ${anterior} (prioridad ${regla.prioridadSugerencia}). ${primeraOracion(regla.efectoSuelo)}`,
    };
  }

  const mismaFamilia =
    codigoFamilia(itemUltimo.familiaBotanica) === codigoFamilia(item.familiaBotanica);
  const esperaFamilia = item.aniosEsperaMismaFamilia ?? 0;

  if (mismaFamilia && aniosEspera !== null && aniosEspera < esperaFamilia) {
    return {
      valor: 10,
      excluido: true,
      motivo: `La familia ${item.familiaBotanica} requiere ${esperaFamilia} año(s) de espera tras ${anterior}; pasaron ${aniosEspera}.`,
    };
  }

  return {
    valor: 55,
    excluido: false,
    motivo: `Sin regla explícita; alterna de familia respecto de ${anterior}.`,
  };
}

interface EvaluacionClima {
  valor: number;
  motivo: string;
}

function evaluarClima(item: CultivoCatalogoItem, clima: ClimaDisponible): EvaluacionClima {
  if (item.tempMinCritica == null) {
    return {
      valor: 70,
      motivo: `Sin umbral de helada configurado para ${item.nombre}; el clima se puntúa de forma neutra.`,
    };
  }

  const umbral = item.tempMinCritica;
  const tempMinProxima = Math.min(...clima.dias.map((d) => d.tempMin));
  const diasRiesgo = clima.dias.filter((d) => d.tempMin <= umbral).length;

  if (diasRiesgo > 0) {
    return {
      valor: clamp(45 - diasRiesgo * 15, 0, 45),
      motivo: `Riesgo de helada: ${diasRiesgo} día(s) con mínima ≤ ${umbral} °C (mínima pronosticada ${tempMinProxima} °C).`,
    };
  }

  return {
    valor: clamp(60 + (tempMinProxima - umbral) * 8, 60, 100),
    motivo: `Sin riesgo de helada: mínima de 7 días ${tempMinProxima} °C contra umbral ${umbral} °C.`,
  };
}

interface EvaluacionPrecio {
  valor: number;
  motivo: string;
}

function evaluarPrecio(params: {
  item: CultivoCatalogoItem;
  preciosPorCultivo: Map<string, number>;
  minimo: number | null;
  maximo: number | null;
  precios: PrecioDisponible;
  totalValoresPrecio: number;
}): EvaluacionPrecio | null {
  const { item, preciosPorCultivo, minimo, maximo, precios, totalValoresPrecio } = params;
  const valorPrecio = preciosPorCultivo.get(normalizarTexto(item.nombre));

  const preciosDiferenciados =
    totalValoresPrecio > 1 && minimo !== null && maximo !== null && maximo !== minimo;

  // Mejora 5: Si hay dispersión de precios y a este cultivo le falta precio, se excluye el factor precio
  if (preciosDiferenciados && valorPrecio === undefined) {
    return null;
  }

  // Mejora 5: Si hay un solo precio o todos son iguales, ningún cultivo queda favorecido (neutro = 50)
  if (!preciosDiferenciados) {
    return {
      valor: 50,
      motivo:
        valorPrecio !== undefined
          ? `Precio de referencia ${valorPrecio} ${precios.moneda} (fuente: ${precios.fuente}); precios homogéneos o sin dispersión en el mercado (factor neutro).`
          : `Sin precio de referencia para ${item.nombre}; precios sin dispersión en el mercado (factor neutro).`,
    };
  }

  const valor = round1(20 + (80 * (valorPrecio! - minimo)) / (maximo - minimo));
  let motivo = `Precio de referencia ${valorPrecio} ${precios.moneda} (fuente: ${precios.fuente}).`;
  if (precios.antiguedadDias != null && precios.antiguedadDias > 0) {
    motivo += ` Último dato de hace ${precios.antiguedadDias} día(s).`;
  }

  return { valor, motivo };
}

export function calcularRecomendacion(input: {
  catalogo: CultivoCatalogoItem[];
  reglas: ReglaTransicionItem[];
  historial: RegistroHistorial[];
  clima: ClimaDisponible;
  precios: PrecioDisponible;
  anioVigente: number;
}): ResultadoRecomendacion {
  const { catalogo, reglas, historial, clima, precios, anioVigente } = input;

  const ultimo = historial.length > 0 ? historial[0] : null;
  const itemUltimo = ultimo
    ? catalogo.find((c) => normalizarTexto(c.nombre) === normalizarTexto(ultimo.cultivo)) ?? null
    : null;
  const tieneHistorial = historial.length > 0;

  const disponibleRotacion = tieneHistorial && itemUltimo !== null;
  const disponibleClima = clima.dias.length > 0;
  const disponiblePrecio = Object.keys(precios.valores).length > 0;

  const sumaPesos =
    (disponibleRotacion ? PESO_ROTACION : 0) +
    (disponibleClima ? PESO_CLIMA : 0) +
    (disponiblePrecio ? PESO_PRECIO : 0);

  const pesosAplicados = {
    rotacion: sumaPesos > 0 && disponibleRotacion ? PESO_ROTACION / sumaPesos : 0,
    clima: sumaPesos > 0 && disponibleClima ? PESO_CLIMA / sumaPesos : 0,
    precio: sumaPesos > 0 && disponiblePrecio ? PESO_PRECIO / sumaPesos : 0,
  };

  const sugerencia = tieneHistorial
    ? null
    : 'Cargá tus campañas anteriores para que la recomendación respete la rotación de cultivos.';

  const advertencias: string[] = [];
  if (ultimo && parsearCampania(ultimo.campania) === null) {
    advertencias.push(
      `Campaña "${ultimo.campania}" no válida: no se pudo calcular el tiempo de espera entre cultivos.`,
    );
  }
  if (!disponibleClima) {
    advertencias.push('Clima no disponible: la recomendación se calculó sin el factor climático.');
  }
  if (precios.fuente === 'simulado') {
    advertencias.push('Precios de referencia simulados: todavía no hay ingesta real de mercado.');
  }
  if (
    precios.fuente === 'bd' &&
    precios.antiguedadDias != null &&
    precios.antiguedadDias > 7
  ) {
    advertencias.push('Los precios de referencia tienen más de 7 días de antigüedad.');
  }

  const ultimoCultivo = ultimo
    ? {
        cultivo: ultimo.cultivo,
        campania: ultimo.campania,
        familiaBotanica: itemUltimo?.familiaBotanica ?? null,
      }
    : null;

  if (sumaPesos === 0) {
    advertencias.push(
      'No hay datos suficientes para puntuar cultivos: cargá historial, clima o precios de referencia.',
    );
    return {
      recomendacion: null,
      alternativas: [],
      cultivosEvaluados: [],
      pesosAplicados,
      tieneHistorial,
      ultimoCultivo,
      sugerencia,
      advertencias,
    };
  }

  const reglasPorPar = new Map<string, ReglaTransicionItem>();
  for (const regla of reglas) {
    reglasPorPar.set(
      `${normalizarTexto(regla.cultivoAnterior)}->${normalizarTexto(regla.cultivoSiguiente)}`,
      regla,
    );
  }

  const preciosPorCultivo = new Map<string, number>();
  for (const [nombre, valor] of Object.entries(precios.valores)) {
    preciosPorCultivo.set(normalizarTexto(nombre), valor);
  }

  const valoresPrecio = catalogo
    .map((item) => preciosPorCultivo.get(normalizarTexto(item.nombre)))
    .filter((valor): valor is number => valor !== undefined);
  const minimo = valoresPrecio.length > 0 ? Math.min(...valoresPrecio) : null;
  const maximo = valoresPrecio.length > 0 ? Math.max(...valoresPrecio) : null;

  const cultivosEvaluados: CandidatoPuntaje[] = catalogo.map((item) => {
    const factores: FactorPuntaje[] = [];

    let rotacion: EvaluacionRotacion | null = null;
    if (disponibleRotacion && ultimo && itemUltimo) {
      rotacion = evaluarRotacion({
        item,
        ultimo,
        itemUltimo,
        reglasPorPar,
        anioVigente,
      });
    }

    let climaEvaluado: EvaluacionClima | null = null;
    if (disponibleClima) {
      climaEvaluado = evaluarClima(item, clima);
    }

    let precioEvaluado: EvaluacionPrecio | null = null;
    if (disponiblePrecio) {
      precioEvaluado = evaluarPrecio({
        item,
        preciosPorCultivo,
        minimo,
        maximo,
        precios,
        totalValoresPrecio: valoresPrecio.length,
      });
    }

    // Mejora 5: Si al candidato le falta precio y se excluyó, se redistribuyen los pesos
    const tieneRotacion = rotacion !== null;
    const tieneClima = climaEvaluado !== null;
    const tienePrecio = precioEvaluado !== null;

    const sumaPesosCandidato =
      (tieneRotacion ? PESO_ROTACION : 0) +
      (tieneClima ? PESO_CLIMA : 0) +
      (tienePrecio ? PESO_PRECIO : 0);

    const pesoRot =
      sumaPesosCandidato > 0 && tieneRotacion ? PESO_ROTACION / sumaPesosCandidato : 0;
    const pesoCli =
      sumaPesosCandidato > 0 && tieneClima ? PESO_CLIMA / sumaPesosCandidato : 0;
    const pesoPre =
      sumaPesosCandidato > 0 && tienePrecio ? PESO_PRECIO / sumaPesosCandidato : 0;

    if (tieneRotacion && rotacion) {
      factores.push({
        nombre: 'rotacion',
        peso: pesoRot,
        valor: rotacion.valor,
        aporte: round1(rotacion.valor * pesoRot),
        motivo: rotacion.motivo,
      });
    }

    if (tieneClima && climaEvaluado) {
      factores.push({
        nombre: 'clima',
        peso: pesoCli,
        valor: climaEvaluado.valor,
        aporte: round1(climaEvaluado.valor * pesoCli),
        motivo: climaEvaluado.motivo,
      });
    }

    if (tienePrecio && precioEvaluado) {
      factores.push({
        nombre: 'precio',
        peso: pesoPre,
        valor: precioEvaluado.valor,
        aporte: round1(precioEvaluado.valor * pesoPre),
        motivo: precioEvaluado.motivo,
      });
    }

    const motivos: string[] = [];
    if (rotacion) {
      motivos.push(rotacion.motivo);
    } else {
      motivos.push(
        'sin historial de campañas no se aplicó rotación; se combinan clima y precio.',
      );
    }
    if (climaEvaluado) motivos.push(climaEvaluado.motivo);
    if (precioEvaluado) motivos.push(precioEvaluado.motivo);

    // Mejora 6: El puntaje es la suma exacta de los aportes ya redondeados
    const puntaje = round1(
      factores.reduce((total, factor) => total + factor.aporte, 0),
    );
    const excluido = rotacion?.excluido ?? false;

    return {
      cultivo: item.nombre,
      familiaBotanica: item.familiaBotanica,
      puntaje,
      motivo: `${item.nombre}: ${motivos.join(' ')}`,
      factores,
      excluido,
      motivoExclusion: excluido ? rotacion?.motivo ?? null : null,
    };
  });

  cultivosEvaluados.sort((a, b) => {
    if (a.excluido !== b.excluido) return a.excluido ? 1 : -1;

    const porPuntaje = b.puntaje - a.puntaje;
    if (porPuntaje !== 0) return porPuntaje;

    const porPrimerFactor = (b.factores[0]?.valor ?? 0) - (a.factores[0]?.valor ?? 0);
    if (porPrimerFactor !== 0) return porPrimerFactor;

    return a.cultivo.localeCompare(b.cultivo, 'es');
  });

  const noExcluidos = cultivosEvaluados.filter((candidato) => !candidato.excluido);
  const recomendacion = noExcluidos[0] ?? null;

  if (noExcluidos.length === 0 && cultivosEvaluados.length > 0) {
    advertencias.push(
      'Ningún cultivo respeta la rotación con el historial actual; revisá las campañas cargadas.',
    );
  }

  return {
    recomendacion,
    alternativas: noExcluidos.slice(1, 3),
    cultivosEvaluados,
    pesosAplicados,
    tieneHistorial,
    ultimoCultivo,
    sugerencia,
    advertencias,
  };
}
