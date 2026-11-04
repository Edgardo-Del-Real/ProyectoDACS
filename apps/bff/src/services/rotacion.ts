import { prisma } from '../db.js';

export type FamiliaCodigo = 'POACEAE' | 'FABACEAE' | 'ASTERACEAE' | 'COBERTURA' | 'OTRA';

export interface ReglaTransicionItem {
  cultivoAnterior: string;
  cultivoSiguiente: string;
  aniosEsperaMin: number;
  efectoSuelo: string;
  prioridadSugerencia: number;
}

export interface CultivoCatalogoItem {
  nombre: string;
  familiaBotanica: string;
  cicloDias?: number;
  tempMinCritica?: number;
  efectoSuelo: string;
  aniosEsperaMismaFamilia: number;
  recomendacionSucesion: string;
  fuente: string;
  prioridadBase?: number;
}

/** Los pasos sin recomendación devuelven los campos del cultivo en null. */
export interface PasoRotacion {
  orden: number;
  campania: string;
  estado: 'sugerido' | 'sin_alternativa' | 'datos_insuficientes';
  cultivo: string | null;
  familiaBotanica: string | null;
  aniosEsperaMismaFamilia: number | null;
  efectoSuelo: string | null;
  recomendacionSucesion: string | null;
  motivoSeleccion: string;
  fuente: string | null;
}

export interface PlanRotacionResponse {
  tieneHistorial: boolean;
  ultimoCultivo: {
    campania: string;
    cultivo: string;
    familiaBotanica: string;
  } | null;
  secuencia: PasoRotacion[];
  catalogo: CultivoCatalogoItem[];
  supuestos: string[];
  /** Registros guardados que el motor no pudo usar (campaña inválida o futura). */
  registrosIgnorados: number;
}

export interface RegistroHistorial {
  campania: string;
  cultivo: string;
  createdAt: Date;
}

const FUENTE_INTA_SECUENCIAS =
  'INTA EEA Pergamino / Marcos Juárez — Ensayos de Larga Duración en Secuencias de Cultivos, Rastrojos y Balance de Carbono (inta.gob.ar)';
const FUENTE_INTA_GIRASOL =
  'INTA EEA Balcarce / Manfredi — Guía de Manejo de Girasol y Control Cultural de Sclerotinia y Verticillium (inta.gob.ar)';

/** Cultivos que solo tienen sentido como segundo cultivo de una campaña: no se proponen solos. */
const SOLO_DOBLE_CULTIVO = new Set(['soja 2da']);

/** Tope (en campañas) para el puntaje de "descanso": evita premiar siempre lo que nunca se sembró. */
const TOPE_DESCANSO = 4;

const HORIZONTE_POR_DEFECTO = 4;
const HORIZONTE_MAXIMO = 8;

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function codigoFamilia(familiaBotanica: string): FamiliaCodigo {
  const n = normalizarTexto(familiaBotanica);
  if (
    n.startsWith('graminea') ||
    n.startsWith('poacea') ||
    n.includes('graminea') ||
    n.includes('poacea')
  ) {
    return 'POACEAE';
  }
  if (
    n.startsWith('leguminosa') ||
    n.startsWith('fabacea') ||
    n.includes('leguminosa') ||
    n.includes('fabacea')
  ) {
    return 'FABACEAE';
  }
  if (
    n.startsWith('asteracea') ||
    n.startsWith('compuesta') ||
    n.includes('asteracea')
  ) {
    return 'ASTERACEAE';
  }
  if (n.startsWith('cobertura') || n.includes('descanso') || n.includes('barbecho')) {
    return 'COBERTURA';
  }
  return 'OTRA';
}

function esperaPorDefectoDeFamilia(familia: FamiliaCodigo): number {
  if (familia === 'ASTERACEAE') return 3;
  return 1;
}

function esperaValida(valor: number | null | undefined, respaldo: number): number {
  return valor != null && Number.isFinite(valor) && valor >= 1
    ? Math.ceil(valor)
    : respaldo;
}

