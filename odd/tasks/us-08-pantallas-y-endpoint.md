# US-08 — Pantalla de recomendación y endpoint

**Rama:** `feature/us-08-pantallas-y-endpoint` (basada en `feature/us-08-recomendacion-cultivo-puntaje-explicable`)
**Issues:** KAN-60 / KAN-82 (pantalla, misma actividad) · KAN-70 (endpoint)
**Inicio:** 2026-11-09

## Objetivo

Que el productor **vea** la recomendación que ya calcula el BFF: cultivo sugerido, puntaje, motivo,
y el clima y el precio que se consideraron.

## Estado de partida

- `POST /api/parcelas/:id/recomendacion` **ya existe** (KAN-54, rama anterior). KAN-70 pide el
  mismo endpoint, así que se toma como **duplicado**: no se reimplementa, se consume.
- El frontend no tiene ninguna referencia a esta funcionalidad ni runner de tests.

## Alcance

- Cliente tipado `src/api/recomendacion.ts`.
- Componente `RecomendacionCultivo` con el desglose explicable.
- Pantalla `RecomendacionParcela` en `/parcelas/:id/recomendacion` (protegida).
- Acceso desde el detalle de la parcela.

## Fuera de alcance

- Cambios en el BFF (el contrato ya está cerrado).
- Tests de frontend (no hay runner todavía).

## Criterios de aceptación

1. Se ve el **cultivo sugerido** y su **puntaje**.
2. Se ve el **motivo** y el **desglose por factor** (rotación, clima, precio con su peso).
3. Se ve el **clima considerado** (fuente, antigüedad, mínima y días con riesgo).
4. Se ve el **precio de referencia considerado** (fuente y antigüedad).
5. Sin historial: se muestra la sugerencia de cargar campañas.
6. Estados de carga, error (con reintento) y sin datos.

## Tareas

- [x] **T1** — `api/recomendacion.ts`: tipos del contrato + `obtenerRecomendacion()`.
- [x] **T2** — `components/RecomendacionCultivo.tsx`: cultivo, puntaje, motivo, factores, clima, precio, historial, advertencias y alternativas.
- [x] **T3** — `pages/RecomendacionParcela.tsx` + ruta protegida + enlace desde `DetalleParcela`.
- [x] **T4** — Verificación: `build` y `lint` del frontend.

## Ruta de trabajo

| Tarea | Ruta | Evidencia del trigger |
| ----- | ---- | --------------------- |
| T1–T3 | Delegada (un writer) | 3 archivos nuevos + 2 editados |
| T4 | Inline | build y lint acotados |

## Checks

```bash
npm run build --workspace apps/frontend
npm run lint --workspace apps/frontend
```

## Bitácora

- 2026-11-09 — Exploración del frontend: ruteo plano bajo `MainLayout`, `apiFetch` inyecta token y
  lanza `ApiError`, estilos 100% Tailwind inline (emerald/slate), `PlanRotacion` como referencia de
  estados carga/error/contenido. KAN-70 marcado como duplicado de KAN-54.
- 2026-11-09 — T1–T3 implementadas. `build` y `lint` del frontend en verde (`tsc -b` incluido en el
  build). Sin runner de tests ni automatización de browser: el render real no se verificó en vivo.
