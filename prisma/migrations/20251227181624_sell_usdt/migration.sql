-- CreateEnum
CREATE TYPE "ConversionType" AS ENUM ('BUY', 'SELL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConversionStatus" ADD VALUE 'USDT_RECEIVED';
ALTER TYPE "ConversionStatus" ADD VALUE 'USDT_SOLD';
ALTER TYPE "ConversionStatus" ADD VALUE 'PIX_OUT_SENT';

-- AlterTable
ALTER TABLE "conversions" ADD COLUMN     "okxDepositId" TEXT,
ADD COLUMN     "pixDestKey" TEXT,
ADD COLUMN     "pixDestKeyType" TEXT,
ADD COLUMN     "type" "ConversionType" NOT NULL DEFAULT 'BUY';

-- CreateIndex
CREATE INDEX "conversions_type_idx" ON "conversions"("type");
