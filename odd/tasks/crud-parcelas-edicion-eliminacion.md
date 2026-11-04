# CRUD Parcelas — Edición y Eliminación (Épica E2 / US-01)
Objetivo: Implementar la edición (renombrar) y eliminación completa de parcelas en el BFF y en la interfaz de usuario de DetalleParcela y Dashboard, completando el ciclo de vida de los lotes agrícolas. Branch: feature/crud-parcelas-edicion-eliminacion. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (BFF PUT /api/parcelas/:id): Endpoint autenticado (`app.authenticate`) con validación de propiedad (`userId`) que permite actualizar el nombre de la parcela (`nombre: string`).
- S2 (BFF DELETE /api/parcelas/:id): Endpoint autenticado (`app.authenticate`) con validación de propiedad (`userId`) que elimina la parcela en la base de datos (con borrado en cascada de campañas y caché climático).
- S3 (Frontend UI en DetalleParcela):
  - Botón para editar el nombre de la parcela (modal o edición inline interactiva con validación y actualización en tiempo real).
  - Botón de "Eliminar parcela" estilizado con confirmación explícita (advirtiendo que se eliminará el historial de campañas asociado) y redirección a `/panel`.
- S4 (Frontend UI en DashboardView):
  - Acceso directo a acciones sobre las parcelas registradas (eliminación rápida con confirmación).
- S5 (Calidad de Código y Accesibilidad):
  - `npm run lint` y `npm run build` sin errores en todos los workspaces.

## Tasks
- T1 (S1, S2): Implementar endpoints PUT y DELETE /api/parcelas/:id en `apps/bff/src/routes/parcelas.ts` — route: inline — status: completed — commit: pending
- T2 (S3): Implementar controles de edición y eliminación en `apps/frontend/src/pages/DetalleParcela.tsx` — route: inline — status: completed — commit: pending
- T3 (S4): Agregar botón de eliminación rápida en `apps/frontend/src/views/DashboardView.tsx` — route: inline — status: completed — commit: pending
- T4 (S5): Verificación de lint y build monorepo — route: inline — status: completed — commit: pending
- T5: Commit y apertura de Pull Request — route: inline — status: in-progress — commit: pending

## Log
- L1 (2026-10-28): Creación de rama feature/crud-parcelas-edicion-eliminacion a partir de feature/mapa-detalle-parcela-p4. Creación de especificación ODD.
- L2 (2026-10-28): Implementación de PUT y DELETE en BFF, edición inline de nombre y eliminación con confirmación en DetalleParcela y DashboardView. Verificación exitosa.
