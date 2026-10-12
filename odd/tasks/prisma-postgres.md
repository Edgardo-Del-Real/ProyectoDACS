# Prisma + Postgres — ProyectoDACS
Objetivo: capa DB con Prisma + Postgres para Parcela y Precios, reversible. Branch: feature/esqueleto-bff-compose (sigue del esqueleto). Delivery: single-pr. Test runner: npm.

## Specs
- S1 (Cambio pedido): "Na tranqui, tampoco es tan importante el conceptos > codigo. Así que vamos con un Prisma + posgre"
- S2 (Alcance): schema Prisma con Usuario, Parcela (polígono Json + hectáreas), Precio (cultivo/fecha/fuente/valor). BFF usa PrismaClient. Compose db PostGIS sigue compatible.
- S3 (Decisiones): muta D2 de docs/decisiones.md a Prisma, se mantiene reversible.

## Tasks
- T1 (S3): mutar D2 en docs/decisiones.md — route: inline — status: completed — commit: pending
- T2 (S2): apps/bff/prisma/schema.prisma + cliente + /ready — route: inline — status: completed — commit: pending — evidence: validate OK, generate OK v7.10.0, typecheck OK, /health 200, /ready 503 sin DB (correcto)
- T3: verificación generate + typecheck + health + commit — route: inline — status: completed — commit: bc5e199
- Verificación: validate OK, generate v7.10.0 OK, typecheck OK, /health 200, migrate dev 20261012215114_init aplicada con Docker Desktop, /ready 200 db up.
- Mirror Engram: pending.

## Log
- L1 (2026-10-12): "Na tranqui, tampoco es tan importante el conceptos > codigo. Así que vamos con un Prisma + posgre"
- Análisis: se prioriza DX sobre SQL explícito. PostGIS se mantiene en compose como Postgres compatible; geo avanzado va por raw cuando haga falta. Mirror Engram: pending.
- Next: T1-T3 inline, luego commit work-unit.
