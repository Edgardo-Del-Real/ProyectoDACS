# Punto de Partida

> Documento de arranque del proyecto. **Objetivo:** que cualquier integrante del equipo pueda
> abrir el repo, entender el estado real y saber exactamente por dónde empezar.
>
> **Última actualización:** 2026-11-09 · **Commit de referencia:** `46786e3` (merge del PR #23)

---

## 1. Qué es este proyecto

**ProyectoDACS** es el Trabajo Práctico de **Desarrollo de Aplicaciones Cliente-Servidor (DACS)**.

El dominio del negocio es un **Sistema de Apoyo a Pequeños Agricultores** (contexto argentino):
el productor delimita su parcela en un mapa, consulta el pronóstico de clima y obtiene un plan de
rotación de cultivos. La simulación financiera con precios del mercado local es parte del alcance
definido, pero **todavía no está implementada**.

La definición funcional completa (APIs, requisitos, historias de usuario) está transcripta en
[`definicion-mvp.md`](./definicion-mvp.md), y la arquitectura del sistema en
[`arquitectura.md`](./arquitectura.md).

### Panorama funcional (resumen)

| Historia | Qué hace | Estado |
| -------- | -------- | ------ |
| **US-01** | Dibujar la parcela en un mapa y calcular hectáreas | ✅ Implementada |
| **US-02** | Consultar y guardar precios futuros diarios (soja, maíz, trigo) | ⬜ Pendiente: rama sin mergear |
| **US-03** | Simular rentabilidad (`Ha × Rinde × Precio`) | ⬜ Pendiente: sin rama, depende de US-02 |
| **US-04** | Sugerir rotación de cultivos (regla: si venía Soja → gramínea) | ✅ Implementada |
| **US-05** | Alertar riesgo de helada (≤ 3 °C a 7 días) | Parcial: pronóstico implementado, alertas por email pendientes |

### Integraciones externas

| Integración | Estado |
| ----------- | ------ |
| **Open-Meteo** (pronóstico por parcela) | ✅ Implementada, con cache en base de datos |
| **Leaflet + OpenStreetMap** (mapa) | ✅ Implementada |
| **Matba Rofex / Remarkets** (futuros agrícolas) | ⬜ No implementada (US-02) |
| **AgroMonitoring** (NDVI satelital) | ⬜ No implementada |
| **Scraping Bolsa de Cereales** (pizarra) | ⬜ No implementada |

---

## 2. Estado actual del repo (verificado 2026-11-09)

> El repositorio es un **monorepo de npm workspaces** con dos aplicaciones: `apps/frontend` y
> `apps/bff`. El BFF **existe y funciona**, pero es un **monolito**: concentra toda la lógica de
> dominio, incluida la rotación. Los paths `services/*` y `packages/*` están declarados en
> `workspaces` pero **no existen como directorios**, así que **no hay microservicios**.

| Check | Comando (desde la raíz) | Estado |
| ----- | ----------------------- | ------ |
| Dependencias | `npm install` | ✅ Resuelve los workspaces `apps/frontend` y `apps/bff` |
| Build | `npm run build` | ✅ Frontend: `tsc -b && vite build`. BFF: `prisma generate && tsc` |
| Lint | `npm run lint` | ✅ ESLint 10 en ambos workspaces |
| Tests | `npm run test` | Parcial: solo BFF, 2 suites con el runner nativo de Node |
| Dev frontend | `npm run dev` | ✅ `http://localhost:5173` (raíz `/`) |
| Dev BFF | `npm run dev --workspace @proyectodacs/bff` | ✅ `http://localhost:8080` |
| Infraestructura | `docker compose up -d db broker` | ✅ PostgreSQL/PostGIS y RabbitMQ |
| CI | `.github/workflows/ci.yml` | ✅ Jobs `frontend` y `bff` sobre Node 24 |

**Toolchain del host de referencia:** Node `v25.8.1`, npm `11.11.0`, Docker `29.9.3`
(sin contenedores levantados al momento de la verificación).

> Esta tabla describe **qué hace cada comando**, no un resultado de ejecución: en la verificación
> del 2026-11-09 se inspeccionó el código y la configuración, pero **no se corrieron** build, lint,
> tests ni la CI. El estado real de la CI se consulta en GitHub Actions.

### Stack del frontend

| Capa | Tecnología |
| ---- | ---------- |
| Build tool | Vite 8.2 (`base: '/'`) |
| UI | React 19.2 |
| Lenguaje | TypeScript ~6.0 |
| Ruteo | react-router-dom 7.18 |
| Mapas | Leaflet 1.9 + react-leaflet 5 + Geoman 2.20 + Turf 7.4 |
| Estilos | Tailwind CSS 3.4 |
| Tests | ⬜ Sin runner ni script de test |

### Stack del BFF

| Capa | Tecnología |
| ---- | ---------- |
| Framework | Fastify 5.12 |
| Auth | `@fastify/jwt` 10 + `bcryptjs` |
| Documentación | `@fastify/swagger` 9 + `@fastify/swagger-ui` 6 (UI en `/docs`) |
| ORM | Prisma 7.10 con `@prisma/adapter-pg` y `pg` |
| Geo | Turf 7.4 en JS; PostGIS disponible vía `$queryRaw` |
| Dev runner | `tsx watch` |
| Tests | Runner nativo de Node (`node --import tsx --test`) |

---

## 3. Estructura actual

```
ProyectoDACS/
├── apps/
│   ├── frontend/            # ✅ SPA React + Vite (base '/')
│   │   ├── src/
│   │   │   ├── api/http.ts  # cliente HTTP (apiFetch)
│   │   │   └── router.tsx   # rutas públicas y protegidas
│   │   ├── public/
│   │   ├── vite.config.ts
│   │   └── .env.example
│   └── bff/                 # ✅ Fastify + Prisma
│       ├── src/
│       │   ├── routes/      # auth, parcelas, clima, rotacion, health
│       │   ├── services/    # rotacion.ts, openmeteo.ts
│       │   ├── plugins/     # auth, swagger
│       │   └── utils/       # circuit-breaker.ts
│       ├── prisma/          # schema, 4 migraciones y seed
│       └── .env.example
├── docs/                    # documentación del proyecto
├── odd/tasks/               # fichas de trabajo por rama/tarea
├── .github/workflows/       # CI (ci.yml)
├── docker-compose.yml       # db, broker, bff, frontend
├── package.json             # raíz de npm workspaces
└── package-lock.json
```

> `services/` y `packages/` están declarados en los workspaces pero **todavía no existen**. Se
> crean cuando se extraiga el primer servicio o se necesite código compartido. Mientras tanto, la
> lógica de dominio vive en `apps/bff/src/services/` (por ejemplo, el motor de rotación en
> `rotacion.ts`).

---

## 4. Decisiones: tomadas y abiertas

### ✅ Ya tomadas

1. **Monorepo:** el repo contiene frontend y BFF con **npm workspaces**.
2. **Stack:** **Node + TypeScript** en ambas aplicaciones.
3. **Framework del BFF:** **Fastify** (D1 en [`decisiones.md`](./decisiones.md)).
4. **Persistencia:** **Prisma 7** con `@prisma/adapter-pg` sobre **PostgreSQL 16 + PostGIS 3.4**
   (D2). El polígono se guarda como GeoJSON en una columna `Json` y las áreas se calculan con
   Turf; PostGIS queda disponible vía `$queryRaw`.
5. **BFF como única API del frontend:** el navegador solo conoce `VITE_API_URL`.
6. **Infraestructura con Docker Compose:** `db` y `broker` en contenedores; modo de trabajo
   **híbrido** con BFF y frontend en el host.
7. **Estilos:** **Tailwind** (D6).
8. **Deploy:** se descartó GitHub Pages. El destino real todavía no está definido.

### ⬜ Abiertas

1. **Microservicios (D4):** no se inició la separación. Falta decidir **cuándo** dividir y con qué
   granularidad (¿3–4 servicios agrupados o los 7 del documento?). Hoy todo el dominio está en el
   BFF.
2. **US-02 — fuente de datos (D5):** Remarkets, scraping de la Bolsa o ambos. La rama
   `feature/KAN-33-mercado-cotizaciones-futuros` existe pero **no está mergeada**.
3. **RabbitMQ (D3):** el broker corre en Compose, pero **no hay cliente AMQP ni código que lo use**
   y `RABBITMQ_URL` no lo lee nadie. Falta decidir si se implementa para jobs async o se retira del
   compose.
4. **Deploy de producción:** plataforma, variables y proceso de migraciones.
5. **Tests del frontend y end-to-end:** no hay runner ni script de test en la SPA; no hay e2e en CI.
6. **Archivos de entorno:** hoy hay `env.development` y `env.production` en la raíz, mal ubicados,
   con `/api` de más y fuera de `.gitignore`. Falta definir el esquema definitivo.
7. **Naming del workspace frontend:** sigue llamándose `dacs-showcase` (menor).

---

## 5. Por dónde arrancar

Hay dos frentes reales. El orden depende del objetivo: **cobertura funcional** (US-02 + US-03) o
**deuda arquitectónica** (separación en microservicios).

### Frente A — Cerrar el alcance funcional

1. **US-02 (Mercado):** mergear o rehacer
   `feature/KAN-33-mercado-cotizaciones-futuros`. Antes hay que resolver la fuente de datos (punto
   abierto 2). Es el desbloqueante de US-03.
2. **US-03 (Simulación):** no existe rama. Depende de US-02 para el precio y de las hectáreas de la
   parcela, que ya existen. Es el caso de uso estrella del BFF.
3. **US-05 (Alertas):** el pronóstico ya está; falta la alerta de heladas/sequías y la notificación
   por email (rama `feature/KAN-21-alertas-heladas-sequias-email` sin mergear).

### Frente B — Separar microservicios

No hay que "completar" servicios existentes: hay que **extraerlos** desde el monolito.

- ⬜ Definir la granularidad (D4) y el contrato interno.
- ⬜ Crear `services/` y el primer servicio extraído, con su `package.json`.
- ⬜ Resolver la comunicación (REST interno o RabbitMQ) antes de mover código.
- ⬜ Mover la lógica desde `apps/bff/src/services/` sin romper el contrato `/api` que consume el
      frontend.

### Deuda técnica transversal

- Ordenar los archivos de entorno (`apps/frontend/.env.*`, `apps/bff/.env`) y corregir
  `VITE_API_URL` (sin `/api`).
- Agregar runner de tests al frontend y, más adelante, un e2e en CI.
- Decidir el destino de RabbitMQ (implementarlo o quitarlo del compose).

> **Recomendación:** si el objetivo es aprobar el TP con alcance completo, priorizar **US-02 y
> US-03** y dejar la separación de servicios como refactor posterior. Si la cátedra evalúa
> explícitamente la arquitectura distribuida, invertir el orden y extraer primero un servicio con
> contrato claro.

---

## 6. Cómo levantar el proyecto hoy

Modo **híbrido**: `db` y `broker` en Docker, BFF y frontend con npm en el host.

### Paso a paso

```bash
npm install
docker compose up -d db broker
npm run db:migrate --workspace @proyectodacs/bff
npm run db:seed --workspace @proyectodacs/bff
```

Luego, en **dos terminales** desde la raíz:

```bash
# Terminal 1 — frontend
npm run dev                                   # http://localhost:5173

# Terminal 2 — BFF
npm run dev --workspace @proyectodacs/bff     # http://localhost:8080
```

> `npm run dev` en la raíz **solo arranca el frontend**. El BFF requiere el segundo comando.

### Variables de entorno

**Frontend — `apps/frontend/.env.local`**

| Variable | Descripción | Valor para desarrollo |
| -------- | ----------- | --------------------- |
| `VITE_APP_NAME` | Nombre de la app expuesto al cliente | `dacs-showcase` |
| `VITE_API_URL` | URL base del BFF, **sin `/api`** | `http://localhost:8080` |

**BFF — `apps/bff/.env`**

| Variable | Descripción | Valor para desarrollo |
| -------- | ----------- | --------------------- |
| `PORT` | Puerto HTTP | `8080` |
| `HOST` | Interfaz de escucha | `0.0.0.0` |
| `DATABASE_URL` | Conexión a PostgreSQL | `postgres://dacs:dacs@localhost:5432/dacs` |
| `JWT_SECRET` | Secreto para firmar tokens | valor propio, no versionado |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma (opcional) | por defecto `localhost:5173` y `:3000` |
| `NODE_ENV` | Entorno | `development` |

> En modo híbrido `DATABASE_URL` debe apuntar a **`localhost:5432`**. El hostname `db` solo
> resuelve dentro de la red de Compose.
>
> El BFF **no arranca** sin `DATABASE_URL` y `JWT_SECRET`. Además, `apps/bff/.env.example` lista
> `RABBITMQ_URL`, pero **ningún código la lee**.

> ⚠️ Los archivos `env.development` y `env.production` de la raíz no los carga Vite (falta el punto
> inicial y están fuera de `apps/frontend`), incluyen `/api` en `VITE_API_URL` y no están cubiertos
> por `.gitignore`. Deben moverse o eliminarse.

### Verificación rápida

| URL | Qué comprueba |
| --- | ------------- |
| `http://localhost:8080/health` | Liveness del BFF |
| `http://localhost:8080/ready` | Readiness (conexión a PostgreSQL) |
| `http://localhost:8080/docs` | Swagger UI |
| `http://localhost:5173` | SPA |
| `http://localhost:15672` | Consola de RabbitMQ (sin uso por código) |

> No ejecutar un `docker compose up` completo mientras se desarrolla en el host: los servicios
> `bff` y `frontend` del compose publican los puertos **8090** y **5173** y colisionan con los
> servidores locales.

---

## 7. Mapa de documentos

| Documento | Contenido |
| --------- | --------- |
| [`../README.md`](../README.md) | Visión del monorepo y puesta en marcha |
| [`../apps/frontend/README.md`](../apps/frontend/README.md) | Detalle del workspace frontend (⚠️ todavía menciona el subpath `/dacshowcase/`, que ya no existe) |
| [`definicion-mvp.md`](./definicion-mvp.md) | Definición del MVP: APIs, requisitos y US-01…US-05 |
| [`arquitectura.md`](./arquitectura.md) | Componentes, flujo de una request y estructura |
| [`decisiones.md`](./decisiones.md) | Registro D1–D6 y estado de implementación al 2026-11-09 |
| [`../odd/tasks/`](../odd/tasks/) | Fichas de trabajo por rama/tarea |
| `punto-de-partida.md` | *Este documento* — estado y próximo paso |
