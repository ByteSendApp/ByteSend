import dns from "dns";
import { BlocklistService } from "./blocklist-service";
import { isPrivateSuffixHostname, isSharedHostname } from "~/lib/constants/shared-domains";
import { isCloud } from "~/utils/common";
import { sendToDiscord } from "./notification-service";
import util from "util";
import * as tldts from "tldts";
import * as ses from "~/server/aws/ses";
import { db } from "~/server/db";
import { env } from "~/env";
import { renderDomainVerificationStatusEmail } from "~/server/email-templates";
import { logger } from "~/server/logger/log";
import { sendMail } from "~/server/mailer";
import { getRedis, redisKey } from "~/server/redis";
import { SesSettingsService } from "./ses-settings-service";
import { ByteSendApiError } from "../public-api/api-error";
import { ApiKey, DomainStatus, type Domain } from "@prisma/client";
import {
  type DomainPayload,
  type DomainWebhookEventType,
} from "@bytesend/lib/src/webhook/webhook-events";
import { LimitService } from "./limit-service";
import type { DomainDnsRecord } from "~/types/domain";
import { WebhookService } from "./webhook-service";

const DOMAIN_STATUS_VALUES = new Set(Object.values(DomainStatus));
export const DOMAIN_UNVERIFIED_RECHECK_MS = 6 * 60 * 60 * 1000;
export const DOMAIN_VERIFIED_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFIED_DOMAIN_STATUSES = new Set<DomainStatus>([DomainStatus.SUCCESS]);

type DomainVerificationState = {
  hasEverVerified: boolean;
  lastCheckedAt: Date | null;
  lastNotifiedStatus: DomainStatus | null;
};

type DomainWithDnsRecords = Domain & { dnsRecords: DomainDnsRecord[] };

export type DnsPrecheckResult = {
  dkim: DnsCheckResult;
  spf: DnsCheckResult;
  mx: DnsCheckResult;
};

type DomainVerificationRefreshResult = DomainWithDnsRecords & {
  verificationError: string | null;
  lastCheckedTime: string | null;
  previousStatus: DomainStatus;
  statusChanged: boolean;
  hasEverVerified: boolean;
  dnsPrecheck: DnsPrecheckResult;
  dkimReregistered: boolean;
};

export function parseDomainStatus(status?: string | null): DomainStatus {
  if (!status) {
    return DomainStatus.NOT_STARTED;
  }

  const normalized = status.toUpperCase();

  if (DOMAIN_STATUS_VALUES.has(normalized as DomainStatus)) {
    return normalized as DomainStatus;
  }

  return DomainStatus.NOT_STARTED;
}

function buildDnsRecords(domain: Domain): DomainDnsRecord[] {
  const subdomainSuffix = domain.subdomain ? `.${domain.subdomain}` : "";
  const mailDomain = `mail${subdomainSuffix}`;
  const dkimSelector = domain.dkimSelector ?? "bytesend";

  const spfStatus = parseDomainStatus(domain.spfDetails);
  const dkimStatus = parseDomainStatus(domain.dkimStatus);
  const dmarcStatus = domain.dmarcAdded
    ? DomainStatus.SUCCESS
    : DomainStatus.NOT_STARTED;

  return [
    {
      type: "MX",
      name: mailDomain,
      value: `feedback-smtp.${domain.region}.amazonses.com`,
      ttl: "Auto",
      priority: "10",
      status: spfStatus,
    },
    {
      type: "TXT",
      name: `${dkimSelector}._domainkey${subdomainSuffix}`,
      value: `p=${domain.publicKey}`,
      ttl: "Auto",
      status: dkimStatus,
    },
    {
      type: "TXT",
      name: mailDomain,
      value: "v=spf1 include:amazonses.com ~all",
      ttl: "Auto",
      status: spfStatus,
    },
    {
      type: "TXT",
      name: "_dmarc",
      value: "v=DMARC1; p=none;",
      ttl: "Auto",
      status: dmarcStatus,
      recommended: true,
    },
  ];
}

