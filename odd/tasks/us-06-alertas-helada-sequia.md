# US-06 — Alertas de helada y sequía por email (worker + dedupe)
Objetivo: evaluar pronósticos climáticos de las parcelas mediante un worker programado y cola en segundo plano, enviar alertas por email ante riesgo de helada (mínima ≤ 0 °C en 72 h) o estrés hídrico (precipitación acumulada bajo umbral), evitar emails duplicados (deduplicación idempotente) y mostrar las alertas registradas en el panel. Branch: feature/us-06-alertas-helada-sequia. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (US-06 criterio 1): "Dado que el pronóstico marca una mínima ≤ 0 °C en las próximas 72 horas, cuando se ejecuta la verificación programada, entonces recibo un email con la parcela, la fecha y la temperatura prevista."
- S2 (US-06 criterio 2): "Dado que ya recibí la alerta para ese evento, cuando se ejecuta otra verificación, entonces no recibo un email duplicado."
- S3 (US-06 criterio 3): "Dado que la precipitación acumulada prevista queda bajo el umbral configurado, entonces recibo una alerta de estrés hídrico."
- S4 (US-06 criterio 4): "Dado que se envió una alerta, cuando abro el panel, entonces la veo registrada en mi lista de alertas."
- S5 (Worker + Dedupe): Job programado dentro del ciclo de vida del BFF con cola asíncrona no bloqueante y restricción única `@@unique([parcelaId, tipo, fechaEvento])` en PostgreSQL.

## Tasks
- T1: Agregar `enum TipoAlerta` y modelo `Alerta` en `apps/bff/prisma/schema.prisma` + migración SQL `20261107011500_add_alertas_us06` — route: inline — status: completed
- T2: Implementar motor puro `evaluarAlertasPronostico`, constructor de email `construirEmailAlerta`, persistencia con dedupe y worker programado en `apps/bff/src/services/alertas.ts` — route: inline — status: completed
- T3: Exponer rutas REST `GET /api/alertas`, `POST /api/alertas/verificar` y `PATCH /api/alertas/:id/leida` en `apps/bff/src/routes/alertas.ts` y conectarlas en `index.ts` y `clima.ts` — route: inline — status: completed
- T4: Crear pruebas unitarias en `apps/bff/src/services/alertas.test.ts` validando heladas en 72h, estrés hídrico, deduplicación y formato de email — route: inline — status: completed
- T5: Implementar cliente HTTP `apps/frontend/src/api/alertas.ts` y componente `PanelAlertas.tsx` integrado en `DashboardView.tsx` y `DetalleParcela.tsx` — route: inline — status: completed
- T6: Integrar Nodemailer en `AlertaEmailService` (`alerta-mailer.ts`) para despacho SMTP real, soporte de variables de entorno (Gmail/SMTP estándar), endpoints `POST /test-email` y `POST /:id/reenviar-email`, y acciones en la UI — route: inline — status: completed

## Log
- L1 (2026-11-07): Implementación completa de US-06 siguiendo la arquitectura del monorepo y reutilizando el servicio de caché/resiliencia de Open-Meteo (`obtenerPronostico`).
- L2 (2026-11-07): Integración de Nodemailer para despacho de correos reales vía SMTP. Se agregaron endpoints de prueba y reenvío de alertas.

