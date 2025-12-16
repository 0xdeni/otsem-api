/*
  Warnings:

  - A unique constraint covering the columns `[endToEnd]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[txid]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "bankPayload" JSONB,
ADD COLUMN     "endToEnd" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "payerMessage" TEXT,
ADD COLUMN     "payerName" TEXT,
ADD COLUMN     "payerTaxNumber" TEXT,
ADD COLUMN     "pixKey" TEXT,
ADD COLUMN     "receiverBankCode" TEXT,
ADD COLUMN     "receiverName" TEXT,
ADD COLUMN     "receiverPixKey" TEXT,
ADD COLUMN     "receiverTaxNumber" TEXT,
ADD COLUMN     "txid" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_endToEnd_key" ON "transactions"("endToEnd");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_txid_key" ON "transactions"("txid");

-- CreateIndex
CREATE INDEX "transactions_endToEnd_idx" ON "transactions"("endToEnd");