function withDnsRecords<T extends Domain>(
  domain: T,
): T & { dnsRecords: DomainDnsRecord[] } {
  return {
    ...domain,
    dnsRecords: buildDnsRecords(domain),
  };
}

const dnsResolveTxt = dns.promises?.resolveTxt
  ? dns.promises.resolveTxt.bind(dns.promises)
  : typeof dns.resolveTxt === "function"
    ? util.promisify(dns.resolveTxt.bind(dns))
    : (async () => {
      throw new Error("DNS TXT resolver unavailable");
    }) as (hostname: string) => Promise<string[][]>;

const dnsResolveMx = dns.promises?.resolveMx
  ? dns.promises.resolveMx.bind(dns.promises)
  : typeof dns.resolveMx === "function"
    ? util.promisify(dns.resolveMx.bind(dns))
    : (async () => {
      throw new Error("DNS MX resolver unavailable");
    }) as (hostname: string) => Promise<Array<{ exchange: string }>>;

const DKIM_STUCK_THRESHOLD_MS = 60 * 60 * 1000;

export type DnsCheckResult = "found" | "wrong_key" | "not_found";

export async function checkDkimDnsRecord(
  selector: string,
  domainName: string,
  expectedPublicKey: string,
): Promise<DnsCheckResult> {
  try {
    const records = await dnsResolveTxt(`${selector}._domainkey.${domainName}`);
    const flat = records.flat().join("");
    if (flat.includes(`p=${expectedPublicKey}`)) return "found";
    if (flat.match(/p=[A-Za-z0-9+/=]+/)) return "wrong_key";
    return "not_found";
  } catch {
    return "not_found";
  }
}

async function checkSpfDnsRecord(mailDomain: string): Promise<DnsCheckResult> {
  try {
    const records = await dnsResolveTxt(mailDomain);
    const spfRecords = records
      .map((parts) => parts.join(""))
      .map((record) => record.trim().toLowerCase())
      .filter((record) => record.startsWith("v=spf1"));

    const hasAmazonSesInclude = spfRecords.some((record) => {
      const mechanisms = record.split(/\s+/).filter(Boolean);

      return mechanisms.some((mechanism) => {
        const normalized = mechanism.replace(/^[+\-~?]/, "");
        if (!normalized.startsWith("include:")) {
          return false;
        }

        const includeDomain = normalized.slice("include:".length);
        return (
          includeDomain === "amazonses.com" ||
          includeDomain.endsWith(".amazonses.com")
        );
      });
    });

    return hasAmazonSesInclude ? "found" : "not_found";
  } catch {
    return "not_found";
  }
}

export async function checkMxDnsRecord(
  mailDomain: string,
  region: string,
): Promise<DnsCheckResult> {
  try {
    const records = await dnsResolveMx(mailDomain);
    const expected = `feedback-smtp.${region}.amazonses.com`;
    return records.some((r) => r.exchange.toLowerCase() === expected)
      ? "found"
      : "not_found";
  } catch {
    return "not_found";
  }
}

function getDomainVerificationKey(kind: string, domainId: number) {
  return redisKey(`domain:verification:${kind}:${domainId}`);
}

function normalizeDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getDomainVerificationState(
  domainId: number,
): Promise<DomainVerificationState> {
  const redis = getRedis();
  const [lastCheckedValue, lastNotifiedStatusValue, hasEverVerifiedValue] =
    await redis.mget([
      getDomainVerificationKey("last-check", domainId),
      getDomainVerificationKey("last-notified-status", domainId),
      getDomainVerificationKey("has-ever-verified", domainId),
    ]);

  return {
    hasEverVerified: hasEverVerifiedValue === "1",
    lastCheckedAt: normalizeDate(lastCheckedValue),
    lastNotifiedStatus: DOMAIN_STATUS_VALUES.has(
      (lastNotifiedStatusValue ?? "") as DomainStatus,
    )
      ? (lastNotifiedStatusValue as DomainStatus)
      : null,
  };
}

