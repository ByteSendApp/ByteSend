-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('PROCESSED', 'FORWARDED', 'FAILED');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "inboundSlug" TEXT;

-- AlterTable
ALTER TABLE "Domain" ADD COLUMN "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inboundSubdomain" TEXT,
ADD COLUMN "inboundStatus" TEXT,
ADD COLUMN "inboundCheckedAt" TIMESTAMP(3),
ADD COLUMN "inboundDkimSelector" TEXT,
ADD COLUMN "inboundPublicKey" TEXT;

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "domainId" INTEGER,
    "sesMessageId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "fromName" TEXT,
    "to" TEXT[],
    "cc" TEXT[],
    "replyTo" TEXT[],
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "headers" JSONB NOT NULL,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT[],
    "inReplyToEmailId" TEXT,
    "attachments" JSONB NOT NULL,
    "size" INTEGER NOT NULL,
    "rawKey" TEXT,
    "spamVerdict" TEXT,
    "virusVerdict" TEXT,
    "spfVerdict" TEXT,
    "dkimVerdict" TEXT,
    "dmarcVerdict" TEXT,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'PROCESSED',
    "forwardedTo" TEXT[],
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundForwardRule" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "match" TEXT NOT NULL,
    "forwardTo" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundForwardRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_inboundSlug_key" ON "Team"("inboundSlug");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_sesMessageId_key" ON "InboundEmail"("sesMessageId");

-- CreateIndex
CREATE INDEX "InboundEmail_teamId_receivedAt_idx" ON "InboundEmail"("teamId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "InboundEmail_expiresAt_idx" ON "InboundEmail"("expiresAt");

-- CreateIndex
CREATE INDEX "InboundForwardRule_teamId_idx" ON "InboundForwardRule"("teamId");

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundForwardRule" ADD CONSTRAINT "InboundForwardRule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
