export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitStateChange {
  name: string;
  from: CircuitState;
  to: CircuitState;
  failures: number;
}

export interface CircuitBreakerOptions {
  /** Cantidad de fallos consecutivos antes de disparar la apertura del circuito. Default: 3 */
  failureThreshold?: number;
  /** Tiempo de enfriamiento en ms antes de probar reconexión (HALF_OPEN). Default: 30.000 ms */
  resetTimeoutMs?: number;
  /** Nombre del servicio monitoreado para propósitos de logging y trazabilidad */
  name?: string;
  /** Hook opcional para observabilidad: se invoca en cada transición de estado. */
  onStateChange?: (change: CircuitStateChange) => void;
}

/**
 * Error que NO representa una caída del proveedor (por ejemplo un 4xx por
 * parámetros inválidos). El breaker no lo cuenta como fallo: un cliente que
 * manda coordenadas fuera de rango no debe abrir el circuito para el resto.
 */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
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
 *
 * Estados: CLOSED (normal) -> OPEN (fail-fast) -> HALF_OPEN (una única sonda) -> CLOSED.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private probeInFlight = false;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly name: string;
  private readonly onStateChange?: (change: CircuitStateChange) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.name = options.name ?? 'ServicioExterno';
    this.onStateChange = options.onStateChange;
  }

  /**
   * Estado actual del circuito. Aplica la transición temporal OPEN -> HALF_OPEN
   * cuando ya venció el periodo de enfriamiento, por eso no es un getter puro.
   */
  public getState(): CircuitState {
    this.refreshState();
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    this.refreshState();

    if (this.state === 'OPEN') {
      throw new CircuitBreakerOpenError(this.name);
    }

    // En HALF_OPEN se permite una sola sonda: si hay otra en vuelo, se
    // responde fail-fast en lugar de golpear al proveedor que se está recuperando.
    if (this.state === 'HALF_OPEN') {
      if (this.probeInFlight) {
        throw new CircuitBreakerOpenError(this.name);
      }
      this.probeInFlight = true;
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    } finally {
      this.probeInFlight = false;
    }
  }

  public reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.transitionTo('CLOSED');
  }

  private refreshState(): void {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
      this.transitionTo('HALF_OPEN');
    }
  }

  private transitionTo(next: CircuitState): void {
    if (this.state === next) return;
    const from = this.state;
    this.state = next;
    this.onStateChange?.({
      name: this.name,
      from,
      to: next,
      failures: this.failureCount,
    });
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.transitionTo('CLOSED');
  }

  private onFailure(error: unknown): void {
    // Un error de cliente (4xx) no dice nada sobre la salud del proveedor.
    if (error instanceof NonRetryableError) return;

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }
}
