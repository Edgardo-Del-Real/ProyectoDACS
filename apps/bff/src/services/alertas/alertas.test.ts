import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AlertaEmailService,
  alertaEmailService,
  construirEmailAlerta,
  diferenciaEnDiasIso,
  evaluarAlertasPronostico,
  type EmailAlertaPayload,
} from './alertas.js';
import type { PronosticoDia } from '../openmeteo.js';

const crearPronosticoBase = (overrides?: Partial<PronosticoDia>[]): PronosticoDia[] => {
  const base: PronosticoDia[] = [
    { fecha: '2026-07-10', tempMax: 14, tempMin: 4.5, precipitacion: 5.0 },
    { fecha: '2026-07-11', tempMax: 13, tempMin: 3.2, precipitacion: 8.0 },
    { fecha: '2026-07-12', tempMax: 15, tempMin: 5.0, precipitacion: 4.0 },
    { fecha: '2026-07-13', tempMax: 16, tempMin: 6.1, precipitacion: 0.0 },
    { fecha: '2026-07-14', tempMax: 17, tempMin: 7.0, precipitacion: 2.0 },
    { fecha: '2026-07-15', tempMax: 15, tempMin: 4.8, precipitacion: 0.0 },
    { fecha: '2026-07-16', tempMax: 14, tempMin: 3.9, precipitacion: 1.0 },
  ];

  return base.map((dia, idx) => ({
    ...dia,
    ...(overrides?.[idx] ?? {}),
  }));
};

describe('diferenciaEnDiasIso', () => {
  it('calcula la diferencia absoluta en días entre dos fechas ISO válidas', () => {
    assert.equal(diferenciaEnDiasIso('2026-07-10', '2026-07-10'), 0);
    assert.equal(diferenciaEnDiasIso('2026-07-10', '2026-07-12'), 2);
    assert.equal(diferenciaEnDiasIso('2026-07-15', '2026-07-10'), 5);
  });

  it('devuelve null ante formatos inválidos', () => {
    assert.equal(diferenciaEnDiasIso('10/07/2026', '2026-07-10'), null);
    assert.equal(diferenciaEnDiasIso('', '2026-07-10'), null);
  });
});

describe('evaluarAlertasPronostico — Heladas (Criterios 1 y 2)', () => {
  it('emite alerta HELADA cuando la mínima es <= 0 °C dentro de las próximas 72h', () => {
    const pronostico = crearPronosticoBase([
      {},
      { tempMin: -1.8 }, // Día 2 (dentro de 72h)
      { tempMin: 0.0 },  // Día 3 (borde exacto 0 °C dentro de 72h)
    ]);

    const resultado = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'Lote Sur',
      pronostico,
      alertasPrevias: [],
      umbrales: { heladaC: 0, sequiaMm: 10 },
    });

    const heladas = resultado.candidatas.filter((c) => c.tipo === 'HELADA');
    assert.equal(heladas.length, 2);
    assert.equal(heladas[0].fechaEvento, '2026-07-11');
    assert.equal(heladas[0].valorDetectado, -1.8);
    assert.match(heladas[0].mensaje, /Lote Sur/);
    assert.match(heladas[0].mensaje, /-1\.8 °C/);

    assert.equal(heladas[1].fechaEvento, '2026-07-12');
    assert.equal(heladas[1].valorDetectado, 0);
  });

  it('no emite alerta de helada temprana si la mínima <= 0 °C ocurre fuera de las 72h (día 4+)', () => {
    const pronostico = crearPronosticoBase([
      { tempMin: 3.0 },
      { tempMin: 2.5 },
      { tempMin: 1.2 },
      { tempMin: -2.5 }, // Día 4 (fuera de la ventana de 72h)
    ]);

    const resultado = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'Lote Norte',
      pronostico,
      alertasPrevias: [],
      umbrales: { heladaC: 0, sequiaMm: 10 },
    });

    const heladas = resultado.candidatas.filter((c) => c.tipo === 'HELADA');
    assert.equal(heladas.length, 0);
  });

  it('deduplica y omite el envío cuando ese evento de helada ya fue alertado por email', () => {
    const pronostico = crearPronosticoBase([
      {},
      { tempMin: -2.0 }, // 2026-07-11
    ]);

    const resultado = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'Lote Sur',
      pronostico,
      alertasPrevias: [
        {
          tipo: 'HELADA',
          fechaEvento: '2026-07-11',
          emailEnviado: true,
        },
      ],
    });

    assert.equal(resultado.candidatas.length, 0);
    assert.equal(resultado.omitidasPorDedupe.length, 1);
    assert.equal(resultado.omitidasPorDedupe[0].tipo, 'HELADA');
    assert.equal(resultado.omitidasPorDedupe[0].fechaEvento, '2026-07-11');
  });

  it('reintenta la alerta si existía en base pero el email no había sido enviado aún', () => {
    const pronostico = crearPronosticoBase([
      { tempMin: -0.5 }, // 2026-07-10
    ]);

    const resultado = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'Lote Sur',
      pronostico,
      alertasPrevias: [
        {
          tipo: 'HELADA',
          fechaEvento: '2026-07-10',
          emailEnviado: false,
        },
      ],
    });

    assert.equal(resultado.candidatas.length, 1);
    assert.equal(resultado.candidatas[0].fechaEvento, '2026-07-10');
  });
});

