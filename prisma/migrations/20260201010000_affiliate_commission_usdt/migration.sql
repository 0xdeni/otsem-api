-- Affiliate: add commissionRate and USDT earnings fields
ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(10, 6) NOT NULL DEFAULT 0.10;
ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "totalEarningsUsdt" DECIMAL(18, 6) NOT NULL DEFAULT 0;
ALTER TABLE "Affiliate" ADD COLUMN IF NOT EXISTS "pendingEarningsUsdt" DECIMAL(18, 6) NOT NULL DEFAULT 0;

-- AffiliateCommission: add USDT fields, conversionId, conversionType, settlementTxId
ALTER TABLE "AffiliateCommission" ADD COLUMN IF NOT EXISTS "conversionId" TEXT;
ALTER TABLE "AffiliateCommission" ADD COLUMN IF NOT EXISTS "conversionType" TEXT;
ALTER TABLE "AffiliateCommission" ADD COLUMN IF NOT EXISTS "spreadBrl" DECIMAL(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE "AffiliateCommission" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(10, 6) NOT NULL DEFAULT 0.10;
ALTER TABLE "AffiliateCommission" ADD COLUMN IF NOT EXISTS "commissionUsdt" DECIMAL(18, 6) NOT NULL DEFAULT 0;
ALTER TABLE "AffiliateCommission" ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(10, 4) NOT NULL DEFAULT 0;
ALTER TABLE "AffiliateCommission" ADD COLUMN IF NOT EXISTS "settlementTxId" TEXT;

-- Add defaults to legacy fields that may not have them
ALTER TABLE "AffiliateCommission" ALTER COLUMN "spreadTotal" SET DEFAULT 0;
ALTER TABLE "AffiliateCommission" ALTER COLUMN "spreadBase" SET DEFAULT 0;
ALTER TABLE "AffiliateCommission" ALTER COLUMN "spreadAffiliate" SET DEFAULT 0;
