# Decisiones de arranque — ProyectoDACS

> Estado: aceptadas 2026-10-12 en `feature/esqueleto-bff-compose`. Todas son **reversibles** y pueden mutar si la cátedra impone otra herramienta. Cada cambio debe actualizar este archivo y el `## Log` de `odd/tasks/esqueleto-bff-compose.md`.

## D1 — BFF con Fastify (Node + TS)
- **Decisión:** Fastify para `apps/bff` y futuros microservicios.
- **Por qué:** minimalista y explícito, sin magia de DI. El TP evalúa que entiendas request/response, validación por schema y orquestación BFF → micros. Performance alta y plugins nativos.
- **Alternativa descartada:** NestJS (módulos + DI por reflection). Ordena 7 micros pero esconde lo que el TP quiere enseñar y suma boilerplate para defender.
- **Si muta:** si la cátedra exige Nest, el contrato `VITE_API_URL → BFF` y `GET /health` no cambian. Solo cambia el scaffolding de `apps/bff` (módulos/controllers). Este doc se versiona con el cambio.

## D2 — Prisma + Postgres como capa DB (muta 2026-10-12)
- **Decisión:** Prisma ORM con Postgres (compose sigue en `postgis/postgis:16-3.4` como Postgres compatible). Schema en `apps/bff/prisma/schema.prisma`: `Usuario`, `Parcela {polígono Json + hectáreas}`, `Precio {cultivo, fecha, fuente, valor}`.
- **Por qué:** priorizás DX y velocidad sobre SQL explícito. Migraciones, cliente tipado y studio sin escribir SQL a mano.
- **Alternativa descartada:** `pg` + `node-pg-migrate` con SQL PostGIS explícito (más didáctico para defender geo, pero más boilerplate).
- **Geo:** Prisma Postgres no mapea `geometry` nativo; se guarda GeoJSON en `Json` y el cálculo va en JS (turf) por ahora. PostGIS queda disponible vía `$queryRaw` cuando se necesite `ST_Area`/`ST_Contains` sin cambiar de motor.
- **Si muta:** si la cátedra impone otro ORM o SQL puro, se aísla en `apps/bff/src/db`. El contrato `/api/parcelas` y el compose no cambian.

## D3 — Comunicación por mensajería async (RabbitMQ)
- **Decisión:** REST interno para sync (`BFF → micros` por DNS de Compose) + RabbitMQ para jobs async (precios US-02, alertas US-05).
- **Por qué:** US-02 pide worker 1×/día y US-05 alertas sin bloquear al BFF. Elegido por vos en arranque.
- **Alternativa descartada:** solo REST + Compose DNS (más simple, sin broker, suficiente para US-01 pero sin jobs nativos).
- **Si muta:** si la cátedra pide solo REST, se baja `broker` del compose y el worker pasa a cron interno del BFF. Contrato `/api` no cambia.

## D4 — Granularidad agrupada en 3-4 servicios
- **Decisión:** arrancar con `bff`, `parcelas+usuarios`, `mercado+simulacion`, `agro+alertas`. Dividir a 7 solo si el TP lo exige.
- **Por qué:** 7 micros desde el día uno son 7 package.json vacíos que mantener. Agrupados avanzás US-01 en días.
- **Si muta:** si la cátedra exige las 7 piezas, se splitea por carpetas en `services/` sin cambiar el BFF.

## D5 — Precios US-02: ambas fuentes + worker diario
- **Decisión:** Remarkets (futuros) + scraping Bolsa (pizarra) con worker 1×/día en `mercado`.
- **Por qué:** futuros para simulación creíble + pizarra real del productor. El documento del TP lo valida.
- **Si muta:** si la cátedra define una sola fuente, se desactiva la otra en el worker. Schema `Precio {cultivo, fecha, fuente, valor}` ya lo soporta.

## D6 — Estilos con Tailwind (frontend base, siguiente tarea)
- **Decisión:** Tailwind para layout/shell/tarjetas. No entra en este esqueleto, queda para Paso 1.
- **Por qué:** velocidad para `/parcelas` y `/panel` con mapa.
- **Si muta:** si la cátedra pide CSS Modules, se limita a `apps/frontend` sin tocar BFF/Compose.
