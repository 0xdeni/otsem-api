/*
  Warnings:

  - You are about to alter the column `balance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `Decimal(18,8)`.
  - A unique constraint covering the columns `[customerId,network,externalAddress]` on the table `Wallet` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "WalletNetwork" AS ENUM ('SOLANA', 'ETHEREUM', 'POLYGON', 'BSC', 'TRON', 'BITCOIN', 'AVALANCHE', 'ARBITRUM', 'OPTIMISM', 'BASE');

-- DropIndex
DROP INDEX "public"."Wallet_customerId_currency_key";

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "label" TEXT,
ADD COLUMN     "network" "WalletNetwork" NOT NULL DEFAULT 'SOLANA',
ALTER COLUMN "currency" SET DEFAULT 'USDT',
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(18,8);

-- CreateIndex
CREATE INDEX "Wallet_customerId_network_idx" ON "Wallet"("customerId", "network");

-- CreateIndex
CREATE INDEX "Wallet_customerId_currency_idx" ON "Wallet"("customerId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_customerId_network_externalAddress_key" ON "Wallet"("customerId", "network", "externalAddress");
