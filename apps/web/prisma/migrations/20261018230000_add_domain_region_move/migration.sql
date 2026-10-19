-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "pendingDkimSelector" TEXT,
ADD COLUMN     "pendingDkimStatus" TEXT,
ADD COLUMN     "pendingMailFromStatus" TEXT,
ADD COLUMN     "pendingPublicKey" TEXT,
ADD COLUMN     "pendingRegion" TEXT,
ADD COLUMN     "regionMoveStartedAt" TIMESTAMP(3),
ADD COLUMN     "retiredRegion" TEXT,
ADD COLUMN     "retiredRegionAt" TIMESTAMP(3);

