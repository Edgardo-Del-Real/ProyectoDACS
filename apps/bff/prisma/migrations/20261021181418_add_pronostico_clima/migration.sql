-- CreateTable
CREATE TABLE "PronosticoClima" (
    "id" TEXT NOT NULL,
    "parcelaId" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PronosticoClima_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PronosticoClima_parcelaId_key" ON "PronosticoClima"("parcelaId");

-- AddForeignKey
ALTER TABLE "PronosticoClima" ADD CONSTRAINT "PronosticoClima_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "Parcela"("id") ON DELETE CASCADE ON UPDATE CASCADE;
