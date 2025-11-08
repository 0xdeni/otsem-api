/*
  Warnings:

  - You are about to drop the column `authUserId` on the `Customer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Customer" DROP CONSTRAINT "Customer_authUserId_fkey";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "authUserId",
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
