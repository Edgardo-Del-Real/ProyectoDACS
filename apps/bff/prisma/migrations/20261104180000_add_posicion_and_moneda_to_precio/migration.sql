-- AlterTable
ALTER TABLE "Precio" ADD COLUMN "posicion" TEXT NOT NULL DEFAULT 'DISPONIBLE',
ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'USD';

-- DropIndex
DROP INDEX IF EXISTS "Precio_cultivo_fecha_fuente_key";

-- CreateIndex
CREATE INDEX "Precio_cultivo_posicion_idx" ON "Precio"("cultivo", "posicion");

-- CreateIndex
CREATE UNIQUE INDEX "Precio_cultivo_posicion_fecha_fuente_key" ON "Precio"("cultivo", "posicion", "fecha", "fuente");
