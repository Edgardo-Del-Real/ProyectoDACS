# US-08 — Recomendación de cultivo con puntaje explicable

**Rama:** `feature/us-08-recomendacion-cultivo-puntaje-explicable`
**Issues:** KAN-54 (endpoint) · KAN-59 / KAN-85 (modelo de puntaje ponderado, misma actividad)
**Inicio:** 2026-11-09

## Objetivo

Que un pequeño productor reciba, para una parcela suya, **un cultivo recomendado con puntaje y
justificación**: qué clima, qué precio y qué reglas de rotación se usaron, y con qué antigüedad.

## Problema

Hoy existe `GET /api/parcelas/:id/rotacion`, que devuelve un **plan de sucesión** (qué sembrar
cada año) pero no un **ranking con puntaje explicable** para la próxima campaña. Tampoco existe
un lector de precios: el modelo `Precio` está en el schema y nadie lo usa.

## Alcance

- `POST /api/parcelas/:id/recomendacion` (JWT, solo el dueño de la parcela).
- Motor de puntaje **puro y testeable** (sin DB): rotación + clima + precio.
- Degradación explícita: si Clima o Mercado fallan, usar el último dato guardado e informar antigüedad.
- Precios simulados como fallback declarado mientras US-02 no exista.

## Fuera de alcance

- Pantalla de frontend (va después, por indicación aparte).
- Ingesta real de precios (US-02).
- Persistencia de la recomendación.

## Criterios de aceptación (doc §2.3)

1. Con historial de cultivos → sugiere un cultivo que respeta la rotación.
2. Muestra el motivo, el clima esperado y el precio de referencia utilizados.
3. Sin historial → recomienda por clima y precio y sugiere cargar el historial.
4. Si Clima o Mercado fallan → usa los últimos datos guardados e indica su antigüedad.

## Modelo de puntaje (KAN-59 / KAN-85)

Puntaje 0–100 por cultivo candidato, suma ponderada de tres factores:

| Factor | Peso base | Cómo se calcula |
| ------ | --------- | --------------- |
| Rotación | 0.40 | Regla `ultimoCultivo → candidato` (`prioridadSugerencia` 1–5) + espera mínima (`aniosEsperaMin`) + recurrencia de familia (`aniosEsperaMismaFamilia`). |
| Clima | 0.35 | `tempMinCritica` del cultivo contra la mínima de los 7 días: riesgo de helada penaliza. |
| Precio | 0.25 | Precio de referencia normalizado entre los candidatos. |

Si un factor no está disponible, **se renormalizan los pesos** de los que sí están y se informa en
`pesosAplicados`. Sin historial, rotación no se aplica (criterio 3).

## Tareas

- [x] **T1** — `services/recomendacion.ts`: motor puro `calcularRecomendacion()` + tipos, con tests que cubran los 4 criterios.
- [x] **T2** — `services/mercado.ts`: precios de referencia desde `Precio` (último por cultivo) con fallback simulado declarado.
- [x] **T3** — `routes/recomendacion.ts`: `POST /:id/recomendacion`, ownership, carga de clima con degradación y respuesta explicable; registrar en `index.ts`.
- [x] **T4** — Verificación: tests, typecheck, lint y smoke HTTP contra la base.

## Ruta de trabajo

| Tarea | Ruta | Evidencia del trigger |
| ----- | ---- | --------------------- |
| T1–T3 | Delegada (un writer) | 4 archivos no triviales + mapeo previo del BFF |
| T4 | Inline | ejecución de comandos acotados |

## Checks

```bash
npm run test --workspace @proyectodacs/bff
npm run typecheck --workspace @proyectodacs/bff
npm run lint --workspace @proyectodacs/bff
```

## Bitácora

- 2026-11-09 — Exploración del BFF: rutas, motor de rotación, Open-Meteo, seed y convención de tests.
  Hallazgo: `Precio` no tiene lectores ni datos sembrados; `ParametroEconomico` tampoco se consulta.
- 2026-11-09 — T1–T3 implementadas. `npm run test -w @proyectodacs/bff` → 27/27 pass;
  `typecheck` y `lint` limpios. Smoke HTTP contra la base real:
  - Sin historial: `Girasol` 100 pts, `pesosAplicados { rotacion: 0, clima: 0.583, precio: 0.417 }`,
    `historial.sugerencia` presente, clima `live`, precios `simulado` con advertencia.
  - Con historial (`Soja 1ra`, 2024/25): `Maíz tardío` 81.3 pts, pesos completos
    `{ 0.4, 0.35, 0.25 }`, motivo con rotación + clima + precio, alternativas `Girasol` y `Trigo pan`.
- Pendiente de verificación manual: degradación de clima con proveedor caído (cubierta por test
  unitario, no reproducida en vivo) y 404 de ownership con un segundo usuario.
