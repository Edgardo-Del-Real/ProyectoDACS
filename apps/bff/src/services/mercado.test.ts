import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarCultivoMercado,
  MercadoClientError,
  CULTIVOS_MERCADO_VALIDOS,
  obtenerCotizacionesMercado,
  obtenerTendenciaMercado,
  mercadoBreaker,
} from './mercado.js';

describe('normalizarCultivoMercado', () => {
  it('reconoce los cultivos agrícolas principales sin importar mayúsculas o tildes', () => {
    assert.equal(normalizarCultivoMercado('soja'), 'Soja');
    assert.equal(normalizarCultivoMercado('SOJA 1RA'), 'Soja');
    assert.equal(normalizarCultivoMercado('maiz'), 'Maíz');
    assert.equal(normalizarCultivoMercado('Maíz tardío'), 'Maíz');
    assert.equal(normalizarCultivoMercado('trigo pan'), 'Trigo');
    assert.equal(normalizarCultivoMercado('GIRASOL'), 'Girasol');
    assert.equal(normalizarCultivoMercado('sorgo'), 'Sorgo');
    assert.equal(normalizarCultivoMercado('cebada'), 'Cebada');
  });

  it('rechaza cultivos no contemplados con MercadoClientError', () => {
    assert.throws(() => normalizarCultivoMercado('arroz'), (err) => {
      assert(err instanceof MercadoClientError);
      return true;
    });
    assert.throws(() => normalizarCultivoMercado('papas'), MercadoClientError);
  });

  it('lista completa de cultivos válidos disponibles', () => {
    assert.deepEqual(CULTIVOS_MERCADO_VALIDOS, [
      'Soja',
      'Maíz',
      'Trigo',
      'Girasol',
      'Sorgo',
      'Cebada',
    ]);
  });
});

describe('obtenerCotizacionesMercado', () => {
  it('devuelve cotizaciones vigentes con spot y contratos por vencimiento (Criterio 1)', async () => {
    const res = await obtenerCotizacionesMercado('Soja');

    assert.equal(res.cultivo, 'Soja');
    assert.equal(res.stale, false);
    assert.ok(res.cotizaciones.length >= 4, 'Debe tener al menos 4 posiciones de futuros');
    assert.ok(typeof res.spotActual === 'number' && res.spotActual > 200, 'Spot debe ser un número positivo');
    assert.ok(res.futuroCercano !== null, 'Debe identificar el futuro más cercano');
    assert.ok(res.cotizaciones.some((c) => c.posicion === 'DISPONIBLE'));
    assert.ok(res.cotizaciones.some((c) => c.posicion === 'MAY25'));
  });

  it('activa fallback con stale: true ante caída del proveedor (Criterio 2)', async () => {
    const res = await obtenerCotizacionesMercado('Soja', true);

    assert.equal(res.cultivo, 'Soja');
    assert.equal(res.stale, true, 'Debe indicar que los datos provienen de la caché');
    assert.ok(res.cotizaciones.length > 0, 'Debe retornar datos desde la base de datos');
    assert.match(res.fuente, /caché/i);
  });
});

describe('obtenerTendenciaMercado', () => {
  it('calcula serie histórica de precios y métricas de variación (Criterio 3)', async () => {
    const res = await obtenerTendenciaMercado('Trigo', 'DISPONIBLE', 15);

    assert.equal(res.cultivo, 'Trigo');
    assert.equal(res.posicion, 'DISPONIBLE');
    assert.ok(res.puntos.length >= 10, 'Debe contener los puntos diarios de la serie');
    assert.ok(res.maximo >= res.minimo, 'Máximo debe ser mayor o igual al mínimo');
    assert.ok(res.promedio >= res.minimo && res.promedio <= res.maximo, 'Promedio debe estar acotado');
    assert.ok(typeof res.variacionTotalPct === 'number', 'Variación porcentual debe ser numérica');
  });
});

describe('mercadoBreaker', () => {
  it('inicia en estado CLOSED', () => {
    assert.equal(mercadoBreaker.getState(), 'CLOSED');
  });
});
