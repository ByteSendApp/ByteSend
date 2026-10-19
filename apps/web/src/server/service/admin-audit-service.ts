import { Prisma } from "@prisma/client";
import { db } from "../db";
import { logger } from "../logger/log";
import type { AdminAuditAction, AdminAuditTargetType } from "~/lib/constants/admin-audit";

export type AdminActor = { id: number; email?: string | null };

export type RecordAdminActionParams = {
  actor: AdminActor | null;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string | number;
  metadata?: Prisma.InputJsonObject;
};

export type ListAdminAuditLogParams = {
  cursor?: string;
  limit: number;
  action?: string;
  targetType?: AdminAuditTargetType;
  targetId?: string;
  actorId?: number;
  query?: string;
  from?: Date;
  to?: Date;
};

export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after) as Array<keyof T & string>) {
    if (after[key] !== undefined && before[key] !== after[key]) {
      changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
    }
  }
  return changes;
}

export class AdminAuditService {
  // Audit writes must never fail the admin action they describe, so errors are logged and swallowed.
  static async record({ actor, action, targetType, targetId, metadata }: RecordAdminActionParams) {
    try {
      await db.adminAuditLog.create({
        data: {
          actorId: actor?.id ?? null,
          actorEmail: actor ? (actor.email ?? null) : "system",
          action,
          targetType,
          targetId: String(targetId),
          metadata: metadata ?? Prisma.JsonNull,
        },
        select: { id: true },
      });
    } catch (error) {
      logger.error(
        { err: error, actorId: actor?.id, action, targetType, targetId },
        "[AdminAuditService]: Failed to record admin action",
      );
    }
  }

  static async list({
    cursor,
    limit,
    action,
    targetType,
    targetId,
    actorId,
    query,
    from,
    to,
  }: ListAdminAuditLogParams) {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
      ...(actorId ? { actorId } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(query
        ? {
            OR: [
              { actorEmail: { contains: query, mode: "insensitive" } },
              { targetId: { equals: query } },
            ],
          }
        : {}),
    };

    const rows = await db.adminAuditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actorId: true,
        actorEmail: true,
        actor: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    const hasMore = rows.length > limit;
    const entries = hasMore ? rows.slice(0, limit) : rows;
    return { entries, nextCursor: hasMore ? entries[entries.length - 1]?.id : undefined };
  }
}
