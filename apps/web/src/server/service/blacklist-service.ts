import dns from "dns";
import { BlacklistStatus, DomainStatus } from "@prisma/client";
import { db } from "../db";
import { env } from "~/env";
import { logger } from "../logger/log";

const LOOKUP_TIMEOUT_MS = 5_000;
const DOMAIN_CONCURRENCY = 5;
const HISTORY_RETENTION_DAYS = 30;

export type BlacklistDefinition = {
  id: string;
  name: string;
  zone: () => string;
  // Return-code handling differs per list; anything not classified as listed is treated as an error.
  classify: (address: string) => BlacklistStatus;
  removalUrl: string;
};

// Spamhaus DBL: 127.0.1.x is a listing; 127.255.255.x means the query itself was refused or malformed.
export function classifySpamhausDbl(address: string): BlacklistStatus {
  if (address.startsWith("127.255.255.")) return BlacklistStatus.ERROR;
  if (address.startsWith("127.0.1.")) return BlacklistStatus.LISTED;
  return BlacklistStatus.ERROR;
}

// SURBL and URIBL answer 127.0.0.1 when they refuse the resolver (e.g. public DNS); other 127.0.0.x values are bitmask listings.
export function classifyBitmaskList(address: string): BlacklistStatus {
  if (address === "127.0.0.1") return BlacklistStatus.ERROR;
  if (address.startsWith("127.0.0.")) return BlacklistStatus.LISTED;
  return BlacklistStatus.ERROR;
}

export const BLACKLISTS: BlacklistDefinition[] = [
  {
    id: "spamhaus-dbl",
    name: "Spamhaus DBL",
    zone: () => (env.SPAMHAUS_DQS_KEY ? `${env.SPAMHAUS_DQS_KEY}.dbl.dq.spamhaus.net` : "dbl.spamhaus.org"),
    classify: classifySpamhausDbl,
    removalUrl: "https://check.spamhaus.org/",
  },
  {
    id: "surbl",
    name: "SURBL",
    zone: () => "multi.surbl.org",
    classify: classifyBitmaskList,
    removalUrl: "https://surbl.org/surbl-analysis",
  },
  {
    id: "uribl",
    name: "URIBL",
    zone: () => "multi.uribl.com",
    classify: classifyBitmaskList,
    removalUrl: "https://admin.uribl.com/",
  },
];

export type BlacklistResult = {
  list: string;
  status: BlacklistStatus;
  returnCode: string | null;
};

function isNotFound(error: unknown) {
  const code = (error as { code?: string } | undefined)?.code;
  return code === "ENOTFOUND" || code === "ENODATA";
}

async function resolveWithTimeout(hostname: string, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      dns.promises.resolve4(hostname),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS lookup timed out")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupDomain(
  domainName: string,
  list: BlacklistDefinition,
  timeoutMs = LOOKUP_TIMEOUT_MS,
): Promise<BlacklistResult> {
  try {
    const addresses = await resolveWithTimeout(`${domainName}.${list.zone()}`, timeoutMs);
    const statuses = addresses.map((address) => list.classify(address));
    const status = statuses.includes(BlacklistStatus.LISTED)
      ? BlacklistStatus.LISTED
      : BlacklistStatus.ERROR;
    return { list: list.id, status, returnCode: addresses.join(",") };
  } catch (error) {
    if (isNotFound(error)) {
      return { list: list.id, status: BlacklistStatus.CLEAN, returnCode: null };
    }
    return {
      list: list.id,
      status: BlacklistStatus.ERROR,
      returnCode: error instanceof Error ? error.message.slice(0, 120) : "lookup failed",
    };
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]!;
      results.push(await fn(item));
    }
  });
  await Promise.all(workers);
  return results;
}

export class BlacklistService {
  static async checkDomain(domain: { id: number; name: string }) {
    const results = await Promise.all(BLACKLISTS.map((list) => lookupDomain(domain.name, list)));

    const previous = await db.domainBlacklistCheck.findMany({
      where: { domainId: domain.id },
      orderBy: { checkedAt: "desc" },
      distinct: ["list"],
      select: { list: true, status: true },
    });
    const previousByList = new Map(previous.map((row) => [row.list, row.status]));

    await db.domainBlacklistCheck.createMany({
      data: results.map((result) => ({ domainId: domain.id, ...result })),
    });

    const newlyListed = results.filter(
      (result) => result.status === BlacklistStatus.LISTED && previousByList.get(result.list) !== BlacklistStatus.LISTED,
    );

    return { results, newlyListed };
  }

  static async checkAllVerifiedDomains() {
    const domains = await db.domain.findMany({
      where: { status: DomainStatus.SUCCESS },
      select: { id: true, name: true, team: { select: { id: true, name: true } } },
    });

    const outcomes = await mapWithConcurrency(domains, DOMAIN_CONCURRENCY, async (domain) => {
      try {
        const { newlyListed } = await BlacklistService.checkDomain(domain);
        return { domain, newlyListed };
      } catch (error) {
        logger.error({ err: error, domainId: domain.id }, "[BlacklistService]: Domain check failed");
        return { domain, newlyListed: [] as BlacklistResult[] };
      }
    });

    await BlacklistService.pruneHistory();

    return {
      checked: domains.length,
      newlyListed: outcomes.filter((outcome) => outcome.newlyListed.length > 0),
    };
  }

  static async pruneHistory() {
    const cutoff = new Date(Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await db.domainBlacklistCheck.deleteMany({ where: { checkedAt: { lt: cutoff } } });
  }

  static async getOverview() {
    const latest = await db.$queryRaw<
      Array<{ domainId: number; list: string; status: BlacklistStatus; returnCode: string | null; checkedAt: Date }>
    >`
      SELECT DISTINCT ON (c."domainId", c.list)
        c."domainId" AS "domainId", c.list, c.status, c."returnCode" AS "returnCode", c."checkedAt" AS "checkedAt"
      FROM "DomainBlacklistCheck" c
      ORDER BY c."domainId", c.list, c."checkedAt" DESC
    `;

    const [domains, verifiedCount] = await Promise.all([
      db.domain.findMany({
        where: { id: { in: [...new Set(latest.map((row) => row.domainId))] } },
        select: { id: true, name: true, status: true, team: { select: { id: true, name: true, isBlocked: true } } },
      }),
      db.domain.count({ where: { status: DomainStatus.SUCCESS } }),
    ]);

    const checksByDomain = new Map<number, typeof latest>();
    for (const row of latest) {
      checksByDomain.set(row.domainId, [...(checksByDomain.get(row.domainId) ?? []), row]);
    }

    const listedCount = (checks: typeof latest) =>
      checks.filter((check) => check.status === BlacklistStatus.LISTED).length;

    const entries = domains
      .map((domain) => {
        const checks = checksByDomain.get(domain.id) ?? [];
        return {
          domain,
          checks,
          lastCheckedAt: new Date(Math.max(...checks.map((check) => check.checkedAt.getTime()))),
        };
      })
      .sort((a, b) => listedCount(b.checks) - listedCount(a.checks) || a.domain.name.localeCompare(b.domain.name));

    return {
      lists: BLACKLISTS.map(({ id, name, removalUrl }) => ({ id, name, removalUrl })),
      usesDqsKey: Boolean(env.SPAMHAUS_DQS_KEY),
      verifiedCount,
      domains: entries,
    };
  }
}
