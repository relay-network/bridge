/*
  Warnings:

  - Added the required column `webhookAddress` to the `Bridge` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Bridge" DROP CONSTRAINT "Bridge_forwardHandlerId_fkey";

-- DropForeignKey
ALTER TABLE "Instance" DROP CONSTRAINT "Instance_bridgeId_fkey";

-- AlterTable
ALTER TABLE "Bridge" ADD COLUMN     "webhookAddress" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Bridge" ADD CONSTRAINT "Bridge_forwardHandlerId_fkey" FOREIGN KEY ("forwardHandlerId") REFERENCES "ForwardHandler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "Bridge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
