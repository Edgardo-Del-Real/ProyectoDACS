# P4 — Mapa Satelital en Detalle de Parcela (Pantalla P4 del PDF)
Objetivo: Implementar la visualización del polígono satelital delimitado en la pantalla de Detalle de Parcela (P4), consumiendo el GeoJSON real desde el BFF y renderizándolo con React-Leaflet en modo solo lectura con ajuste automático de zoom (fitBounds). Branch: feature/mapa-detalle-parcela-p4. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (BFF Endpoint GET /api/parcelas/:id): Implementar endpoint en `apps/bff/src/routes/parcelas.ts` protegido con autenticación (`app.authenticate`) que devuelve el registro completo de la parcela (incluyendo el objeto `poligono` GeoJSON y `hectareas`), validando que pertenezca al usuario en sesión (`userId`).
- S2 (Componente Frontend MapaDetalleParcela): Crear `apps/frontend/src/components/MapaDetalleParcela.tsx` usando `react-leaflet` con la capa satelital de Esri (`World_Imagery`) y la capa de referencia (`World_Boundaries_and_Places`), renderizando el polígono con `GeoJSON` de Leaflet con estilo agronómico (verde/esmeralda semitransparente) y auto-centrado con `fitBounds`.
- S3 (Integración en DetalleParcela.tsx): Actualizar `apps/frontend/src/pages/DetalleParcela.tsx` para cargar los datos de la parcela (`GET /api/parcelas/:id`), renderizar la tarjeta del mapa satelital del lote, mostrar las hectáreas oficiales y mantener la interfaz responsive y consistente con Tailwind CSS.
- S4 (Verificación): Ejecutar `npm run lint` y `npm run build` en ambos workspaces (`apps/bff` y `apps/frontend`) garantizando 0 errores y builds limpios.

## Tasks
- T1 (S1): Implementar `GET /api/parcelas/:id` en `apps/bff/src/routes/parcelas.ts` — route: inline — status: completed — commit: pending
- T2 (S2): Crear componente `apps/frontend/src/components/MapaDetalleParcela.tsx` — route: inline — status: completed — commit: pending
- T3 (S3): Integrar mapa satelital en `apps/frontend/src/pages/DetalleParcela.tsx` — route: inline — status: completed — commit: pending
- T4 (S4): Verificación de lint y build monorepo — route: inline — status: completed — commit: pending
- T5: Commit y apertura de Pull Request — route: inline — status: in-progress — commit: pending

## Log
- L1 (2026-10-28): Creación de rama feature/mapa-detalle-parcela-p4 a partir de feature/rnf-15-tailwind-parcelas. Creación de especificación ODD.
- L2 (2026-10-28): Endpoint GET /api/parcelas/:id en BFF, componente MapaDetalleParcela con fitBounds y capas Esri, e integración en DetalleParcela.tsx completada. Lint y build limpios.
