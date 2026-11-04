import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  BolsaCerealesFormatoError,
  extraerFechaPublicacion,
  normalizarPosicion,
  parsearPreciosOficiales,
  parsearSpotFlash,
} from './bolsaCereales.js';
import {
  CULTIVOS_MERCADO_VALIDOS,
  MercadoClientError,
  normalizarCultivoMercado,
} from './mercadoCatalogo.js';
import {
  calcularMetricasTendencia,
  claveOrdenPosicion,
  generarDescripcionPosicion,
} from './mercadoMetricas.js';

const FIXTURE = readFileSync(
  new URL('./__fixtures__/precios-oficiales.html', import.meta.url),
  'utf8',
);

describe('normalizarPosicion', () => {
  it('traduce los meses del sitio al código español', () => {
    assert.equal(normalizarPosicion('Nov26'), 'NOV26');
    assert.equal(normalizarPosicion('Dec26'), 'DIC26');
    assert.equal(normalizarPosicion('Jan27'), 'ENE27');
    assert.equal(normalizarPosicion('Aug27'), 'AGO27');
  });

  it('rechaza lo que no es un vencimiento mensual', () => {
    assert.equal(normalizarPosicion('2026'), null);
    assert.equal(normalizarPosicion('DISPONIBLE'), null);
    assert.equal(normalizarPosicion(''), null);
  });
});

describe('extraerFechaPublicacion', () => {
  it('lee la fecha del bloque "Fecha:"', () => {
    assert.equal(extraerFechaPublicacion(FIXTURE), '2026-11-04');
  });

  it('devuelve null si no hay fecha reconocible', () => {
    assert.equal(extraerFechaPublicacion('<html><body>sin fecha</body></html>'), null);
  });
});

describe('parsearPreciosOficiales', () => {
  it('extrae la fecha, las posiciones y los granos de la tabla FOB', () => {
    const resultado = parsearPreciosOficiales(FIXTURE);

    assert.equal(resultado.fecha, '2026-11-04');
    assert.deepEqual(
      [...new Set(resultado.cotizaciones.map((c) => c.posicion))].sort(),
      ['DIC26', 'ENE27', 'NOV26'],
    );
  });

  it('ignora los subproductos (aceites y pellets) y deja solo los granos modelados', () => {
    const resultado = parsearPreciosOficiales(FIXTURE);

    for (const cotizacion of resultado.cotizaciones) {
      assert.ok(
        (CULTIVOS_MERCADO_VALIDOS as readonly string[]).includes(cotizacion.cultivo),
        `cultivo inesperado: ${cotizacion.cultivo}`,
      );
    }
  });

  it('mapea cada columna a su cultivo con el valor correcto', () => {
    const resultado = parsearPreciosOficiales(FIXTURE);
    const buscar = (cultivo: string, posicion: string) =>
      resultado.cotizaciones.find((c) => c.cultivo === cultivo && c.posicion === posicion);

    assert.equal(buscar('Soja', 'NOV26')?.valor, 473);
    assert.equal(buscar('Maíz', 'NOV26')?.valor, 203);
    assert.equal(buscar('Trigo', 'NOV26')?.valor, 235);
    assert.equal(buscar('Cebada', 'NOV26')?.valor, 232);
    assert.equal(buscar('Girasol', 'NOV26')?.valor, 606);
    assert.equal(buscar('Sorgo', 'NOV26')?.valor, 221);
  });

  it('descarta los vencimientos sin cotización ("s/c")', () => {
    const resultado = parsearPreciosOficiales(FIXTURE);
    const buscar = (cultivo: string, posicion: string) =>
      resultado.cotizaciones.find((c) => c.cultivo === cultivo && c.posicion === posicion);

    assert.equal(buscar('Cebada', 'DIC26'), undefined);
    assert.equal(buscar('Girasol', 'DIC26'), undefined);
    assert.equal(buscar('Sorgo', 'DIC26'), undefined);
    // Los que sí tienen valor en esa posición siguen estando.
    assert.equal(buscar('Maíz', 'DIC26')?.valor, 207);
  });

  it('falla con error de formato cuando no encuentra la tabla', () => {
    assert.throws(
      () => parsearPreciosOficiales('<html><body><p>mantenimiento</p></body></html>'),
      BolsaCerealesFormatoError,
    );
  });

  it('falla con error de formato cuando la tabla no tiene granos conocidos', () => {
    const html = `<table class="tabla-cotizaciones">
      <thead><tr><td colspan="2">Posición</td><td>Girasol ornamental<br>USD/TN</td></tr></thead>
      <tbody><tr><td colspan="2">Nov26</td><td>100</td></tr></tbody>
    </table>`;

    assert.throws(() => parsearPreciosOficiales(html), BolsaCerealesFormatoError);
  });
});

