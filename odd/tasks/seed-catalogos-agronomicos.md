# Tarea: Modelado de Dominio y Seed Agronómico (Fase 2 / INTA)

## 1. Contexto y Objetivos
- **Referencia de Proyecto:** Documento *"Sistema de Apoyo a Pequeños Agricultores"* (Páginas 10, 15, 16 y 18).
- **Problema:** Para que las historias de rotación plurianual (`US-09` / `KAN-29`) y recomendación de cultivo con puntaje explicable (`US-08` / `KAN-32`) puedan operar, el sistema requiere los catálogos agronómicos iniciales cargados en base de datos.
- **Objetivo:**
  1. Incorporar en `schema.prisma` los modelos `Cultivo`, `ReglaRotacion` y `ParametroEconomico`.
  2. Implementar un script de seed ejecutable (`prisma/seed.ts`) que alimente la base con los cultivos principales de la región pampeana argentina (Soja, Maíz, Trigo, Girasol, Sorgo, Cebada), sus reglas agronómicas de rotación con fundamentación técnica y los parámetros económicos de retenciones y costos.
  3. Configurar `"prisma": { "seed": "tsx prisma/seed.ts" }` y el comando `"db:seed": "prisma db seed"` en `apps/bff`.

## 2. Modelos en `schema.prisma`
- **`Cultivo`**:
  - `id`: identificador único (cuid).
  - `nombre`: nombre común único (ej: "Soja 1ra", "Maíz tardío", "Trigo pan", "Girasol").
  - `familiaBotanica`: familia biológica (ej: "Leguminosa", "Gramínea", "Asterácea").
  - `cicloDias`: duración estimada del ciclo de cultivo.
  - `tempMinCritica`: temperatura umbral de daño por helada (°C).
- **`ReglaRotacion`**:
  - `cultivoAnteriorId` y `cultivoSiguienteId`: relación a `Cultivo`.
  - `aniosEsperaMin`: años mínimos recomendados antes de repetir el mismo cultivo/familia.
  - `efectoSuelo`: justificación agronómica explicable (ej: fijación simbiótica de N2, estructuración radicular y aporte de rastrojo, etc.).
  - `prioridadSugerencia`: ponderación numérica para el motor de recomendación.
- **`ParametroEconomico`**:
  - `cultivo`: cultivo de referencia.
  - `retencionPct`: alícuota de derechos de exportación vigente en Argentina (ej: 33% soja, 12% maíz/trigo).
  - `costoPorHa`: costo promedio estimado de producción por hectárea (USD/ha).

## 3. Plan de Verificación
- `npm run prisma:validate --workspace apps/bff`: Schema válido y consistente.
- `npm run prisma:generate --workspace apps/bff`: Tipos de Prisma Client generados.
- `npm run build --workspace apps/bff`: Compilación de TypeScript limpia (cero errores de tipos).
- `npm run lint --workspace apps/bff`: Validación de linter exitosa.
