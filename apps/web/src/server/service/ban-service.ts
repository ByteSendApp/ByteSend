import { BlocklistType, Prisma } from "@prisma/client";
import { canonicalEmail } from "~/lib/canonical-email";
import { db } from "../db";
import { BlocklistService } from "./blocklist-service";

export type RelatedAccount = {
  id: number;
  email: string | null;
  name: string | null;
  isBanned: boolean;
  reason: "same_mailbox" | "same_name";
};

export type EvasionFlag = { level: "match" | "possible"; bannedUserId: number; reason: string };

// Mirrors canonicalEmail() so the database can match aliases without a stored column.
const CANONICAL_EMAIL_SQL = Prisma.sql`
  CASE
    WHEN split_part(lower(trim(u."email")), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(lower(trim(u."email")), '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE split_part(split_part(lower(trim(u."email")), '@', 1), '+', 1) || '@' || split_part(lower(trim(u."email")), '@', 2)
  END`;

/** Every address that reaches this user: primary, backup and connected-provider emails, canonicalised. */
async function userMailboxes(userId: number): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      backupEmails: { select: { email: true } },
      accounts: { select: { email: true } },
    },
  });
  if (!user) return [];
  const raw = [user.email, ...user.backupEmails.map((b) => b.email), ...user.accounts.map((a) => a.email)];
  return [...new Set(raw.filter((e): e is string => Boolean(e && e.includes("@"))).map(canonicalEmail))];
}

async function teamDomainsFor(userId: number) {
  return db.domain.findMany({
    where: { team: { teamUsers: { some: { userId } } } },
    select: { id: true, name: true, team: { select: { id: true, name: true, _count: { select: { teamUsers: true } } } } },
    orderBy: { name: "asc" },
  });
}

export const BanService = {
  /** Other accounts that look like the same person: same mailbox (strong) or same name (weak). */
  async relatedAccounts(userId: number): Promise<RelatedAccount[]> {
    const [mailboxes, user] = await Promise.all([
      userMailboxes(userId),
      db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

    const sameMailbox = mailboxes.length
      ? await db.$queryRaw<Array<{ id: number; email: string | null; name: string | null; isBanned: boolean }>>`
          SELECT u."id", u."email", u."name", u."isBanned"
          FROM "User" u
          WHERE u."id" <> ${userId} AND u."email" IS NOT NULL AND ${CANONICAL_EMAIL_SQL} IN (${Prisma.join(mailboxes)})
          ORDER BY u."id" DESC
          LIMIT 25`
      : [];

    const name = user?.name?.trim();
    const sameName =
      name && name.length >= 3
        ? await db.user.findMany({
            where: { id: { notIn: [userId, ...sameMailbox.map((u) => u.id)] }, name: { equals: name, mode: "insensitive" } },
            select: { id: true, email: true, name: true, isBanned: true },
            orderBy: { id: "desc" },
            take: 25,
          })
        : [];

    return [
      ...sameMailbox.map((u) => ({ ...u, reason: "same_mailbox" as const })),
      ...sameName.map((u) => ({ ...u, reason: "same_name" as const })),
    ];
  },

  /** What banning this user would block, for the ban dialog. */
  async preview(userId: number) {
    const [mailboxes, domains, related] = await Promise.all([
      userMailboxes(userId),
      teamDomainsFor(userId),
      this.relatedAccounts(userId),
    ]);
    return {
      mailboxes,
      domains: domains.map((d) => ({
        name: d.name,
        teamId: d.team.id,
        teamName: d.team.name,
        sharedTeam: d.team._count.teamUsers > 1,
      })),
      related: related.filter((r) => !r.isBanned),
    };
  },

  async ban(
    userId: number,
    options: { reason?: string; blockMailboxes: boolean; blockDomains: string[]; alsoBanUserIds: number[] },
    actorId: number,
  ) {
    const userIds = [userId, ...options.alsoBanUserIds.filter((id) => id !== userId)];
    await db.user.updateMany({ where: { id: { in: userIds } }, data: { isBanned: true } });

    const reason = options.reason?.trim() || "Banned user";
    const blocked: string[] = [];
    if (options.blockMailboxes) {
      for (const id of userIds) {
        for (const mailbox of await userMailboxes(id)) {
          await BlocklistService.add({ type: BlocklistType.EMAIL, value: mailbox, reason, createdById: actorId, sourceUserId: id });
          blocked.push(mailbox);
        }
      }
    }
    for (const domain of options.blockDomains) {
      await BlocklistService.add({ type: BlocklistType.SENDING_DOMAIN, value: domain, reason, createdById: actorId, sourceUserId: userId });
      blocked.push(domain);
    }
    return { bannedUserIds: userIds, blocked };
  },

  /** Lifts the ban and removes the blocklist entries that ban created. */
  async unban(userId: number) {
    await db.user.update({ where: { id: userId }, data: { isBanned: false } });
    const { count } = await db.blocklistEntry.deleteMany({ where: { sourceUserId: userId } });
    return { removedEntries: count };
  },

  /** Ban-evasion flags for a page of users (only for users who aren't banned themselves). */
  async evasionFlags(users: Array<{ id: number; email: string | null; name: string | null; isBanned: boolean }>) {
    const flags = new Map<number, EvasionFlag>();
    const active = users.filter((u) => !u.isBanned);
    if (active.length === 0) return flags;

    const byMailbox = new Map<string, number[]>();
    for (const user of active) {
      if (!user.email?.includes("@")) continue;
      const mailbox = canonicalEmail(user.email);
      byMailbox.set(mailbox, [...(byMailbox.get(mailbox) ?? []), user.id]);
    }
    const entries = byMailbox.size
      ? await db.blocklistEntry.findMany({
          where: { type: BlocklistType.EMAIL, value: { in: [...byMailbox.keys()] } },
          select: { value: true, sourceUserId: true },
        })
      : [];
    for (const entry of entries) {
      for (const id of byMailbox.get(entry.value) ?? []) {
        flags.set(id, {
          level: "match",
          bannedUserId: entry.sourceUserId ?? 0,
          reason: entry.sourceUserId
            ? `Same mailbox as banned user #${entry.sourceUserId}`
            : "Email is on the blocklist",
        });
      }
    }

    const names = [...new Set(active.map((u) => u.name?.trim()).filter((n): n is string => Boolean(n && n.length >= 3)))];
    if (names.length) {
      const bannedSameName = await db.user.findMany({
        where: { isBanned: true, OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
        select: { id: true, name: true },
      });
      for (const user of active) {
        if (flags.has(user.id) || !user.name) continue;
        const match = bannedSameName.find((b) => b.name?.trim().toLowerCase() === user.name!.trim().toLowerCase());
        if (match) {
          flags.set(user.id, { level: "possible", bannedUserId: match.id, reason: `Same name as banned user #${match.id}` });
        }
      }
    }
    return flags;
  },
};
