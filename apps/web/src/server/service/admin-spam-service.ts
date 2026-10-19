import { Prisma, SpamReviewDecision, SpamVerdict } from "@prisma/client";
import { db } from "../db";
import { ByteSendApiError } from "../public-api/api-error";
import { AdminAuditService, type AdminActor } from "./admin-audit-service";
import { EmailQueueService } from "./email-queue-service";
import { sendCampaign } from "./campaign-service";
import type { SpamHit } from "./spam-scan-service";

export type SpamQueueFilter = "held" | "flagged" | "reviewed";

function whereFor(filter: SpamQueueFilter): Prisma.SpamScanWhereInput {
  switch (filter) {
    case "held":
      return { verdict: SpamVerdict.HOLD, reviewedAt: null };
    case "flagged":
      return { verdict: SpamVerdict.FLAG };
    case "reviewed":
      return { reviewedAt: { not: null } };
  }
}

export class AdminSpamService {
  static async list({ filter, cursor, limit }: { filter: SpamQueueFilter; cursor?: string; limit: number }) {
    const rows = await db.spamScan.findMany({
      where: whereFor(filter),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        score: true,
        verdict: true,
        hits: true,
        createdAt: true,
        reviewedAt: true,
        reviewDecision: true,
        emailId: true,
        campaignId: true,
        team: { select: { id: true, name: true, plan: true, isBlocked: true } },
      },
    });

    const hasMore = rows.length > limit;
    const scans = hasMore ? rows.slice(0, limit) : rows;

    const emailIds = scans.flatMap((scan) => (scan.emailId ? [scan.emailId] : []));
    const campaignIds = scans.flatMap((scan) => (scan.campaignId ? [scan.campaignId] : []));
    const [emails, campaigns] = await Promise.all([
      emailIds.length
        ? db.email.findMany({
            where: { id: { in: emailIds } },
            select: { id: true, subject: true, from: true, to: true, latestStatus: true },
          })
        : [],
      campaignIds.length
        ? db.campaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, name: true, subject: true, from: true, status: true, total: true },
          })
        : [],
    ]);
    const emailById = new Map(emails.map((email) => [email.id, email]));
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

    return {
      scans: scans.map((scan) => ({
        ...scan,
        hits: scan.hits as unknown as SpamHit[],
        email: scan.emailId ? (emailById.get(scan.emailId) ?? null) : null,
        campaign: scan.campaignId ? (campaignById.get(scan.campaignId) ?? null) : null,
      })),
      nextCursor: hasMore ? scans[scans.length - 1]?.id : undefined,
    };
  }

  static async countHeld() {
    return db.spamScan.count({ where: whereFor("held") });
  }

  private static async getPendingHold(scanId: string) {
    const scan = await db.spamScan.findUnique({ where: { id: scanId } });
    if (!scan) throw new ByteSendApiError({ code: "NOT_FOUND", message: "Scan not found" });
    if (scan.verdict !== SpamVerdict.HOLD || scan.reviewedAt) {
      throw new ByteSendApiError({ code: "BAD_REQUEST", message: "This message is not waiting for review" });
    }
    return scan;
  }

  private static async markReviewed(scanId: string, actor: AdminActor, decision: SpamReviewDecision) {
    await db.spamScan.update({
      where: { id: scanId },
      data: { reviewedAt: new Date(), reviewedById: actor.id, reviewDecision: decision },
    });
  }

  static async release(scanId: string, actor: AdminActor) {
    const scan = await AdminSpamService.getPendingHold(scanId);

    if (scan.emailId) {
      const email = await db.email.findUnique({
        where: { id: scan.emailId },
        select: { id: true, latestStatus: true, scheduledAt: true, teamId: true, domainId: true },
      });
      if (!email || email.latestStatus !== "HELD") {
        throw new ByteSendApiError({ code: "BAD_REQUEST", message: "The held email no longer exists" });
      }
      const domain = email.domainId
        ? await db.domain.findUnique({ where: { id: email.domainId }, select: { region: true } })
        : null;
      if (!domain) {
        throw new ByteSendApiError({ code: "BAD_REQUEST", message: "The email's sending domain no longer exists" });
      }

      const delay = email.scheduledAt ? Math.max(0, email.scheduledAt.getTime() - Date.now()) : undefined;
      await db.email.update({
        where: { id: email.id },
        data: { latestStatus: email.scheduledAt && delay ? "SCHEDULED" : "QUEUED" },
      });
      await EmailQueueService.queueEmail(email.id, email.teamId, domain.region, true, undefined, delay);
    } else if (scan.campaignId) {
      await sendCampaign(scan.campaignId, { skipSpamScan: true });
    }

    await AdminSpamService.markReviewed(scanId, actor, SpamReviewDecision.RELEASED);
    await AdminAuditService.record({
      actor,
      action: "spam.release",
      targetType: scan.emailId ? "email" : "team",
      targetId: scan.emailId ?? scan.teamId,
      metadata: { scanId, teamId: scan.teamId, score: scan.score, campaignId: scan.campaignId },
    });
  }

  static async reject(scanId: string, actor: AdminActor, reason: string) {
    const scan = await AdminSpamService.getPendingHold(scanId);

    if (scan.emailId) {
      await db.email.updateMany({
        where: { id: scan.emailId, latestStatus: "HELD" },
        data: { latestStatus: "REJECTED" },
      });
      await db.emailEvent.create({
        data: {
          emailId: scan.emailId,
          status: "REJECTED",
          data: { error: "Rejected after spam review", reason },
          teamId: scan.teamId,
        },
      });
    }

    await AdminSpamService.markReviewed(scanId, actor, SpamReviewDecision.REJECTED);
    await AdminAuditService.record({
      actor,
      action: "spam.reject",
      targetType: scan.emailId ? "email" : "team",
      targetId: scan.emailId ?? scan.teamId,
      metadata: { scanId, teamId: scan.teamId, score: scan.score, campaignId: scan.campaignId, reason },
    });
  }
}
