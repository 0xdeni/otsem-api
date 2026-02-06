-- CreateEnum
CREATE TYPE "SpotOrderStatus" AS ENUM ('OPEN', 'PARTIAL', 'FILLED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "SpotTransferDirection" AS ENUM ('TO_PRO', 'TO_WALLET');

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "reserved" DECIMAL(18,8) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SpotBalance" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "available" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "locked" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "instId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "ordType" TEXT NOT NULL,
    "sz" DECIMAL(18,8) NOT NULL,
    "px" DECIMAL(18,8),
    "lockedCurrency" TEXT NOT NULL,
    "lockedAmount" DECIMAL(18,8) NOT NULL,
    "status" "SpotOrderStatus" NOT NULL DEFAULT 'OPEN',
    "okxOrdId" TEXT,
    "filledBase" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "filledQuote" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "avgPx" DECIMAL(18,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotTransfer" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "walletId" TEXT,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "direction" "SpotTransferDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpotBalance_customerId_idx" ON "SpotBalance"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SpotBalance_customerId_currency_key" ON "SpotBalance"("customerId", "currency");

-- CreateIndex
CREATE INDEX "SpotOrder_customerId_status_idx" ON "SpotOrder"("customerId", "status");

-- CreateIndex
CREATE INDEX "SpotOrder_okxOrdId_idx" ON "SpotOrder"("okxOrdId");

-- CreateIndex
CREATE INDEX "SpotTransfer_customerId_createdAt_idx" ON "SpotTransfer"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "SpotBalance" ADD CONSTRAINT "SpotBalance_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotOrder" ADD CONSTRAINT "SpotOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotTransfer" ADD CONSTRAINT "SpotTransfer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotTransfer" ADD CONSTRAINT "SpotTransfer_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
