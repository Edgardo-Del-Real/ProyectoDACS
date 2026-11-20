import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AlertaEmailService,
  alertaEmailService,
  construirEmailAlerta,
  diferenciaEnDiasIso,
  evaluarAlertasPronostico,
  type EmailAlertaPayload,
  type EmailSender,
  type VerificacionParcelaResultado,
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

  it('escapa caracteres HTML (& < > " \') en el HTML del email y no en texto plano ni subject (Bloqueante 1)', () => {
    const mailHelada = construirEmailAlerta({
      destinatarioEmail: 'productor@campo.ar',
      destinatarioNombre: 'Juan & "Pedro" <Admin>\'',
      parcelaId: 'p-malicious',
      parcelaNombre: '<img src=x>',
      alerta: {
        tipo: 'HELADA',
        fechaEvento: '2026-07-11',
        valorDetectado: -1.5,
        umbral: 0,
        mensaje: 'Peligro <script>alert("xss")</script>',
      },
    });

    // En el HTML debe estar escapado
    assert.match(mailHelada.html, /&lt;img src=&quot;x&quot;&gt;|&lt;img src=x&gt;/);
    assert.doesNotMatch(mailHelada.html, /<img src=x>/);
    assert.match(mailHelada.html, /Juan &amp; &quot;Pedro&quot; &lt;Admin&gt;&#39;/);
    assert.doesNotMatch(mailHelada.html, /<strong>Juan & "Pedro"/);

    // En texto plano y subject NO debe estar escapado
    assert.match(mailHelada.subject, /<img src=x>/);
    assert.doesNotMatch(mailHelada.subject, /&lt;img/);
    assert.match(mailHelada.text, /Parcela: <img src=x>/);
    assert.match(mailHelada.text, /Hola Juan & "Pedro" <Admin>',/);
    assert.doesNotMatch(mailHelada.text, /&lt;img/);

    // Mismo chequeo para alerta SEQUIA
    const mailSequia = construirEmailAlerta({
      destinatarioEmail: 'productor@campo.ar',
      destinatarioNombre: '<Dueño>',
      parcelaId: 'p-malicious-2',
      parcelaNombre: '<img src=x>',
      alerta: {
        tipo: 'SEQUIA',
        fechaEvento: '2026-07-10',
        valorDetectado: 2.0,
        umbral: 10,
        mensaje: 'Sequía <alerta>',
      },
    });

    assert.match(mailSequia.html, /&lt;img src=x&gt;/);
    assert.doesNotMatch(mailSequia.html, /<img src=x>/);
    assert.match(mailSequia.html, /&lt;Dueño&gt;/);
    assert.match(mailSequia.subject, /<img src=x>/);
    assert.match(mailSequia.text, /<Dueño>/);
  });
});

describe('verificarAlertasDeParcela — Concurrencia y reclamo atómico (Bloqueante 2)', () => {
  it('dos verificaciones simultáneas de la misma parcela tienen que enviar un solo email', async () => {
    const { verificarAlertasDeParcela } = await import('./alertas.js');

    let emailEnviadoEnDb = false;
    let updateManyLlamado = false;
    const emailsEnviados: EmailAlertaPayload[] = [];

    // Mock atómico de la base de datos simulando PostgreSQL
    const mockDb = {
      parcela: {
        findUnique: async () => ({
          id: 'parcela-10',
          nombre: 'Campo Concurrente',
          userId: 'user-1',
          hectareas: 100,
          usuario: {
            id: 'user-1',
            email: 'productor@test.com',
            nombre: 'Productor Test',
          },
        }),
      },
      alerta: {
        findMany: async () => [],
        upsert: async () => ({
          id: 'alerta-100',
          userId: 'user-1',
          parcelaId: 'parcela-10',
          tipo: 'HELADA',
          fechaEvento: '2026-07-11',
          valorDetectado: -2,
          umbral: 0,
          mensaje: 'Helada prevista',
          emailEnviado: emailEnviadoEnDb,
          enviadoAt: null,
          leida: false,
          createdAt: new Date(),
        }),
        updateMany: async (args: { where: { id: string; emailEnviado: boolean } }) => {
          updateManyLlamado = true;
          if (args.where.emailEnviado === false && !emailEnviadoEnDb) {
            emailEnviadoEnDb = true;
            return { count: 1 };
          }
          return { count: 0 };
        },
        update: async () => ({
          id: 'alerta-100',
          userId: 'user-1',
          parcelaId: 'parcela-10',
          tipo: 'HELADA',
          fechaEvento: '2026-07-11',
          valorDetectado: -2,
          umbral: 0,
          mensaje: 'Helada prevista',
          emailEnviado: emailEnviadoEnDb,
          enviadoAt: new Date(),
          leida: false,
          createdAt: new Date(),
        }),
      },
    };

    const senderMock: EmailSender = async (payload) => {
      // Simula delay de red SMTP
      await new Promise((r) => setTimeout(r, 20));
      emailsEnviados.push(payload);
    };

    const pronosticoPreCargado = crearPronosticoBase([
      {},
      { tempMin: -2.0 }, // Helada en día 2
    ]);

    // Ejecutar dos verificaciones en paralelo
    const [res1, res2] = await Promise.all([
      verificarAlertasDeParcela('parcela-10', {
        pronosticoPreCargado,
        sender: senderMock,
        db: mockDb,
      }),
      verificarAlertasDeParcela('parcela-10', {
        pronosticoPreCargado,
        sender: senderMock,
        db: mockDb,
      }),
    ]);

    assert.ok(updateManyLlamado, 'Debe usar updateMany para reclamar atómicamente el envío');
    assert.equal(emailsEnviados.length, 1, 'Dos verificaciones simultáneas deben enviar exactamente un solo email');
    assert.ok(res1 !== null && res2 !== null);
  });
});

