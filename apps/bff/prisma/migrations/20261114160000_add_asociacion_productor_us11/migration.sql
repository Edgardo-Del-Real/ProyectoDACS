-- CreateTable
CREATE TABLE "AsociacionProductor" (
    "id" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "productorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsociacionProductor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsociacionProductor_tecnicoId_idx" ON "AsociacionProductor"("tecnicoId");

-- CreateIndex
CREATE INDEX "AsociacionProductor_productorId_idx" ON "AsociacionProductor"("productorId");

-- CreateIndex
CREATE UNIQUE INDEX "AsociacionProductor_tecnicoId_productorId_key" ON "AsociacionProductor"("tecnicoId", "productorId");

-- AddForeignKey
ALTER TABLE "AsociacionProductor" ADD CONSTRAINT "AsociacionProductor_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsociacionProductor" ADD CONSTRAINT "AsociacionProductor_productorId_fkey" FOREIGN KEY ("productorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
