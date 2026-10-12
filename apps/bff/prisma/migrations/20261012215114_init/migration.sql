-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcela" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT,
    "poligono" JSONB NOT NULL,
    "hectareas" DOUBLE PRECISION NOT NULL,
    "cultivoAnterior" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Precio" (
    "id" TEXT NOT NULL,
    "cultivo" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "fuente" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Precio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Parcela_userId_idx" ON "Parcela"("userId");

-- CreateIndex
CREATE INDEX "Precio_cultivo_fecha_idx" ON "Precio"("cultivo", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Precio_cultivo_fecha_fuente_key" ON "Precio"("cultivo", "fecha", "fuente");

-- AddForeignKey
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