async function setDomainVerificationCheckedAt(
  domainId: number,
  checkedAt: Date,
) {
  await getRedis().set(
    getDomainVerificationKey("last-check", domainId),
    checkedAt.toISOString(),
  );
}

async function setDkimReregisteredFlag(domainId: number) {
  await getRedis().set(
    getDomainVerificationKey("dkim-reregistered", domainId),
    "1",
    "EX",
    86400,
  );
}

export async function clearDkimReregisteredFlag(domainId: number) {
  await getRedis().del(getDomainVerificationKey("dkim-reregistered", domainId));
}

async function getDkimReregisteredFlag(domainId: number): Promise<boolean> {
  const val = await getRedis().get(
    getDomainVerificationKey("dkim-reregistered", domainId),
  );
  return val === "1";
}

async function markDomainEverVerified(domainId: number) {
  await getRedis().set(
    getDomainVerificationKey("has-ever-verified", domainId),
    "1",
  );
}

async function setLastNotifiedDomainStatus(
  domainId: number,
  status: DomainStatus,
) {
  await getRedis().set(
    getDomainVerificationKey("last-notified-status", domainId),
    status,
  );
}

async function reserveDomainStatusNotification(
  domainId: number,
  status: DomainStatus,
) {
  const result = await getRedis().set(
    getDomainVerificationKey(`notification-lock:${status}`, domainId),
    "1",
    "EX",
    300,
    "NX",
  );

  return result === "OK";
}

async function clearDomainVerificationState(domainId: number) {
  await getRedis().del(
    getDomainVerificationKey("last-check", domainId),
    getDomainVerificationKey("last-notified-status", domainId),
    getDomainVerificationKey("has-ever-verified", domainId),
  );
}

function shouldContinueVerifying(
  verificationStatus: DomainStatus,
  dkimStatus: string | undefined,
  spfDetails: string | undefined,
) {
  if (
    verificationStatus === DomainStatus.SUCCESS &&
    dkimStatus === DomainStatus.SUCCESS &&
    spfDetails === DomainStatus.SUCCESS
  ) {
    return false;
  }

  return verificationStatus !== DomainStatus.FAILED;
}

function shouldSendDomainStatusNotification({
  previousStatus,
  currentStatus,
  hasEverVerified,
  lastNotifiedStatus,
}: {
  previousStatus: DomainStatus;
  currentStatus: DomainStatus;
  hasEverVerified: boolean;
  lastNotifiedStatus: DomainStatus | null;
}) {
  if (lastNotifiedStatus === null && currentStatus === previousStatus) {
    return false;
  }

  if (hasEverVerified) {
    return currentStatus !== lastNotifiedStatus;
  }

  if (
    currentStatus !== DomainStatus.SUCCESS &&
    currentStatus !== DomainStatus.FAILED
  ) {
    return false;
  }

  return currentStatus !== lastNotifiedStatus;
}

async function sendDomainStatusNotification({
  domain,
  previousStatus,
}: {
  domain: Domain;
  previousStatus: DomainStatus;
}) {
  const recipients = (
    await db.teamUser.findMany({
      where: {
        teamId: domain.teamId,
      },
      include: {
        user: true,
      },
    })
  )
    .map((teamUser) => teamUser.user?.email)
    .filter((email): email is string => Boolean(email));

  if (recipients.length === 0) {
    logger.info(
      { domainId: domain.id, teamId: domain.teamId },
      "[DomainService]: Skipping domain status email because team has no recipients",
    );
    return;
  }

  const subject =
    domain.status === DomainStatus.SUCCESS
      ? `ByteSend: ${domain.name} is verified`
      : previousStatus === DomainStatus.SUCCESS
        ? `ByteSend: ${domain.name} verification status changed`
        : `ByteSend: ${domain.name} verification failed`;

  const domainUrl = `${env.NEXTAUTH_URL}/domains/${domain.id}`;
  const html = await renderDomainVerificationStatusEmail({
    domainName: domain.name,
    currentStatus: domain.status,
    previousStatus,
    domainUrl,
  });
  const statusMessage =
    domain.status === DomainStatus.SUCCESS
      ? `Your domain ${domain.name} is now verified, and you can start sending emails.`
      : `Your domain ${domain.name} could not be verified because the DNS records are not set up correctly yet. Please review your DNS settings and try again.`;
  const textLines = [
    "Hey,",
    null,
    statusMessage,
    null,
    `Open domain settings: ${domainUrl}`,
    null,
    "Thanks,",
    "ByteSend Team",
  ].filter((value): value is string => Boolean(value));

  await Promise.all(
    recipients.map((email) =>
      sendMail(email, subject, textLines.join("\n"), html, "hey@bytesend.cloud"),
    ),
  );
}