describe('Lectura lazy de umbrales y worker interval (Bloqueante 3)', () => {
  it('lee variables de entorno ALERTA_UMBRAL_* y ALERTAS_WORKER_INTERVAL_MS en forma lazy', async () => {
    const {
      obtenerUmbralesPorDefecto,
      obtenerWorkerIntervalMs,
      UMBRALES_POR_DEFECTO,
    } = await import('./alertas.js');

    const envPrevioHelada = process.env.ALERTA_UMBRAL_HELADA_C;
    const envPrevioSequia = process.env.ALERTA_UMBRAL_SEQUIA_MM;
    const envPrevioInterval = process.env.ALERTAS_WORKER_INTERVAL_MS;

    try {
      process.env.ALERTA_UMBRAL_HELADA_C = '-2.5';
      process.env.ALERTA_UMBRAL_SEQUIA_MM = '18';
      process.env.ALERTAS_WORKER_INTERVAL_MS = '7200000';

      const umbrales = obtenerUmbralesPorDefecto();
      assert.equal(umbrales.heladaC, -2.5);
      assert.equal(umbrales.sequiaMm, 18);
      assert.equal(obtenerWorkerIntervalMs(), 7200000);

      // Compatibilidad hacia atrás vía getter
      assert.equal(UMBRALES_POR_DEFECTO.heladaC, -2.5);
      assert.equal(UMBRALES_POR_DEFECTO.sequiaMm, 18);
    } finally {
      if (envPrevioHelada !== undefined) {
        process.env.ALERTA_UMBRAL_HELADA_C = envPrevioHelada;
      } else {
        delete process.env.ALERTA_UMBRAL_HELADA_C;
      }
      if (envPrevioSequia !== undefined) {
        process.env.ALERTA_UMBRAL_SEQUIA_MM = envPrevioSequia;
      } else {
        delete process.env.ALERTA_UMBRAL_SEQUIA_MM;
      }
      if (envPrevioInterval !== undefined) {
        process.env.ALERTAS_WORKER_INTERVAL_MS = envPrevioInterval;
      } else {
        delete process.env.ALERTAS_WORKER_INTERVAL_MS;
      }
    }
  });
});

