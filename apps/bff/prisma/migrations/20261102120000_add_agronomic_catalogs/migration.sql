-- CreateTable
CREATE TABLE "Cultivo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "familiaBotanica" TEXT NOT NULL,
    "cicloDias" INTEGER NOT NULL,
    "tempMinCritica" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaRotacion" (
    "id" TEXT NOT NULL,
    "cultivoAnteriorId" TEXT NOT NULL,
    "cultivoSiguienteId" TEXT NOT NULL,
    "aniosEsperaMin" INTEGER NOT NULL DEFAULT 0,
    "efectoSuelo" TEXT NOT NULL,
    "prioridadSugerencia" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglaRotacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroEconomico" (
    "id" TEXT NOT NULL,
    "cultivo" TEXT NOT NULL,
    "retencionPct" DOUBLE PRECISION NOT NULL,
    "costoPorHa" DOUBLE PRECISION NOT NULL,
    "fechaVigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametroEconomico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cultivo_nombre_key" ON "Cultivo"("nombre");

-- CreateIndex
CREATE INDEX "Cultivo_familiaBotanica_idx" ON "Cultivo"("familiaBotanica");

-- CreateIndex
CREATE UNIQUE INDEX "ReglaRotacion_cultivoAnteriorId_cultivoSiguienteId_key" ON "ReglaRotacion"("cultivoAnteriorId", "cultivoSiguienteId");

-- CreateIndex
CREATE INDEX "ReglaRotacion_cultivoAnteriorId_idx" ON "ReglaRotacion"("cultivoAnteriorId");

-- CreateIndex
CREATE INDEX "ReglaRotacion_cultivoSiguienteId_idx" ON "ReglaRotacion"("cultivoSiguienteId");

-- CreateIndex
CREATE INDEX "ParametroEconomico_cultivo_idx" ON "ParametroEconomico"("cultivo");

-- AddForeignKey
ALTER TABLE "ReglaRotacion"
ADD CONSTRAINT "ReglaRotacion_cultivoAnteriorId_fkey"
FOREIGN KEY ("cultivoAnteriorId") REFERENCES "Cultivo"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaRotacion"
ADD CONSTRAINT "ReglaRotacion_cultivoSiguienteId_fkey"
FOREIGN KEY ("cultivoSiguienteId") REFERENCES "Cultivo"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