function buildDomainPayload(domain: Domain): DomainPayload {
  return {
    id: domain.id,
    name: domain.name,
    status: domain.status,
    region: domain.region,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
    clickTracking: domain.clickTracking,
    openTracking: domain.openTracking,
    subdomain: domain.subdomain,
    sesTenantId: domain.sesTenantId,
    dkimStatus: domain.dkimStatus,
    spfDetails: domain.spfDetails,
    dmarcAdded: domain.dmarcAdded,
  };
}

export async function validateDomainFromEmail(email: string, teamId: number) {
  const match = email.match(/<([^>]+)>/);
  let fromDomain: string | undefined;

  if (match && match[1]) {
    const parts = match[1].split("@");
    fromDomain = parts.length > 1 ? parts[1] : undefined;
  } else {
    const parts = email.split("@");
    fromDomain = parts.length > 1 ? parts[1] : undefined;
  }

  if (fromDomain?.endsWith(">")) {
    fromDomain = fromDomain.slice(0, -1);
  }

  if (!fromDomain) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "From email is invalid",
    });
  }

  const domain = await db.domain.findFirst({
    where: { name: fromDomain, teamId },
  });

  if (!domain) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: `Domain: ${fromDomain} of from email is wrong. Use the domain verified by ByteSend`,
    });
  }

  if (domain.status !== "SUCCESS") {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: `Domain: ${fromDomain} is not verified`,
    });
  }

  return domain;
}

export async function validateApiKeyDomainAccess(
  email: string,
  teamId: number,
  apiKey: ApiKey & { domain?: { name: string } | null },
) {
  const domain = await validateDomainFromEmail(email, teamId);

  if (!apiKey.domainId) {
    return domain;
  }

  if (apiKey.domainId !== domain.id) {
    throw new ByteSendApiError({
      code: "FORBIDDEN",
      message: `API key does not have access to domain: ${domain.name}`,
    });
  }

  return domain;
}

const RESERVED_DOMAINS = [
  "bytesend.cloud",
  "bytesend.com",
];

