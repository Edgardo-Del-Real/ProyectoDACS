# ProyectoDACS — Sistema de Apoyo a Pequeños Agricultores

Trabajo Práctico de **Desarrollo de Aplicaciones Cliente-Servidor (DACS)**.

MVP de una plataforma para pequeños productores agropecuarios argentinos. El estado actual
permite registrar una parcela sobre un mapa, consultar su pronóstico de clima y obtener un plan
de rotación de cultivos. La simulación financiera y los precios de mercado local todavía no están
implementados.

> **Este repositorio es un MONOREPO** con **npm workspaces**. Hoy contiene dos aplicaciones
> reales: la SPA (`apps/frontend`) y el BFF (`apps/bff`). Los paths `services/*` y `packages/*`
> están declarados en la configuración de workspaces pero **no existen todavía**: no hay
> microservicios, y el BFF concentra toda la lógica de dominio como monolito.

## Documentación

Toda la documentación del proyecto está en [`docs/`](./docs/):

| Documento | Contenido |
| --------- | --------- |
| [`docs/punto-de-partida.md`](./docs/punto-de-partida.md) | Estado verificado, decisiones abiertas y por dónde arrancar |
| [`docs/arquitectura.md`](./docs/arquitectura.md) | Componentes, flujo de una request y estructura del monorepo |
| [`docs/decisiones.md`](./docs/decisiones.md) | Registro histórico D1–D6 y su estado de implementación |
| [`docs/definicion-mvp.md`](./docs/definicion-mvp.md) | Definición del MVP: APIs, requisitos e historias de usuario US-01…US-05 |

## Estructura

```
apps/
  frontend/        SPA React 19 + Vite 8 + TypeScript + Tailwind
  bff/             Fastify 5 + Prisma 7 (única API del frontend)
docs/              documentación del proyecto
odd/tasks/         fichas de trabajo por rama/tarea
.github/workflows/ CI de GitHub Actions
docker-compose.yml PostgreSQL/PostGIS + RabbitMQ
package.json       raíz de npm workspaces
```

`services/` y `packages/` figuran en `workspaces` pero **no existen como directorios**. Se crean
recién cuando se extraiga el primer servicio o se necesite código compartido.

## Requisitos

- **Node.js 20 o superior**. La CI y el `docker-compose.yml` usan Node 24; el host de referencia
  probó `v25.8.1`.
- **npm 11 o superior**, porque el repo usa **npm workspaces** (probado con `11.11.0`).
- **Docker con Compose v2**, para la base de datos y el broker.

## Puesta en marcha (modo híbrido)

Modo de trabajo adoptado: **`db` y `broker` en Docker; BFF y frontend con npm en el host**. Así se
evita reconstruir imágenes en cada cambio de código.

### 1. Instalar dependencias

Desde la raíz:

```bash
npm install
```

### 2. Configurar variables de entorno

Cada aplicación carga su propio archivo; **no hay un `.env` único en la raíz**.

| Aplicación | Archivo | Variables |
| ---------- | ------- | --------- |
| Frontend | `apps/frontend/.env.local` | `VITE_APP_NAME=dacs-showcase`<br>`VITE_API_URL=http://localhost:8080` |
| BFF | `apps/bff/.env` | `PORT=8080`<br>`HOST=0.0.0.0`<br>`DATABASE_URL=postgres://dacs:dacs@localhost:5432/dacs`<br>`JWT_SECRET=<secreto único>` |

Dos reglas que ya causaron problemas:

1. **`VITE_API_URL` no debe terminar en `/api`.** El cliente HTTP arma la URL como
   `${VITE_API_URL}${path}` y cada llamada pasa un path que empieza con `/api/...`. Si la base
   incluye `/api`, las rutas quedan duplicadas.
2. **En modo híbrido, `DATABASE_URL` apunta a `localhost:5432`**, no al hostname `db` de Compose.
   El BFF no arranca sin `DATABASE_URL` y `JWT_SECRET`.

> Nota: en la raíz del repo hay dos archivos `env.development` y `env.production` que Vite no lee
> (necesita el punto inicial y la ubicación dentro de `apps/frontend`), que además incluyen `/api`
> en la URL y que hoy no están cubiertos por `.gitignore`. Deben moverse a
> `apps/frontend/.env.development` y `apps/frontend/.env.production`, sin `/api`, o eliminarse.

### 3. Levantar la infraestructura

```bash
docker compose up -d db broker
```

