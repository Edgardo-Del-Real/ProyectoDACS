export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Cantidad de fallos consecutivos antes de disparar la apertura del circuito. Default: 3 */
  failureThreshold?: number;
  /** Tiempo de enfriamiento en ms antes de probar reconexión (HALF_OPEN). Default: 30.000 ms */
  resetTimeoutMs?: number;
  /** Nombre del servicio monitoreado para propósitos de logging y trazabilidad */
  name?: string;
}

export class CircuitBreakerOpenError extends Error {
  constructor(serviceName: string) {
    super(`El circuit breaker para "${serviceName}" está ABIERTO (OPEN). Solicitud abortada por resiliencia.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Patrón Circuit Breaker (RNF-10) para proteger llamadas a APIs externas.
 * Evita la saturación del BFF ante caídas sostenidas del proveedor.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.name = options.name ?? 'ServicioExterno';
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError(this.name);
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
