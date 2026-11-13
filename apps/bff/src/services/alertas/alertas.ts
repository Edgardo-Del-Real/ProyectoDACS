import { prisma } from '../../db.js';
import { obtenerPronostico, type PronosticoDia } from '../openmeteo.js';
import {
  AlertaEmailService,
  alertaEmailService,
  construirEmailAlerta,
  escaparHtml,
  type EmailAlertaPayload,
  type EmailSender,
  type TipoAlertaClimatica,
} from './alerta-mailer.js';

export {
  AlertaEmailService,
  alertaEmailService,
  construirEmailAlerta,
  escaparHtml,
  type EmailAlertaPayload,
  type EmailSender,
  type TipoAlertaClimatica,
};

export interface UmbralesAlerta {
  /** Temperatura mínima en °C que dispara alerta de helada (por defecto ≤ 0 °C). */
  heladaC: number;
  /** Horizonte en días para evaluar riesgo de helada (72 horas = 3 días). */
  ventanaHeladaDias: number;
  /** Precipitación acumulada mínima esperada en 7 días en mm (por defecto < 10 mm). */
  sequiaMm: number;
  /** Días mínimos entre alertas de sequía de una misma parcela para evitar duplicados en ventanas corridas. */
  ventanaDedupeSequiaDias: number;
}

/**
 * Lectura lazy de los umbrales climáticos configurados por variables de entorno (Bloqueante 3).
 * Evita evaluar process.env al cargar el módulo antes de que se cargue el archivo .env.
 */
export function obtenerUmbralesPorDefecto(): UmbralesAlerta {
  const envHelada = process.env.ALERTA_UMBRAL_HELADA_C;
  const envSequia = process.env.ALERTA_UMBRAL_SEQUIA_MM;
  return {
    heladaC: envHelada !== undefined && envHelada.trim() !== '' ? Number(envHelada) : 0,
    ventanaHeladaDias: 3, // 72 horas
    sequiaMm: envSequia !== undefined && envSequia.trim() !== '' ? Number(envSequia) : 10,
    ventanaDedupeSequiaDias: 7, // Ventana de 7 días
  };
}

/**
 * Lectura lazy del intervalo del worker programado de alertas climáticas (Bloqueante 3).
 */
export function obtenerWorkerIntervalMs(): number {
  const envInterval = process.env.ALERTAS_WORKER_INTERVAL_MS;
  return envInterval !== undefined && envInterval.trim() !== ''
    ? Number(envInterval)
    : 3 * 60 * 60 * 1000;
}

/**
 * Mapeo de umbrales con getters para lectura lazy y retrocompatibilidad.
 */
export const UMBRALES_POR_DEFECTO: UmbralesAlerta = {
  get heladaC() {
    return obtenerUmbralesPorDefecto().heladaC;
  },
  set heladaC(val: number) {
    process.env.ALERTA_UMBRAL_HELADA_C = String(val);
  },
  get ventanaHeladaDias() {
    return 3;
  },
  set ventanaHeladaDias(_val: number) {},
  get sequiaMm() {
    return obtenerUmbralesPorDefecto().sequiaMm;
  },
  set sequiaMm(val: number) {
    process.env.ALERTA_UMBRAL_SEQUIA_MM = String(val);
  },
  get ventanaDedupeSequiaDias() {
    return 7;
  },
  set ventanaDedupeSequiaDias(_val: number) {},
};

/** Intervalo del job programado de verificación de alertas (por defecto cada 3 horas, alineado a RNF-08). */
export const WORKER_INTERVAL_MS = Number(
  process.env.ALERTAS_WORKER_INTERVAL_MS ?? 3 * 60 * 60 * 1000,
);

export interface AlertaPreviaItem {
  tipo: string;
  fechaEvento: string;
  emailEnviado: boolean;
}

export interface AlertaCandidata {
  tipo: TipoAlertaClimatica;
  fechaEvento: string;
  valorDetectado: number;
  umbral: number;
  mensaje: string;
}

export interface AlertaOmitidaDedupe {
  tipo: TipoAlertaClimatica;
  fechaEvento: string;
  motivo: string;
}

export interface EvaluarAlertasInput {
  parcelaId: string;
  parcelaNombre: string | null;
  pronostico: PronosticoDia[];
  alertasPrevias: AlertaPreviaItem[];
  umbrales?: Partial<UmbralesAlerta>;
}

