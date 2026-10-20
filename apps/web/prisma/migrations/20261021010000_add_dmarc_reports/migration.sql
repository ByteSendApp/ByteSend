-- CreateTable
CREATE TABLE "DmarcReport" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "domainId" INTEGER,
    "domain" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "reporterEmail" TEXT,
    "reportId" TEXT NOT NULL,
    "beginAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "policy" JSONB NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "passCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmarcReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmarcRecord" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "sourceHost" TEXT,
    "count" INTEGER NOT NULL,
    "disposition" TEXT NOT NULL,
    "dkim" TEXT NOT NULL,
    "spf" TEXT NOT NULL,
    "headerFrom" TEXT NOT NULL,
    "envelopeFrom" TEXT,
    "dkimResults" JSONB NOT NULL,
    "spfResults" JSONB NOT NULL,
    "viaByteSend" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DmarcRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DmarcReport_teamId_endAt_idx" ON "DmarcReport"("teamId", "endAt" DESC);

-- CreateIndex
CREATE INDEX "DmarcReport_domainId_endAt_idx" ON "DmarcReport"("domainId", "endAt" DESC);

-- CreateIndex
CREATE INDEX "DmarcReport_endAt_idx" ON "DmarcReport"("endAt");

-- CreateIndex
CREATE UNIQUE INDEX "DmarcReport_teamId_orgName_reportId_key" ON "DmarcReport"("teamId", "orgName", "reportId");

-- CreateIndex
CREATE INDEX "DmarcRecord_reportId_idx" ON "DmarcRecord"("reportId");

-- AddForeignKey
ALTER TABLE "DmarcReport" ADD CONSTRAINT "DmarcReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmarcReport" ADD CONSTRAINT "DmarcReport_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmarcRecord" ADD CONSTRAINT "DmarcRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DmarcReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

