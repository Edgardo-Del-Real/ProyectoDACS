# RNF-15 — Modernización Tailwind de NuevaParcela y DetalleParcela (P3 y P4)
Objetivo: Modernizar las pantallas de Nueva Parcela (P3) y Detalle de Parcela (P4) reemplazando estilos inline con Tailwind CSS, garantizando diseño responsive, experiencia mobile-first y coherencia visual con el Dashboard (RNF-15). Branch: feature/rnf-15-tailwind-parcelas. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (NuevaParcela Responsive & Tailwind): Eliminar estilos inline en `NuevaParcela.tsx`. Implementar layout mobile-first con Tailwind CSS (tarjeta estilizada, input accesible para nombre, marco redondeado para MapaPoligono, badge para cálculo de superficie con Turf, banner de alerta cuando se supera el límite de 5.000 ha, botones estilizados para guardar y cancelar/volver).
- S2 (DetalleParcela Responsive & Tailwind): Eliminar estilos inline en `DetalleParcela.tsx`. Modernizar header de parcela, banner de estado stale del clima, grid de pronóstico extendido a 7 días (responsive con Open-Meteo), formulario plegable de registro de campañas y tabla/tarjetas de historial de cultivos con badge por cultivo y acción de eliminación.
- S3 (Preservar Funcionalidad y Contratos): Mantener inalterados todos los contratos con el BFF (`POST /api/parcelas`, `GET /api/parcelas/:id/clima`, `GET /api/parcelas/:id/campanias`, `POST /api/parcelas/:id/campanias`, `DELETE /api/parcelas/:id/campanias/:campaniaId`), validación de sesión con `useAuth` / `getToken`, y callbacks de Geoman/Turf.
- S4 (Calidad de Código y Accesibilidad): Sin errores de lint en React 19 / ESLint (`react-hooks/set-state-in-effect`), soporte semántico con `role="alert"`, build de producción limpio.

## Tasks
- T1 (S1): Refactorizar `apps/frontend/src/pages/NuevaParcela.tsx` a Tailwind CSS mobile-first — route: inline — status: completed — commit: pending
- T2 (S2): Refactorizar `apps/frontend/src/pages/DetalleParcela.tsx` a Tailwind CSS mobile-first — route: inline — status: completed — commit: pending
- T3 (S3, S4): Verificación de lint y build en el workspace frontend — route: inline — status: completed — commit: pending
- T4: Commit y apertura de Pull Request — route: inline — status: in-progress — commit: pending

## Log
- L1 (2026-10-28): Creación de rama feature/rnf-15-tailwind-parcelas a partir de main limpio. Creación de especificación ODD.
- L2 (2026-10-28): Refactorización completa de NuevaParcela.tsx y DetalleParcela.tsx con Tailwind CSS. Verificación de lint y build exitosos.