export interface EvaluarAlertasResultado {
  candidatas: AlertaCandidata[];
  omitidasPorDedupe: AlertaOmitidaDedupe[];
  precipitacionAcumuladaMm: number;
}

export interface AlertaRegistradaDTO {
  id: string;
  userId: string;
  parcelaId: string;
  parcelaNombre: string | null;
  parcelaHectareas?: number;
  tipo: string;
  fechaEvento: string;
  valorDetectado: number;
  umbral: number;
  mensaje: string;
  emailEnviado: boolean;
  enviadoAt: string | null;
  leida: boolean;
  createdAt: string;
}

function redondear1Decimal(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Calcula la diferencia absoluta en días calendario entre dos fechas ISO `YYYY-MM-DD`.
 * Devuelve `null` si alguna fecha no tiene formato válido.
 */
export function diferenciaEnDiasIso(fechaA: string, fechaB: string): number | null {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(fechaA) || !regex.test(fechaB)) {
    return null;
  }
  const msA = Date.parse(`${fechaA}T00:00:00Z`);
  const msB = Date.parse(`${fechaB}T00:00:00Z`);
  if (Number.isNaN(msA) || Number.isNaN(msB)) {
    return null;
  }
  return Math.round(Math.abs(msA - msB) / (24 * 60 * 60 * 1000));
}

/**
 * Evaluación de alertas climáticas (US-06):
 * 1. Evalúa heladas (`tempMin <= heladaC`) en las próximas 72 horas (primeros 3 días del pronóstico).
 * 2. Evalúa estrés hídrico / sequía (`precipitacionAcumulada < sequiaMm`) en la ventana de 7 días.
 * 3. Aplica deduplicación contra `alertasPrevias` ya notificadas por email para no enviar correos duplicados.
 */
export function evaluarAlertasPronostico(input: EvaluarAlertasInput): EvaluarAlertasResultado {
  const umbrales: UmbralesAlerta = {
    ...obtenerUmbralesPorDefecto(),
    ...input.umbrales,
  };

  const nombreLote = input.parcelaNombre?.trim() || 'Parcela sin nombre';
  const candidatas: AlertaCandidata[] = [];
  const omitidasPorDedupe: AlertaOmitidaDedupe[] = [];

  if (!Array.isArray(input.pronostico) || input.pronostico.length === 0) {
    return {
      candidatas,
      omitidasPorDedupe,
      precipitacionAcumuladaMm: 0,
    };
  }

  // 1. Criterio 1 y 2: Helada en las próximas 72 horas (primeros 3 días del pronóstico)
  const diasVentanaHelada = input.pronostico.slice(0, umbrales.ventanaHeladaDias);

  for (const dia of diasVentanaHelada) {
    if (typeof dia.tempMin === 'number' && dia.tempMin <= umbrales.heladaC) {
      const yaEnviada = input.alertasPrevias.some(
        (previa) =>
          previa.tipo === 'HELADA' &&
          previa.fechaEvento === dia.fecha &&
          previa.emailEnviado === true,
      );

      if (yaEnviada) {
        omitidasPorDedupe.push({
          tipo: 'HELADA',
          fechaEvento: dia.fecha,
          motivo: `Evento de helada para ${dia.fecha} ya fue notificado previamente.`,
        });
        continue;
      }

      const tempRedondeada = redondear1Decimal(dia.tempMin);
      candidatas.push({
        tipo: 'HELADA',
        fechaEvento: dia.fecha,
        valorDetectado: tempRedondeada,
        umbral: umbrales.heladaC,
        mensaje: `Alerta de helada en "${nombreLote}": se prevé una mínima de ${tempRedondeada} °C para el ${dia.fecha} (umbral ≤ ${umbrales.heladaC} °C en las próximas 72 h).`,
      });
    }
  }

  // 2. Criterio 3 y 2: Estrés hídrico (precipitación acumulada bajo el umbral configurado)
  const precipitacionAcumuladaMm = redondear1Decimal(
    input.pronostico.reduce(
      (acum, dia) => acum + (typeof dia.precipitacion === 'number' ? dia.precipitacion : 0),
      0,
    ),
  );

  if (precipitacionAcumuladaMm < umbrales.sequiaMm) {
    const fechaInicio = input.pronostico[0].fecha;
    const fechaFin = input.pronostico[input.pronostico.length - 1].fecha;

    const yaEnviadaSequia = input.alertasPrevias.some((previa) => {
      // Las filas con emailEnviado=false también cuentan para el dedupe (Mejora 8)
      if (previa.tipo !== 'SEQUIA') {
        return false;
      }
      if (previa.fechaEvento === fechaInicio) {
        return true;
      }
      const diffDias = diferenciaEnDiasIso(fechaInicio, previa.fechaEvento);
      // Evita re-emitir alertas para sequías sostenidas activas dentro de la ventana del pronóstico
      return diffDias !== null && diffDias < umbrales.ventanaDedupeSequiaDias;
    });

    if (yaEnviadaSequia) {
      omitidasPorDedupe.push({
        tipo: 'SEQUIA',
        fechaEvento: fechaInicio,
        motivo: `Alerta de estrés hídrico para la ventana iniciada el ${fechaInicio} ya fue notificada recientemente.`,
      });
    } else {
      candidatas.push({
        tipo: 'SEQUIA',
        fechaEvento: fechaInicio,
        valorDetectado: precipitacionAcumuladaMm,
        umbral: umbrales.sequiaMm,
        mensaje: `Alerta de estrés hídrico en "${nombreLote}": precipitación acumulada prevista de ${precipitacionAcumuladaMm} mm entre ${fechaInicio} y ${fechaFin} (umbral mínimo ${umbrales.sequiaMm} mm).`,
      });
    }
  }

  return {
    candidatas,
    omitidasPorDedupe,
    precipitacionAcumuladaMm,
  };
}

