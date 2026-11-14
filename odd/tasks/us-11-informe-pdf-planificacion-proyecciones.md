# US-11 — Informe PDF con Planificación y Proyecciones (Fase 2)
Objetivo: Permitir al técnico extensionista (o al productor) descargar un informe completo en PDF con la planificación agronómica de la parcela, cultivo sugerido, rotación plurianual, clima hiperlocal y proyecciones económicas/de mercado, asegurando control de acceso estricto (403 si la parcela no es propia ni de un productor asociado). Branch: feature/KAN-21-informePDF-planificacion-y-proyecciones. Delivery: single-pr. Test runner: npm / node.

## Specs
- S1 (US-11 Criterio 1): "Dado que existe una recomendación generada, cuando presiono Descargar informe, entonces obtengo un PDF con la planificación y las proyecciones."
- S2 (US-11 Criterio 2): "Dado que el informe se genera, entonces incluye parcela, cultivo sugerido, rotación, clima y precios considerados."
- S3 (US-11 Criterio 3): "Dado que la parcela no es mía ni de un productor asociado a mí, entonces el sistema responde 403."
- S4 (Gestión de Asociaciones): Soporte en Prisma para el modelo `AsociacionProductor` que vincula a un técnico (`RolUsuario.TECNICO`) con un productor (`RolUsuario.AGRICULTOR`).
- S5 (UI Frontend): Botón interactivo "Descargar Informe PDF" en el detalle de parcela / rotación con feedback de carga y descarga de archivo.

## Tasks
- T1 (S4): Modelo `AsociacionProductor` en `schema.prisma`, migración SQL (`20261114160000_add_asociacion_productor_us11`) y seed de relaciones técnico-productor — route: inline — status: completed
- T2 (S2, S3): Servicio `InformePdfService` y motor vector `PdfDocumentBuilder` para consolidar datos (parcela, rotación/recomendación, clima Open-Meteo, precios Matba Rofex/Bolsa de Cereales, proyecciones de margen) y generar el documento PDF binario estándar (PDF 1.4) — route: inline — status: completed
- T3 (S1, S3): Rutas Fastify (`GET /api/parcelas/:id/informe-pdf`, `GET /api/parcelas/:id/informe`, endpoints de asociaciones de técnicos) con control de acceso 403 / 404 — route: inline — status: completed
- T4 (S5): Integración en frontend (`DetalleParcela.tsx`, `PlanRotacion.tsx`, `DashboardView.tsx`) con botón de descarga y manejo de errores 403 — route: inline — status: completed
- T5 (S1, S2, S3): Pruebas unitarias automatizadas (`informe-pdf.test.ts`) cubriendo generación de PDF, cálculo de proyecciones y verificación de autorización (200 para dueño/asociado, 403 para no asociado, 404 para inexistente) — route: inline — status: completed

## Log
- L1 (2026-11-14): Implementación integral de US-11. Se diseñó el motor `PdfDocumentBuilder` en TypeScript puro sin dependencias nativas pesadas, se modeló `AsociacionProductor` en PostgreSQL con Prisma, se implementaron los endpoints protegidos con 403 para parcelas ajenas no asociadas y se incorporó el botón de descarga en la UI.
