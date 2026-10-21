# US-01 — Mapa de parcelas con dibujo de polígono
Objetivo: alta de parcela con mapa satelital, dibujo de polígono y cálculo de hectáreas. Branch: feature/us-01-mapa-parcelas. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (US-01 criterio 1): "Dado que estoy autenticado, cuando abro 'Nueva parcela', entonces se carga el mapa satelital."
- S2 (US-01 criterio 2): "Dado que el mapa está cargado, cuando marco puntos y cierro la figura, entonces se forma un polígono."
- S3 (US-01 criterio 3): "Dado que cerré el polígono, cuando termino de dibujarlo, entonces el sistema calcula y muestra las hectáreas totales."
- S4 (US-01 criterio 4): "Dado un polígono válido, cuando presiono Guardar, entonces las coordenadas se almacenan vinculadas a mi usuario."
- S5 (US-01 criterio 5): "Dado un polígono con menos de 3 puntos o lados cruzados, cuando intento guardarlo, entonces el sistema muestra un error de geometría inválida."

**Alcance autorizado:** frontend con Leaflet + Geoman en pantalla "Nueva parcela", cálculo de hectáreas con turf.js, endpoint BFF POST /api/parcelas, validación de geometría en backend.

**Fuera de alcance:** autenticación JWT completa (se mockea el usuario por ahora), historial de cultivos (US-04), edición/eliminación de parcelas.

**Dependencias técnicas:** Prisma ya tiene modelo Parcela (polígono Json + hectáreas + userId). Compose ya tiene PostGIS. BFF Fastify ya operativo con /health y /ready.

## Tasks
- T1 (S1): instalar Leaflet + Geoman en frontend + pantalla NuevaParcela con mapa satelital — route: inline — status: completed — evidence: build OK, tiles Esri World Imagery, routing /parcelas/nueva
- T2 (S2): habilitar dibujo de polígono con Geoman + evento onFinish — route: inline — status: completed — evidence: pm:create wireado, toolbar drawPolygon + editMode + removalMode
- T3 (S3): calcular hectáreas con turf.js al cerrar polígono + mostrar en UI — route: inline — status: completed — evidence: turf.area() en create/edit/remove, display "{ha} ha"
- T4 (S4,S5): endpoint BFF POST /api/parcelas con validación de geometría (mínimo 3 puntos, no cruzado) + persistencia Prisma — route: inline — status: completed — evidence: build BFF OK, validación con turf.js + detección de lados cruzados O(n²), auth JWT via app.authenticate, GET /api/parcelas listado por usuario
- T5 (todas): integración frontend → BFF + verificación end-to-end + commit work-unit — route: inline — status: completed — commit: e6e1eed — evidence: typecheck frontend OK, typecheck BFF OK, build OK. Verificación end-to-end completa con Docker Desktop: stack up (db/broker/bff/frontend), migraciones Prisma aplicadas, registro+login+JWT OK, POST /api/parcelas OK, GET /api/parcelas OK, validación geometría inválida OK (rechaza polígono con <3 puntos con 400).

## Log
- L1 (2026-10-21): "Dale, metele nomas. Cuando lleguemo a ese momento del detalle, lo resolvemos"
- L2 (2026-10-21): Verificación end-to-end completa con Docker Desktop. Flujo probado: registro → login → JWT → crear parcela → listar parcelas → validación geometría inválida. Todo OK.
- L3 (2026-10-21): Ajuste puerto BFF a 8090 (8080 ocupado). Frontend corre directo sin npm install para evitar conflictos de workspaces.
- L4 (2026-10-21): Commits finales: 77e8e29 (implementación), e6e1eed (verificación end-to-end y ajustes).
- Análisis: US-01 tiene criterios claros. Auth se mockea por ahora (no bloquea el mapa). Cálculo de área en frontend con turf.js es más rápido que PostGIS para este slice. Validación de geometría va en backend como defensa.
- Next: T1 instalación Leaflet + Geoman.
