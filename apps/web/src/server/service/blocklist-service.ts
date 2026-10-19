import { BlocklistType, type BlocklistEntry, type Prisma } from "@prisma/client";
import { canonicalEmail, domainAndParents, emailDomain } from "~/lib/canonical-email";
import { db } from "../db";

/** Normalises a value the way it's stored, so lookups and the unique index agree. */
export function normalizeBlocklistValue(type: BlocklistType, raw: string): string {
  if (type === BlocklistType.EMAIL) return canonicalEmail(raw);
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export const BlocklistService = {
  /** The entry that stops `email` from creating an account, if any. */
  async findBlockedSignup(email: string): Promise<BlocklistEntry | null> {
    const domain = emailDomain(email);
    return db.blocklistEntry.findFirst({
      where: {
        OR: [
          { type: BlocklistType.EMAIL, value: canonicalEmail(email) },
          ...(domain ? [{ type: BlocklistType.EMAIL_DOMAIN, value: { in: domainAndParents(domain) } }] : []),
        ],
      },
    });
  },

  /** The entry that stops `name` (or a parent domain of it) from being added as a sending domain. */
  async findBlockedSendingDomain(name: string): Promise<BlocklistEntry | null> {
    return db.blocklistEntry.findFirst({
      where: { type: BlocklistType.SENDING_DOMAIN, value: { in: domainAndParents(name) } },
    });
  },

  async list({ type, query, page, pageSize }: { type?: BlocklistType; query?: string; page: number; pageSize: number }) {
    const where: Prisma.BlocklistEntryWhereInput = {
      ...(type ? { type } : {}),
      ...(query ? { value: { contains: query.trim().toLowerCase() } } : {}),
    };
    const [entries, total] = await Promise.all([
      db.blocklistEntry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      db.blocklistEntry.count({ where }),
    ]);
    return { entries, total, page, pageSize };
  },

  async add(input: {
    type: BlocklistType;
    value: string;
    reason?: string | null;
    createdById?: number | null;
    sourceUserId?: number | null;
  }) {
    const value = normalizeBlocklistValue(input.type, input.value);
    return db.blocklistEntry.upsert({
      where: { type_value: { type: input.type, value } },
      create: {
        type: input.type,
        value,
        reason: input.reason ?? null,
        createdById: input.createdById ?? null,
        sourceUserId: input.sourceUserId ?? null,
      },
      update: {},
    });
  },

  async remove(id: string) {
    return db.blocklistEntry.delete({ where: { id } });
  },
};