export async function createDomain(
  teamId: number,
  name: string,
  region: string,
  sesTenantId?: string,
  allowReserved?: boolean,
) {
  const domainStr = tldts.getDomain(name);

  logger.info({ domainStr, name, region }, "Creating domain");

  if (!domainStr) {
    throw new Error("Invalid domain");
  }

  if (!allowReserved && RESERVED_DOMAINS.some((r) => name === r || name.endsWith(`.${r}`))) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message: "This domain is reserved and cannot be added.",
    });
  }

  if (isCloud() && isSharedHostname(name)) {
    throw new ByteSendApiError({
      code: "BAD_REQUEST",
      message:
        "Domains on dynamic-DNS, free-subdomain or tunnel services (like duckdns.org or no-ip.org) can't send through ByteSend. Use a domain you own.",
    });
  }

  if (await BlocklistService.findBlockedSendingDomain(name)) {
    throw new ByteSendApiError({
      code: "FORBIDDEN",
      message: "This domain can't be added to ByteSend. Contact support if you think this is a mistake.",
    });
  }

  const setting = await SesSettingsService.getSetting(region);

  if (!setting) {
    throw new Error("Ses setting not found");
  }

  const { isLimitReached, reason } =
    await LimitService.checkDomainLimit(teamId);

  if (isLimitReached) {
    throw new ByteSendApiError({
      code: "FORBIDDEN",
      message: reason ?? "Domain limit reached",
    });
  }

  const subdomain = tldts.getSubdomain(name);
  const dkimSelector = "bytesend";
  const publicKey = await ses.addDomain(
    name,
    region,
    sesTenantId,
    dkimSelector,
  );

  let domain: Domain;
  try {
    domain = await db.domain.create({
      data: {
        name,
        publicKey,
        teamId,
        subdomain,
        region,
        sesTenantId,
        dkimSelector,
        dkimStatus: DomainStatus.NOT_STARTED,
        spfDetails: DomainStatus.NOT_STARTED,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "P2002"
    ) {
      throw new ByteSendApiError({
        code: "CONFLICT",
        message:
          "This domain is already registered in another workspace. Each domain can only be connected to one account.",
      });
    }
    throw error;
  }

  await emitDomainEvent(domain, "domain.created");

  // Shared namespaces the curated block list doesn't cover (some are legitimate paid ones, like
  // acme.uk.com), so they're allowed but put in front of an admin.
  if (isCloud() && isPrivateSuffixHostname(name)) {
    sendToDiscord(
      `⚠️ **Domain on a shared namespace added**\n**Domain:** \`${name}\`\n**Team:** #${teamId}\nCould be a dynamic-DNS or free-subdomain host. Review it in the admin panel and add it to the blocklist if it isn't legitimate.`,
    ).catch(() => void 0);
  }

  return withDnsRecords(domain);
}

export async function getDomain(id: number, teamId: number) {
  const domain = await db.domain.findUnique({
    where: {
      id,
      teamId,
    },
  });

  if (!domain) {
    throw new ByteSendApiError({
      code: "NOT_FOUND",
      message: "Domain not found",
    });
  }

  if (domain.isVerifying) {
    return refreshDomainVerification(domain);
  }

  const dkimReregistered = await getDkimReregisteredFlag(domain.id);
  return { ...withDnsRecords(domain), dkimReregistered, dnsPrecheck: null };
}

export async function refreshDomainVerification(
  domainOrId: number | Domain,
): Promise<DomainVerificationRefreshResult> {
  const domain =
    typeof domainOrId === "number"
      ? await db.domain.findUnique({ where: { id: domainOrId } })
      : domainOrId;

  if (!domain) {
    throw new ByteSendApiError({
      code: "NOT_FOUND",
      message: "Domain not found",
    });
  }

  const verificationState = await getDomainVerificationState(domain.id);
  const previousStatus = domain.status;
  const subdomainSuffix = domain.subdomain ? `.${domain.subdomain}` : "";
  const mailDomain = `mail${subdomainSuffix}.${domain.name}`;
  const dkimSelector = domain.dkimSelector ?? "bytesend";

  const [domainIdentity, dkimDns, spfDns, mxDns] = await Promise.all([
    ses.getDomainIdentity(domain.name, domain.region),
    checkDkimDnsRecord(dkimSelector, domain.name, domain.publicKey),
    checkSpfDnsRecord(mailDomain),
    checkMxDnsRecord(mailDomain, domain.region),
  ]);

  const dnsPrecheck: DnsPrecheckResult = {
    dkim: dkimDns,
    spf: spfDns,
    mx: mxDns,
  };

  let dkimStatus = domainIdentity.DkimAttributes?.Status?.toString();
  const spfDetails =
    domainIdentity.MailFromAttributes?.MailFromDomainStatus?.toString();
  const verificationError =
    domainIdentity.VerificationInfo?.ErrorType?.toString() ?? null;
  const verificationStatus = parseDomainStatus(
    domainIdentity.VerificationStatus?.toString(),
  );
  const lastCheckedTime = domainIdentity.VerificationInfo?.LastCheckedTimestamp;
  const baseDomain = tldts.getDomain(domain.name);
  const _dmarcRecord = baseDomain ? await getDmarcRecord(baseDomain) : null;
  const dmarcRecord = _dmarcRecord?.[0]?.[0];
  const checkedAt = new Date();

  let dkimReregistered = false;
  const dkimIsStuck =
    dkimStatus !== DomainStatus.SUCCESS && dkimDns === "found";
  const lastChecked = verificationState.lastCheckedAt;

  const stuckTooLong =
    lastChecked !== null &&
    Date.now() - lastChecked.getTime() > DKIM_STUCK_THRESHOLD_MS;

  if (dkimIsStuck && stuckTooLong) {
    try {
      const newPublicKey = await ses.reregisterDkimSigning(
        domain.name,
        domain.region,
        dkimSelector,
      );
      await db.domain.update({
        where: { id: domain.id },
        data: { publicKey: newPublicKey, dkimStatus: DomainStatus.NOT_STARTED },
      });
      dkimStatus = DomainStatus.NOT_STARTED;
      dkimReregistered = true;
      await setDkimReregisteredFlag(domain.id);
      logger.info(
        { domainId: domain.id, domain: domain.name },
        "[DomainService]: Auto re-registered DKIM signing: DNS pre-check found record but SES was stuck",
      );
    } catch (err) {
      logger.error(
        { err, domainId: domain.id },
        "[DomainService]: Failed to auto re-register DKIM signing",
      );
    }
  }

  const updatedDomain = await db.domain.update({
    where: {
      id: domain.id,
    },
    data: {
      dkimStatus: dkimStatus ?? null,
      spfDetails: spfDetails ?? null,
      status: verificationStatus,
      errorMessage: verificationError,
      dmarcAdded: Boolean(dmarcRecord),
      isVerifying: dkimReregistered
        ? false
        : shouldContinueVerifying(verificationStatus, dkimStatus, spfDetails),
    },
  });

  await setDomainVerificationCheckedAt(domain.id, checkedAt);

  if (updatedDomain.status === DomainStatus.SUCCESS) {
    await markDomainEverVerified(domain.id);
  }

  if (
    shouldSendDomainStatusNotification({
      previousStatus,
      currentStatus: updatedDomain.status,
      hasEverVerified:
        verificationState.hasEverVerified ||
        updatedDomain.status === DomainStatus.SUCCESS,
      lastNotifiedStatus: verificationState.lastNotifiedStatus,
    })
  ) {
    const reservedNotification = await reserveDomainStatusNotification(
      domain.id,
      updatedDomain.status,
    );

    if (reservedNotification) {
      try {
        await sendDomainStatusNotification({
          domain: updatedDomain,
          previousStatus,
        });
        await setLastNotifiedDomainStatus(domain.id, updatedDomain.status);
      } catch (error) {
        logger.error(
          { err: error, domainId: domain.id, status: updatedDomain.status },
          "[DomainService]: Failed to send domain status notification",
        );
      }
    }
  }

  const normalizedDomain = {
    ...updatedDomain,
    dkimStatus: dkimStatus ?? null,
    spfDetails: spfDetails ?? null,
    dmarcAdded: Boolean(dmarcRecord),
  } satisfies Domain;

  const domainWithDns = withDnsRecords(normalizedDomain);
  const normalizedLastCheckedTime =
    lastCheckedTime instanceof Date
      ? lastCheckedTime.toISOString()
      : lastCheckedTime != null
        ? String(lastCheckedTime)
        : null;

  if (previousStatus !== domainWithDns.status) {
    const eventType: DomainWebhookEventType =
      domainWithDns.status === DomainStatus.SUCCESS
        ? "domain.verified"
        : "domain.updated";
    await emitDomainEvent(domainWithDns, eventType);
  }

  return {
    ...domainWithDns,
    dkimStatus: normalizedDomain.dkimStatus,
    spfDetails: normalizedDomain.spfDetails,
    verificationError,
    lastCheckedTime: normalizedLastCheckedTime,
    dmarcAdded: normalizedDomain.dmarcAdded,
    previousStatus,
    statusChanged: previousStatus !== domainWithDns.status,
    hasEverVerified:
      verificationState.hasEverVerified ||
      domainWithDns.status === DomainStatus.SUCCESS,
    dnsPrecheck,
    dkimReregistered,
  };
}

export async function reregisterDomainDkim(id: number, teamId: number) {
  const domain = await db.domain.findUnique({
    where: { id, teamId },
  });

  if (!domain) {
    throw new ByteSendApiError({ code: "NOT_FOUND", message: "Domain not found" });
  }

  const selector = domain.dkimSelector ?? "bytesend";
  const newPublicKey = await ses.reregisterDkimSigning(
    domain.name,
    domain.region,
    selector,
  );

  const updated = await db.domain.update({
    where: { id },
    data: {
      publicKey: newPublicKey,
      dkimStatus: DomainStatus.NOT_STARTED,
      isVerifying: false,
    },
  });

  await setDkimReregisteredFlag(id);

  logger.info(
    { domainId: id, domain: domain.name },
    "[DomainService]: DKIM manually re-registered",
  );

  return { ...withDnsRecords(updated), dkimReregistered: true, dnsPrecheck: null };
}

export async function updateDomain(
  id: number,
  data: { clickTracking?: boolean; openTracking?: boolean },
) {
  const updated = await db.domain.update({
    where: { id },
    data,
  });

  await emitDomainEvent(updated, "domain.updated");

  return updated;
}

export async function deleteDomain(id: number) {
  const domain = await db.domain.findUnique({
    where: { id },
  });

  if (!domain) {
    throw new Error("Domain not found");
  }

  const deleted = await ses.deleteDomain(
    domain.name,
    domain.region,
    domain.sesTenantId ?? undefined,
  );

  if (!deleted) {
    throw new Error("Error in deleting domain");
  }

  for (const extraRegion of [domain.pendingRegion, domain.retiredRegion]) {
    if (!extraRegion || extraRegion === domain.region) continue;
    try {
      await ses.deleteDomain(domain.name, extraRegion, domain.sesTenantId ?? undefined);
    } catch (error) {
      logger.error(
        { err: error, domainId: id, region: extraRegion },
        "[DomainService]: Failed to delete secondary-region identity",
      );
    }
  }

  const deletedRecord = await db.domain.delete({ where: { id } });
  try {
    await clearDomainVerificationState(id);
  } catch (error) {
    logger.error(
      { err: error, domainId: id },
      "[DomainService]: Failed to clear domain verification state",
    );
  }

  await emitDomainEvent(domain, "domain.deleted");

  return deletedRecord;
}

export async function getDomains(
  teamId: number,
  options?: { domainId?: number },
) {
  const domains = await db.domain.findMany({
    where: {
      teamId,
      ...(options?.domainId ? { id: options.domainId } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return domains.map((d) => withDnsRecords(d));
}

async function getDmarcRecord(domain: string) {
  try {
    const dmarcRecord = await dnsResolveTxt(`_dmarc.${domain}`);
    return dmarcRecord;
  } catch (error) {
    logger.error({ err: error, domain }, "Error fetching DMARC record");
    return null;
  }
}

export async function emitDomainEvent(domain: Domain, type: DomainWebhookEventType) {
  try {
    await WebhookService.emit(domain.teamId, type, buildDomainPayload(domain), {
      domainId: domain.id,
    });
  } catch (error) {
    logger.error(
      { error, domainId: domain.id, type },
      "[DomainService]: Failed to emit domain webhook event",
    );
  }
}

export async function isDomainVerificationDue(domain: Domain) {
  const verificationState = await getDomainVerificationState(domain.id);

  if (
    !verificationState.hasEverVerified &&
    domain.status === DomainStatus.FAILED &&
    !domain.isVerifying
  ) {
    return false;
  }

  const now = Date.now();
  const lastCheckedAt = verificationState.lastCheckedAt?.getTime() ?? 0;
  const intervalMs =
    verificationState.hasEverVerified ||
      VERIFIED_DOMAIN_STATUSES.has(domain.status)
      ? DOMAIN_VERIFIED_RECHECK_MS
      : DOMAIN_UNVERIFIED_RECHECK_MS;

  if (!verificationState.lastCheckedAt) {
    return true;
  }

  return now - lastCheckedAt >= intervalMs;
}
