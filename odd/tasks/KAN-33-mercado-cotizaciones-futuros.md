# KAN-33 — Cotizaciones de Futuros y Pantalla Mercado (US-07 / P5)
Objetivo: Implementar el módulo de mercado agrícola con consulta de cotizaciones de futuros por vencimiento (Matba Rofex), histórico con gráficos de tendencia y pantalla Mercado responsiva (US-07 / Pantalla P5), con resiliencia y caché de respaldo. Branch: feature/KAN-33-mercado-cotizaciones-futuros. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (Modelo de Datos de Precios y Futuros): Ajustar el modelo `Precio` en Prisma con campos para posición/vencimiento (`posicion: string`), moneda (`USD`), fecha y valor en USD/tn. Cargar seed con cotizaciones históricas y posiciones de futuros de los principales granos argentinos (Soja, Maíz, Trigo, Girasol).
- S2 (Servicio y Endpoints en BFF):
  - Crear `apps/bff/src/services/mercado.ts` con protección por `CircuitBreaker` (RNF-10) y fallback en base de datos (`stale: true`).
  - Implementar endpoints en `apps/bff/src/routes/mercado.ts`:
    - `GET /api/mercado/cotizaciones`: devuelve cotizaciones vigentes agrupadas por cultivo y vencimiento.
    - `GET /api/mercado/historico`: devuelve serie temporal de precios para graficar tendencias.
- S3 (Pantalla Mercado P5 en Frontend):
  - Crear vista `apps/frontend/src/views/MercadoView.tsx` responsive con Tailwind CSS:
    - Selector interactivo de cultivo (Soja, Maíz, Trigo, Girasol).
    - Tarjetas KPI: Precio Disponible / Spot, Posición Futuro más cercana, Variación diaria.
    - Tabla de contratos de futuros por vencimiento (Mayo, Julio, Noviembre, etc.).
    - Gráfico de tendencia interactivo (SVG accesible) con evolución histórica de precios.
    - Alerta visual en caso de datos desactualizados (`stale`).
  - Agregar enlace a "Mercado" en `Navbar.tsx` y registrar la ruta en `router.tsx`.
- S4 (Calidad y Cobertura):
  - Tests unitarios en `apps/bff/src/services/mercado.test.ts` con `node --test`.
  - Verificación estricta: `npm test`, `npm run lint` y `npm run build` sin errores.

## Tasks
- T1 (S1): Actualizar `schema.prisma` y seed con datos de mercado y futuros — route: inline — status: completed — commit: pending
- T2 (S2): Implementar servicio `mercado.ts` y rutas en BFF — route: inline — status: completed — commit: pending
- T3 (S4): Tests unitarios de mercado en `apps/bff/src/services/mercado.test.ts` — route: inline — status: completed — commit: pending
- T4 (S3): Implementar vista `MercadoView.tsx`, gráfico de tendencia y navegación — route: inline — status: completed — commit: pending
- T5 (S4): Verificación completa monorepo (tests, lint, build) — route: inline — status: completed — commit: pending
- T6: Commit y entrega de PR — route: inline — status: in-progress — commit: pending

## Log
- L1 (2026-11-04): Creación de rama feature/KAN-33-mercado-cotizaciones-futuros a partir de main actualizado. Creación de especificación ODD.
- L2 (2026-11-04): Implementación completa de modelo de precios, endpoints de cotizaciones y tendencias con circuit breaker, tests unitarios en node --test y vista P5 responsiva. Lint y build exitosos.
