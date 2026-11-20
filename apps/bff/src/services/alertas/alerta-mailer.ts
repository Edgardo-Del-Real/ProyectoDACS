import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type TipoAlertaClimatica = 'HELADA' | 'SEQUIA';

export interface AlertaCandidataEmail {
  tipo: TipoAlertaClimatica;
  fechaEvento: string;
  valorDetectado: number;
  umbral: number;
  mensaje: string;
}

export interface EmailAlertaPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
  meta: {
    parcelaId: string;
    parcelaNombre: string;
    tipo: TipoAlertaClimatica;
    fechaEvento: string;
    valorDetectado: number;
    umbral: number;
  };
}

export type EmailSender = (payload: EmailAlertaPayload) => Promise<void>;

export interface ConstruirEmailAlertaParams {
  destinatarioEmail: string;
  destinatarioNombre?: string | null;
  parcelaId: string;
  parcelaNombre?: string | null;
  alerta: AlertaCandidataEmail;
}

/**
 * Escapa los caracteres especiales HTML (& < > " ') para evitar inyecciones de código
 * en los cuerpos HTML de correos electrónicos.
 */
export function escaparHtml(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Servicio encargado de la construcción de plantillas (texto/HTML)
 * y despacho de correos electrónicos de alertas climáticas usando Nodemailer (US-06).
 */
export class AlertaEmailService {
  private transporter: Transporter | null = null;
  private customSender: EmailSender | null = null;

  constructor(sender?: EmailSender) {
    if (sender) {
      this.customSender = sender;
    } else {
      this.inicializarTransporter();
    }
  }

  /**
   * Inicializa el transporte de Nodemailer leyendo las variables de entorno:
   * - Si se especifica SMTP_SERVICE (ej: 'gmail'), utiliza el servicio predefinido de Nodemailer.
   * - Si se especifica SMTP_HOST, conecta mediante SMTP estándar (host, port, secure, auth).
   * - Si no se especifican variables, el transporter queda en null y emite advertencia.
   */
  public inicializarTransporter(): void {
    const service = process.env.SMTP_SERVICE?.trim();
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (service && user && pass) {
      this.transporter = nodemailer.createTransport({
        service,
        auth: { user, pass },
      });
    } else if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  /**
   * Permite inyectar o sustituir el transporte de envío de emails
   * (ideal para pruebas unitarias, mocks o integración personalizada).
   */
  public configurarSender(sender: EmailSender | null): void {
    this.customSender = sender;
  }

  /**
   * Permite asignar un Transporter de Nodemailer directamente (ej. para tests con nodemailer mock).
   */
  public setTransporter(transporter: Transporter | null): void {
    this.transporter = transporter;
  }

  /**
   * Indica si hay un transporter o sender configurado capaz de despachar correos.
   */
  public isConfigurado(): boolean {
    return Boolean(this.customSender || this.transporter);
  }

  /**
   * Devuelve el sender actualmente configurado.
   */
  public getSender(): EmailSender {
    return this.enviar.bind(this);
  }

  /**
   * Construye el contenido estructurado del correo electrónico (asunto, texto y HTML)
   * incorporando los datos clave requeridos por US-06: parcela, fecha del evento
   * y temperatura mínima o precipitación prevista.
   */
  public construirEmail(params: ConstruirEmailAlertaParams): EmailAlertaPayload {
    const nombreProductor = params.destinatarioNombre?.trim() || params.destinatarioEmail;
    const nombreLote = params.parcelaNombre?.trim() || 'Parcela sin nombre';
    const { alerta } = params;

    if (alerta.tipo === 'HELADA') {
      const subject = `❄️ Alerta de Helada en ${nombreLote} (${alerta.fechaEvento}: ${alerta.valorDetectado} °C)`;
      const text = [
        `Hola ${nombreProductor},`,
        '',
        `El sistema de monitoreo climático de ProyectoDACS detectó riesgo de HELADA en las próximas 72 horas para tu lote:`,
        '',
        `• Parcela: ${nombreLote}`,
        `• Fecha prevista: ${alerta.fechaEvento}`,
        `• Temperatura mínima prevista: ${alerta.valorDetectado} °C (umbral de alerta: ≤ ${alerta.umbral} °C)`,
        '',
        `Recomendación: verificá el estado fenológico de tu cultivo y evaluá medidas preventivas ante bajas temperaturas.`,
        `Podés consultar el pronóstico extendido y tus alertas activas en el Panel de Control Agrícola.`,
      ].join('\n');

      const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #bae6fd; border-radius: 12px; background-color: #f0f9ff; color: #0c4a6e;">
        <h2 style="margin-top: 0; color: #0369a1;">❄️ Alerta Temprana de Helada</h2>
        <p>Hola <strong>${escaparHtml(nombreProductor)}</strong>,</p>
        <p>Se detectó una temperatura mínima crítica en las próximas 72 horas para tu parcela:</p>
        <ul style="background: #ffffff; padding: 16px 32px; border-radius: 8px; border: 1px solid #e0f2fe;">
          <li><strong>Parcela:</strong> ${escaparHtml(nombreLote)}</li>
          <li><strong>Fecha prevista:</strong> ${escaparHtml(alerta.fechaEvento)}</li>
          <li><strong>Temperatura mínima prevista:</strong> <span style="color: #0284c7; font-weight: bold;">${escaparHtml(alerta.valorDetectado)} °C</span> (umbral ≤ ${escaparHtml(alerta.umbral)} °C)</li>
        </ul>
        <p style="font-size: 13px; color: #334155;">Ingresá al Panel de Control Agrícola de ProyectoDACS para ver el detalle de tu lote.</p>
      </div>
    `.trim();

      return {
        to: params.destinatarioEmail,
        subject,
        text,
        html,
        meta: {
          parcelaId: params.parcelaId,
          parcelaNombre: nombreLote,
          tipo: alerta.tipo,
          fechaEvento: alerta.fechaEvento,
          valorDetectado: alerta.valorDetectado,
          umbral: alerta.umbral,
        },
      };
    }

    // Tipo SEQUIA (estrés hídrico)
    const subject = `🌵 Alerta de Estrés Hídrico en ${nombreLote} (${alerta.valorDetectado} mm previstos)`;
    const text = [
      `Hola ${nombreProductor},`,
      '',
      `El sistema de monitoreo climático de ProyectoDACS detectó riesgo de ESTRÉS HÍDRICO (sequía) para tu lote:`,
      '',
      `• Parcela: ${nombreLote}`,
      `• Inicio del período evaluado: ${alerta.fechaEvento}`,
      `• Precipitación acumulada prevista (7 días): ${alerta.valorDetectado} mm (umbral mínimo configurado: ${alerta.umbral} mm)`,
      '',
      `Recomendación: monitoreá la humedad útil del perfil de suelo, priorizá cobertura de rastrojo y ajustá fechas de labores.`,
      `Podés consultar el detalle en el Panel de Control Agrícola.`,
    ].join('\n');

    const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #fde68a; border-radius: 12px; background-color: #fffbeb; color: #78350f;">
      <h2 style="margin-top: 0; color: #b45309;">🌵 Alerta de Estrés Hídrico</h2>
      <p>Hola <strong>${escaparHtml(nombreProductor)}</strong>,</p>
      <p>La precipitación acumulada prevista para los próximos 7 días se encuentra por debajo del umbral hídrico configurado:</p>
      <ul style="background: #ffffff; padding: 16px 32px; border-radius: 8px; border: 1px solid #fef3c7;">
        <li><strong>Parcela:</strong> ${escaparHtml(nombreLote)}</li>
        <li><strong>Período desde:</strong> ${escaparHtml(alerta.fechaEvento)}</li>
        <li><strong>Precipitación prevista (7 días):</strong> <span style="color: #d97706; font-weight: bold;">${escaparHtml(alerta.valorDetectado)} mm</span> (umbral mínimo: ${escaparHtml(alerta.umbral)} mm)</li>
      </ul>
      <p style="font-size: 13px; color: #334155;">Ingresá al Panel de Control Agrícola de ProyectoDACS para ver el detalle de tu lote.</p>
    </div>
  `.trim();

    return {
      to: params.destinatarioEmail,
      subject,
      text,
      html,
      meta: {
        parcelaId: params.parcelaId,
        parcelaNombre: nombreLote,
        tipo: alerta.tipo,
        fechaEvento: alerta.fechaEvento,
        valorDetectado: alerta.valorDetectado,
        umbral: alerta.umbral,
      },
    };
  }

  /**
   * Envía el correo utilizando el sender activo o el transporte Nodemailer configurado.
   */
  public async enviar(payload: EmailAlertaPayload): Promise<void> {
    if (this.customSender) {
      await this.customSender(payload);
      return;
    }

    if (!this.transporter) {
      this.inicializarTransporter();
    }

    if (this.transporter) {
      const from =
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        '"ProyectoDACS Alertas" <alertas@proyectodacs.com>';

      const info = await this.transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      console.info(
        `[alertas-mailer] ✉️ Correo enviado exitosamente vía Nodemailer a <${payload.to}> (ID: ${info.messageId})`,
      );
      return;
    }

    // Si no hay configuración SMTP, registrar advertencia detallada y lanzar error explicativo
    const avisoConfig =
      'No se encontró configuración SMTP activa en el entorno. ' +
      'Para enviar correos reales vía Nodemailer, configurá SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS ' +
      '(o SMTP_SERVICE=gmail) en el archivo .env del BFF.';

    console.warn(`[alertas-mailer] ⚠️ ${avisoConfig} (Destinatario: <${payload.to}>)`);
    throw new Error(avisoConfig);
  }

  /**
   * Helper de alto nivel: construye el payload y lo envía en una sola operación.
   */
  public async construirYEnviar(params: ConstruirEmailAlertaParams): Promise<EmailAlertaPayload> {
    const payload = this.construirEmail(params);
    await this.enviar(payload);
    return payload;
  }

  /**
   * Envía un correo de prueba para verificar inmediatamente si la configuración SMTP funciona.
   */
  public async enviarTestEmail(
      destinatarioEmail: string,
      destinatarioNombre?: string | null,
    ): Promise<EmailAlertaPayload> {
    const nombre = destinatarioNombre?.trim() || destinatarioEmail;
    const ahoraIso = new Date().toLocaleDateString('es-AR');

      const payload: EmailAlertaPayload = {
        to: destinatarioEmail,
        subject: '🧪 Verificación de Conexión SMTP — ProyectoDACS Alertas',
        text: [
          `Hola ${nombre},`,
          '',
          `Este es un correo de prueba enviado desde ProyectoDACS usando Nodemailer.`,
          `Si recibiste este mensaje en tu buzón, el servicio de correo y las alertas automáticas de helada y sequía están listos para notificarte.`,
          '',
          `Fecha de emisión: ${ahoraIso}`,
          '',
          `Saludos,`,
          `Equipo ProyectoDACS`,
        ].join('\n'),
        html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #10b981; border-radius: 12px; background-color: #ecfdf5; color: #065f46;">
          <h2 style="margin-top: 0; color: #047857;">🌱 Verificación de Correo Exitosa (Nodemailer)</h2>
          <p>Hola <strong>${escaparHtml(nombre)}</strong>,</p>
          <p>Este es un correo de prueba emitido por el sistema de alertas climáticas de <strong>ProyectoDACS</strong>.</p>
          <p>Si estás leyendo este mensaje en tu bandeja de entrada, tu servidor SMTP se encuentra <strong>correctamente vinculado y listo para enviar alertas de helada y estrés hídrico</strong>.</p>
          <hr style="border: none; border-top: 1px solid #a7f3d0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #047857;">Enviado el ${escaparHtml(ahoraIso)} mediante Nodemailer.</p>
        </div>
      `.trim(),
        meta: {
          parcelaId: 'test',
          parcelaNombre: 'Prueba de Conexión',
          tipo: 'HELADA',
          fechaEvento: ahoraIso,
          valorDetectado: 0,
          umbral: 0,
        },
      };

    await this.enviar(payload);
    return payload;
  }
}

/** Instancia singleton compartida por defecto. */
export const alertaEmailService = new AlertaEmailService();

/** Helper de compatibilidad para llamadas funcionales directas. */
export function construirEmailAlerta(params: ConstruirEmailAlertaParams): EmailAlertaPayload {
  return alertaEmailService.construirEmail(params);
}