describe('parsearSpotFlash', () => {
  const flash = `<section class="flash-cotizaciones">
    <h1>Flash de Cotizaciones</h1>
    <div class="fecha-modulo-sidebar">04/11/2026</div>
    <table class="flash active" id="flash-trigo">
      <tr><td colspan="4" class="bold">FOB MAGyP</td></tr>
      <tr><td>Spot US$/t</td><td>03/11</td><td></td><td>233</td></tr>
    </table>
    <table class="flash" id="flash-soja">
      <tr><td colspan="4" class="bold">FOB MAGyP</td></tr>
      <tr><td>Spot US$/t</td><td>03/11</td><td></td><td>474</td></tr>
    </table>
    <table class="flash" id="flash-desconocido">
      <tr><td>Spot US$/t</td><td>03/11</td><td></td><td>999</td></tr>
    </table>
  </section>`;

  it('asocia cada spot al cultivo que declara el id de la tabla', () => {
    const resultado = parsearSpotFlash(flash);

    assert.equal(resultado.spot.Trigo, 233);
    assert.equal(resultado.spot.Soja, 474);
    assert.equal(resultado.fecha, '2026-11-04');
  });

  it('ignora tablas de cultivos que la app no modela', () => {
    const resultado = parsearSpotFlash(flash);

    assert.equal(Object.keys(resultado.spot).length, 2);
    assert.ok(!Object.values(resultado.spot).includes(999));
  });

  it('no rompe si el bloque no existe: devuelve vacío con advertencia', () => {
    const resultado = parsearSpotFlash('<html><body>nada</body></html>');

    assert.deepEqual(resultado.spot, {});
    assert.equal(resultado.advertencias.length, 1);
  });
});

describe('normalizarCultivoMercado', () => {
  it('reconoce los cultivos del catálogo sin importar mayúsculas ni tildes', () => {
    assert.equal(normalizarCultivoMercado('soja'), 'Soja');
    assert.equal(normalizarCultivoMercado('SOJA 1RA'), 'Soja');
    assert.equal(normalizarCultivoMercado('maiz'), 'Maíz');
    assert.equal(normalizarCultivoMercado('Maíz tardío'), 'Maíz');
    assert.equal(normalizarCultivoMercado('trigo pan'), 'Trigo');
    assert.equal(normalizarCultivoMercado('GIRASOL'), 'Girasol');
    assert.equal(normalizarCultivoMercado('sorgo'), 'Sorgo');
    assert.equal(normalizarCultivoMercado('cebada'), 'Cebada');
  });

  it('rechaza cultivos no modelados con un error de cliente', () => {
    assert.throws(() => normalizarCultivoMercado('arroz'), MercadoClientError);
  });

  it('el catálogo es la única lista de cultivos válidos', () => {
    assert.deepEqual([...CULTIVOS_MERCADO_VALIDOS], [
      'Soja',
      'Maíz',
      'Trigo',
      'Girasol',
      'Sorgo',
      'Cebada',
    ]);
  });
});

describe('mercadoMetricas', () => {
  it('describe la posición en castellano', () => {
    assert.equal(generarDescripcionPosicion('NOV26'), 'Noviembre 2026');
    assert.equal(generarDescripcionPosicion('DISPONIBLE'), 'Disponible');
    assert.equal(generarDescripcionPosicion('raro'), 'raro');
  });

  it('ordena los vencimientos por fecha real, no alfabéticamente', () => {
    assert.equal(claveOrdenPosicion('DISPONIBLE'), 0);
    assert.ok(claveOrdenPosicion('DIC26') < claveOrdenPosicion('ENE27'));
    assert.ok(claveOrdenPosicion('ENE27') < claveOrdenPosicion('NOV27'));
    assert.equal(claveOrdenPosicion('raro'), Number.MAX_SAFE_INTEGER);
  });

  it('calcula mínimo, máximo, promedio y variación', () => {
    const metricas = calcularMetricasTendencia([
      { fecha: '2026-11-01', valor: 100, posicion: 'DISPONIBLE' },
      { fecha: '2026-11-02', valor: 110, posicion: 'DISPONIBLE' },
      { fecha: '2026-11-03', valor: 120, posicion: 'DISPONIBLE' },
    ]);

    assert.deepEqual(metricas, { minimo: 100, maximo: 120, promedio: 110, variacionTotalPct: 20 });
  });

  it('devuelve ceros con una serie vacía y no divide por cero', () => {
    assert.deepEqual(calcularMetricasTendencia([]), {
      minimo: 0,
      maximo: 0,
      promedio: 0,
      variacionTotalPct: 0,
    });

    const conCero = calcularMetricasTendencia([
      { fecha: '2026-11-01', valor: 0, posicion: 'DISPONIBLE' },
      { fecha: '2026-11-02', valor: 50, posicion: 'DISPONIBLE' },
    ]);
    assert.equal(conCero.variacionTotalPct, 0);
  });
});
