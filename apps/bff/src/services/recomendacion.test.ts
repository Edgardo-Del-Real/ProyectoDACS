import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcularRecomendacion } from './recomendacion.js';
import type {
  ClimaDisponible,
  CandidatoPuntaje,
  PrecioDisponible,
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

const HISTORIAL: RegistroHistorial[] = [{ cultivo: 'Soja 1ra', campania: '2024/25' }];

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

describe('calcularRecomendacion', () => {
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
      historial: [{ cultivo: 'Trigo pan', campania: '2025/26' }],
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