function normalizarHorizonte(valor: number | undefined): number {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n) || n < 1) return HORIZONTE_POR_DEFECTO;
  return Math.min(HORIZONTE_MAXIMO, n);
}

/** Admite un año o dos consecutivos: 2025, 2025/26, 2025-26 y 2025/2026. */
export function parsearCampania(texto: string): number | null {
  const match = texto.trim().match(/^(19\d{2}|20\d{2})(?:\s*[/-]\s*(\d{4}|\d{2}))?$/);
  if (!match) return null;
  const inicio = Number(match[1]);
  const fin = match[2];
  if (fin === undefined) return inicio;
  const consecutivo =
    fin.length === 4 ? Number(fin) === inicio + 1 : Number(fin) === (inicio + 1) % 100;
  return consecutivo ? inicio : null;
}

export function normalizarCampania(texto: string): string | null {
  const anio = parsearCampania(texto);
  return anio === null ? null : `${anio}/${anio + 1}`;
}

const formatearCampania = (anioInicio: number): string => `${anioInicio}/${anioInicio + 1}`;

/** La campaña agrícola se considera de julio a junio. */
export function obtenerAnioCampaniaVigente(fecha: Date): number {
  const mes = fecha.getMonth() + 1;
  return mes >= 7 ? fecha.getFullYear() : fecha.getFullYear() - 1;
}

/** Orden dentro de una misma campaña: cultivos de invierno antes que los estivales. */
function ordenCicloEnCampania(nombre: string): number {
  return /\b(trigo|cebada|avena|centeno|colza|raigras|vicia)\b/.test(normalizarTexto(nombre))
    ? 0
    : 1;
}

function esCerealDeInvierno(nombre: string): boolean {
  return /\b(trigo|cebada)\b/.test(normalizarTexto(nombre));
}

/**
 * Equivalencias entre nombres cortos cargados en el frontend (`Trigo`, `Sorgo`, `Cebada`, `Maíz temprano`)
 * y los nombres canónicos del seed en Prisma (`Trigo pan`, `Sorgo granífero`, `Cebada cervecera`, `Maíz tardío`).
 */
const ALIAS_CANONICOS: Record<string, string> = {
  trigo: 'Trigo pan',
  'trigo pan': 'Trigo pan',
  sorgo: 'Sorgo granífero',
  'sorgo granifero': 'Sorgo granífero',
  cebada: 'Cebada cervecera',
  'cebada cervecera': 'Cebada cervecera',
  maiz: 'Maíz tardío',
  'maiz temprano': 'Maíz tardío',
  'maiz tardio': 'Maíz tardío',
  soja: 'Soja 1ra',
  'soja 1ra': 'Soja 1ra',
  'soja 2da': 'Soja 1ra',
  girasol: 'Girasol',
};

export function resolverNombreCanonico(nombre: string): string {
  const n = normalizarTexto(nombre);
  return ALIAS_CANONICOS[n] ?? nombre.trim();
}

export interface DatosCatalogoRotacion {
  catalogo: CultivoCatalogoItem[];
  reglasTransicion: ReglaTransicionItem[];
}

/**
 * Construye el catálogo y las reglas de rotación directamente desde Prisma (`Cultivo` + `ReglaRotacion`),
 * que actúa como única fuente de verdad (sembrada por `apps/bff/prisma/seed.ts`).
 */
