-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "sendingApprovedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "registeredAt" TIMESTAMP(3),
ADD COLUMN     "registrationCheckedAt" TIMESTAMP(3);
