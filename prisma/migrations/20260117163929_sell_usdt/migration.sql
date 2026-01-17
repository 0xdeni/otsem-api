-- CreateEnum
CREATE TYPE "KycLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "kycLevel" "KycLevel" NOT NULL DEFAULT 'LEVEL_1',
ADD COLUMN     "spreadPercent" DECIMAL(6,4);

-- CreateTable
CREATE TABLE "kyc_level_configs" (
    "id" TEXT NOT NULL,
    "level" "KycLevel" NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "monthlyLimit" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_level_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_level_configs_level_customerType_key" ON "kyc_level_configs"("level", "customerType");