describe('evaluarAlertasPronostico — Estrés Hídrico / Sequía (Criterio 3 y Dedupe)', () => {
  it('emite alerta SEQUIA cuando la precipitación acumulada en 7 días queda bajo el umbral', () => {
    const pronostico = crearPronosticoBase([
      { precipitacion: 0.0 },
      { precipitacion: 1.2 },
      { precipitacion: 0.0 },
      { precipitacion: 0.0 },
      { precipitacion: 2.0 },
      { precipitacion: 0.0 },
      { precipitacion: 0.3 },
    ]);

    const resultado = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'La Esperanza',
      pronostico,
      alertasPrevias: [],
      umbrales: { sequiaMm: 10 },
    });

    assert.equal(resultado.precipitacionAcumuladaMm, 3.5);
    const sequias = resultado.candidatas.filter((c) => c.tipo === 'SEQUIA');
    assert.equal(sequias.length, 1);
    assert.equal(sequias[0].fechaEvento, '2026-07-10');
    assert.equal(sequias[0].valorDetectado, 3.5);
    assert.equal(sequias[0].umbral, 10);
    assert.match(sequias[0].mensaje, /La Esperanza/);
    assert.match(sequias[0].mensaje, /3\.5 mm/);
  });

  it('no emite alerta SEQUIA si la precipitación acumulada alcanza o supera el umbral', () => {
    const pronostico = crearPronosticoBase(); // Suma 20.0 mm
    const resultado = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'La Esperanza',
      pronostico,
      alertasPrevias: [],
      umbrales: { sequiaMm: 10 },
    });

    assert.equal(resultado.precipitacionAcumuladaMm, 20);
    assert.equal(resultado.candidatas.filter((c) => c.tipo === 'SEQUIA').length, 0);
  });

  it('deduplica alerta SEQUIA dentro de la ventana de enfriamiento de días consecutivos', () => {
    const pronostico = crearPronosticoBase(
      Array.from({ length: 7 }, () => ({ precipitacion: 0 })),
    );

    const resultado = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'La Esperanza',
      pronostico,
      alertasPrevias: [
        {
          tipo: 'SEQUIA',
          fechaEvento: '2026-07-09', // Día anterior (dentro de ventana de 3 días)
          emailEnviado: true,
        },
      ],
      umbrales: { sequiaMm: 10, ventanaDedupeSequiaDias: 3 },
    });

    assert.equal(resultado.candidatas.filter((c) => c.tipo === 'SEQUIA').length, 0);
    assert.equal(resultado.omitidasPorDedupe.length, 1);
    assert.equal(resultado.omitidasPorDedupe[0].tipo, 'SEQUIA');
  });
});

