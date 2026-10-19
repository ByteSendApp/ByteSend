import { Prisma } from "@prisma/client";
import { db } from "../db";
import { TeamService } from "./team-service";
import { AdminAuditService, type AdminActor } from "./admin-audit-service";
import {
  BOUNCE_RATE_HARD_LIMIT,
  BOUNCE_RATE_MIN_VOLUME,
  BOUNCE_RATE_WARN_LIMIT,
  COMPLAINT_RATE_HARD_LIMIT,
  COMPLAINT_RATE_WARN_LIMIT,
  DELIVERABILITY_WINDOW_DAYS,
} from "~/lib/constants/deliverability";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DeliverabilityStatus = "ok" | "warning" | "over_limit" | "low_volume";

export type TeamDeliverability = {
  teamId: number;
  name: string;
  plan: string;
  isBlocked: boolean;
  sent: number;
  delivered: number;
  hardBounced: number;
  complained: number;
  newSuppressions: number;
  bounceRate: number;
  complaintRate: number;
  status: DeliverabilityStatus;
  riskScore: number;
};

type TeamDeliverabilityRow = Omit<
  TeamDeliverability,
  "bounceRate" | "complaintRate" | "status" | "riskScore"
>;

export function classifyDeliverability(row: {
  delivered: number;
  hardBounced: number;
  complained: number;
}) {
  const bounceRate = row.delivered > 0 ? row.hardBounced / row.delivered : 0;
  const complaintRate = row.delivered > 0 ? row.complained / row.delivered : 0;
  // Rates are normalised against their own warn limit so a 0.1% complaint rate ranks like a 1.5% bounce rate.
  const riskScore = Math.max(bounceRate / BOUNCE_RATE_WARN_LIMIT, complaintRate / COMPLAINT_RATE_WARN_LIMIT);

  let status: DeliverabilityStatus = "ok";
  if (row.delivered < BOUNCE_RATE_MIN_VOLUME) {
    status = "low_volume";
  } else if (bounceRate >= BOUNCE_RATE_HARD_LIMIT || complaintRate >= COMPLAINT_RATE_HARD_LIMIT) {
    status = "over_limit";
  } else if (bounceRate >= BOUNCE_RATE_WARN_LIMIT || complaintRate >= COMPLAINT_RATE_WARN_LIMIT) {
    status = "warning";
  }

  return { bounceRate, complaintRate, riskScore, status };
}

export class AdminDeliverabilityService {
  static async getTeamStats({
    atRiskOnly = false,
    includeBlocked = true,
    query,
    limit,
  }: {
    atRiskOnly?: boolean;
    includeBlocked?: boolean;
    query?: string;
    limit: number;
  }): Promise<TeamDeliverability[]> {
    const since = new Date(Date.now() - DELIVERABILITY_WINDOW_DAYS * DAY_MS);
    const cutoffKey = since.toISOString().slice(0, 10);

    const rows = await db.$queryRaw<Array<TeamDeliverabilityRow>>`
      WITH usage AS (
        SELECT
          d."teamId",
          SUM(d.sent)::integer AS sent,
          SUM(d.delivered)::integer AS delivered,
          SUM(d."hardBounced")::integer AS "hardBounced",
          SUM(d.complained)::integer AS complained
        FROM "DailyEmailUsage" d
        WHERE d."date" >= ${cutoffKey}
        GROUP BY d."teamId"
      ),
      suppressions AS (
        SELECT s."teamId", COUNT(*)::integer AS count
        FROM "SuppressionList" s
        WHERE s."createdAt" >= ${since}
        GROUP BY s."teamId"
      )
      SELECT
        t.id AS "teamId",
        t.name AS name,
        t.plan::text AS plan,
        t."isBlocked" AS "isBlocked",
        COALESCE(u.sent, 0) AS sent,
        COALESCE(u.delivered, 0) AS delivered,
        COALESCE(u."hardBounced", 0) AS "hardBounced",
        COALESCE(u.complained, 0) AS complained,
        COALESCE(s.count, 0) AS "newSuppressions"
      FROM "Team" t
      LEFT JOIN usage u ON u."teamId" = t.id
      LEFT JOIN suppressions s ON s."teamId" = t.id
      WHERE (u."teamId" IS NOT NULL ${includeBlocked ? Prisma.sql`OR t."isBlocked" = true` : Prisma.empty})
      ${query ? Prisma.sql`AND (t.name ILIKE ${`%${query}%`} OR t.id::text = ${query})` : Prisma.empty}
      ${
        atRiskOnly
          ? Prisma.sql`AND (
              ${includeBlocked ? Prisma.sql`t."isBlocked" = true` : Prisma.sql`false`}
              OR (
                COALESCE(u.delivered, 0) >= ${BOUNCE_RATE_MIN_VOLUME}
                AND (
                  u."hardBounced"::float / u.delivered >= ${BOUNCE_RATE_WARN_LIMIT}
                  OR u.complained::float / u.delivered >= ${COMPLAINT_RATE_WARN_LIMIT}
                )
              )
            )`
          : Prisma.empty
      }
    `;

    return rows
      .map((row) => ({ ...row, ...classifyDeliverability(row) }))
      .sort((a, b) => {
        const aRanked = a.status === "low_volume" ? -1 : a.riskScore;
        const bRanked = b.status === "low_volume" ? -1 : b.riskScore;
        return bRanked - aRanked || b.sent - a.sent;
      })
      .slice(0, limit);
  }

  static async setTeamBlocked({
    actor,
    teamId,
    isBlocked,
    reason,
  }: {
    actor: AdminActor;
    teamId: number;
    isBlocked: boolean;
    reason: string;
  }) {
    const team = await db.team.update({
      where: { id: teamId },
      data: { isBlocked },
      select: { id: true, name: true, isBlocked: true },
    });
    await TeamService.invalidateTeamCache(teamId);
    await AdminAuditService.record({
      actor,
      action: isBlocked ? "team.block" : "team.unblock",
      targetType: "team",
      targetId: teamId,
      metadata: { teamName: team.name, reason },
    });
    return team;
  }
}
