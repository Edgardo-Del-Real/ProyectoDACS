# Punto de Partida

> Documento de arranque del proyecto. **Objetivo:** que mañana cualquiera del equipo pueda
> abrir el repo, entender dónde estamos parados y saber exactamente por dónde empezar.
>
> **Última actualización:** 2026-10-11

---

## 1. Qué es este proyecto

**ProyectoDACS** es el Trabajo Práctico de **Desarrollo de Aplicaciones Cliente-Servidor (DACS)**.

El dominio del negocio es un **Sistema de Apoyo a Pequeños Agricultores** (contexto argentino):
el productor delimita su parcela en un mapa, y el sistema le devuelve una recomendación de
siembra/rotación basada en datos reales (suelo, clima, mercado) más una simulación financiera
con precios del mercado **local**.

La definición funcional completa (APIs, requisitos, historias de usuario) está transcripta en
[`definicion-mvp.md`](./definicion-mvp.md), y la arquitectura del sistema en
[`arquitectura.md`](./arquitectura.md).

### Panorama funcional (resumen)

| Historia | Qué hace | Microservicios |
| -------- | -------- | -------------- |
| **US-01** | Dibujar la parcela en un mapa y calcular hectáreas | Usuarios, Parcelas, Frontend |
| **US-02** | Consultar y guardar precios futuros diarios (soja, maíz, trigo) | Mercado |
| **US-03** | Simular rentabilidad (`Ha × Rinde × Precio`) | Parcelas, Mercado, Simulación |
| **US-04** | Sugerir rotación de cultivos (regla: si venía Soja → gramínea) | Parcelas, Rotación |
| **US-05** | Alertar riesgo de helada (≤ 3 °C a 7 días) | Parcelas, Clima, Alertas |

### Integraciones externas (ya decididas en el documento)

- **Matba Rofex / Remarkets** → futuros agrícolas locales.
- **AgroMonitoring** → NDVI satelital del polígono.
- **Open-Meteo** → pronóstico hiperlocal (heladas / estrés hídrico).
- **Leaflet + OpenStreetMap** → render del mapa.
- **Scraping Bolsa de Cereales** → *opcional*, worker 1×/día para precios pizarra.

---

## 2. Estado actual del repo (verificado 2026-10-11)

> ✅ **Este repositorio ya es un MONOREPO.** La raíz es un **workspace de npm** y el frontend vive
> en `apps/frontend/`. El **BFF y los microservicios todavía no existen**: los paths `services/*`
> y `packages/*` ya están declarados en los workspaces, pero están vacíos. La orquestación con
> **Docker** todavía está pendiente.

| Check | Comando (desde la raíz) | Resultado |
| ----- | ----------------------- | --------- |
| Dependencias | `npm install` | ✅ 161 paquetes (workspaces) |
| Tipo + build | `npm run build` | ✅ OK |
| Lint | `npm run lint` | ✅ limpio |
| Dev server | `npm run dev` | ✅ responde en `/dacshowcase/` |
| Seguridad | `npm audit` | ✅ 0 vulnerabilidades |

**Toolchain del host de referencia:** Node `v25.5.0`, npm `11.18.0`.

### Stack declarado (frontend)

| Capa | Tecnología |
| ---- | ---------- |
| Build tool | Vite 8 |
| UI | React 19 |
| Lenguaje | TypeScript 6 |
| Lint | ESLint 10 + `typescript-eslint` |

---

## 3. Estructura actual

```
ProyectoDACS/
├── apps/
│   └── frontend/           # ✅ SPA React + Vite (ya movido desde la raíz)
│       ├── src/
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts  # base: '/dacshowcase/'
│       └── .env.example
├── docs/                   # documentación del proyecto
├── package.json            # raíz de workspaces (npm)
└── .gitignore
```

> `services/` y `packages/` están declarados en los workspaces pero **todavía no existen**; se
> crean cuando agreguemos el primer servicio.

---

## 4. Decisiones: tomadas y abiertas

### ✅ Ya tomadas

1. **Monorepo:** este repo contiene frontend + BFF + microservicios.
2. **Stack:** **Node + TypeScript** para el BFF y los microservicios.
3. **Docker:** orquestación de todos los servicios con Docker Compose.
4. **BFF:** el frontend consume un Backend For Frontend, no los microservicios directo.
5. **Deploy:** no se usa GitHub Pages.
6. **Estructura:** raíz de npm workspaces + frontend movido a `apps/frontend/`.

### ⬜ Abiertas (a resolver antes de codear en serio)

