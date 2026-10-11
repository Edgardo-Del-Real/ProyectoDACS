# Frontend — ProyectoDACS

SPA del **Sistema de Apoyo a Pequeños Agricultores**: React 19 + Vite 8 + TypeScript.

Este es el workspace `apps/frontend` del monorepo ProyectoDACS. Documentación general en
[`../../docs/`](../../docs/) y [`../../README.md`](../../README.md).

## Stack

| Capa | Tecnología |
| ---- | ---------- |
| Build tool | Vite 8 |
| UI | React 19 |
| Lenguaje | TypeScript 6 |
| Lint | ESLint 10 + `typescript-eslint` |

## Requisitos

- **Node.js >= 20** (probado con `v25.5.0`)
- **npm >= 11** (probado con `11.18.0`)

## Puesta en marcha

Desde la **raíz del monorepo** (recomendado — instala todos los workspaces):

```bash
npm install
npm run dev
```

O directamente dentro de este workspace:

```bash
npm run dev
```

La app queda disponible en <http://localhost:5173/dacshowcase/>.

> El `base` de Vite está configurado como `/dacshowcase/`, así que **la app se sirve bajo ese
> subpath** tanto en `dev` como en el build.

## Scripts

| Comando | Qué hace |
| ------- | -------- |
| `npm run dev` | Servidor de desarrollo (Vite + HMR) |
| `npm run build` | Type-check (`tsc -b`) + build de producción |
| `npm run lint` | ESLint sobre todo el workspace |
| `npm run preview` | Sirve localmente el build de producción |

Desde la raíz podés acotar cualquier script a este workspace, por ejemplo:

```bash
npm run build -w apps/frontend
```

## Configuración de entorno

Las variables se leen vía `import.meta.env` (ver `src/config/environment.ts`). Los archivos
`.env.*` de entorno están fuera del control de versiones, por lo que existe una plantilla:

```bash
cp .env.example .env.local
```

| Variable | Descripción | Default |
| -------- | ----------- | ------- |
| `VITE_APP_NAME` | Nombre de la aplicación expuesto al cliente | `development` |
| `VITE_API_URL` | URL base del **BFF** | `http://localhost:8080/api` |

## Estructura

```
public/                 Assets estáticos servidos tal cual
src/
  assets/               Imágenes y SVGs importados por componentes
  config/environment.ts Acceso centralizado a variables de entorno
  App.tsx               Componente raíz
  main.tsx              Punto de entrada (createRoot)
index.html              Documento HTML base
vite.config.ts          Configuración de Vite (base: /dacshowcase/)
```

## Estado

Scaffold inicial de Vite + React + TypeScript. La UI todavía es el template por defecto; el
trabajo funcional del MVP arranca sobre esta base (ver el plan en
[`../../docs/punto-de-partida.md`](../../docs/punto-de-partida.md)).
