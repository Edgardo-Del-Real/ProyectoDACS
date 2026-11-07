-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('HELADA', 'SEQUIA', 'SIEMBRA', 'COSECHA', 'PRECIO');

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parcelaId" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "fechaEvento" TEXT NOT NULL,
    "valorDetectado" DOUBLE PRECISION NOT NULL,
    "umbral" DOUBLE PRECISION NOT NULL,
    "mensaje" TEXT NOT NULL,
    "emailEnviado" BOOLEAN NOT NULL DEFAULT false,
    "enviadoAt" TIMESTAMP(3),
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_parcelaId_tipo_fechaEvento_key" ON "Alerta"("parcelaId", "tipo", "fechaEvento");

-- CreateIndex
CREATE INDEX "Alerta_userId_createdAt_idx" ON "Alerta"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Alerta_parcelaId_idx" ON "Alerta"("parcelaId");

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "Parcela"("id") ON DELETE CASCADE ON UPDATE CASCADE;

