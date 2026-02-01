-- CreateEnum
CREATE TYPE "BankProvider" AS ENUM ('INTER', 'FDBANK');

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "activeBankProvider" "BankProvider" NOT NULL DEFAULT 'INTER',
    "interEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fdbankEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add bankProvider to Payment
ALTER TABLE "Payment" ADD COLUMN "bankProvider" "BankProvider";

-- AlterTable: Add bankProvider to Deposit
ALTER TABLE "Deposit" ADD COLUMN "bankProvider" "BankProvider";

-- AlterTable: Add bankProvider to Transaction
ALTER TABLE "Transaction" ADD COLUMN "bankProvider" "BankProvider";

-- Insert default settings
INSERT INTO "system_settings" ("id", "activeBankProvider", "interEnabled", "fdbankEnabled", "updatedAt")
VALUES ('singleton', 'INTER', true, false, NOW())
ON CONFLICT ("id") DO NOTHING;
