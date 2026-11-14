import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcularRecomendacion,
  calcularDiasConRiesgoHelada,
  esPronosticoValido,
  round1,
} from './recomendacion.js';
import type {
  ClimaDisponible,
  CandidatoPuntaje,
  PrecioDisponible,
  PronosticoDia,
  RegistroHistorial,
} from './recomendacion.js';
import type { CultivoCatalogoItem, ReglaTransicionItem } from './rotacion.js';

const cultivo = (
  nombre: string,
  familiaBotanica: string,
  tempMinCritica: number,
  aniosEsperaMismaFamilia = 1,
): CultivoCatalogoItem => ({
  nombre,
  familiaBotanica,
  cicloDias: 140,
  tempMinCritica,
  efectoSuelo: `Aporta cobertura al suelo. Mejora la estructura de ${nombre}.`,
  aniosEsperaMismaFamilia,
  recomendacionSucesion: 'Alternar con otra familia botánica.',
  fuente: 'test',
  prioridadBase: 3,
});

const CATALOGO: CultivoCatalogoItem[] = [
  cultivo('Soja 1ra', 'Leguminosa', 4, 3),
  cultivo('Maíz tardío', 'Gramínea', 6, 1),
  cultivo('Trigo pan', 'Gramínea', 2, 1),
  cultivo('Girasol', 'Asterácea', 3, 3),
];

const REGLAS: ReglaTransicionItem[] = [
  {
    cultivoAnterior: 'Soja 1ra',
    cultivoSiguiente: 'Maíz tardío',
    aniosEsperaMin: 0,
    efectoSuelo: 'Aporta nitrógeno al suelo. Mejora la estructura.',
    prioridadSugerencia: 5,
  },
];

const HISTORIAL: RegistroHistorial[] = [{ cultivo: 'Soja 1ra', campania: '2026/27' }];

const climaConMinima = (tempMin: number): ClimaDisponible => ({
  fuente: 'live',
  antiguedadHoras: 1,
  dias: Array.from({ length: 7 }, (_, indice) => ({
    fecha: `2026-11-${String(indice + 1).padStart(2, '0')}`,
    tempMax: tempMin + 12,
    tempMin,
    precipitacion: 0,
  })),
});

const preciosBd = (valores: Record<string, number>): PrecioDisponible => ({
  fuente: 'bd',
  antiguedadDias: 0,
  moneda: 'USD/t',
  valores,
});

const PRECIOS: PrecioDisponible = preciosBd({
  'Soja 1ra': 320,
  'Maíz tardío': 190,
  'Trigo pan': 230,
  Girasol: 200,
});

const factorDe = (candidato: CandidatoPuntaje, nombre: 'rotacion' | 'clima' | 'precio') =>
  candidato.factores.find((factor) => factor.nombre === nombre);

describe('esPronosticoValido', () => {
  it('valida correctamente un array de dias con tempMin numerico', () => {
    assert.equal(
      esPronosticoValido([
        { fecha: '2026-11-01', tempMax: 20, tempMin: 10, precipitacion: 0 },
      ]),
      true,
    );
  });

  it('rechaza null, objetos, arrays vacios o dias sin tempMin numerico', () => {
    assert.equal(esPronosticoValido(null), false);
    assert.equal(esPronosticoValido({}), false);
    assert.equal(esPronosticoValido([]), false);
    assert.equal(esPronosticoValido([{ fecha: '2026-11-01' }]), false);
    assert.equal(esPronosticoValido([{ tempMin: 'no-numero' }]), false);
    assert.equal(esPronosticoValido([{ tempMin: NaN }]), false);
  });
});

describe('calcularDiasConRiesgoHelada', () => {
  it('si el cultivo recomendado no tiene tempMinCritica devuelve null', () => {
    const dias: PronosticoDia[] = [
      { fecha: '2026-11-01', tempMax: 20, tempMin: -2, precipitacion: 0 },
      { fecha: '2026-11-02', tempMax: 22, tempMin: 5, precipitacion: 0 },
    ];
    assert.equal(calcularDiasConRiesgoHelada(null, dias), null);
    assert.equal(calcularDiasConRiesgoHelada(undefined, dias), null);
  });

  it('si el cultivo tiene tempMinCritica cuenta los dias con minima menor o igual al umbral', () => {
    const dias: PronosticoDia[] = [
      { fecha: '2026-11-01', tempMax: 20, tempMin: 2, precipitacion: 0 },
      { fecha: '2026-11-02', tempMax: 22, tempMin: 5, precipitacion: 0 },
      { fecha: '2026-11-03', tempMax: 18, tempMin: 3, precipitacion: 0 },
    ];
    assert.equal(calcularDiasConRiesgoHelada(3, dias), 2);
  });
});