describe('construirEmailAlerta', () => {
  it('incluye parcela, fecha y temperatura prevista en el email de helada (Criterio 1)', () => {
    const mail = construirEmailAlerta({
      destinatarioEmail: 'productor@campo.ar',
      destinatarioNombre: 'Juan Pérez',
      parcelaId: 'p-123',
      parcelaNombre: 'Lote El Ombú',
      alerta: {
        tipo: 'HELADA',
        fechaEvento: '2026-07-11',
        valorDetectado: -2.4,
        umbral: 0,
        mensaje: 'Alerta de helada',
      },
    });

    assert.equal(mail.to, 'productor@campo.ar');
    assert.match(mail.subject, /Lote El Ombú/);
    assert.match(mail.subject, /2026-07-11/);
    assert.match(mail.subject, /-2\.4 °C/);
    assert.match(mail.text, /Parcela: Lote El Ombú/);
    assert.match(mail.text, /Fecha prevista: 2026-07-11/);
    assert.match(mail.text, /-2\.4 °C/);
    assert.match(mail.html, /Lote El Ombú/);
    assert.match(mail.html, /-2\.4 °C/);
  });

  it('incluye parcela, período y precipitación acumulada en el email de estrés hídrico (Criterio 3)', () => {
    const mail = construirEmailAlerta({
      destinatarioEmail: 'productor@campo.ar',
      destinatarioNombre: 'Juan Pérez',
      parcelaId: 'p-123',
      parcelaNombre: 'Lote El Ombú',
      alerta: {
        tipo: 'SEQUIA',
        fechaEvento: '2026-07-10',
        valorDetectado: 1.5,
        umbral: 10,
        mensaje: 'Alerta de estrés hídrico',
      },
    });

    assert.equal(mail.to, 'productor@campo.ar');
    assert.match(mail.subject, /Estrés Hídrico/);
    assert.match(mail.subject, /Lote El Ombú/);
    assert.match(mail.text, /1\.5 mm/);
    assert.match(mail.text, /10 mm/);
  });
});

describe('AlertaEmailService (Clase dedicada a emails)', () => {
  it('permite inyectar sender personalizado y despachar con construirYEnviar', async () => {
    const despachados: EmailAlertaPayload[] = [];
    const mailer = new AlertaEmailService(async (payload) => {
      despachados.push(payload);
    });

    const resultado = await mailer.construirYEnviar({
      destinatarioEmail: 'productor@ejemplo.com',
      destinatarioNombre: 'Ana',
      parcelaId: 'p-999',
      parcelaNombre: 'Lote Norte',
      alerta: {
        tipo: 'HELADA',
        fechaEvento: '2026-07-12',
        valorDetectado: -1.0,
        umbral: 0,
        mensaje: 'Helada prevista',
      },
    });

    assert.equal(despachados.length, 1);
    assert.equal(despachados[0].to, 'productor@ejemplo.com');
    assert.equal(despachados[0].meta.parcelaId, 'p-999');
    assert.equal(resultado.subject, despachados[0].subject);
  });

  it('permite cambiar el sender dinámicamente con configurarSender', async () => {
    const mailer = new AlertaEmailService();
    let llamado = false;
    mailer.configurarSender(async () => {
      llamado = true;
    });

    const payload = mailer.construirEmail({
      destinatarioEmail: 'test@ejemplo.com',
      parcelaId: 'p-1',
      alerta: {
        tipo: 'SEQUIA',
        fechaEvento: '2026-07-10',
        valorDetectado: 2,
        umbral: 10,
        mensaje: 'Sequía prevista',
      },
    });

    await mailer.enviar(payload);
    assert.equal(llamado, true);
  });

  it('la instancia singleton alertaEmailService expone getSender y construirEmail', () => {
    assert.ok(alertaEmailService instanceof AlertaEmailService);
    assert.equal(typeof alertaEmailService.getSender(), 'function');
  });

  it('permite enviar un correo de prueba con enviarTestEmail', async () => {
    const despachados: EmailAlertaPayload[] = [];
    const mailer = new AlertaEmailService(async (payload) => {
      despachados.push(payload);
    });

    const resultado = await mailer.enviarTestEmail('productor@campo.ar', 'Martín Fierro');
    assert.equal(despachados.length, 1);
    const enviado = despachados[0];
    assert.equal(enviado.to, 'productor@campo.ar');
    assert.match(enviado.subject, /Verificación/);
    assert.match(enviado.html, /Martín Fierro/);
    assert.equal(resultado.to, 'productor@campo.ar');
  });

  it('detecta si está configurado con isConfigurado()', () => {
    const mailerSinConfig = new AlertaEmailService();
    // En entorno de test sin SMTP_HOST/SMTP_SERVICE ni sender custom
    if (!process.env.SMTP_HOST && !process.env.SMTP_SERVICE) {
      assert.equal(mailerSinConfig.isConfigurado(), false);
    }

    mailerSinConfig.configurarSender(async () => { });
    assert.equal(mailerSinConfig.isConfigurado(), true);
  });
});