/**
 * Permite inyectar un transporte de email alternativo (ej. en tests unitarios o de integración).
 */
export function configurarEmailSender(sender: EmailSender): void {
  alertaEmailService.configurarSender(sender);
}

interface AlertaRow {
  id: string;
  userId: string;
  parcelaId: string;
  tipo: string;
  fechaEvento: string;
  valorDetectado: number;
  umbral: number;
  mensaje: string;
  emailEnviado: boolean;
  enviadoAt: Date | null;
  leida: boolean;
  createdAt: Date;
}

interface AlertaConParcelaRow extends AlertaRow {
  parcela: {
    nombre: string | null;
    hectareas: number;
  };
}

/**
 * Contrato tipado del modelo `Alerta` sobre PrismaClient.
 * Garantiza seguridad de tipos en el IDE aun antes de regenerar los artefactos locales de `.prisma/client`.
 */
interface AlertaPrismaDelegate {
  findMany(args: {
    where: Record<string, unknown>;
    select?: Record<string, boolean>;
    include?: Record<string, unknown>;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<AlertaConParcelaRow[]>;
  findFirst(args: {
    where: Record<string, unknown>;
    include: Record<string, unknown>;
  }): Promise<AlertaConParcelaRow | null>;
  upsert(args: {
    where: {
      parcelaId_tipo_fechaEvento: {
        parcelaId: string;
        tipo: TipoAlertaClimatica;
        fechaEvento: string;
      };
    };
    create: {
      userId: string;
      parcelaId: string;
      tipo: TipoAlertaClimatica;
      fechaEvento: string;
      valorDetectado: number;
      umbral: number;
      mensaje: string;
      emailEnviado: boolean;
    };
    update: {
      valorDetectado: number;
      umbral: number;
      mensaje: string;
    };
  }): Promise<AlertaRow>;
  update(args: {
    where: { id: string };
    data: {
      emailEnviado?: boolean;
      enviadoAt?: Date | null;
      leida?: boolean;
    };
  }): Promise<AlertaRow>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

function obtenerRepositorioAlerta(dbOverride?: unknown): AlertaPrismaDelegate {
  return ((dbOverride ?? prisma) as unknown as { alerta: AlertaPrismaDelegate }).alerta;
}

export interface VerificacionParcelaResultado {
  parcelaId: string;
  parcelaNombre: string | null;
  nuevas: AlertaRegistradaDTO[];
  omitidasPorDedupe: AlertaOmitidaDedupe[];
}

export interface EstadoFallaEnvio {
  intentos: number;
  proximoIntentoAt: number;
  ultimoError?: string;
}

const registroFallasEnvio = new Map<string, EstadoFallaEnvio>();

/**
 * Limpia el registro de fallas de envío y backoff (ideal para pruebas y reinicio).
 */
export function limpiarRegistroFallasEnvio(): void {
  registroFallasEnvio.clear();
}

/**
 * Consulta el estado de reintentos y backoff de una alerta fallida.
 */
export function obtenerEstadoFallaEnvio(alertaId: string): EstadoFallaEnvio | undefined {
  return registroFallasEnvio.get(alertaId);
}

/**
 * Calcula el tiempo de backoff exponencial en ms tras fallas sucesivas de envío (Mejora 5).
 */
export function calcularBackoffEnvioMs(intentos: number): number {
  const baseMs = 60_000;
  const maxMs = 15 * 60_000;
  return Math.min(baseMs * Math.pow(2, Math.max(0, intentos - 1)), maxMs);
}

/**
 * Evalúa el pronóstico de una parcela puntual, guarda las nuevas alertas en la base de datos
 * respetando la restricción única `(parcelaId, tipo, fechaEvento)` y envía el email si aún no fue enviado.
 */
export async function verificarAlertasDeParcela(
  parcelaId: string,
  opciones?: {
    pronosticoPreCargado?: PronosticoDia[];
    sender?: EmailSender;
    umbrales?: Partial<UmbralesAlerta>;
    db?: unknown;
  },
): Promise<VerificacionParcelaResultado | null> {
  const dbClient = (opciones?.db ?? prisma) as typeof prisma;
  const parcela = await dbClient.parcela.findUnique({
    where: { id: parcelaId },
    include: {
      usuario: {
        select: { id: true, email: true, nombre: true },
      },
    },
  });

  if (!parcela) {
    return null;
  }

  let diasPronostico = opciones?.pronosticoPreCargado;
  if (!diasPronostico) {
    const respuestaClima = await obtenerPronostico(parcelaId);
    if (!respuestaClima) {
      return null;
    }
    diasPronostico = respuestaClima.pronostico;
  }

  const repoAlerta = obtenerRepositorioAlerta(opciones?.db);
  const alertasPrevias = await repoAlerta.findMany({
    where: { parcelaId: parcela.id },
    select: {
      tipo: true,
      fechaEvento: true,
      emailEnviado: true,
    },
  });

  const evaluacion = evaluarAlertasPronostico({
    parcelaId: parcela.id,
    parcelaNombre: parcela.nombre,
    pronostico: diasPronostico,
    alertasPrevias,
    umbrales: opciones?.umbrales,
  });

  const sender = opciones?.sender ?? alertaEmailService.getSender();
  const nuevas: AlertaRegistradaDTO[] = [];

  for (const candidata of evaluacion.candidatas) {
    // Upsert idempotente respaldado por @@unique([parcelaId, tipo, fechaEvento])
    const registro = await repoAlerta.upsert({
      where: {
        parcelaId_tipo_fechaEvento: {
          parcelaId: parcela.id,
          tipo: candidata.tipo,
          fechaEvento: candidata.fechaEvento,
        },
      },
      create: {
        userId: parcela.userId,
        parcelaId: parcela.id,
        tipo: candidata.tipo,
        fechaEvento: candidata.fechaEvento,
        valorDetectado: candidata.valorDetectado,
        umbral: candidata.umbral,
        mensaje: candidata.mensaje,
        emailEnviado: false,
      },
      update: {
        valorDetectado: candidata.valorDetectado,
        umbral: candidata.umbral,
        mensaje: candidata.mensaje,
      },
    });

    // Control de reintentos y backoff ante fallas previas de envío SMTP (Mejora 5)
    const estadoFalla = registroFallasEnvio.get(registro.id);
    if (estadoFalla && Date.now() < estadoFalla.proximoIntentoAt) {
      evaluacion.omitidasPorDedupe.push({
        tipo: candidata.tipo,
        fechaEvento: candidata.fechaEvento,
        motivo: `Envío omitido temporalmente por backoff tras ${estadoFalla.intentos} intento(s) fallido(s).`,
      });
      continue;
    }

    // Reclamar el envío de forma atómica para evitar envíos duplicados por concurrencia (Bloqueante 2)
    const reclamo = await repoAlerta.updateMany({
      where: {
        id: registro.id,
        emailEnviado: false,
      },
      data: {
        emailEnviado: true,
        enviadoAt: new Date(),
      },
    });

    // Enviar solo si count === 1
    if (reclamo.count !== 1) {
      evaluacion.omitidasPorDedupe.push({
        tipo: candidata.tipo,
        fechaEvento: candidata.fechaEvento,
        motivo: 'Email ya reclamado o despachado por otra ejecución concurrente.',
      });
      continue;
    }

    const emailPayload = alertaEmailService.construirEmail({
      destinatarioEmail: parcela.usuario.email,
      destinatarioNombre: parcela.usuario.nombre,
      parcelaId: parcela.id,
      parcelaNombre: parcela.nombre,
      alerta: candidata,
    });

    let envioExitoso = false;
    try {
      await sender(emailPayload);
      envioExitoso = true;
      registroFallasEnvio.delete(registro.id);
    } catch (err) {
      const prev = registroFallasEnvio.get(registro.id) ?? { intentos: 0, proximoIntentoAt: 0 };
      const intentos = prev.intentos + 1;
      const backoffMs = calcularBackoffEnvioMs(intentos);
      registroFallasEnvio.set(registro.id, {
        intentos,
        proximoIntentoAt: Date.now() + backoffMs,
        ultimoError: err instanceof Error ? err.message : String(err),
      });

      console.warn(
        `[alertas-worker] ⚠️ No se pudo enviar el email a <${parcela.usuario.email}> (intento ${intentos}, próximo reintento en ${Math.round(backoffMs / 1000)}s):`,
        err instanceof Error ? err.message : err,
      );
      // Si el envío falla, revertí el flag (o registrá el fallo) para que pueda reintentarse al vencer el backoff
      await repoAlerta.update({
        where: { id: registro.id },
        data: {
          emailEnviado: false,
          enviadoAt: null,
        },
      });
    }

    nuevas.push({
      id: registro.id,
      userId: registro.userId,
      parcelaId: registro.parcelaId,
      parcelaNombre: parcela.nombre,
      parcelaHectareas: parcela.hectareas,
      tipo: registro.tipo,
      fechaEvento: registro.fechaEvento,
      valorDetectado: registro.valorDetectado,
      umbral: registro.umbral,
      mensaje: registro.mensaje,
      emailEnviado: envioExitoso,
      enviadoAt: envioExitoso ? new Date().toISOString() : null,
      leida: registro.leida,
      createdAt:
        registro.createdAt instanceof Date
          ? registro.createdAt.toISOString()
          : new Date().toISOString(),
    });
  }

  return {
    parcelaId: parcela.id,
    parcelaNombre: parcela.nombre,
    nuevas,
    omitidasPorDedupe: evaluacion.omitidasPorDedupe,
  };
}

/**
 * Verifica las alertas de todas las parcelas de un usuario (o de una parcela específica si se indica).
 */
export async function verificarAlertasDeUsuario(
  userId: string,
  parcelaId?: string,
): Promise<{
  parcelasEvaluadas: number;
  nuevas: AlertaRegistradaDTO[];
  omitidasPorDedupe: number;
}> {
  const parcelas = await prisma.parcela.findMany({
    where: {
      userId,
      ...(parcelaId ? { id: parcelaId } : {}),
    },
    select: { id: true },
  });

  const nuevasTotales: AlertaRegistradaDTO[] = [];
  let omitidasTotales = 0;
  let evaluadas = 0;

  for (const p of parcelas) {
    try {
      const res = await verificarAlertasDeParcela(p.id);
      if (res) {
        evaluadas++;
        nuevasTotales.push(...res.nuevas);
        omitidasTotales += res.omitidasPorDedupe.length;
      }
    } catch (err) {
      console.warn(`[alertas-worker] No se pudo verificar la parcela ${p.id}:`, err);
    }
  }

  return {
    parcelasEvaluadas: evaluadas,
    nuevas: nuevasTotales,
    omitidasPorDedupe: omitidasTotales,
  };
}

/**
 * Lista las alertas registradas para un productor, ordenadas de más reciente a más antigua.
 */
export async function listarAlertasDeUsuario(
  userId: string,
  filtros?: { parcelaId?: string; soloNoLeidas?: boolean },
): Promise<{
  alertas: AlertaRegistradaDTO[];
  resumen: {
    total: number;
    noLeidas: number;
    heladas: number;
    sequias: number;
  };
  umbrales: UmbralesAlerta;
}> {
  const repoAlerta = obtenerRepositorioAlerta();
  const registros = await repoAlerta.findMany({
    where: {
      userId,
      ...(filtros?.parcelaId ? { parcelaId: filtros.parcelaId } : {}),
      ...(filtros?.soloNoLeidas ? { leida: false } : {}),
    },
    include: {
      parcela: {
        select: {
          nombre: true,
          hectareas: true,
        },
      },
    },
    orderBy: [{ leida: 'asc' }, { createdAt: 'desc' }],
  });

  const alertas: AlertaRegistradaDTO[] = registros.map((r: AlertaConParcelaRow) => ({
    id: r.id,
    userId: r.userId,
    parcelaId: r.parcelaId,
    parcelaNombre: r.parcela.nombre,
    parcelaHectareas: r.parcela.hectareas,
    tipo: r.tipo,
    fechaEvento: r.fechaEvento,
    valorDetectado: r.valorDetectado,
    umbral: r.umbral,
    mensaje: r.mensaje,
    emailEnviado: r.emailEnviado,
    enviadoAt: r.enviadoAt ? r.enviadoAt.toISOString() : null,
    leida: r.leida,
    createdAt: r.createdAt.toISOString(),
  }));

  const noLeidas = alertas.filter((a) => !a.leida).length;
  const heladas = alertas.filter((a) => a.tipo === 'HELADA').length;
  const sequias = alertas.filter((a) => a.tipo === 'SEQUIA').length;

  return {
    alertas,
    resumen: {
      total: alertas.length,
      noLeidas,
      heladas,
      sequias,
    },
    umbrales: obtenerUmbralesPorDefecto(),
  };
}

/**
 * Marca una alerta como leída/revisada verificando que pertenezca al usuario autenticado.
 */
export async function marcarAlertaLeida(
  userId: string,
  alertaId: string,
  leida = true,
): Promise<AlertaRegistradaDTO | null> {
  const repoAlerta = obtenerRepositorioAlerta();
  const existente = await repoAlerta.findFirst({
    where: { id: alertaId, userId },
    include: {
      parcela: {
        select: { nombre: true, hectareas: true },
      },
    },
  });

  if (!existente) {
    return null;
  }

  const actualizada = await repoAlerta.update({
    where: { id: alertaId },
    data: { leida },
  });

  return {
    id: actualizada.id,
    userId: actualizada.userId,
    parcelaId: actualizada.parcelaId,
    parcelaNombre: existente.parcela.nombre,
    parcelaHectareas: existente.parcela.hectareas,
    tipo: actualizada.tipo,
    fechaEvento: actualizada.fechaEvento,
    valorDetectado: actualizada.valorDetectado,
    umbral: actualizada.umbral,
    mensaje: actualizada.mensaje,
    emailEnviado: actualizada.emailEnviado,
    enviadoAt: actualizada.enviadoAt ? actualizada.enviadoAt.toISOString() : null,
    leida: actualizada.leida,
    createdAt: actualizada.createdAt.toISOString(),
  };
}

/**
 * Error tipado emitido cuando una alerta o el usuario no existe o no le pertenece (Mejora 4).
 */
export class AlertaNotFoundError extends Error {
  public readonly statusCode = 404;
  constructor(message = 'Alerta no encontrada o no pertenece al usuario') {
    super(message);
    this.name = 'AlertaNotFoundError';
  }
}

/**
 * Reenvía manualmente el correo de una alerta específica usando Nodemailer
 * y actualiza su estado a emailEnviado = true si el despacho fue exitoso.
 */
export async function reenviarEmailAlerta(
  userId: string,
  alertaId: string,
  dbOverride?: unknown,
): Promise<{ alerta: AlertaRegistradaDTO; mensaje: string }> {
  const dbClient = (dbOverride ?? prisma) as typeof prisma;
  const repoAlerta = obtenerRepositorioAlerta(dbOverride);
  const existente = await repoAlerta.findFirst({
    where: { id: alertaId, userId },
    include: {
      parcela: {
        select: { nombre: true, hectareas: true },
      },
    },
  });

  if (!existente) {
    throw new AlertaNotFoundError('Alerta no encontrada o no pertenece al usuario');
  }

  const usuario = await dbClient.usuario.findUnique({
    where: { id: userId },
    select: { email: true, nombre: true },
  });

  if (!usuario) {
    throw new AlertaNotFoundError('Usuario no encontrado');
  }

  const emailPayload = alertaEmailService.construirEmail({
    destinatarioEmail: usuario.email,
    destinatarioNombre: usuario.nombre,
    parcelaId: existente.parcelaId,
    parcelaNombre: existente.parcela.nombre,
    alerta: {
      tipo: existente.tipo as TipoAlertaClimatica,
      fechaEvento: existente.fechaEvento,
      valorDetectado: existente.valorDetectado,
      umbral: existente.umbral,
      mensaje: existente.mensaje,
    },
  });

  await alertaEmailService.enviar(emailPayload);

  const ahora = new Date();
  const actualizada = await repoAlerta.update({
    where: { id: alertaId },
    data: {
      emailEnviado: true,
      enviadoAt: ahora,
    },
  });

  return {
    alerta: {
      id: actualizada.id,
      userId: actualizada.userId,
      parcelaId: actualizada.parcelaId,
      parcelaNombre: existente.parcela.nombre,
      parcelaHectareas: existente.parcela.hectareas,
      tipo: actualizada.tipo,
      fechaEvento: actualizada.fechaEvento,
      valorDetectado: actualizada.valorDetectado,
      umbral: actualizada.umbral,
      mensaje: actualizada.mensaje,
      emailEnviado: actualizada.emailEnviado,
      enviadoAt: ahora.toISOString(),
      leida: actualizada.leida,
      createdAt: actualizada.createdAt.toISOString(),
    },
    mensaje: `Correo enviado exitosamente a ${usuario.email}`,
  };
}

// ============================================================================
// WORKER ASÍNCRONO Y SCHEDULER PROGRAMADO (US-06)
// ============================================================================

const colaParcelasPendientes = new Set<string>();
export const pronosticosPreCargadosCache = new Map<string, PronosticoDia[]>();
let procesandoCola = false;

/**
 * Encola la evaluación asíncrona de una parcela sin bloquear la respuesta HTTP del BFF.
 * Guarda los pronósticos precargados en un Map<parcelaId, pronostico> para que ninguna
 * parcela encolada pierda el suyo y vuelva a llamar a Open-Meteo (Mejora 6).
 */
export function encolarVerificacionParcela(
  parcelaId: string,
  pronosticoPreCargado?: PronosticoDia[],
): void {
  if (pronosticoPreCargado) {
    pronosticosPreCargadosCache.set(parcelaId, pronosticoPreCargado);
  }
  colaParcelasPendientes.add(parcelaId);

  if (procesandoCola) return;

  procesandoCola = true;
  setImmediate(async () => {
    try {
      while (colaParcelasPendientes.size > 0) {
        const iterator = colaParcelasPendientes.values().next();
        if (iterator.done) break;
        const idActual = iterator.value;
        colaParcelasPendientes.delete(idActual);

        const pronostico = pronosticosPreCargadosCache.get(idActual);
        pronosticosPreCargadosCache.delete(idActual);

        try {
          await verificarAlertasDeParcela(idActual, {
            pronosticoPreCargado: pronostico,
          });
        } catch (err) {
          console.warn(`[alertas-worker] Error procesando parcela encolada ${idActual}:`, err);
        }
      }
    } finally {
      procesandoCola = false;
    }
  });
}

let barridaEnEjecucion = false;

/**
 * Consulta si hay una barrida programada actualmente en ejecución (Mejora 7).
 */
export function isBarridaEnEjecucion(): boolean {
  return barridaEnEjecucion;
}

export interface ResultadoBarridaProgramada {
  parcelasEvaluadas: number;
  alertasEmitidas: number;
  omitidasPorDedupe: number;
  omitidaPorSolapamiento?: boolean;
}

export interface OpcionesBarridaProgramada {
  db?: unknown;
  limiteConcurrencia?: number;
  verificador?: (parcelaId: string) => Promise<VerificacionParcelaResultado | null>;
}

/**
 * Procesa una colección de elementos limitando la concurrencia simultánea (Mejora 7).
 */
export async function procesarConLimiteConcurrencia<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const resultados: R[] = [];
  const limiteEfectivo = Math.max(1, Math.min(limite, items.length));
  let cursor = 0;

  const workers = Array.from({ length: limiteEfectivo }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      const res = await fn(item);
      resultados.push(res);
    }
  });

