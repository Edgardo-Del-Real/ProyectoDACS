# Auth JWT en BFF — ProyectoDACS
Objetivo: Implementar US-02 y US-03 (registro y login con JWT + hash bcrypt) en apps/bff. Branch: feature/bff-auth. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (Registro US-02): Endpoint `POST /api/auth/register` con `email`, `password`, `nombre`, `rol` (`AGRICULTOR`, `COOPERATIVA`, `TECNICO`). Valida email único, contraseña >= 8 caracteres y hash con bcrypt (RNF-02).
- S2 (Login US-03): Endpoint `POST /api/auth/login` con `email` y `password`. Si es válido, emite JWT con expiración corta conteniendo `{ id, email, rol }`. Credenciales incorrectas responden 401 genérico (criterio 2 US-03).
- S3 (Protección de rutas): Plugin/decorator `fastify.authenticate` con `@fastify/jwt`. Endpoint `GET /api/auth/me` para obtener el usuario autenticado (sin exponer `passwordHash`).
- S4 (Configuración): Soporte de variable `JWT_SECRET` con valor por defecto seguro en desarrollo.

## Tasks
- T1 (S4): Actualizar `apps/bff/package.json` con dependencias `@fastify/jwt` y `bcryptjs` + types — route: inline — status: completed — commit: pending
- T2 (S3): Implementar plugin de JWT y decorator de autenticación en `apps/bff/src/plugins/auth.ts` — route: inline — status: completed — commit: pending
- T3 (S1, S2): Implementar rutas de autenticación en `apps/bff/src/routes/auth.ts` (`/register`, `/login`, `/me`) — route: inline — status: completed — commit: pending
- T4 (Todas): Registrar plugin y rutas en `apps/bff/src/index.ts` — route: inline — status: completed — commit: pending

## Log
- L1 (2026-10-20): Arranque de Fase 1 (Núcleo) implementando Auth en BFF. Se selecciona bcryptjs por portabilidad cross-platform en contenedores Node.