export async function obtenerDatosCatalogoRotacion(): Promise<DatosCatalogoRotacion> {
  const guardados = await prisma.cultivo.findMany({
    include: {
      reglasOrigen: {
        include: { cultivoSiguiente: true },
      },
      reglasDestino: {
        include: { cultivoAnterior: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const catalogo: CultivoCatalogoItem[] = guardados.map((c) => {
    const familiaCodigo = codigoFamilia(c.familiaBotanica);
    const esperaBase = esperaPorDefectoDeFamilia(familiaCodigo);

    // Reglas donde se repite el mismo cultivo o la misma familia botánica
    const reglasMismaFamilia = c.reglasOrigen.filter(
      (r) =>
        r.cultivoSiguienteId === c.id ||
        codigoFamilia(r.cultivoSiguiente.familiaBotanica) === familiaCodigo,
    );
    const maxEsperaRegla = reglasMismaFamilia.reduce(
      (max, r) => Math.max(max, r.aniosEsperaMin),
      0,
    );

    // Mejor regla donde este cultivo es el destino sugerido (para su efectoSuelo y prioridad base)
    const entradasRecomendadas = c.reglasDestino
      .filter((r) => r.cultivoAnteriorId !== c.id && r.aniosEsperaMin === 0)
      .sort((a, b) => b.prioridadSugerencia - a.prioridadSugerencia);
    const mejorEntrada = entradasRecomendadas[0];

    // Mejores sucesores desde este cultivo hacia otras familias sin restricción de espera
    const salidasRecomendadas = c.reglasOrigen
      .filter(
        (r) =>
          r.cultivoSiguienteId !== c.id &&
          r.aniosEsperaMin === 0 &&
          r.prioridadSugerencia > 1,
      )
      .sort((a, b) => b.prioridadSugerencia - a.prioridadSugerencia);

    const nombresSucesores = salidasRecomendadas.map((r) => r.cultivoSiguiente.nombre);
    const recomendacionSucesion =
      nombresSucesores.length > 0
        ? `Sucesores recomendados en rotación: ${nombresSucesores.join(', ')}.`
        : 'Alternar con otra familia botánica en la campaña siguiente.';

    return {
      nombre: c.nombre,
      familiaBotanica: c.familiaBotanica || 'Otra / No catalogada',
      cicloDias: c.cicloDias,
      tempMinCritica: c.tempMinCritica,
      efectoSuelo:
        mejorEntrada?.efectoSuelo ??
        salidasRecomendadas[0]?.efectoSuelo ??
        'Cultivo registrado en el catálogo agronómico.',
      aniosEsperaMismaFamilia: esperaValida(maxEsperaRegla, esperaBase),
      recomendacionSucesion,
      fuente:
        familiaCodigo === 'ASTERACEAE' ? FUENTE_INTA_GIRASOL : FUENTE_INTA_SECUENCIAS,
      prioridadBase: mejorEntrada?.prioridadSugerencia ?? 3,
    };
  });

  const reglasTransicion: ReglaTransicionItem[] = [];
  for (const c of guardados) {
    for (const r of c.reglasOrigen) {
      reglasTransicion.push({
        cultivoAnterior: c.nombre,
        cultivoSiguiente: r.cultivoSiguiente.nombre,
        aniosEsperaMin: r.aniosEsperaMin,
        efectoSuelo: r.efectoSuelo,
        prioridadSugerencia: r.prioridadSugerencia,
      });
    }
  }

  return { catalogo, reglasTransicion };
}

export async function obtenerCatalogoRotacion(): Promise<CultivoCatalogoItem[]> {
  const { catalogo } = await obtenerDatosCatalogoRotacion();
  return catalogo;
}

interface CultivoHistorialResuelto {
  nombre: string;
  nombreCanonico: string;
  familiaBotanica: string;
}

const ESPECIES_POR_FAMILIA = [
  {
    patron: /\b(maiz|trigo|sorgo|cebada|avena|centeno|mijo|raigras|triticale)\b/,
    familia: 'Gramínea',
  },
  {
    patron: /\b(soja|vicia|arveja|poroto|lenteja|garbanzo|alfalfa|trebol|mani)\b/,
    familia: 'Leguminosa',
  },
  {
    patron: /\b(girasol|cartamo)\b/,
    familia: 'Asterácea',
  },
];

function resolverParte(parte: string, catalogo: CultivoCatalogoItem[]): CultivoHistorialResuelto[] {
  const normalizado = normalizarTexto(parte);
  const canonicoBuscado = normalizarTexto(resolverNombreCanonico(parte));

  const exacto =
    catalogo.find((c) => normalizarTexto(c.nombre) === normalizado) ??
    catalogo.find((c) => normalizarTexto(c.nombre) === canonicoBuscado);

  if (exacto && !/\b(pastura|barbecho)\b/.test(normalizado)) {
    return [
      {
        nombre: parte.trim(),
        nombreCanonico: exacto.nombre,
        familiaBotanica: exacto.familiaBotanica,
      },
    ];
  }

  const encontrados: CultivoHistorialResuelto[] = [];
  let sinIdentificar = normalizado;
  for (const { patron, familia } of ESPECIES_POR_FAMILIA) {
    if (patron.test(normalizado)) {
      const canonico = resolverNombreCanonico(parte.trim());
      encontrados.push({
        nombre: parte.trim(),
        nombreCanonico: canonico,
        familiaBotanica: familia,
      });
      sinIdentificar = sinIdentificar.replace(new RegExp(patron.source, 'g'), ' ');
    }
  }

  // El texto restante puede contener otra especie desconocida, no solo calificadores.
  sinIdentificar = sinIdentificar
    .replace(
      /\b(de|pastura|cobertura|servicio|servicios|consociada|consociado|granifero|forrajero|cervecera|temprano|tardio|invernal|estival|pan|primera|segunda|1ra|2da)\b/g,
      ' ',
    )
    .replace(/\p{P}/gu, ' ');

  if (encontrados.length === 0 || sinIdentificar.trim()) {
    encontrados.push({
      nombre: parte.trim() || 'Cultivo previo',
      nombreCanonico: parte.trim() || 'Cultivo previo',
      familiaBotanica: 'Otra / No catalogada',
    });
  }
  return encontrados;
}

function resolverCultivosEnTexto(
  texto: string,
  catalogo: CultivoCatalogoItem[],
): CultivoHistorialResuelto[] {
  const partes = texto
    .split(/[/+,;&]|\s+(?:y|e|con)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return (partes.length > 0 ? partes : [texto]).flatMap((parte) => resolverParte(parte, catalogo));
}

interface AnioTimeline {
  familias: Set<FamiliaCodigo>;
  cultivos: string[];
  cultivosCanonicos: string[];
  familiasTexto: string[];
  familiaDesconocida: boolean;
}

export interface ParametrosPlan {
  registros: RegistroHistorial[];
  catalogo: CultivoCatalogoItem[];
  reglasTransicion?: ReglaTransicionItem[];
  fecha?: Date;
  horizonteAnios?: number;
  cultivosExcluidos?: string[];
}

/** Los huecos entre años del historial cuentan como campañas sin cultivo. */
export function calcularPlanRotacion(params: ParametrosPlan): PlanRotacionResponse {
  const { registros } = params;
  const fecha = params.fecha ?? new Date();
  const horizonte = normalizarHorizonte(params.horizonteAnios);
  const excluidosSet = new Set(
    (params.cultivosExcluidos ?? [])
      .flatMap((nombre) => [normalizarTexto(nombre), normalizarTexto(resolverNombreCanonico(nombre))])
      .filter(Boolean),
  );
  const catalogo = params.catalogo.map((item) => ({ ...item }));
  const reglasTransicion = params.reglasTransicion ?? [];
  const supuestos: string[] = [];

  const esperaPorFamilia = new Map<FamiliaCodigo, number>();
  for (const c of catalogo) {
    const familia = codigoFamilia(c.familiaBotanica);
    const respaldo = esperaPorDefectoDeFamilia(familia);
    esperaPorFamilia.set(
      familia,
      Math.max(
        esperaPorFamilia.get(familia) ?? respaldo,
        esperaValida(c.aniosEsperaMismaFamilia, respaldo),
      ),
    );
  }

  // Solo se proponen cultivos productivos del catálogo con familia identificable
  // y que no hayan sido excluidos por el productor para este lote.
  const candidatos = catalogo.filter((c) => {
    const nombreNorm = normalizarTexto(c.nombre);
    if (excluidosSet.has(nombreNorm)) {
      return false;
    }
    const familia = codigoFamilia(c.familiaBotanica);
    return (
      !SOLO_DOBLE_CULTIVO.has(nombreNorm) &&
      familia !== 'OTRA' &&
      familia !== 'COBERTURA'
    );
  });

  const mapaTransiciones = new Map<string, ReglaTransicionItem>();
  for (const r of reglasTransicion) {
    const clave = `${normalizarTexto(r.cultivoAnterior)}->${normalizarTexto(r.cultivoSiguiente)}`;
    mapaTransiciones.set(clave, r);
  }

  const anioVigente = obtenerAnioCampaniaVigente(fecha);

  const porAnio = new Map<number, RegistroHistorial[]>();
  let invalidos = 0;
  let futuros = 0;
  for (const registro of registros) {
    const anio = parsearCampania(registro.campania);
    if (anio === null) {
      invalidos++;
      continue;
    }
    if (anio > anioVigente) {
      futuros++;
      continue;
    }
    const lista = porAnio.get(anio);
    if (lista) lista.push(registro);
    else porAnio.set(anio, [registro]);
  }

  const registrosIgnorados = invalidos + futuros;
  if (invalidos > 0) {
    supuestos.push(
      `${invalidos} registro(s) se ignoraron porque su campaña no es válida (formatos aceptados: 2025, 2025/26 o 2025/2026, con años consecutivos).`,
    );
  }
  if (futuros > 0) {
    supuestos.push(
      `${futuros} registro(s) se ignoraron porque su campaña es posterior a la vigente (${formatearCampania(anioVigente)}).`,
    );
  }

  if (porAnio.size === 0) {
    return {
      tieneHistorial: false,
      ultimoCultivo: null,
      secuencia: [],
      catalogo,
      supuestos,
      registrosIgnorados,
    };
  }

  const timeline = new Map<number, AnioTimeline>();
  const ultimoPorAnio = new Map<number, { cultivo: string; familiaBotanica: string }>();

  for (const [anio, regs] of porAnio) {
    const ordenados = [...regs].sort(
      (a, b) =>
        ordenCicloEnCampania(a.cultivo) - ordenCicloEnCampania(b.cultivo) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const resueltos = ordenados.map((r) => ({
      original: r.cultivo,
      items: resolverCultivosEnTexto(r.cultivo, catalogo),
    }));
    const todos = resueltos.flatMap((r) => r.items);

    const familiaDesconocida = todos.some((i) => {
      const familia = codigoFamilia(i.familiaBotanica);
      return familia === 'OTRA' || familia === 'COBERTURA';
    });
    if (familiaDesconocida) {
      supuestos.push(
        `La campaña ${formatearCampania(anio)} contiene cultivos de familia indeterminada. Identificá las especies de "${regs.map((r) => r.cultivo).join(' + ')}" para verificar la rotación.`,
      );
    }
    timeline.set(anio, {
      familias: new Set(todos.map((i) => codigoFamilia(i.familiaBotanica))),
      cultivos: [...new Set(todos.map((i) => normalizarTexto(i.nombre)))],
      cultivosCanonicos: [...new Set(todos.map((i) => normalizarTexto(i.nombreCanonico)))],
      familiasTexto: [...new Set(todos.map((i) => i.familiaBotanica))],
      familiaDesconocida,
    });

    const ultimo = resueltos[resueltos.length - 1];
    ultimoPorAnio.set(anio, {
      cultivo: ultimo.original,
      familiaBotanica: [...new Set(ultimo.items.map((i) => i.familiaBotanica))].join(' + '),
    });
  }

  const ultimoAnioHistorial = Math.max(...timeline.keys());
  const ultimoRegistro = ultimoPorAnio.get(ultimoAnioHistorial)!;
  const primerAnioPlan = Math.max(ultimoAnioHistorial + 1, anioVigente);

  if (primerAnioPlan > ultimoAnioHistorial + 1) {
    supuestos.push(
      `No hay registros entre ${formatearCampania(ultimoAnioHistorial)} y la campaña vigente: se consideran campañas sin cultivo. Si sembraste algo, cargalo en el historial para mejorar el plan.`,
    );
  }

  const bloqueadaPorFamilia = (familia: FamiliaCodigo, anio: number): boolean => {
    const espera = esperaPorFamilia.get(familia) ?? esperaPorDefectoDeFamilia(familia);
    for (let a = anio - espera; a < anio; a++) {
      if (timeline.get(a)?.familias.has(familia)) return true;
    }
    return false;
  };

  /**
   * Verifica restricciones de espera entre pares específicos de cultivos (incluso de distinta familia,
   * como Soja 1ra <-> Girasol por susceptibilidad compartida a Sclerotinia sclerotiorum).
   */
  const bloqueadaPorReglaPar = (candidato: CultivoCatalogoItem, anio: number): boolean => {
    const destinoNorm = normalizarTexto(candidato.nombre);
    for (const [anioPrevio, datosAnio] of timeline) {
      if (anioPrevio >= anio) continue;
      const distancia = anio - anioPrevio;
      for (const origenNorm of datosAnio.cultivosCanonicos) {
        const regla = mapaTransiciones.get(`${origenNorm}->${destinoNorm}`);
        if (regla && regla.aniosEsperaMin >= 1 && distancia <= regla.aniosEsperaMin) {
          return true;
        }
      }
      // Regla sanitaria por defecto entre Fabáceas y Asteráceas (Sclerotinia sclerotiorum)
      const famCandidato = codigoFamilia(candidato.familiaBotanica);
      if (
        distancia <= 1 &&
        ((famCandidato === 'ASTERACEAE' && datosAnio.familias.has('FABACEAE')) ||
          (famCandidato === 'FABACEAE' && datosAnio.familias.has('ASTERACEAE')))
      ) {
        return true;
      }
    }
    return false;
  };

  const tieneAntecedenteIndeterminado = (familia: FamiliaCodigo, anio: number): boolean => {
    const espera = esperaPorFamilia.get(familia) ?? esperaPorDefectoDeFamilia(familia);
    for (let a = anio - espera; a < anio; a++) {
      if (timeline.get(a)?.familiaDesconocida) return true;
    }
    return false;
  };

  /** Campañas desde la última aparición (1 = campaña anterior). Infinity si nunca apareció. */
  const distanciaDesde = (anio: number, aparece: (t: AnioTimeline) => boolean): number => {
    let mejor = Infinity;
    for (const [a, t] of timeline) {
      if (a < anio && aparece(t)) mejor = Math.min(mejor, anio - a);
    }
    return mejor;
  };

  const usosDelCultivo = (anio: number, nombreCanonicoNormalizado: string): number => {
    let total = 0;
    for (const [anioRegistrado, t] of timeline.entries()) {
      if (anioRegistrado < anio && anio - anioRegistrado <= TOPE_DESCANSO) {
        total += t.cultivosCanonicos.filter((c) => c === nombreCanonicoNormalizado).length;
      }
    }
    return total;
  };

  const obtenerReglaTransicion = (
    anteriorTimeline: AnioTimeline | undefined,
    candidato: CultivoCatalogoItem,
  ): ReglaTransicionItem | undefined => {
    if (!anteriorTimeline || anteriorTimeline.cultivosCanonicos.length === 0) return undefined;
    const ultimoCanonico =
      anteriorTimeline.cultivosCanonicos[anteriorTimeline.cultivosCanonicos.length - 1];
    return mapaTransiciones.get(`${ultimoCanonico}->${normalizarTexto(candidato.nombre)}`);
  };

  const secuencia: PasoRotacion[] = [];

  for (let paso = 0; paso < horizonte; paso++) {
    const anio = primerAnioPlan + paso;
    const anterior = timeline.get(anio - 1);

    const sinBloqueoConocido = candidatos.filter(
      (c) =>
        !bloqueadaPorFamilia(codigoFamilia(c.familiaBotanica), anio) &&
        !bloqueadaPorReglaPar(c, anio),
    );
    let pool = sinBloqueoConocido.filter(
      (c) => !tieneAntecedenteIndeterminado(codigoFamilia(c.familiaBotanica), anio),
    );

    if (pool.length === 0) {
      const datosInsuficientes = sinBloqueoConocido.length > 0;
      if (!secuencia.some((p) => p.estado !== 'sugerido')) {
        supuestos.push(
          'Los pasos posteriores a una campaña sin sugerencia suponen que no se siembra ningún cultivo en ella. Si sembrás, registralo y regenerá el plan.',
        );
      }
      timeline.set(anio, {
        familias: new Set(),
        cultivos: [],
        cultivosCanonicos: [],
        familiasTexto: [],
        familiaDesconocida: false,
      });
      secuencia.push({
        orden: paso + 1,
        campania: formatearCampania(anio),
        estado: datosInsuficientes ? 'datos_insuficientes' : 'sin_alternativa',
        cultivo: null,
        familiaBotanica: null,
        aniosEsperaMismaFamilia: null,
        efectoSuelo: null,
        recomendacionSucesion: null,
        motivoSeleccion: datosInsuficientes
          ? 'No se puede verificar la espera porque hay antecedentes de familia indeterminada. Completá las especies del historial y regenerá el plan.'
          : 'Ningún cultivo habilitado respeta los años de espera de su familia botánica y sanidad en esta campaña. Habilitá más cultivos de otra familia o consultá con un técnico agropecuario.',
        fuente: null,
      });
      continue;
    }

    // Tras hoja ancha (Soja / Girasol) se prioriza una gramínea para reponer carbono y cortar ciclo de Sclerotinia.
    const veniaDeHojaAncha =
      anterior?.familias.has('FABACEAE') || anterior?.familias.has('ASTERACEAE');
    if (veniaDeHojaAncha) {
      const poaceas = pool.filter((c) => codigoFamilia(c.familiaBotanica) === 'POACEAE');
      if (poaceas.length > 0) pool = poaceas;
    }

    const descansoFamilia = (c: CultivoCatalogoItem) =>
      Math.min(
        distanciaDesde(anio, (t) => t.familias.has(codigoFamilia(c.familiaBotanica))),
        TOPE_DESCANSO,
      );
    const descansoCultivo = (c: CultivoCatalogoItem) =>
      Math.min(
        distanciaDesde(anio, (t) => t.cultivosCanonicos.includes(normalizarTexto(c.nombre))),
        TOPE_DESCANSO,
      );

    const prioridadTransicion = (c: CultivoCatalogoItem): number =>
      obtenerReglaTransicion(anterior, c)?.prioridadSugerencia ?? c.prioridadBase ?? 3;

    const puntajeEfectivo = (c: CultivoCatalogoItem): number =>
      prioridadTransicion(c) - usosDelCultivo(anio, normalizarTexto(c.nombre));

    // Orden de desempate:
    // 1. Puntaje efectivo (prioridadSugerencia de ReglaRotacion penalizada por usos recientes en el lote)
    // 2. Menor cantidad de repeticiones recientes del cultivo en el lote
    // 3. Mayor prioridad agronómica de la transición
    // 4. Mayor descanso de la familia botánica y del cultivo específico
    const ordenado = [...pool].sort((a, b) => {
      const pe = puntajeEfectivo(b) - puntajeEfectivo(a);
      if (pe !== 0) return pe;

      const usos =
        usosDelCultivo(anio, normalizarTexto(a.nombre)) -
        usosDelCultivo(anio, normalizarTexto(b.nombre));
      if (usos !== 0) return usos;

      const prio = prioridadTransicion(b) - prioridadTransicion(a);
      if (prio !== 0) return prio;

      const df = descansoFamilia(b) - descansoFamilia(a);
      if (df !== 0) return df;

      const dc = descansoCultivo(b) - descansoCultivo(a);
      if (dc !== 0) return dc;

      return catalogo.indexOf(a) - catalogo.indexOf(b);
    });

    const elegido = ordenado[0];
    const familiaElegida = codigoFamilia(elegido.familiaBotanica);
    const esperaElegida =
      esperaPorFamilia.get(familiaElegida) ??
      esperaValida(elegido.aniosEsperaMismaFamilia, esperaPorDefectoDeFamilia(familiaElegida));
    const reglaAplicada = obtenerReglaTransicion(anterior, elegido);

    const previoTexto =
      anterior && anterior.cultivos.length > 0
        ? `${anterior.cultivos.join(' + ')} (${[...new Set(anterior.familiasTexto)].join(' + ')})`
        : 'una campaña sin registro';

    // Evaluar si el cereal de invierno sugerido admite doble cultivo (+ Soja 2da) en la misma campaña
    const leguminosaHabilitadaEnAnio =
      !excluidosSet.has(normalizarTexto('Soja 1ra')) &&
      !bloqueadaPorFamilia('FABACEAE', anio) &&
      !anterior?.familias.has('ASTERACEAE');
    const notaDobleCultivo =
      esCerealDeInvierno(elegido.nombre) && leguminosaHabilitadaEnAnio
        ? ` Admite secuencia intensiva de doble cultivo (${elegido.nombre} / Soja 2da) en la misma campaña; si implantás Soja 2da, registrá ambos cultivos para que la campaña siguiente rote a una gramínea estival (Maíz tardío o Sorgo granífero).`
        : '';

    const nombreNormalizado = normalizarTexto(elegido.nombre);
    timeline.set(anio, {
      familias: new Set([familiaElegida]),
      cultivos: [nombreNormalizado],
      cultivosCanonicos: [nombreNormalizado],
      familiasTexto: [elegido.familiaBotanica],
      familiaDesconocida: false,
    });

    secuencia.push({
      orden: paso + 1,
      campania: formatearCampania(anio),
      estado: 'sugerido',
      cultivo: elegido.nombre,
      familiaBotanica: elegido.familiaBotanica,
      aniosEsperaMismaFamilia: esperaElegida,
      efectoSuelo: reglaAplicada?.efectoSuelo ?? elegido.efectoSuelo,
      recomendacionSucesion: `${elegido.recomendacionSucesion}${notaDobleCultivo}`,
      motivoSeleccion: `Se sugiere ${elegido.nombre} luego de ${previoTexto} para rotar hacia ${elegido.familiaBotanica}, respetando los ${esperaElegida} año(s) mínimos de espera de la familia.${notaDobleCultivo}`,
      fuente: elegido.fuente,
    });
  }

  return {
    tieneHistorial: true,
    ultimoCultivo: {
      campania: formatearCampania(ultimoAnioHistorial),
      cultivo: ultimoRegistro.cultivo,
      familiaBotanica: ultimoRegistro.familiaBotanica,
    },
    secuencia,
    catalogo,
    supuestos,
    registrosIgnorados,
  };
}

export async function obtenerPlanRotacion(
  parcelaId: string,
  horizonteAnios = HORIZONTE_POR_DEFECTO,
  cultivosExcluidos: string[] = [],
  fecha: Date = new Date(),
): Promise<PlanRotacionResponse> {
  const { catalogo, reglasTransicion } = await obtenerDatosCatalogoRotacion();

  const registros = await prisma.campaniaCultivo.findMany({
    where: { parcelaId },
  });

  return calcularPlanRotacion({
    registros: registros.map((r) => ({
      campania: r.campania,
      cultivo: r.cultivo,
      createdAt: r.createdAt,
    })),
    catalogo,
    reglasTransicion,
    fecha,
    horizonteAnios,
    cultivosExcluidos,
  });
}
