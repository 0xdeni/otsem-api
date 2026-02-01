-- Change KycUpgradeRequest.customerId from RESTRICT to CASCADE
ALTER TABLE "kyc_upgrade_requests" DROP CONSTRAINT IF EXISTS "kyc_upgrade_requests_customerId_fkey";
ALTER TABLE "kyc_upgrade_requests"
  ADD CONSTRAINT "kyc_upgrade_requests_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Change AffiliateCommission.customerId from RESTRICT to CASCADE
ALTER TABLE "AffiliateCommission" DROP CONSTRAINT IF EXISTS "AffiliateCommission_customerId_fkey";
ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT "AffiliateCommission_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Change Conversion.customerId from RESTRICT to CASCADE
ALTER TABLE "conversions" DROP CONSTRAINT IF EXISTS "conversions_customerId_fkey";
ALTER TABLE "conversions"
  ADD CONSTRAINT "conversions_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Change Conversion.accountId from RESTRICT to CASCADE
ALTER TABLE "conversions" DROP CONSTRAINT IF EXISTS "conversions_accountId_fkey";
ALTER TABLE "conversions"
  ADD CONSTRAINT "conversions_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
