import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcularPlanRotacion,
  codigoFamilia,
  parsearCampania,
  resolverNombreCanonico,
} from './rotacion.js';
import type { CultivoCatalogoItem } from './rotacion.js';

const cultivo = (
  nombre: string,
  familiaBotanica: string,
  aniosEsperaMismaFamilia = 1,
  prioridadBase = 3,
): CultivoCatalogoItem => ({
  nombre,
  familiaBotanica,
  efectoSuelo: `Efecto de ${nombre}`,
  aniosEsperaMismaFamilia,
  recomendacionSucesion: 'Alternar con otra familia botánica.',
  fuente: 'test',
  prioridadBase,
});

const CATALOGO: CultivoCatalogoItem[] = [
  cultivo('Soja 1ra', 'Leguminosa', 1, 4),
  cultivo('Maíz tardío', 'Gramínea', 1, 5),
  cultivo('Trigo pan', 'Gramínea', 1, 4),
  cultivo('Girasol', 'Asterácea', 3, 3),
  cultivo('Sorgo granífero', 'Gramínea', 1, 3),
];

/** Campaña agrícola de julio a junio: noviembre de 2026 pertenece a 2026/2027. */
const FECHA_NOV_2026 = new Date('2026-11-01T12:00:00.000Z');

const historial = (campania: string, nombreCultivo: string) => ({
  campania,
  cultivo: nombreCultivo,
  createdAt: new Date('2025-05-01T12:00:00.000Z'),
});

describe('parsearCampania', () => {
  it('acepta un año suelto', () => {
    assert.equal(parsearCampania('2025'), 2025);
  });

  it('acepta el par de años en sus dos formatos', () => {
    assert.equal(parsearCampania('2025/26'), 2025);
    assert.equal(parsearCampania('2025-2026'), 2025);
    assert.equal(parsearCampania('2025/2026'), 2025);
  });

  it('rechaza años no consecutivos y texto libre', () => {
    assert.equal(parsearCampania('2025/2027'), null);
    assert.equal(parsearCampania('campaña gruesa'), null);
    assert.equal(parsearCampania(''), null);
  });
});

describe('codigoFamilia', () => {
  it('reconoce las familias agronómicas del catálogo', () => {
    assert.equal(codigoFamilia('Gramínea'), 'POACEAE');
    assert.equal(codigoFamilia('Poaceae'), 'POACEAE');
    assert.equal(codigoFamilia('Leguminosa'), 'FABACEAE');
    assert.equal(codigoFamilia('Asterácea'), 'ASTERACEAE');
  });

  it('separa cobertura de familia desconocida', () => {
    assert.equal(codigoFamilia('Barbecho'), 'COBERTURA');
    assert.equal(codigoFamilia('Otra / No catalogada'), 'OTRA');
  });
});

describe('resolverNombreCanonico', () => {
  it('normaliza los nombres cortos del frontend al catálogo', () => {
    assert.equal(resolverNombreCanonico('trigo'), 'Trigo pan');
    assert.equal(resolverNombreCanonico('Maíz temprano'), 'Maíz tardío');
    assert.equal(resolverNombreCanonico('Cebada'), 'Cebada cervecera');
    assert.equal(resolverNombreCanonico('soja 2da'), 'Soja 1ra');
  });

  it('deja intacto un nombre que ya es canónico', () => {
    assert.equal(resolverNombreCanonico('Girasol'), 'Girasol');
  });
});

describe('calcularPlanRotacion', () => {
  it('sin historial no inventa una secuencia', () => {
    const plan = calcularPlanRotacion({ registros: [], catalogo: CATALOGO, fecha: FECHA_NOV_2026 });

    assert.equal(plan.tieneHistorial, false);
    assert.equal(plan.ultimoCultivo, null);
    assert.deepEqual(plan.secuencia, []);
  });

  it('devuelve tantos pasos como el horizonte pedido', () => {
    const plan = calcularPlanRotacion({
      registros: [historial('2024/2025', 'Soja 1ra')],
      catalogo: CATALOGO,
      fecha: FECHA_NOV_2026,
      horizonteAnios: 4,
    });

    assert.equal(plan.tieneHistorial, true);
    assert.equal(plan.secuencia.length, 4);
    assert.deepEqual(
      plan.secuencia.map((paso) => paso.campania),
      ['2026/2027', '2027/2028', '2028/2029', '2029/2030'],
    );
  });

  it('nunca repite familia botánica en campañas consecutivas', () => {
    const plan = calcularPlanRotacion({
      registros: [historial('2024/2025', 'Soja 1ra')],
      catalogo: CATALOGO,
      fecha: FECHA_NOV_2026,
      horizonteAnios: 4,
    });

    const familias = plan.secuencia.map((paso) => paso.familiaBotanica);
    for (let i = 1; i < familias.length; i++) {
      assert.notEqual(familias[i], familias[i - 1], `paso ${i + 1} repite familia`);
    }
  });

  it('ignora campañas inválidas y futuras, y lo informa en supuestos', () => {
    const plan = calcularPlanRotacion({
      registros: [
        historial('2024/2025', 'Soja 1ra'),
        historial('campaña vieja', 'Trigo pan'),
        historial('2030/2031', 'Maíz tardío'),
      ],
      catalogo: CATALOGO,
      fecha: FECHA_NOV_2026,
    });

    assert.equal(plan.registrosIgnorados, 2);
    assert.ok(plan.supuestos.length >= 2);
    assert.equal(plan.ultimoCultivo?.cultivo, 'Soja 1ra');
  });

  it('respeta los cultivos excluidos por el productor', () => {
    const plan = calcularPlanRotacion({
      registros: [historial('2024/2025', 'Soja 1ra')],
      catalogo: CATALOGO,
      fecha: FECHA_NOV_2026,
      horizonteAnios: 2,
      cultivosExcluidos: ['Soja 1ra', 'Maíz tardío', 'Trigo pan', 'Sorgo granífero'],
    });

    assert.equal(plan.secuencia[0].cultivo, 'Girasol');
    // Girasol pide 3 campañas de espera: la segunda no puede repetirlo.
    assert.equal(plan.secuencia[1].estado, 'sin_alternativa');
  });

  it('bloquea Fabáceas después de Asteráceas por Sclerotinia', () => {
    const plan = calcularPlanRotacion({
      registros: [historial('2025/2026', 'Girasol')],
      catalogo: CATALOGO,
      fecha: FECHA_NOV_2026,
      horizonteAnios: 1,
      cultivosExcluidos: ['Maíz tardío', 'Trigo pan', 'Sorgo granífero'],
    });

    // Queda solo Soja 1ra, que comparte Sclerotinia con el girasol anterior.
    assert.equal(plan.secuencia[0].estado, 'sin_alternativa');
    assert.equal(plan.secuencia[0].cultivo, null);
  });

  it('marca datos insuficientes cuando el historial no tiene familia identificable', () => {
    const plan = calcularPlanRotacion({
      registros: [historial('2025/2026', 'Cultivo raro sin catalogar')],
      catalogo: CATALOGO,
      fecha: FECHA_NOV_2026,
      horizonteAnios: 1,
    });

    assert.equal(plan.secuencia[0].estado, 'datos_insuficientes');
    assert.ok(plan.supuestos.some((supuesto) => supuesto.includes('familia indeterminada')));
  });
});
