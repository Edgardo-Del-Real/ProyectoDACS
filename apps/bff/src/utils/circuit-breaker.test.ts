import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, it } from 'node:test';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  NonRetryableError,
} from './circuit-breaker.js';

/** Acción que siempre falla con un error de servidor (cuenta como fallo). */
const fallaServidor = () => Promise.reject(new Error('proveedor caído'));

describe('CircuitBreaker', () => {
  it('arranca cerrado y deja pasar las llamadas', async () => {
    const breaker = new CircuitBreaker({ name: 'Test' });

    assert.equal(breaker.getState(), 'CLOSED');
    assert.equal(await breaker.execute(() => Promise.resolve('ok')), 'ok');
    assert.equal(breaker.getState(), 'CLOSED');
  });

  it('abre después de tres fallos consecutivos y hace fail-fast', async () => {
    const breaker = new CircuitBreaker({ name: 'Test', failureThreshold: 3 });

    for (let intento = 0; intento < 3; intento++) {
      await assert.rejects(breaker.execute(fallaServidor), /proveedor caído/);
    }

    assert.equal(breaker.getState(), 'OPEN');
    await assert.rejects(breaker.execute(() => Promise.resolve('ok')), CircuitBreakerOpenError);
  });

  it('vuelve a CLOSED cuando una llamada sale bien antes del umbral', async () => {
    const breaker = new CircuitBreaker({ name: 'Test', failureThreshold: 3 });

    await assert.rejects(breaker.execute(fallaServidor));
    await assert.rejects(breaker.execute(fallaServidor));
    assert.equal(await breaker.execute(() => Promise.resolve('ok')), 'ok');

    // El contador se reinicia: dos fallos más no alcanzan para abrir.
    await assert.rejects(breaker.execute(fallaServidor));
    await assert.rejects(breaker.execute(fallaServidor));
    assert.equal(breaker.getState(), 'CLOSED');
  });

  it('no cuenta los NonRetryableError como fallo del proveedor', async () => {
    const breaker = new CircuitBreaker({ name: 'Test', failureThreshold: 1 });

    for (let intento = 0; intento < 5; intento++) {
      await assert.rejects(
        breaker.execute(() => Promise.reject(new NonRetryableError('400 del cliente'))),
        NonRetryableError,
      );
    }

    assert.equal(breaker.getState(), 'CLOSED');
    assert.equal(await breaker.execute(() => Promise.resolve('ok')), 'ok');
  });

  it('pasa a HALF_OPEN al vencer el enfriamiento y se cierra si la sonda funciona', async () => {
    const breaker = new CircuitBreaker({
      name: 'Test',
      failureThreshold: 1,
      resetTimeoutMs: 20,
    });

    await assert.rejects(breaker.execute(fallaServidor));
    assert.equal(breaker.getState(), 'OPEN');

    await delay(30);
    assert.equal(breaker.getState(), 'HALF_OPEN');

    assert.equal(await breaker.execute(() => Promise.resolve('ok')), 'ok');
    assert.equal(breaker.getState(), 'CLOSED');
  });

  it('permite una sola sonda concurrente en HALF_OPEN', async () => {
    const breaker = new CircuitBreaker({
      name: 'Test',
      failureThreshold: 1,
      resetTimeoutMs: 10,
    });

    await assert.rejects(breaker.execute(fallaServidor));
    await delay(20);

    let liberarSonda: (valor: string) => void = () => {};
    const sondaEnVuelo = breaker.execute(
      () => new Promise<string>((resolve) => {
        liberarSonda = resolve;
      }),
    );

    // La segunda llamada no debe golpear al proveedor que se está recuperando.
    await assert.rejects(breaker.execute(() => Promise.resolve('ok')), CircuitBreakerOpenError);

    liberarSonda('ok');
    assert.equal(await sondaEnVuelo, 'ok');
    assert.equal(breaker.getState(), 'CLOSED');
  });

  it('notifica cada transición por onStateChange', async () => {
    const transiciones: string[] = [];
    const breaker = new CircuitBreaker({
      name: 'Test',
      failureThreshold: 1,
      resetTimeoutMs: 10,
      onStateChange: ({ from, to }) => transiciones.push(`${from}->${to}`),
    });

    await assert.rejects(breaker.execute(fallaServidor));
    await delay(20);
    await breaker.execute(() => Promise.resolve('ok'));

    assert.deepEqual(transiciones, ['CLOSED->OPEN', 'OPEN->HALF_OPEN', 'HALF_OPEN->CLOSED']);
  });
});
