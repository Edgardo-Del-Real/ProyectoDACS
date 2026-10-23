# Tarea: KAN-28 - OpenAPI/Swagger del BFF + CORS restringido + /health (RNF-06/12/16)

## 1. Contexto y Objetivos
- **Ticket Jira:** `KAN-28` (Épica `E8 — Infraestructura`)
- **Requisitos No Funcionales cubiertos:**
  - **RNF-06:** Documentación interactiva de la API con OpenAPI 3.0 / Swagger UI accesible en `/docs`.
  - **RNF-12:** Seguridad de red y restricción de CORS a los orígenes del frontend configurados por entorno (`CORS_ORIGIN` / `FRONTEND_URL`) con fallback seguro en desarrollo (`http://localhost:5173`, etc.).
  - **RNF-16:** Endpoints de monitoreo de disponibilidad `/health` (liveness del proceso) y `/ready` (readiness verificando conexión a base de datos PostgreSQL/Prisma).

## 2. Decisiones Técnicas y Arquitectura
- **Plugins:**
  - `@fastify/swagger`: Genera la especificación OpenAPI 3.0 con metadatos del proyecto, tags y esquema de seguridad HTTP Bearer JWT.
  - `@fastify/swagger-ui`: Expone la interfaz gráfica interactiva en la ruta `/docs`.
  - `@fastify/cors`: Restricción dinámica de orígenes basados en regex / whitelist para desarrollo y producción.
- **Rutas de Salud:**
  - `/health`: Liveness probe rápido. Retorna 200 `{ status: 'ok', service: 'bff', uptime, timestamp }`.
  - `/ready`: Readiness probe. Realiza `SELECT 1` contra PostgreSQL con Prisma. Retorna 200 `{ status: 'ready', db: 'up' }` o 503 `{ status: 'degraded', db: 'down' }`.

## 3. Plan de Verificación
- `npm run build --workspace apps/bff`: Compilación limpia (Prisma generate + TypeScript).
- Typecheck y build pasan sin errores.
- Acceso a `/docs`, `/health` y `/ready` responden con los formatos y códigos HTTP esperados.
