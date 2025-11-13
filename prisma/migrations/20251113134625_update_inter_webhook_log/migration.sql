-- AlterTable
ALTER TABLE "inter_webhook_logs" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'PENDENTE',
ALTER COLUMN "processedAt" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "inter_webhook_logs_type_createdAt_idx" ON "inter_webhook_logs"("type", "createdAt");