describe('calcularRecomendacion', () => {
  it('con un historial que excluye todos los cultivos, recomendacion tiene que ser null', () => {
    const catalogo: CultivoCatalogoItem[] = [
      cultivo('Soja 1ra', 'Leguminosa', 4, 3),
      cultivo('Soja 2da', 'Leguminosa', 4, 3),
    ];
    const resultado = calcularRecomendacion({
      catalogo,
      reglas: [],
      historial: [{ cultivo: 'Soja 1ra', campania: '2026/27' }],
      clima: climaConMinima(12),
      precios: preciosBd({ 'Soja 1ra': 320, 'Soja 2da': 300 }),
      anioVigente: 2026,
    });

    assert.equal(resultado.recomendacion, null);
    assert.equal(resultado.alternativas.length, 0);
    assert.ok(resultado.cultivosEvaluados.every((c) => c.excluido));
    assert.ok(
      resultado.advertencias.some((adv) => /rotación/i.test(adv)),
    );
  });

  it('con aniosEsperaMin=1 y el último cultivo en la campaña actual, el sucesor no tiene que quedar excluido', () => {
    const catalogo: CultivoCatalogoItem[] = [
      cultivo('Soja 1ra', 'Leguminosa', 4, 3),
      cultivo('Maíz tardío', 'Gramínea', 6, 1),
    ];
    const reglas: ReglaTransicionItem[] = [
      {
        cultivoAnterior: 'Soja 1ra',
        cultivoSiguiente: 'Maíz tardío',
        aniosEsperaMin: 1,
        efectoSuelo: 'Aporta nitrógeno.',
        prioridadSugerencia: 5,
      },
    ];

    const resultado = calcularRecomendacion({
      catalogo,
      reglas,
      historial: [{ cultivo: 'Soja 1ra', campania: '2026/27' }],
      clima: climaConMinima(12),
      precios: preciosBd({ 'Soja 1ra': 320, 'Maíz tardío': 190 }),
      anioVigente: 2026,
    });

    const maiz = resultado.cultivosEvaluados.find((c) => c.cultivo === 'Maíz tardío');
    assert.ok(maiz);
    assert.equal(maiz.excluido, false);
    assert.equal(resultado.recomendacion?.cultivo, 'Maíz tardío');
  });

  it('con una campaña no parseable, no se excluye por espera y agrega una advertencia', () => {
    const catalogo: CultivoCatalogoItem[] = [
      cultivo('Soja 1ra', 'Leguminosa', 4, 3),
      cultivo('Maíz tardío', 'Gramínea', 6, 1),
    ];
    const reglas: ReglaTransicionItem[] = [
      {
        cultivoAnterior: 'Soja 1ra',
        cultivoSiguiente: 'Maíz tardío',
        aniosEsperaMin: 2,
        efectoSuelo: 'Aporta nitrógeno.',
        prioridadSugerencia: 5,
      },
    ];

    const resultado = calcularRecomendacion({
      catalogo,
      reglas,
      historial: [{ cultivo: 'Soja 1ra', campania: 'campania-invalida' }],
      clima: climaConMinima(12),
      precios: preciosBd({ 'Soja 1ra': 320, 'Maíz tardío': 190 }),
      anioVigente: 2026,
    });

    const maiz = resultado.cultivosEvaluados.find((c) => c.cultivo === 'Maíz tardío');
    assert.ok(maiz);
    assert.equal(maiz.excluido, false);
    assert.ok(
      resultado.advertencias.some((adv) => /campania-invalida/i.test(adv) || /campaña/i.test(adv)),
    );
  });

  it('con historial recomienda el sucesor explícito y aplica el peso de rotación', () => {
    const resultado = calcularRecomendacion({
      catalogo: CATALOGO,
      reglas: REGLAS,
      historial: HISTORIAL,
      clima: climaConMinima(12),
      precios: PRECIOS,
      anioVigente: 2026,
    });

    assert.equal(resultado.recomendacion?.cultivo, 'Maíz tardío');
    assert.equal(resultado.tieneHistorial, true);

    const rotacion = resultado.recomendacion
      ? factorDe(resultado.recomendacion, 'rotacion')
      : undefined;
    assert.ok(rotacion);
    assert.ok(rotacion.peso > 0);
    assert.equal(rotacion.valor, 100);
  });

  it('sin historial renormaliza clima y precio y deja rotación en cero', () => {
    const resultado = calcularRecomendacion({
      catalogo: CATALOGO,
      reglas: REGLAS,
      historial: [],
      clima: climaConMinima(12),
      precios: PRECIOS,
      anioVigente: 2026,
    });

    assert.equal(typeof resultado.sugerencia, 'string');
    assert.equal(resultado.pesosAplicados.rotacion, 0);
    assert.ok(resultado.recomendacion);
    assert.ok(
      resultado.recomendacion.factores.every((factor) => factor.nombre !== 'rotacion'),
    );
    assert.ok(
      Math.abs(resultado.pesosAplicados.clima + resultado.pesosAplicados.precio - 1) < 1e-9,
    );
  });

  it('un cultivo sin precio no puntua mejor que uno con precio real y redistribuye pesos', () => {
    const catalogo: CultivoCatalogoItem[] = [
      cultivo('Trigo pan', 'Gramínea', 2, 1),
      cultivo('Soja 1ra', 'Leguminosa', 4, 1),
      cultivo('Maíz tardío', 'Gramínea', 6, 1),
    ];
    // Trigo tiene precio mínimo (100), Soja precio máximo (300), Maíz sin precio
    const resultado = calcularRecomendacion({
      catalogo,
      reglas: [],
      historial: [],
      clima: climaConMinima(12),
      precios: preciosBd({ 'Trigo pan': 100, 'Soja 1ra': 300 }),
      anioVigente: 2026,
    });

    const trigo = resultado.cultivosEvaluados.find((c) => c.cultivo === 'Trigo pan')!;
    const maiz = resultado.cultivosEvaluados.find((c) => c.cultivo === 'Maíz tardío')!;

    const factorPrecioTrigo = factorDe(trigo, 'precio');
    const factorPrecioMaiz = factorDe(maiz, 'precio');

    // Maíz no debe tener un factor de precio que supere al precio real mínimo
    assert.ok(factorPrecioTrigo);
    assert.equal(factorPrecioMaiz, undefined);

    // Los pesos de Maíz deben estar redistribuidos para sumar 1 (solo clima en este caso sin historial)
    const sumaPesosMaiz = maiz.factores.reduce((total, f) => total + f.peso, 0);
    assert.ok(Math.abs(sumaPesosMaiz - 1) < 1e-9);
  });

  it('si hay un solo precio o todos son iguales, ningún cultivo queda favorecido por precio', () => {
    const catalogo: CultivoCatalogoItem[] = [
      cultivo('Trigo pan', 'Gramínea', 2, 1),
      cultivo('Soja 1ra', 'Leguminosa', 4, 1),
    ];
    // Caso 1: precios iguales
    const resIguales = calcularRecomendacion({
      catalogo,
      reglas: [],
      historial: [],
      clima: climaConMinima(12),
      precios: preciosBd({ 'Trigo pan': 200, 'Soja 1ra': 200 }),
      anioVigente: 2026,
    });
    const trigoIgual = resIguales.cultivosEvaluados.find((c) => c.cultivo === 'Trigo pan')!;
    const sojaIgual = resIguales.cultivosEvaluados.find((c) => c.cultivo === 'Soja 1ra')!;
    assert.equal(factorDe(trigoIgual, 'precio')?.valor, 50);
    assert.equal(factorDe(sojaIgual, 'precio')?.valor, 50);

    // Caso 2: un solo precio en todo el catálogo
    const resUnSoloPrecio = calcularRecomendacion({
      catalogo,
      reglas: [],
      historial: [],
      clima: climaConMinima(12),
      precios: preciosBd({ 'Trigo pan': 200 }),
      anioVigente: 2026,
    });
    const trigoSolo = resUnSoloPrecio.cultivosEvaluados.find((c) => c.cultivo === 'Trigo pan')!;
    const sojaSolo = resUnSoloPrecio.cultivosEvaluados.find((c) => c.cultivo === 'Soja 1ra')!;
    // Ninguno queda favorecido por precio: aportes de precio idénticos o no favorecedores
    const aporteTrigo = factorDe(trigoSolo, 'precio')?.aporte ?? 0;
    const aporteSoja = factorDe(sojaSolo, 'precio')?.aporte ?? 0;
    assert.equal(aporteTrigo, aporteSoja);
  });

  it('calcula el puntaje como la suma exacta de los aportes ya redondeados', () => {
    const resultado = calcularRecomendacion({
      catalogo: CATALOGO,
      reglas: REGLAS,
      historial: HISTORIAL,
      clima: climaConMinima(7),
      precios: PRECIOS,
      anioVigente: 2026,
    });

    for (const candidato of resultado.cultivosEvaluados) {
      const sumaAportes = round1(
        candidato.factores.reduce((total, f) => total + f.aporte, 0),
      );
      assert.equal(candidato.puntaje, sumaAportes);
    }
  });

  it('penaliza el cultivo sensible a heladas con el pronóstico bajo el umbral', () => {
    const catalogo: CultivoCatalogoItem[] = [
      cultivo('Trigo pan', 'Gramínea', 0, 1),
      cultivo('Cebada cervecera', 'Gramínea', 6, 1),
    ];

    const resultado = calcularRecomendacion({
      catalogo,
      reglas: [],
      historial: [],
      clima: climaConMinima(2),
      precios: preciosBd({ 'Trigo pan': 200, 'Cebada cervecera': 200 }),
      anioVigente: 2026,
    });

    const trigo = resultado.cultivosEvaluados.find((c) => c.cultivo === 'Trigo pan');
    const cebada = resultado.cultivosEvaluados.find((c) => c.cultivo === 'Cebada cervecera');
    assert.ok(trigo);
    assert.ok(cebada);

    assert.ok(cebada.puntaje < trigo.puntaje);

    const climaCebada = factorDe(cebada, 'clima');
    assert.ok(climaCebada);
    assert.match(climaCebada.motivo, /helada/);
  });

  it('excluye al cultivo que no respeta la espera de la misma familia', () => {
    const catalogo: CultivoCatalogoItem[] = [
      cultivo('Trigo pan', 'Gramínea', 2, 1),
      cultivo('Cebada cervecera', 'Gramínea', 2, 2),
      cultivo('Soja 1ra', 'Leguminosa', 4, 3),
    ];

    const resultado = calcularRecomendacion({
      catalogo,
      reglas: [],
      historial: [{ cultivo: 'Trigo pan', campania: '2026/27' }],
      clima: climaConMinima(12),
      precios: preciosBd({
        'Trigo pan': 230,
        'Cebada cervecera': 210,
        'Soja 1ra': 320,
      }),
      anioVigente: 2026,
    });

    const cebada = resultado.cultivosEvaluados.find(
      (c) => c.cultivo === 'Cebada cervecera',
    );
    assert.ok(cebada);
    assert.equal(cebada.excluido, true);
    assert.match(cebada.motivoExclusion ?? '', /espera/);
  });

  it('sin clima deja el peso climático en cero y advierte, renormalizando el resto', () => {
    const resultado = calcularRecomendacion({
      catalogo: CATALOGO,
      reglas: REGLAS,
      historial: HISTORIAL,
      clima: { fuente: 'no_disponible', antiguedadHoras: null, dias: [] },
      precios: PRECIOS,
      anioVigente: 2026,
    });

    assert.equal(resultado.pesosAplicados.clima, 0);
    assert.ok(
      resultado.advertencias.some((advertencia) => /Clima no disponible/.test(advertencia)),
    );
    const suma =
      resultado.pesosAplicados.rotacion +
      resultado.pesosAplicados.clima +
      resultado.pesosAplicados.precio;
    assert.ok(Math.abs(suma - 1) < 1e-9);
  });

  it('advierte cuando los precios son simulados', () => {
    const resultado = calcularRecomendacion({
      catalogo: CATALOGO,
      reglas: REGLAS,
      historial: HISTORIAL,
      clima: climaConMinima(12),
      precios: {
        fuente: 'simulado',
        antiguedadDias: null,
        moneda: 'USD/t',
        valores: { 'Maíz tardío': 190, 'Trigo pan': 230, Girasol: 200 },
      },
      anioVigente: 2026,
    });

    assert.ok(
      resultado.advertencias.some((advertencia) => /simulados/.test(advertencia)),
    );
  });
});