- `db`: PostgreSQL 16 con PostGIS 3.4, en `localhost:5432` (`dacs` / `dacs` / base `dacs`).
- `broker`: RabbitMQ 3 con consola de administración en `http://localhost:15672`.

### 4. Aplicar migraciones y catálogos

```bash
npm run db:migrate --workspace @proyectodacs/bff
npm run db:seed --workspace @proyectodacs/bff
```

`db:migrate` crea el esquema con las cuatro migraciones existentes; `db:seed` carga los catálogos
agronómicos (cultivos, reglas de rotación y parámetros económicos).

### 5. Levantar las dos aplicaciones

En **dos terminales distintas** desde la raíz:

```bash
# Terminal 1 — frontend
npm run dev                                   # http://localhost:5173

# Terminal 2 — BFF
npm run dev --workspace @proyectodacs/bff     # http://localhost:8080
```

`npm run dev` en la raíz arranca **solo el frontend**. El BFF no se inicia con ese comando.

### 6. Verificar

```bash
curl http://localhost:8080/health     # liveness
curl http://localhost:8080/ready      # readiness: comprueba la conexión a PostgreSQL
```

La documentación OpenAPI interactiva queda en `http://localhost:8080/docs`.

> No ejecutar un `docker compose up` completo mientras se desarrolla en el host: los servicios
> `bff` y `frontend` del compose publican los puertos **8090** y **5173**, y colisionan con los
> servidores locales.

## Scripts

### Raíz del monorepo

| Comando | Qué hace |
| ------- | -------- |
| `npm run dev` | Levanta **solo el frontend** en modo desarrollo |
| `npm run build` | Build de todos los workspaces que lo definan (`--if-present`) |
| `npm run lint` | Lint de todos los workspaces |
| `npm run test` | Tests de todos los workspaces que los definan (hoy solo el BFF) |

### BFF (`apps/bff`)

| Comando | Qué hace |
| ------- | -------- |
| `npm run dev` | `tsx watch src/index.ts` |
| `npm run build` | `prisma generate` + `tsc` |
| `npm run start` | Ejecuta `dist/index.js` |
| `npm run test` | Runner nativo de Node sobre los archivos `*.test.ts` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Carga los catálogos agronómicos |
| `npm run db:studio` | Prisma Studio |
| `npm run prisma:validate` | Valida el schema de Prisma |

### Frontend (`apps/frontend`)

| Comando | Qué hace |
| ------- | -------- |
| `npm run dev` | Servidor de Vite en `http://localhost:5173` |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Sirve el build local |
| `npm run lint` | ESLint |

Para acotar un comando a un workspace puntual:

```bash
npm run build --workspace @proyectodacs/bff
```

## Estado

### Implementado

- ✅ Monorepo con npm workspaces (`apps/frontend`, `apps/bff`).
- ✅ **US-01**: alta de parcela dibujada en el mapa, cálculo de superficie y CRUD completo.
- ✅ Autenticación JWT (registro, login, `me`) y rutas protegidas en el frontend.
- ✅ **US-04**: catálogo y plan de rotación de cultivos por parcela.
- ✅ **US-05 (pronóstico)**: clima por parcela con Open-Meteo y cache en base de datos.
- ✅ Dashboard con datos reales e historial de campañas.
- ✅ Swagger UI, endpoints `health`/`ready` y CORS con whitelist.
- ✅ `docker-compose.yml` con PostgreSQL/PostGIS y RabbitMQ.
- ✅ CI en GitHub Actions: jobs `frontend` y `bff` sobre Node 24.

### Pendiente

- ⬜ **US-02** (mercado y cotizaciones): rama `feature/KAN-33-mercado-cotizaciones-futuros` sin mergear.
- ⬜ **US-03** (simulación de rentabilidad): no existe rama; depende de US-02.
- ⬜ Alertas de heladas y sequías con notificación por email: rama sin mergear.
- ⬜ Separación en microservicios: hoy el BFF es un monolito que concentra el dominio.
- ⬜ Uso real de RabbitMQ: el broker está declarado y corre, pero no hay cliente AMQP ni código que lo use.
- ⬜ Tests de frontend y pruebas end-to-end: el BFF solo tiene dos suites unitarias.
- ⬜ Deploy a producción.
- ⬜ Ordenar los archivos de entorno (hoy mal ubicados en la raíz).

El detalle del plan y de las decisiones abiertas está en
[`docs/punto-de-partida.md`](./docs/punto-de-partida.md).
