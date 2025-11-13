/*
  Warnings:

  - The values [CONFIRMED] on the enum `PayoutStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `genderId` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `identifier` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `legalName` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `socialName` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `tradeName` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `accountHolderId` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `payerBankAccount` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `payerBankAccountDigit` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `payerBankBranch` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `payerBankCode` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `payerISPB` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `receiverBankAccount` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `receiverBankAccountDigit` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `receiverBankBranch` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `receiverBankCode` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `receiverISPB` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `receiverName` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `receiverTaxNumber` on the `Deposit` table. All the data in the column will be lost.
  - You are about to drop the column `statusId` on the `Deposit` table. All the data in the column will be lost.
  - The `status` column on the `Deposit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `payerBankAccount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `payerBankBranch` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `payerBankCode` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `payerISPB` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `receiverBankAccount` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `receiverBankBranch` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `receiverISPB` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `statusId` on the `Payment` table. All the data in the column will be lost.
  - The `status` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `singleTransfer` on the `PixLimits` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(15,2)`.
  - You are about to alter the column `daytime` on the `PixLimits` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(15,2)`.
  - You are about to alter the column `nighttime` on the `PixLimits` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(15,2)`.
  - You are about to alter the column `monthly` on the `PixLimits` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(15,2)`.
  - You are about to drop the column `walletId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `PixWebhookEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WebhookEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inter_webhook_logs` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[chargebackId]` on the table `CardTransaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `Deposit` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[debitTxId]` on the table `Payout` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `Customer` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Deposit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'TRANSFER_IN', 'TRANSFER_OUT', 'PIX_IN', 'PIX_OUT', 'FEE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED', 'CANCELED');

-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'suspended';

-- AlterEnum
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED');
ALTER TABLE "public"."Payout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "public"."PayoutStatus_old";
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."CardTransaction" DROP CONSTRAINT "CardTransaction_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Chargeback" DROP CONSTRAINT "Chargeback_cardTransactionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Chargeback" DROP CONSTRAINT "Chargeback_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payout" DROP CONSTRAINT "Payout_walletId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Wallet" DROP CONSTRAINT "Wallet_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."accounts" DROP CONSTRAINT "accounts_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_accountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_walletId_fkey";

-- DropIndex
DROP INDEX "public"."Customer_externalAccredId_key";

-- DropIndex
DROP INDEX "public"."Customer_externalClientId_key";

-- DropIndex
DROP INDEX "public"."Customer_type_accountStatus_idx";

-- DropIndex
DROP INDEX "public"."Customer_userId_key";

-- DropIndex
DROP INDEX "public"."Payout_walletId_status_createdAt_idx";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "genderId",
DROP COLUMN "identifier",
DROP COLUMN "legalName",
DROP COLUMN "productId",
DROP COLUMN "socialName",
DROP COLUMN "tradeName",
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "foundingDate" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "mothersName" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "tradingName" TEXT,
ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "Deposit" DROP COLUMN "accountHolderId",
DROP COLUMN "payerBankAccount",
DROP COLUMN "payerBankAccountDigit",
DROP COLUMN "payerBankBranch",
DROP COLUMN "payerBankCode",
DROP COLUMN "payerISPB",
DROP COLUMN "receiverBankAccount",
DROP COLUMN "receiverBankAccountDigit",
DROP COLUMN "receiverBankBranch",
DROP COLUMN "receiverBankCode",
DROP COLUMN "receiverISPB",
DROP COLUMN "receiverName",
DROP COLUMN "receiverTaxNumber",
DROP COLUMN "statusId",
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "DepositStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "payerBankAccount",
DROP COLUMN "payerBankBranch",
DROP COLUMN "payerBankCode",
DROP COLUMN "payerISPB",
DROP COLUMN "receiverBankAccount",
DROP COLUMN "receiverBankBranch",
DROP COLUMN "receiverISPB",
DROP COLUMN "statusId",
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "PixLimits" ALTER COLUMN "singleTransfer" SET DATA TYPE DECIMAL(15,2),
ALTER COLUMN "daytime" SET DATA TYPE DECIMAL(15,2),
ALTER COLUMN "nighttime" SET DATA TYPE DECIMAL(15,2),
ALTER COLUMN "monthly" SET DATA TYPE DECIMAL(15,2);

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "currency" SET DEFAULT 'BRL';

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "walletId",
DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TransactionStatus" NOT NULL;

-- AlterTable
ALTER TABLE "webhook_logs" ADD COLUMN     "endToEnd" TEXT,
ADD COLUMN     "txid" TEXT;

-- DropTable
DROP TABLE "public"."PixWebhookEvent";

-- DropTable
DROP TABLE "public"."WebhookEvent";

-- DropTable
DROP TABLE "public"."inter_webhook_logs";

-- DropEnum
DROP TYPE "public"."TxType";

-- CreateIndex
CREATE UNIQUE INDEX "CardTransaction_chargebackId_key" ON "CardTransaction"("chargebackId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_externalClientId_idx" ON "Customer"("externalClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_externalId_key" ON "Deposit"("externalId");

-- CreateIndex
CREATE INDEX "Deposit_status_createdAt_idx" ON "Deposit"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Deposit_endToEnd_idx" ON "Deposit"("endToEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalId_key" ON "Payment"("externalId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_debitTxId_key" ON "Payout"("debitTxId");

-- CreateIndex
CREATE INDEX "Payout_walletId_createdAt_idx" ON "Payout"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Wallet_customerId_idx" ON "Wallet"("customerId");

-- CreateIndex
CREATE INDEX "accounts_customerId_idx" ON "accounts"("customerId");

-- CreateIndex
CREATE INDEX "transactions_type_status_idx" ON "transactions"("type", "status");

-- CreateIndex
CREATE INDEX "webhook_logs_endToEnd_idx" ON "webhook_logs"("endToEnd");

-- CreateIndex
CREATE INDEX "webhook_logs_processed_idx" ON "webhook_logs"("processed");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_cardTransactionId_fkey" FOREIGN KEY ("cardTransactionId") REFERENCES "CardTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
