/*
  Warnings:

  - You are about to drop the `CardTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Chargeback` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ownership` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payout` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PixLimits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Refund` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CardTransaction" DROP CONSTRAINT "CardTransaction_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Chargeback" DROP CONSTRAINT "Chargeback_cardTransactionId_fkey";

-- DropForeignKey
ALTER TABLE "Chargeback" DROP CONSTRAINT "Chargeback_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Ownership" DROP CONSTRAINT "Ownership_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_debitTxId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_walletId_fkey";

-- DropForeignKey
ALTER TABLE "PixLimits" DROP CONSTRAINT "PixLimits_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_customerId_fkey";

-- AlterTable
ALTER TABLE "Affiliate" ALTER COLUMN "commissionRate" SET DEFAULT 0.03;

-- DropTable
DROP TABLE "CardTransaction";

-- DropTable
DROP TABLE "Chargeback";

-- DropTable
DROP TABLE "Ownership";

-- DropTable
DROP TABLE "Payout";

-- DropTable
DROP TABLE "PixLimits";

-- DropTable
DROP TABLE "Refund";

-- DropEnum
DROP TYPE "CardTransactionStatus";

-- DropEnum
DROP TYPE "CardTransactionType";

-- DropEnum
DROP TYPE "ChargebackReason";

-- DropEnum
DROP TYPE "ChargebackStatus";

-- DropEnum
DROP TYPE "PayoutStatus";
