# Arquitectura

> **Estado:** documento de arquitectura del sistema en su implementación actual.
> **Última actualización:** 2026-11-09 (commit `46786e3`).

---

## 1. Decisiones tomadas

- **Monorepo:** el repositorio contiene el sistema completo con **npm workspaces**. Hoy existen
  `apps/frontend` y `apps/bff`; `services/*` y `packages/*` están declarados pero **no existen
  como directorios**.
- **Stack:** **Node + TypeScript** en ambas aplicaciones.
- **BFF (Backend For Frontend):** el frontend **no** habla con servicios de dominio; habla contra
  una única API, el BFF.
- **BFF framework:** **Fastify 5.12** (ver [`decisiones.md`](./decisiones.md) D1).
- **Persistencia:** **Prisma 7.10** con `@prisma/adapter-pg` y `pg` sobre **PostgreSQL 16 +
  PostGIS 3.4** (D2). El polígono se guarda como GeoJSON en una columna `Json`; las áreas se
  calculan con Turf en JS y PostGIS queda disponible vía `$queryRaw` para `ST_Area`/`ST_Contains`.
- **Mensajería:** **RabbitMQ 3** está declarado en `docker-compose.yml` y el contenedor corre,
  pero **no hay cliente AMQP ni código que lo use** (D3 no implementado).
- **Estilos:** **Tailwind CSS 3.4** en el frontend (D6).
- **Infraestructura:** **Docker Compose** para la base de datos y el broker; el compose también
  define los servicios `bff` y `frontend`, que publican los puertos de host 8090 y 5173.
- **Deploy:** se descartó **GitHub Pages**. El destino de producción sigue sin definirse.

---

## 2. Por qué un BFF

El frontend es una SPA. Si hablara directo con múltiples servicios de dominio habría estos
problemas:

- Una sola pantalla terminaría disparando **N requests** (parcela + precio + alerta + …).
- El cliente conocería la **topología interna** y quedaría **acoplado** a cada servicio.
- Cosas transversales (sesión/auth, CORS, cache, agregación) tendrían que resolverse en el browser.

El BFF resuelve esto: es la **única API que consume el frontend** y se encarga de:

1. **Agregar/componer** datos de varias fuentes en una sola respuesta apta para la UI.
2. **Aislar** al frontend de cambios internos (contrato único).
3. **Centralizar** sesión/auth, CORS, cache y manejo de errores del lado servidor.

El contrato con el frontend es una sola URL base: `VITE_API_URL` → **BFF**.

> Hoy el BFF hace todo el trabajo **en proceso**: no orquesta servicios porque no existen. La
> composición de llamadas descripta arriba es el objetivo arquitectónico, no el estado actual.

---

## 3. Componentes

| Componente | Rol | Estado |
| ---------- | --- | ------ |
| **Frontend (SPA)** | React 19.2 + Vite 8.2 + TypeScript + Tailwind. Rutas públicas (`/`, `/login`, `/registro`), protegidas (`/panel`, `/parcelas/nueva`, `/parcelas/:id`) y `*` → `/`. | Implementado |
| **BFF** | Fastify 5.12. Única API del navegador. Concentra auth JWT, CRUD de parcelas, campañas, clima y rotación. | Implementado (monolito) |
| **Motor de rotación** | Lógica de dominio dentro del BFF (`apps/bff/src/services/rotacion.ts`), apoyada en los catálogos `Cultivo` y `ReglaRotacion`. | Implementado en proceso |
| **Persistencia** | PostgreSQL 16 + PostGIS 3.4 vía Prisma 7.10 y `@prisma/adapter-pg`. Cuatro migraciones y un seed de catálogos agronómicos. | Implementado |
| **Broker** | RabbitMQ 3 con consola de administración (`5672` / `15672`). | Declarado, sin uso |
| **Integración Open-Meteo** | Pronóstico por parcela, con cache en `PronosticoClima` (TTL 3 h). | Implementado |
| **Otras integraciones** | Matba Rofex/Remarkets, AgroMonitoring (NDVI) y scraping de la Bolsa de Cereales. | No implementadas |
| **Documentación de API** | OpenAPI 3 + Swagger UI montada en `/docs`. | Implementado |
| **CI** | GitHub Actions con dos jobs sobre Node 24: `frontend` (lint + build) y `bff` (lint + build + tests + `prisma validate`). | Implementado |

