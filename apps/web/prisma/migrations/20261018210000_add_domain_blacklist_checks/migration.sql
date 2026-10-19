-- CreateEnum
CREATE TYPE "BlacklistStatus" AS ENUM ('LISTED', 'CLEAN', 'ERROR');

-- CreateTable
CREATE TABLE "DomainBlacklistCheck" (
    "id" TEXT NOT NULL,
    "domainId" INTEGER NOT NULL,
    "list" TEXT NOT NULL,
    "status" "BlacklistStatus" NOT NULL,
    "returnCode" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainBlacklistCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainBlacklistCheck_domainId_checkedAt_idx" ON "DomainBlacklistCheck"("domainId", "checkedAt" DESC);

-- CreateIndex
CREATE INDEX "DomainBlacklistCheck_status_checkedAt_idx" ON "DomainBlacklistCheck"("status", "checkedAt" DESC);

-- AddForeignKey
ALTER TABLE "DomainBlacklistCheck" ADD CONSTRAINT "DomainBlacklistCheck_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

