# Esqueleto BFF + Compose — ProyectoDACS
Objetivo: esqueleto monorepo con BFF Fastify /health + Compose + decisiones documentadas. Branch: feature/esqueleto-bff-compose. Delivery: single-pr. Test runner: npm.

## Specs
- S1 (BFF framework): "Bien, mandemosle con Fastify entonces."
- S2 (DB): Postgres + PostGIS — respuesta tool a "¿Qué motor de DB usamos para arrancar el esqueleto y US-01 con polígono GeoJSON y precios?" = "Postgres + PostGIS".
- S3 (Comunicación): Mensajería async — respuesta tool a "¿Cómo comunicamos BFF con microservicios dentro de Docker?" = "Mensajería async".
- S4 (Granularidad): Agrupados en 3-4 — respuesta tool a "¿Granularidad inicial de microservicios para el arranque?" = "Agrupados en 3-4".
- S5 (Precios US-02): Ambos + worker — respuesta tool a "¿Estrategia para obtener precios futuros diarios en US-02?" = "Ambos + worker".
- S6 (Estilos): Tailwind — respuesta tool a "¿Estrategia de estilos para la base del frontend?" = "Tailwind".
- S7 (Decisiones doc): "Acordate de dejar documentadas las decisiones y por qué, ya que en algún momento estas pueden mutar respecto a herramientas que den en la cátedra."

Alcance autorizado: Paso 0 esqueleto (compose + bff /health + docs decisiones). No incluye slice US-01 mapa ni base Tailwind (queda para siguiente tarea). Broker default: RabbitMQ (reversible, ver S3).

## Tasks
- T1 (S7): docs/decisiones.md + link desde arquitectura — route: inline — status: completed — commit: pending
- T2 (S1): apps/bff Fastify mínimo con GET /health — route: inline — status: completed — commit: pending — evidence: typecheck OK, curl /health 200 {"status":"ok"}
- T3 (S2,S3,S4): docker-compose.yml frontend+bff+db+broker + env — route: inline — status: completed — commit: pending — evidence: compose validation pending (sin Docker en WSL2, se valida con Docker Desktop)
- T4 (todas): verificación npm build + compose config + commit work-unit — route: inline — status: completed — commit: 62d52af
- Verificación: npm install 222 pkgs OK, typecheck BFF OK, curl /health 200 OK, compose config pendiente sin Docker en WSL2.
- Mirror Engram: pending (proyecto ambiguo).

## Log
- L1 (2026-10-12): "Dale, metamosle. Acordate de dejar documentadas las decisiones y por qué, ya que en algún momento estas pueden mutar respecto a herramientas que den en la cátedra."
- Contexto previo L0: "Bien, mandemosle con Fastify entonces. No cambia nada de lo que ya diagramó edgar en sus commits pasados? Que más tenemos que definir? Haceme las preguntas que sientas y creas necesarias para dar un buen arranque"
- Análisis: Fastify no rompe diagrama Edgar (solo cierra abierta arquitectura.md:99). DB/Comunicación/Granularidad/Precios/Estilos cerrados por tool. Mirror Engram: pending (proyecto Engram ambiguo, se preserva solo local).
- Next: T1-T3 inline, luego T4 verificación y commit.