### Exposición de red

Hoy solo quedan expuestos el **BFF** y el **frontend**. No hay red interna de microservicios
porque no existen servicios: el BFF accede directamente a PostgreSQL y a Open-Meteo.

---

## 4. Flujo de una request

El BFF expone estos grupos de endpoints:

| Grupo | Endpoints |
| ----- | --------- |
| Sistema | `GET /health`, `GET /api/health`, `GET /ready`, `GET /api/ready` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Parcelas | `POST /api/parcelas`, `GET /api/parcelas`, `GET /api/parcelas/:id`, `PUT /api/parcelas/:id`, `DELETE /api/parcelas/:id` |
| Campañas | `GET`/`POST` `/api/parcelas/:id/campanias`, `PUT`/`DELETE` `/api/parcelas/:id/campanias/:campaniaId` |
| Clima | `GET /api/parcelas/:id/clima` |
| Rotación | `GET /api/parcelas/:id/rotacion`, `GET /api/parcelas/catalogo-rotacion` |
| Documentación | `GET /docs` |

### Ejemplo real: consultar el clima de una parcela

```
Navegador ──(JWT)──▶ BFF  GET /api/parcelas/:id/clima
                        ├─▶ Prisma → PronosticoClima (cache, uno por parcela)
                        ├─ cache vigente (< 3 h) ──▶ responde
                        └─ cache vencido o ausente
                             ├─▶ Open-Meteo (pronóstico por coordenadas)
                             ├─▶ upsert del cache en PostgreSQL
                             └─▶ responde
```

El frontend hace **una** llamada y no sabe que existe un proveedor externo ni un cache. Ese es el
valor del BFF. El endpoint `GET /api/parcelas/:id/rotacion` sigue el mismo patrón: el BFF resuelve
todo en proceso contra los catálogos de la base y devuelve una respuesta ya armada para la UI.

> Cuando existan microservicios, este mismo esquema se extiende: el BFF compone las llamadas
> internas y el navegador sigue viendo un único contrato `/api`.

---

## 5. Estructura del monorepo

```
ProyectoDACS/
├── apps/
│   ├── frontend/          # SPA React + Vite (base '/')
│   │   ├── src/
│   │   │   ├── api/       # cliente HTTP: apiFetch
│   │   │   ├── components/# layout, auth, mapa
│   │   │   ├── views/
│   │   │   ├── pages/
│   │   │   └── router.tsx
│   │   └── vite.config.ts
│   └── bff/               # Fastify + Prisma
│       ├── src/
│       │   ├── routes/    # auth, parcelas, clima, rotacion, health
│       │   ├── services/  # rotacion, openmeteo
│       │   ├── plugins/   # auth, swagger
│       │   ├── utils/     # circuit-breaker
│       │   ├── db.ts
│       │   └── index.ts
│       └── prisma/        # schema, migraciones, seed
├── services/              # microservicios de dominio (no existe)
├── packages/              # contratos/tipos compartidos (no existe)
├── docs/                  # documentación
├── odd/tasks/             # fichas de trabajo por rama/tarea
├── .github/workflows/     # ci.yml
├── docker-compose.yml     # db, broker, bff, frontend
├── package.json           # raíz de npm workspaces
└── package-lock.json
```

**Hecho:** `apps/frontend` y `apps/bff` existen y se construyen desde la raíz. Los workspaces
`services/*` y `packages/*` están declarados, así que un servicio nuevo entra sin tocar la
configuración raíz.

**Falta:** crear `services/` y `packages/` cuando haya contenido real. Un directorio vacío no
aporta nada y hoy no existe.

---

## 6. Decisiones abiertas

1. **Granularidad y momento de la separación en servicios:** el BFF es un monolito. Falta decidir
   cuándo dividir y en cuántas piezas (¿3–4 servicios agrupados o los 7 del documento?).
2. **Fuente de datos de mercado (US-02):** Remarkets, scraping de la Bolsa o ambos. La rama
   `feature/KAN-33-mercado-cotizaciones-futuros` no está mergeada.
3. **Uso real de RabbitMQ:** definir si se implementa como canal de jobs async (precios, alertas)
   o se retira del compose. Hoy no hay cliente AMQP ni código que publique o consuma.
4. **Deploy de producción:** plataforma, gestión de secretos y ejecución de migraciones.
