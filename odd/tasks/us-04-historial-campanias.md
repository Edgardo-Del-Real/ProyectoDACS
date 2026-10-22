# US-04 — Historial de Campañas de la Parcela
Objetivo: Registrar y consultar el historial de cultivos por campaña agrícola para cada parcela (US-04), con soporte para edición y eliminación. Branch: feature/us-04-historial-campanias. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (US-04 Criterio 1): "Dado que tengo una parcela creada, cuando registro un cultivo con su campaña (por ejemplo, soja 2024/2025), entonces queda guardado en el historial de la parcela."
- S2 (US-04 Criterio 2): "Dado que el historial tiene cultivos, cuando abro el detalle de la parcela, entonces los veo ordenados por campaña."
- S3 (US-04 Criterio 3): "Dado que cargué un dato por error, cuando lo edito o lo elimino, entonces el historial se actualiza."
- S4 (RNF-03 Seguridad): Validación de ownership en todas las operaciones: solo el dueño de la parcela puede ver, agregar, editar o borrar sus campañas.

## Tasks
- T1 (S1, S2, S3, S4): Endpoints en BFF para campañas (`POST`, `GET`, `PUT`, `DELETE` en `/api/parcelas/:id/campanias`) con validación de ownership — route: inline — status: completed — commit: pending
- T2 (S1, S2, S3): Interfaz en frontend en `DetalleParcela.tsx` con listado ordenado por campaña, formulario de alta y acciones de eliminar/editar — route: inline — status: completed — commit: pending
- T3: Verificación end-to-end de contratos y compilación — route: inline — status: completed — commit: pending

## Log
- L1 (2026-10-21): Inicio de US-04. El modelo `CampaniaCultivo` ya fue migrado en Prisma en PR previo. Se implementan los endpoints REST y la UI en DetalleParcela.
