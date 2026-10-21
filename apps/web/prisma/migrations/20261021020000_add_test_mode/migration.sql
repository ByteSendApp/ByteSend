-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Email_teamId_isTest_createdAt_idx" ON "Email"("teamId", "isTest", "createdAt");

