import { isCloud, isEmailCleanupEnabled } from "~/utils/common";

let initialized = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !initialized) {
    console.log("Registering instrumentation");

    const { EmailQueueService } = await import(
      "~/server/service/email-queue-service"
    );
    await EmailQueueService.init();

    if (isCloud()) {
      await import("~/server/jobs/usage-job");
    }

    if (process.env.REDIS_URL) {
      const { initDomainVerificationJob } = await import(
        "~/server/jobs/domain-verification-job"
      );
      await initDomainVerificationJob();

      await import("~/server/jobs/webhook-cleanup-job");

      const { initDomainHealthJob } = await import("~/server/jobs/domain-health-job");
      await initDomainHealthJob();

      const { isInboundEnabled } = await import("~/server/service/inbound-storage");
      if (isInboundEnabled()) {
        const { initInboundJobs } = await import("~/server/jobs/inbound-job");
        await initInboundJobs();
      }

      if (isCloud()) {
        const { initBlacklistCheckJob } = await import("~/server/jobs/blacklist-check-job");
        await initBlacklistCheckJob();
      }
    }

    if (isEmailCleanupEnabled()) {
      await import("~/server/jobs/cleanup-email-bodies");
    }

    const { CampaignSchedulerService } = await import(
      "~/server/jobs/campaign-scheduler-job"
    );
    await CampaignSchedulerService.start();

    initialized = true;
  }
}
