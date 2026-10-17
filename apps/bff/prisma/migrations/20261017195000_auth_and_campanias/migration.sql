-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('AGRICULTOR', 'COOPERATIVA', 'TECNICO');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "passwordHash" TEXT NOT NULL,
ADD COLUMN "rol" "RolUsuario" NOT NULL DEFAULT 'AGRICULTOR',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Parcela" DROP COLUMN "cultivoAnterior";

-- CreateTable
CREATE TABLE "CampaniaCultivo" (
    "id" TEXT NOT NULL,
    "parcelaId" TEXT NOT NULL,
    "cultivo" TEXT NOT NULL,
    "campania" TEXT NOT NULL,
    "rindeReal" DOUBLE PRECISION,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaniaCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaniaCultivo_parcelaId_idx" ON "CampaniaCultivo"("parcelaId");

-- AddForeignKey
ALTER TABLE "CampaniaCultivo" ADD CONSTRAINT "CampaniaCultivo_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "Parcela"("id") ON DELETE CASCADE ON UPDATE CASCADE;
