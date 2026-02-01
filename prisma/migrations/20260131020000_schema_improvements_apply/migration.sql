-- =====================================================
-- Migration: schema_improvements_apply
-- Aplica as alterações que não foram efetivadas porque
-- a migration 20260131000000 foi marcada como aplicada
-- mas falhou antes de completar.
-- Todos os comandos são idempotentes.
-- =====================================================

-- =====================================================
-- 1. Criar enums (se não existirem)
-- =====================================================

DO $$ BEGIN
  CREATE TYPE "KycUpgradeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 2. Adicionar colunas timestamp (se não existirem)
-- =====================================================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Address" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Ownership" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Ownership" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- 3. Conversão segura String -> Enum (preserva dados)
--    Verifica se a coluna ainda é text/varchar antes de converter
-- =====================================================

-- KycUpgradeRequest.status: String -> KycUpgradeRequestStatus
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kyc_upgrade_requests' AND column_name = 'status'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE "kyc_upgrade_requests" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "kyc_upgrade_requests"
      ALTER COLUMN "status" TYPE "KycUpgradeRequestStatus" USING "status"::"KycUpgradeRequestStatus";
    ALTER TABLE "kyc_upgrade_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
  END IF;
END $$;

-- Payout.pixKeyType: String -> PixKeyType
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Payout' AND column_name = 'pixKeyType'
      AND data_type IN ('text', 'character varying')
  ) THEN
    UPDATE "Payout" SET "pixKeyType" = 'PHONE' WHERE "pixKeyType" = 'TELEFONE';
    UPDATE "Payout" SET "pixKeyType" = 'RANDOM'
      WHERE "pixKeyType" NOT IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');
    ALTER TABLE "Payout"
      ALTER COLUMN "pixKeyType" TYPE "PixKeyType" USING "pixKeyType"::"PixKeyType";
  END IF;
END $$;

-- Account.pixKeyType: String -> PixKeyType (nullable)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'pixKeyType'
      AND data_type IN ('text', 'character varying')
  ) THEN
    UPDATE "accounts" SET "pixKeyType" = 'PHONE' WHERE "pixKeyType" = 'TELEFONE';
    UPDATE "accounts" SET "pixKeyType" = 'RANDOM'
      WHERE "pixKeyType" IS NOT NULL
        AND "pixKeyType" NOT IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');
    ALTER TABLE "accounts" ALTER COLUMN "pixKeyType" DROP DEFAULT;
    ALTER TABLE "accounts"
      ALTER COLUMN "pixKeyType" TYPE "PixKeyType" USING "pixKeyType"::"PixKeyType";
    ALTER TABLE "accounts" ALTER COLUMN "pixKeyType" SET DEFAULT 'RANDOM';
  END IF;
END $$;

-- AffiliateCommission.status: String -> CommissionStatus
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AffiliateCommission' AND column_name = 'status'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE "AffiliateCommission" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "AffiliateCommission"
      ALTER COLUMN "status" TYPE "CommissionStatus" USING "status"::"CommissionStatus";
    ALTER TABLE "AffiliateCommission" ALTER COLUMN "status" SET DEFAULT 'PENDING';
  END IF;
END $$;

-- Conversion.pixDestKeyType: String -> PixKeyType (nullable)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversions' AND column_name = 'pixDestKeyType'
      AND data_type IN ('text', 'character varying')
  ) THEN
    UPDATE "conversions" SET "pixDestKeyType" = 'PHONE' WHERE "pixDestKeyType" = 'TELEFONE';
    UPDATE "conversions" SET "pixDestKeyType" = NULL
      WHERE "pixDestKeyType" IS NOT NULL
        AND "pixDestKeyType" NOT IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');
    ALTER TABLE "conversions"
      ALTER COLUMN "pixDestKeyType" TYPE "PixKeyType" USING "pixDestKeyType"::"PixKeyType";
  END IF;
END $$;

-- =====================================================
-- 4. Índices compostos (IF NOT EXISTS)
--    Já cobertos na fix migration, mas garantir aqui
-- =====================================================

CREATE INDEX IF NOT EXISTS "Wallet_customerId_isMain_idx"
  ON "Wallet"("customerId", "isMain");

CREATE INDEX IF NOT EXISTS "transactions_accountId_type_status_idx"
  ON "transactions"("accountId", "type", "status");

CREATE INDEX IF NOT EXISTS "conversions_type_status_idx"
  ON "conversions"("type", "status");

-- =====================================================
-- 5. Foreign Keys (idempotente)
-- =====================================================

DO $$ BEGIN
  ALTER TABLE "AffiliateCommission"
    ADD CONSTRAINT "AffiliateCommission_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateCommission"
    ADD CONSTRAINT "AffiliateCommission_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "conversions"
    ADD CONSTRAINT "conversions_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
