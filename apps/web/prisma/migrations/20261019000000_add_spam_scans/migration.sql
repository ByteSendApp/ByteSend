-- CreateEnum
CREATE TYPE "SpamVerdict" AS ENUM ('FLAG', 'HOLD');

-- CreateEnum
CREATE TYPE "SpamReviewDecision" AS ENUM ('RELEASED', 'REJECTED');

-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE 'HELD';

-- CreateTable
CREATE TABLE "SpamScan" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "emailId" TEXT,
    "campaignId" TEXT,
    "score" INTEGER NOT NULL,
    "verdict" "SpamVerdict" NOT NULL,
    "hits" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewDecision" "SpamReviewDecision",

    CONSTRAINT "SpamScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpamScan_verdict_reviewedAt_createdAt_idx" ON "SpamScan"("verdict", "reviewedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SpamScan_teamId_createdAt_idx" ON "SpamScan"("teamId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SpamScan_emailId_idx" ON "SpamScan"("emailId");

-- CreateIndex
CREATE INDEX "SpamScan_campaignId_idx" ON "SpamScan"("campaignId");

-- AddForeignKey
ALTER TABLE "SpamScan" ADD CONSTRAINT "SpamScan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