  await Promise.all(workers);
  return resultados;
}

/**
 * Ejecuta una barrida completa sobre todas las parcelas registradas en el sistema.
 * Agrega flag de "en ejecución" para no solapar con la corrida anterior y un límite de concurrencia (Mejora 7).
 */
export async function ejecutarBarridaProgramadaAlertas(
  opciones?: OpcionesBarridaProgramada,
): Promise<ResultadoBarridaProgramada> {
  if (barridaEnEjecucion) {
    console.warn(
      '[alertas-worker] ⚠️ Barrida programada ya se encuentra en ejecución. Omitiendo corrida concurrente.',
    );
    return {
      parcelasEvaluadas: 0,
      alertasEmitidas: 0,
      omitidasPorDedupe: 0,
      omitidaPorSolapamiento: true,
    };
  }

  barridaEnEjecucion = true;
  try {
    const dbClient = (opciones?.db ?? prisma) as typeof prisma;
    const parcelas = await dbClient.parcela.findMany({
      select: { id: true },
    });

    const limite = opciones?.limiteConcurrencia ?? 5;
    const verificar =
      opciones?.verificador ??
      ((id: string) => verificarAlertasDeParcela(id, { db: opciones?.db }));

    let parcelasEvaluadas = 0;
    let alertasEmitidas = 0;
    let omitidasPorDedupe = 0;

    await procesarConLimiteConcurrencia(parcelas, limite, async (parcela) => {
      try {
        const resultado = await verificar(parcela.id);
        if (resultado) {
          parcelasEvaluadas++;
          alertasEmitidas += resultado.nuevas.length;
          omitidasPorDedupe += resultado.omitidasPorDedupe.length;
        }
      } catch (err) {
        console.warn(
          `[alertas-worker] Fallo al evaluar parcela ${parcela.id} en job programado:`,
          err,
        );
      }
    });

    return {
      parcelasEvaluadas,
      alertasEmitidas,
      omitidasPorDedupe,
    };
  } finally {
    barridaEnEjecucion = false;
  }
}