1. **Framework** del BFF y de los microservicios (el lenguaje ya está: Node + TS).
2. **Motor de base de datos** y **modelo de datos** (ver huecos en
   [`definicion-mvp.md`](./definicion-mvp.md#4-huecos-conocidos-del-documento-a-completar)).
3. **Mecanismo de comunicación entre servicios** y descubrimiento dentro de Docker.
4. **Alcance de cada microservicio** (¿7 separados o algunos agrupados?).
5. **US-02, criterio 1** sigue sin definir (*"Definir cómo lo vamos a hacer"*): Remarkets,
   scraping o ambos.
6. **Naming del workspace frontend:** sigue llamándose `dacs-showcase` *(menor)*.

---

## 5. Por dónde arrancar (propuesta)

> **Recomendación:** terminar el **esqueleto del monorepo** (Docker + BFF) y después bajar un
> **slice vertical completo (US-01)**. Motivo: casi todas las historias dependen de la parcela
> (US-03, US-04, US-05 la usan), así que US-01 es el cimiento.

### Paso 0 — Esqueleto del monorepo *(en curso)*

- [x] Definir la **estructura del monorepo** (ver [`arquitectura.md` §5](./arquitectura.md#5-estructura-del-monorepo)).
- [x] **Mover el frontend actual de la raíz a `apps/frontend/`**.
- [x] Configurar la **raíz de workspaces** (npm workspaces).
- [ ] Crear el **`docker-compose.yml`** base y los servicios (frontend + BFF + microservicios placeholder).
- [ ] Crear el **`apps/bff/`** mínimo (Node + TS) que exponga un `/health` y sirva de contrato para el frontend.

### Paso 1 — Base técnica del frontend *(sobre `apps/frontend/`)*

- [ ] **Ruteo** (`react-router`) con las rutas base (ej. `/`, `/login`, `/parcelas`, `/panel`).
- [ ] **Layout / shell** de la app (header, navegación, contenedor de páginas).
- [ ] **Cliente HTTP** centralizado que consuma `environment.apiUrl` (→ BFF).
- [ ] **Uso real de `src/config/environment.ts`** (hoy es código muerto; verificar env en `dev` y `build`).
- [ ] Decidir la **estrategia de estilos** (CSS Modules / Tailwind / otra).

### Paso 2 — Primer slice vertical: **US-01** (delimitar parcela)

- [ ] Integrar **Leaflet + OpenStreetMap** y renderizar el mapa satelital.
- [ ] Herramienta de **dibujo de polígono** cerrado.
- [ ] **Cálculo de superficie** en hectáreas a partir de las coordenadas.
- [ ] **Persistencia** del polígono asociado al usuario (requiere el contrato BFF ↔ microservicio Parcelas).

### Después (orden sugerido por dependencias)

1. **US-02** (Mercado) — desbloquea US-03.
2. **US-03** (Simulación) — depende de Parcelas + Mercado (y es el caso de uso estrella del BFF).
3. **US-04** (Rotación) — depende de Parcelas + AgroMonitoring.
4. **US-05** (Alertas) — depende de Parcelas + Open-Meteo.

---

## 6. Cómo levantar el proyecto hoy

> *(hoy sólo existe el frontend; el BFF y los microservicios todavía no)*

Desde la **raíz del monorepo**:

```bash
npm install          # instala todos los workspaces
npm run dev          # http://localhost:5173/dacshowcase/
```

| Comando (raíz) | Qué hace |
| -------------- | -------- |
| `npm run dev` | Levanta el frontend en desarrollo |
| `npm run build` | Build de todos los workspaces que lo definan |
| `npm run lint` | Lint de todos los workspaces que lo definan |

Para acotar un comando a un workspace puntual:

```bash
npm run build -w apps/frontend
```

**Variables de entorno:** viven en `apps/frontend/` — copiar `.env.example` a `.env.local`:

```bash
cd apps/frontend
cp .env.example .env.local
```

| Variable | Descripción | Default |
| -------- | ----------- | ------- |
| `VITE_APP_NAME` | Nombre de la app expuesto al cliente | `development` |
| `VITE_API_URL` | URL base del **BFF** | `http://localhost:8080/api` |

> ⚠️ Por ahora la app se sirve bajo el subpath `/dacshowcase/` (por el `base` de Vite).

---

## 7. Mapa de documentos

| Documento | Contenido |
| --------- | --------- |
| [`../README.md`](../README.md) | Visión del monorepo y cómo levantarlo |
| [`../apps/frontend/README.md`](../apps/frontend/README.md) | Detalle del workspace frontend |
| [`definicion-mvp.md`](./definicion-mvp.md) | Definición del MVP: APIs, RF y US-01…US-05 |
| [`arquitectura.md`](./arquitectura.md) | Monorepo, Docker, BFF y microservicios |
| `punto-de-partida.md` | *Este documento* — estado y próximo paso |
