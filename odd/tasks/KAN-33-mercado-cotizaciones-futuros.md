# KAN-33 — Cotizaciones de Futuros y Pantalla Mercado (US-07 / P5)
Objetivo: Implementar el módulo de mercado agrícola con cotizaciones de futuros por vencimiento, histórico con gráficos de tendencia y pantalla Mercado responsiva (US-07 / Pantalla P5), con resiliencia y caché de respaldo. Branch: feature/KAN-33-mercado-cotizaciones-futuros. Delivery: single-pr. Test runner: npm.

## Fuente de datos
Precios FOB oficiales (Ley 21.453) de la Bolsa de Cereales de Buenos Aires:
`https://www.bolsadecereales.com/precios-oficiales` (curva por vencimiento) y
`https://www.bolsadecereales.com/cotizaciones` (spot FOB MAGyP).

El sitio no publica API ni archivos descargables: los datos están en tablas HTML
server-rendered. Se scrapea con un parser propio, testeado contra un fixture del
HTML real.

Nota de infraestructura: el sitio está detrás de Cloudflare y responde 403 al
cliente HTTP de Node (fingerprint TLS), mientras que `curl` obtiene 200. Por eso
la descarga usa `fetch` y cae a `curl` como segundo intento. robots.txt declara
`User-agent: * -> Allow: /`. La sincronización corre en un worker aparte
(`npm run sync:mercado`), nunca en el request path de la API.

## Specs
- S1 (Modelo de datos): `Precio` con `posicion` (`DISPONIBLE`, `NOV26`, `ENE27`…), `moneda`, `fecha`, `fuente` y `valor` en USD/tn. Índice único `(cultivo, posicion, fecha, fuente)` e índice `(cultivo, posicion)`.
- S2 (Scraper y worker): `services/bolsaCereales.ts` descarga y parsea la tabla FOB y el flash de spot; `scripts/sync-mercado.ts` las persiste con `upsert` idempotente, protegido por `CircuitBreaker` (RNF-10).
- S3 (API de lectura): `GET /api/mercado/cotizaciones` (spot + curva, con `stale` según antigüedad), `GET /api/mercado/historico` (serie de snapshots, sin escrituras), `GET /api/mercado/cultivos`.
- S4 (Pantalla P5): vista responsive con selector de grano, KPIs (spot, futuro más cercano, último cierre), tabla de vencimientos, gráfico SVG de tendencia con `<title>` accesible y aviso de datos desactualizados.
- S5 (Calidad): tests con `node --test` sobre parsers y métricas puras, sin base de datos ni red. `npm test`, `npm run lint` y `npm run build` sin errores.

## Tasks
- T1 (S1): Migración `add_posicion_and_moneda_to_precio` y modelo `Precio` — status: completed
- T2 (S2): Parser de la Bolsa + worker `sync:mercado` — status: completed
- T3 (S3): Servicio y rutas de mercado (solo lectura) — status: completed
- T4 (S5): Tests de parsers y métricas (20 casos) — status: completed
- T5 (S4): Vista `MercadoView` con tabla, KPIs y gráfico accesible — status: completed
- T6: Commit y entrega de PR — status: in-progress

## Log
- L1 (2026-11-04): Creación de rama y especificación ODD.
- L2 (2026-11-04): Primera implementación con tabla hardcodeada `PRECIOS_BASE_MERCADO` presentada como Matba Rofex. Detectado en review: no había ninguna llamada HTTP, la variación diaria era `sin(codigo[0])` y los tests pasaban sin base de datos porque los errores de Prisma se silenciaban.
- L3 (2026-11-04): Reemplazo del proveedor simulado por scraping real de la Bolsa de Cereales (aprobado con el equipo). Se elimina `forzarFallo`, la tabla de precios inventados y la generación de series con senos; se agrega parser testeado, worker de sincronización y `stale` calculado por antigüedad real.