describe('reenviarEmailAlerta — Errores tipados 404 (Mejora 4)', () => {
  it('lanza AlertaNotFoundError tipado cuando la alerta no existe o no pertenece al usuario', async () => {
    const { reenviarEmailAlerta, AlertaNotFoundError } = await import('./alertas.js');

    assert.ok(AlertaNotFoundError, 'AlertaNotFoundError debe estar exportado');

    await assert.rejects(
      async () => {
        await reenviarEmailAlerta('user-inexistente', 'alerta-inexistente', {
          alerta: {
            findFirst: async () => null,
          },
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof AlertaNotFoundError);
        assert.match((err as Error).message, /no encontrada/i);
        return true;
      },
    );
  });
});

describe('Contador de intentos de envío y backoff ante fallas de SMTP (Mejora 5)', () => {
  it('registra fallas de envío, aplica backoff y evita reintentos inmediatos en llamadas sucesivas', async () => {
    const {
      verificarAlertasDeParcela,
      obtenerEstadoFallaEnvio,
      limpiarRegistroFallasEnvio,
    } = await import('./alertas.js');

    assert.ok(obtenerEstadoFallaEnvio, 'obtenerEstadoFallaEnvio debe estar exportado');
    limpiarRegistroFallasEnvio();

    let intentosLlamadosSender = 0;
    const senderFalla: EmailSender = async () => {
      intentosLlamadosSender++;
      throw new Error('SMTP Connection timeout');
    };

    const alertaEnDb = {
      id: 'alerta-smtp-fail',
      userId: 'user-1',
      parcelaId: 'parcela-smtp',
      tipo: 'HELADA' as const,
      fechaEvento: '2026-07-11',
      valorDetectado: -1.5,
      umbral: 0,
      mensaje: 'Helada',
      emailEnviado: false,
      enviadoAt: null,
      leida: false,
      createdAt: new Date(),
    };

    const mockDb = {
      parcela: {
        findUnique: async () => ({
          id: 'parcela-smtp',
          nombre: 'Parcela SMTP',
          userId: 'user-1',
          hectareas: 50,
          usuario: {
            id: 'user-1',
            email: 'productor@test.com',
            nombre: 'Productor Test',
          },
        }),
      },
      alerta: {
        findMany: async () => [],
        upsert: async () => alertaEnDb,
        updateMany: async () => {
          if (!alertaEnDb.emailEnviado) {
            alertaEnDb.emailEnviado = true;
            return { count: 1 };
          }
          return { count: 0 };
        },
        update: async (args: { data: { emailEnviado?: boolean } }) => {
          alertaEnDb.emailEnviado = args.data.emailEnviado ?? alertaEnDb.emailEnviado;
          return alertaEnDb;
        },
      },
    };

    const pronosticoPreCargado = crearPronosticoBase([
      {},
      { tempMin: -1.5 },
    ]);

    // Primer intento: sender falla
    await verificarAlertasDeParcela('parcela-smtp', {
      pronosticoPreCargado,
      sender: senderFalla,
      db: mockDb,
    });

    assert.equal(intentosLlamadosSender, 1);
    const estado = obtenerEstadoFallaEnvio('alerta-smtp-fail');
    assert.ok(estado, 'Debe haber un estado registrado de falla');
    assert.equal(estado?.intentos, 1);
    assert.ok(estado!.proximoIntentoAt > Date.now());

    // Segundo intento inmediato (ej: un GET /clima consecutivo)
    const resSegundo = await verificarAlertasDeParcela('parcela-smtp', {
      pronosticoPreCargado,
      sender: senderFalla,
      db: mockDb,
    });

    // No debe haber llamado a sender nuevamente gracias al backoff
    assert.equal(intentosLlamadosSender, 1, 'No debe reintentar enviar email mientras esté en backoff');
    assert.ok(resSegundo?.omitidasPorDedupe.some((o) => /backoff/i.test(o.motivo)));

    limpiarRegistroFallasEnvio();
  });
});

describe('encolarVerificacionParcela — Cache de pronósticos precargados (Mejora 6)', () => {
  it('guarda los pronósticos precargados en un Map para que ninguna parcela encolada pierda el suyo', async () => {
    const { encolarVerificacionParcela } = await import('./alertas.js');

    const pronosticoA = crearPronosticoBase([{ tempMin: 1 }]);
    const pronosticoB = crearPronosticoBase([{ tempMin: 2 }]);

    // Importamos o verificamos que se mantenga el mapeo
    const { pronosticosPreCargadosCache } = await import('./alertas.js');
    assert.ok(pronosticosPreCargadosCache instanceof Map, 'pronosticosPreCargadosCache debe ser una instancia de Map');

    encolarVerificacionParcela('parcela-A', pronosticoA);
    encolarVerificacionParcela('parcela-B', pronosticoB);

    assert.equal(pronosticosPreCargadosCache.get('parcela-A'), pronosticoA);
    assert.equal(pronosticosPreCargadosCache.get('parcela-B'), pronosticoB);
  });
});

describe('Barrida programada — Flag de en ejecución y límite de concurrencia (Mejora 7)', () => {
  it('no solapa dos barridas simultáneas y respeta el límite de concurrencia', async () => {
    const {
      ejecutarBarridaProgramadaAlertas,
      isBarridaEnEjecucion,
    } = await import('./alertas.js');

    assert.ok(typeof isBarridaEnEjecucion === 'function', 'isBarridaEnEjecucion debe ser una función exportada');

    let concurrenciaActual = 0;
    let maxConcurrenciaMedida = 0;
    const parcelasMock = Array.from({ length: 8 }, (_, i) => ({ id: `p-${i + 1}` }));

    const mockDb = {
      parcela: {
        findMany: async () => parcelasMock,
      },
    };

    const verificadorMock = async (_id: string): Promise<VerificacionParcelaResultado | null> => {
      concurrenciaActual++;
      if (concurrenciaActual > maxConcurrenciaMedida) {
        maxConcurrenciaMedida = concurrenciaActual;
      }
      await new Promise((r) => setTimeout(r, 20));
      concurrenciaActual--;
      return {
        parcelaId: _id,
        parcelaNombre: 'Parcela',
        nuevas: [],
        omitidasPorDedupe: [],
      };
    };

    // Lanzar primera barrida y una segunda concurrente inmediatamente
    const promesaBarrida1 = ejecutarBarridaProgramadaAlertas({
      db: mockDb,
      limiteConcurrencia: 3,
      verificador: verificadorMock,
    });

    const promesaBarrida2 = ejecutarBarridaProgramadaAlertas({
      db: mockDb,
      limiteConcurrencia: 3,
      verificador: verificadorMock,
    });

    const [res1, res2] = await Promise.all([promesaBarrida1, promesaBarrida2]);

    // La segunda corrida debió omitirse por estar la primera en ejecución
    assert.equal(res2.omitidaPorSolapamiento, true, 'Segunda barrida concurrente debe ser omitida por solapamiento');
    assert.equal(res1.parcelasEvaluadas, 8);
    // El límite de concurrencia no debe superar 3
    assert.ok(maxConcurrenciaMedida <= 3, `Concurrencia medida (${maxConcurrenciaMedida}) debe ser <= 3`);
  });
});

describe('Deduplicación de SEQUIA en sequías sostenidas y con emailEnviado=false (Mejora 8)', () => {
  it('deduplica sequía sostenida cuando la fecha avanza y cuenta filas con emailEnviado=false', () => {
    const pronostico = crearPronosticoBase(
      Array.from({ length: 7 }, () => ({ precipitacion: 0 })),
    ); // fechaInicio: '2026-07-10'

    // Caso 1: fila previa con emailEnviado = false debe contar para el dedupe
    const resEmailFalse = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'Lote Seco',
      pronostico,
      alertasPrevias: [
        {
          tipo: 'SEQUIA',
          fechaEvento: '2026-07-10',
          emailEnviado: false, // aún no despachado / pendiente
        },
      ],
      umbrales: { sequiaMm: 10 },
    });

    assert.equal(
      resEmailFalse.candidatas.filter((c) => c.tipo === 'SEQUIA').length,
      0,
      'Debe deduplicar aunque emailEnviado sea false',
    );
    assert.equal(resEmailFalse.omitidasPorDedupe.length, 1);

    // Caso 2: sequía sostenida (la fecha del pronóstico cambió a 2026-07-10, alerta previa 2026-07-06 hace 4 días)
    const resSostenida = evaluarAlertasPronostico({
      parcelaId: 'parcela-1',
      parcelaNombre: 'Lote Seco',
      pronostico,
      alertasPrevias: [
        {
          tipo: 'SEQUIA',
          fechaEvento: '2026-07-06',
          emailEnviado: true,
        },
      ],
      umbrales: { sequiaMm: 10 },
    });

    assert.equal(
      resSostenida.candidatas.filter((c) => c.tipo === 'SEQUIA').length,
      0,
      'Una sequía sostenida activa dentro de la ventana de 7 días no debe volver a emitir alerta',
    );
    assert.equal(resSostenida.omitidasPorDedupe.length, 1);
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

