import { type EmailStatus, Prisma } from "@prisma/client";
import { db } from "../db";
import { AdminAuditService, type AdminActor } from "./admin-audit-service";

export const ADMIN_EMAIL_MAX_WINDOW_DAYS = 31;

export type ListAdminEmailsParams = {
  cursor?: string;
  limit: number;
  from: Date;
  to: Date;
  teamId?: number;
  domainId?: number;
  statuses?: EmailStatus[];
  recipient?: string;
  sender?: string;
  subject?: string;
};

export class AdminEmailService {
  // Every filter is applied inside a bounded createdAt window so queries stay on the createdAt index.
  static async list({
    cursor,
    limit,
    from,
    to,
    teamId,
    domainId,
    statuses,
    recipient,
    sender,
    subject,
  }: ListAdminEmailsParams) {
    const where: Prisma.EmailWhereInput = {
      createdAt: { gte: from, lte: to },
      ...(teamId ? { teamId } : {}),
      ...(domainId ? { domainId } : {}),
      ...(statuses?.length ? { latestStatus: { in: statuses } } : {}),
      ...(recipient ? { to: { hasSome: [...new Set([recipient, recipient.toLowerCase()])] } } : {}),
      ...(sender ? { from: { contains: sender, mode: "insensitive" } } : {}),
      ...(subject ? { subject: { contains: subject, mode: "insensitive" } } : {}),
    };

    const rows = await db.email.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        from: true,
        to: true,
        subject: true,
        latestStatus: true,
        createdAt: true,
        campaignId: true,
        team: { select: { id: true, name: true } },
      },
    });

    const hasMore = rows.length > limit;
    const emails = hasMore ? rows.slice(0, limit) : rows;
    return { emails, nextCursor: hasMore ? emails[emails.length - 1]?.id : undefined };
  }

  static async get(id: string) {
    return db.email.findUnique({
      where: { id },
      select: {
        id: true,
        sesEmailId: true,
        from: true,
        to: true,
        cc: true,
        bcc: true,
        replyTo: true,
        subject: true,
        latestStatus: true,
        createdAt: true,
        updatedAt: true,
        scheduledAt: true,
        campaignId: true,
        domainId: true,
        apiId: true,
        team: { select: { id: true, name: true, plan: true, isBlocked: true } },
        emailEvents: {
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, data: true, createdAt: true },
        },
      },
    });
  }

  static async viewContent(id: string, actor: AdminActor) {
    const email = await db.email.findUnique({
      where: { id },
      select: { id: true, html: true, text: true, subject: true, teamId: true },
    });
    if (!email) return null;

    await AdminAuditService.record({
      actor,
      action: "email.view_content",
      targetType: "email",
      targetId: email.id,
      metadata: { teamId: email.teamId, subject: email.subject },
    });

    return { html: email.html, text: email.text };
  }
}
