# US-05 — Pronóstico del clima de la parcela
Objetivo: ver el pronóstico de 7 días de una parcela usando Open-Meteo, con caché y fallback. Branch: feature/us-05-pronostico-clima. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (US-05 criterio 1): "Dado que mi parcela tiene coordenadas, cuando abro su detalle, entonces veo el pronóstico de 7 días con temperatura mínima, máxima y precipitación."
- S2 (US-05 criterio 2): "Dado que ya consulté el clima hace menos del TTL de la caché, entonces el sistema responde con el dato guardado sin llamar a Open-Meteo."
- S3 (US-05 criterio 3): "Dado que Open-Meteo no responde, entonces veo el último pronóstico guardado con la fecha de su última actualización."
- S4 (RNF-08): Caché con TTL de 3 horas para pronóstico.
- S5 (RNF-09): Si la API externa falla, el sistema sirve el último dato válido y lo indica.

**Alcance autorizado:** modelo PronosticoClima en Prisma, servicio Open-Meteo client con caché, endpoint BFF GET /api/parcelas/:id/clima, frontend página detalle de parcela con pronóstico de 7 días.

**Fuera de alcance:** alertas de helada (US-06), histórico de clima, múltiples parcelas en una sola vista de clima.

**Dependencias técnicas:** Parcela ya existe con polígono GeoJSON. Necesito calcular centroide del polígono para enviar a Open-Meteo. Open-Meteo API: https://api.open-meteo.com/v1/forecast

## Tasks
- T1: explorar Open-Meteo API y diseñar modelo PronosticoClima — route: inline — status: completed — evidence: API docs revisadas, endpoint /v1/forecast, daily params: temperature_2m_max/min, precipitation_sum, timezone support
- T2: agregar modelo PronosticoClima a Prisma + migración — route: inline — status: completed — evidence: schema actualizado, migración SQL ejecutada, prisma generate OK, cliente actualizado con modelo PronosticoClima
- T3: implementar servicio Open-Meteo client con caché y fallback — route: inline — status: completed — evidence: servicio creado con TTL 3h, caché DB, fallback a datos stale
- T4: endpoint BFF GET /api/parcelas/:id/clima — route: inline — status: completed — evidence: ruta registrada, auth JWT, validación ownership, build OK
- T5: frontend página detalle de parcela con pronóstico — route: inline — status: completed — evidence: página DetalleParcela creada, routing /parcelas/:id agregado, build OK
- T6: verificación end-to-end + commit work-unit — route: inline — status: completed — commit: 31ffe8a — evidence: registro/login/parcela OK, endpoint /clima responde con 7 días de pronóstico, stale:false, fallback listo

## Log
- L1 (2026-10-21): Usuario eligió US-05 como próximo feature. Branch creada desde main.
- L2 (2026-10-21): Implementación completa. Commit 31ffe8a. Verificación end-to-end OK: registro, login, crear parcela, obtener pronóstico con 7 días. Caché y fallback implementados.
