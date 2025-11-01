-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "note" TEXT,
ADD COLUMN     "validationErrors" JSONB;
