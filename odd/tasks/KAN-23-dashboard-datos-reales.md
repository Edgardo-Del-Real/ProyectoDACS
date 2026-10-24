# KAN-23 — Dashboard con datos reales del BFF (quitar hardcode)
Objetivo: Conectar DashboardView con los endpoints del BFF (GET /api/parcelas y GET /api/parcelas/:id/clima) eliminando los datos estáticos de muestra. Branch: feature/KAN-23-dashboard-datos-reales. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (Listado de Parcelas): Consumir `GET /api/parcelas` enviando el token JWT. Mostrar la lista de parcelas reales del productor (nombre, hectáreas calculadas, fecha de alta).
- S2 (Navegación al Detalle): Cada tarjeta de parcela debe enlazar a `/parcelas/:id` para ver su pronóstico climático de 7 días y su historial de campañas (US-04 / US-05).
- S3 (Clima en Dashboard): Si el productor tiene parcelas, cargar en la tarjeta lateral el pronóstico real de la primera parcela desde `GET /api/parcelas/:id/clima`.
- S4 (Empty State): Si el productor aún no tiene parcelas registradas, mostrar un estado vacío amigable con botón directo para dibujar una nueva parcela (`/parcelas/nueva`).
- S5 (Estados de carga y error): Manejo de skeleton/loading y feedback si la sesión expiró o la API no responde.

## Tasks
- T1 (S1, S2, S4): Reemplazar datos hardcodeados en `apps/frontend/src/views/DashboardView.tsx` por fetch a `GET /api/parcelas` — route: inline — status: completed — commit: pending
- T2 (S3): Conectar el widget lateral de clima con el endpoint real `GET /api/parcelas/:id/clima` — route: inline — status: completed — commit: pending
- T3 (S5): Manejar estados de carga, vacío y enlaces de navegación — route: inline — status: completed — commit: pending
- T4: Verificación y commit — route: inline — status: completed — commit: pending

## Log
- L1 (2026-10-23): Creación de rama feature/KAN-23-dashboard-datos-reales a partir de main limpio. Se mapea contra el ticket Jira KAN-23.
