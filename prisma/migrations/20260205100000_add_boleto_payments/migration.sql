-- CreateEnum
CREATE TYPE "BoletoPaymentStatus" AS ENUM ('PENDING_APPROVAL', 'ADMIN_PAYING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "boleto_payments" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "description" TEXT,
    "boletoAmount" DECIMAL(15,2) NOT NULL,
    "serviceFee" DECIMAL(15,2) NOT NULL,
    "totalBrl" DECIMAL(15,2) NOT NULL,
    "cryptoAmount" DECIMAL(18,8) NOT NULL,
    "cryptoCurrency" TEXT NOT NULL,
    "network" "WalletNetwork" NOT NULL,
    "walletId" TEXT NOT NULL,
    "exchangeRate" DECIMAL(10,4) NOT NULL,
    "status" "BoletoPaymentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "adminNotes" TEXT,
    "paidByAdminAt" TIMESTAMP(3),
    "paidByAdminId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boleto_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boleto_payments_customerId_idx" ON "boleto_payments"("customerId");

-- CreateIndex
CREATE INDEX "boleto_payments_status_idx" ON "boleto_payments"("status");

-- CreateIndex
CREATE INDEX "boleto_payments_status_createdAt_idx" ON "boleto_payments"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "boleto_payments" ADD CONSTRAINT "boleto_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleto_payments" ADD CONSTRAINT "boleto_payments_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