export interface LoggerLike {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

/**
 * Inicia el worker programado de alertas climáticas dentro del ciclo de vida del BFF.
 * Devuelve una función `stop()` para limpiar los timers al apagar el servidor.
 */
export function iniciarWorkerAlertas(logger?: LoggerLike): () => void {
  const logInfo = (msg: string, meta?: Record<string, unknown>) => {
    if (logger) {
      logger.info(meta ?? {}, msg);
    } else {
      console.info(msg, meta ?? '');
    }
  };

  const logWarn = (msg: string, err?: unknown) => {
    if (logger) {
      logger.warn({ err }, msg);
    } else {
      console.warn(msg, err);
    }
  };

  const correrJob = async () => {
    try {
      const resumen = await ejecutarBarridaProgramadaAlertas();
      if (resumen.parcelasEvaluadas > 0 || resumen.alertasEmitidas > 0) {
        logInfo('[alertas-worker] Barrida programada completada', { ...resumen });
      }
    } catch (err) {
      logWarn('[alertas-worker] Error en barrida programada de alertas', err);
    }
  };

  // Primera verificación diferida tras el arranque para no competir con la inicialización
  const timeoutInicial = setTimeout(() => {
    void correrJob();
  }, 15_000);
  timeoutInicial.unref();

  const workerInterval = obtenerWorkerIntervalMs();
  const umbralesActuales = obtenerUmbralesPorDefecto();

  const intervalo = setInterval(() => {
    void correrJob();
  }, workerInterval);
  intervalo.unref();

  logInfo('[alertas-worker] Worker programado de alertas climáticas activo', {
    intervaloMinutos: Math.round(workerInterval / 60_000),
    umbralHeladaC: umbralesActuales.heladaC,
    umbralSequiaMm: umbralesActuales.sequiaMm,
  });

  return () => {
    clearTimeout(timeoutInicial);
    clearInterval(intervalo);
  };
}

