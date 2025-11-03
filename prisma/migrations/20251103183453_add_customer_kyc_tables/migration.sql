/*
  Warnings:

  - You are about to drop the column `externalAccountHolderId` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `taxNumber` on the `Customer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[externalClientId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalAccredId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `identifier` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `Customer` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('not_requested', 'received', 'processing', 'approved', 'rejected');

-- DropIndex
DROP INDEX "public"."Customer_externalAccountHolderId_key";

-- DropIndex
DROP INDEX "public"."Customer_taxNumber_key";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "externalAccountHolderId",
DROP COLUMN "taxNumber",
ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'not_requested',
ADD COLUMN     "authUserId" TEXT,
ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "externalAccredId" TEXT,
ADD COLUMN     "externalClientId" TEXT,
ADD COLUMN     "genderId" INTEGER,
ADD COLUMN     "identifier" TEXT NOT NULL,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "productId" INTEGER NOT NULL,
ADD COLUMN     "socialName" TEXT,
ADD COLUMN     "tradeName" TEXT,
ADD COLUMN     "type" "CustomerType" NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "cityIbgeCode" INTEGER NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixLimits" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "singleTransfer" DECIMAL(65,30) NOT NULL,
    "daytime" DECIMAL(65,30) NOT NULL,
    "nighttime" DECIMAL(65,30) NOT NULL,
    "monthly" DECIMAL(65,30) NOT NULL,
    "serviceId" INTEGER NOT NULL,

    CONSTRAINT "PixLimits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ownership" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "birthday" TIMESTAMP(3) NOT NULL,
    "isAdministrator" BOOLEAN NOT NULL,

    CONSTRAINT "Ownership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Address_customerId_key" ON "Address"("customerId");

-- CreateIndex
CREATE INDEX "Address_cityIbgeCode_idx" ON "Address"("cityIbgeCode");

-- CreateIndex
CREATE UNIQUE INDEX "PixLimits_customerId_key" ON "PixLimits"("customerId");

-- CreateIndex
CREATE INDEX "Ownership_customerId_idx" ON "Ownership"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalClientId_key" ON "Customer"("externalClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalAccredId_key" ON "Customer"("externalAccredId");

-- CreateIndex
CREATE INDEX "Customer_type_accountStatus_idx" ON "Customer"("type", "accountStatus");

-- CreateIndex
CREATE INDEX "Customer_cpf_idx" ON "Customer"("cpf");

-- CreateIndex
CREATE INDEX "Customer_cnpj_idx" ON "Customer"("cnpj");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixLimits" ADD CONSTRAINT "PixLimits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
