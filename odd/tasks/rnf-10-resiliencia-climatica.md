# RNF-10 — Resiliencia en Clima: Timeouts, Retries y Circuit Breaker (Open-Meteo)
Objetivo: Implementar los mecanismos de resiliencia requeridos por el RNF-10 para la integración con la API externa de Open-Meteo: timeouts controlados, reintentos con espera exponencial y patrón Circuit Breaker con fail-fast y fallback en caché. Branch: feature/rnf-10-resiliencia-climatica. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (Timeout por Request): Configurar un timeout máximo de 4.000 ms (`AbortSignal.timeout`) por petición HTTP a Open-Meteo, evitando hilos bloqueados ante degradación de red externa.
- S2 (Reintentos con Espera Exponencial): Implementar hasta 3 intentos con backoff exponencial (300ms, 600ms, 1200ms) para errores transitorios de red, 5xx y timeouts. Los errores 4xx del cliente no se reintentan.
- S3 (Patrón Circuit Breaker): Crear una clase/módulo reutilizable `CircuitBreaker` con estados `CLOSED`, `OPEN` y `HALF_OPEN`. Tras 3 fallos consecutivos, el circuito pasa a `OPEN` durante un periodo de enfriamiento de 30 segundos, activando fail-fast inmediato hacia la caché (`stale: true`).
- S4 (Integración con openmeteo.ts): Integrar el circuit breaker en `obtenerPronostico(parcelaId)` manteniendo la lógica de centroide con Turf, actualización de caché en PostgreSQL y fallback suave ante caída externa.
- S5 (Calidad y Verificación): `npm run lint` y `npm run build` sin errores en el BFF y monorepo.

## Tasks
- T1 (S3): Implementar utilidad `apps/bff/src/utils/circuit-breaker.ts` — route: inline — status: completed — commit: pending
- T2 (S1, S2, S4): Refactorizar `apps/bff/src/services/openmeteo.ts` con timeouts, exponential backoff y circuit breaker — route: inline — status: completed — commit: pending
- T3 (S5): Verificación de lint y build monorepo — route: inline — status: completed — commit: pending
- T4: Commit y apertura de Pull Request — route: inline — status: in-progress — commit: pending

## Log
- L1 (2026-10-28): Creación de rama feature/rnf-10-resiliencia-climatica a partir de feature/crud-parcelas-edicion-eliminacion. Creación de especificación ODD.
- L2 (2026-10-28): Implementación de CircuitBreaker y fetchConReintentos con AbortSignal.timeout(4000) y backoff exponencial en openmeteo.ts. Verificación de compilación y linters exitosa.
