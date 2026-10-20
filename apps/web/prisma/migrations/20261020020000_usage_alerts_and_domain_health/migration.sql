-- AlterEnum
ALTER TYPE "NotificationEventType" ADD VALUE 'USAGE_ALERT';
ALTER TYPE "NotificationEventType" ADD VALUE 'DOMAIN_HEALTH';

-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "dnsIssues" JSONB,
ADD COLUMN     "dnsIssuesSince" TIMESTAMP(3),
ADD COLUMN     "dnsIssuesNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "dnsCheckedAt" TIMESTAMP(3);
