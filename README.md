# ProyectoDACS — Sistema de Apoyo a Pequeños Agricultores

Trabajo Práctico de **Desarrollo de Aplicaciones Cliente-Servidor (DACS)**.

MVP de una plataforma para pequeños productores agropecuarios argentinos: registrar el
campo (parcela) sobre un mapa, recibir recomendaciones de siembra/rotación basadas en
datos reales (suelo, clima y mercado local) y ver una simulación financiera con precios
del mercado local.

> **Este repositorio es un MONOREPO.** Contiene el sistema completo — frontend, BFF y
> microservicios — orquestado con **Docker**. Hoy está en construcción: la raíz de workspaces
> ya existe pero el resto de las piezas todavía no.

## Documentación

Toda la documentación del proyecto está en [`docs/`](./docs/):

| Documento | Contenido |
| --------- | --------- |
| [`docs/punto-de-partida.md`](./docs/punto-de-partida.md) | Estado del repo, decisiones abiertas y por dónde arrancar |
| [`docs/arquitectura.md`](./docs/arquitectura.md) | Monorepo, Docker, BFF y microservicios |
| [`docs/definicion-mvp.md`](./docs/definicion-mvp.md) | Definición del MVP: APIs, requisitos e historias de usuario US-01…US-05 |

## Estructura

```
apps/
  frontend/        SPA React 19 + Vite 8 + TypeScript
services/          microservicios de dominio (pendiente)
packages/          código compartido: contratos/tipos (pendiente)
docs/              documentación del proyecto
docker-compose.yml orquestación (pendiente)
```

## Requisitos

- **Node.js >= 20** (probado con `v25.5.0`)
- **npm >= 11** (probado con `11.18.0`) — usa **npm workspaces**
- **Docker** (cuando levantemos los servicios)

## Puesta en marcha

Instalar todas las dependencias del monorepo desde la raíz:

```bash
npm install
```

Levantar el frontend en modo desarrollo:

```bash
npm run dev          # http://localhost:5173/dacshowcase/
```

## Scripts (raíz)

| Comando | Qué hace |
| ------- | -------- |
| `npm run dev` | Levanta el frontend en modo desarrollo |
| `npm run build` | Build de todos los workspaces que lo definan |
| `npm run lint` | Lint de todos los workspaces que lo definan |

Para trabajar dentro de un workspace puntual, ver el README de cada uno
(ej. [`apps/frontend/README.md`](./apps/frontend/README.md)).

## Estado

- [x] Repositorio convertido a **monorepo** (raíz de workspaces).
- [x] Frontend movido a `apps/frontend/`.
- [ ] `docker-compose.yml` + esqueleto del BFF.
- [ ] Primer slice vertical: US-01 (parcela en el mapa).

El detalle del plan está en [`docs/punto-de-partida.md`](./docs/punto-de-partida.md).
