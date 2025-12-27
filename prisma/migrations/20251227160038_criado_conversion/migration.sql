/*
  Warnings:

  - You are about to alter the column `spreadValue` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `Decimal(6,4)`.

*/
-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'PIX_SENT', 'USDT_BOUGHT', 'USDT_WITHDRAWN', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "spreadValue" SET DEFAULT 0.9905,
ALTER COLUMN "spreadValue" SET DATA TYPE DECIMAL(6,4);

-- CreateTable
CREATE TABLE "conversions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionId" TEXT,
    "brlCharged" DECIMAL(18,2) NOT NULL,
    "brlExchanged" DECIMAL(18,2) NOT NULL,
    "spreadPercent" DECIMAL(6,4) NOT NULL,
    "spreadBrl" DECIMAL(18,2) NOT NULL,
    "usdtPurchased" DECIMAL(18,6) NOT NULL,
    "usdtWithdrawn" DECIMAL(18,6) NOT NULL,
    "exchangeRate" DECIMAL(10,4) NOT NULL,
    "network" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletId" TEXT,
    "pixEndToEnd" TEXT,
    "pixTxid" TEXT,
    "okxOrderId" TEXT,
    "okxWithdrawId" TEXT,
    "affiliateId" TEXT,
    "affiliateCommission" DECIMAL(18,2),
    "okxWithdrawFee" DECIMAL(18,6) NOT NULL,
    "okxTradingFee" DECIMAL(18,2) NOT NULL,
    "totalOkxFees" DECIMAL(18,2) NOT NULL,
    "grossProfit" DECIMAL(18,2) NOT NULL,
    "netProfit" DECIMAL(18,2) NOT NULL,
    "status" "ConversionStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversions_transactionId_key" ON "conversions"("transactionId");

-- CreateIndex
CREATE INDEX "conversions_customerId_idx" ON "conversions"("customerId");

-- CreateIndex
CREATE INDEX "conversions_status_idx" ON "conversions"("status");

-- CreateIndex
CREATE INDEX "conversions_createdAt_idx" ON "conversions"("createdAt");

-- CreateIndex
CREATE INDEX "conversions_affiliateId_idx" ON "conversions"("affiliateId");

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
