import dns from "node:dns";
import { TRPCError } from "@trpc/server";
import type { Domain } from "@prisma/client";
import { env } from "~/env";
import { db } from "../db";
import * as ses from "../aws/ses";
import { logger } from "../logger/log";
import { createReceivingIdentity, deleteReceivingIdentity, inboundMxHost, isIdentityVerified } from "../aws/ses-receiving";

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const INBOUND_DKIM_SELECTOR = "bytesend-inbound";

type ReceivingDomain = Pick<
  Domain,
  "id" | "name" | "subdomain" | "region" | "status" | "inboundEnabled" | "inboundSubdomain" | "inboundStatus" | "inboundCheckedAt" | "inboundDkimSelector" | "inboundPublicKey"
>;

export const RECEIVING_DOMAIN_SELECT = {
  id: true,
  name: true,
  subdomain: true,
  region: true,
  status: true,
  inboundEnabled: true,
  inboundSubdomain: true,
  inboundStatus: true,
  inboundCheckedAt: true,
  inboundDkimSelector: true,
  inboundPublicKey: true,
} as const;

export function receivesThroughKeptIdentity(domain: Pick<Domain, "region" | "inboundEnabled" | "inboundDkimSelector">) {
  return domain.inboundEnabled && !domain.inboundDkimSelector && domain.region !== env.INBOUND_REGION;
}

export const ROOT_RECEIVING = "@";

export function isRootReceiving(domain: Pick<Domain, "inboundSubdomain">) {
  return domain.inboundSubdomain === ROOT_RECEIVING;
}

export function receivingFqdn(domain: Pick<Domain, "name" | "inboundSubdomain">) {
  if (!domain.inboundSubdomain) return null;
  return isRootReceiving(domain) ? domain.name : `${domain.inboundSubdomain}.${domain.name}`;
}

export function receivingRecords(domain: Pick<ReceivingDomain, "subdomain" | "inboundSubdomain" | "inboundDkimSelector" | "inboundPublicKey">) {
  if (!domain.inboundSubdomain) return [];
  const host = isRootReceiving(domain) ? "" : domain.inboundSubdomain;
  const relativeToZone = (...labels: string[]) => [...labels, domain.subdomain].filter(Boolean).join(".") || ROOT_RECEIVING;
  const records: Array<{ type: "MX" | "TXT"; name: string; value: string; priority?: number }> = [
    { type: "MX", name: relativeToZone(host), value: inboundMxHost(), priority: 10 },
  ];
  if (domain.inboundDkimSelector && domain.inboundPublicKey) {
    records.push({
      type: "TXT",
      name: relativeToZone(`${domain.inboundDkimSelector}._domainkey`, host),
      value: `p=${domain.inboundPublicKey}`,
    });
  }
  return records;
}

export async function enableReceiving(teamId: number, domainId: number, rawSubdomain: string, confirmRoot = false) {
  const requested = rawSubdomain.trim().toLowerCase();
  const root = requested === "" || requested === ROOT_RECEIVING;
  const subdomain = root ? ROOT_RECEIVING : requested;
  if (!root && !LABEL.test(subdomain)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Use a single subdomain like \"reply\" or \"inbound\": letters, numbers and dashes." });
  }
  if (root && !confirmRoot) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Receiving on the domain itself sends all of its mail to ByteSend. Confirm that before turning it on.",
    });
  }
  const domain = await db.domain.findFirst({ where: { id: domainId, teamId }, select: RECEIVING_DOMAIN_SELECT });
  if (!domain) throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
  if (domain.status !== "SUCCESS") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Verify the domain for sending first, then set up receiving." });
  }

  const fqdn = root ? domain.name : `${subdomain}.${domain.name}`;
  const alreadyVerified = root && domain.region !== env.INBOUND_REGION && (await isIdentityVerified(fqdn).catch(() => false));
  const needsIdentity = domain.region !== env.INBOUND_REGION && !alreadyVerified;
  const identity = needsIdentity ? await createReceivingIdentity(fqdn, INBOUND_DKIM_SELECTOR) : null;

  return db.domain.update({
    where: { id: domain.id },
    data: {
      inboundEnabled: true,
      inboundSubdomain: subdomain,
      inboundStatus: env.NODE_ENV === "development" ? "SUCCESS" : "PENDING",
      inboundCheckedAt: null,
      inboundDkimSelector: identity ? INBOUND_DKIM_SELECTOR : null,
      inboundPublicKey: identity?.publicKey ?? null,
    },
    select: RECEIVING_DOMAIN_SELECT,
  });
}

const MAIL_PROVIDERS: Array<[RegExp, string]> = [
  [/(google|googlemail)\.com$/, "Google Workspace"],
  [/mail\.protection\.outlook\.com$/, "Microsoft 365"],
  [/zoho\.(com|eu|in)$/, "Zoho Mail"],
  [/protonmail\.ch$/, "Proton Mail"],
  [/messagingengine\.com$/, "Fastmail"],
  [/icloud\.com$/, "iCloud Mail"],
  [/mx\.cloudflare\.net$/, "Cloudflare Email Routing"],
  [/amazonaws\.com$/, "Amazon SES"],
];

export async function currentMailHosts(teamId: number, domainId: number) {
  const domain = await db.domain.findFirst({ where: { id: domainId, teamId }, select: { name: true } });
  if (!domain) throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
  const records = await dns.promises.resolveMx(domain.name).catch(() => []);
  const hosts = records
    .sort((a, b) => a.priority - b.priority)
    .map((record) => ({ host: record.exchange.toLowerCase().replace(/\.$/, ""), priority: record.priority }));
  const provider = hosts.map((h) => MAIL_PROVIDERS.find(([pattern]) => pattern.test(h.host))?.[1]).find(Boolean) ?? null;
  return { domain: domain.name, hosts, provider, alreadyByteSend: hosts.some((h) => h.host === inboundMxHost()) };
}

async function mxPointsAtSes(fqdn: string) {
  try {
    const records = await dns.promises.resolveMx(fqdn);
    return records.some((record) => record.exchange.toLowerCase().replace(/\.$/, "") === inboundMxHost());
  } catch {
    return false;
  }
}

export async function checkReceiving(teamId: number, domainId: number) {
  const domain = await db.domain.findFirst({ where: { id: domainId, teamId }, select: RECEIVING_DOMAIN_SELECT });
  if (!domain?.inboundEnabled) throw new TRPCError({ code: "NOT_FOUND", message: "Receiving isn't set up for this domain" });
  const fqdn = receivingFqdn(domain)!;

  const mx = env.NODE_ENV === "development" ? true : await mxPointsAtSes(fqdn);
  const identity = domain.inboundDkimSelector ? await isIdentityVerified(fqdn) : true;
  const ready = mx && identity;

  const updated = await db.domain.update({
    where: { id: domain.id },
    data: { inboundStatus: ready ? "SUCCESS" : "PENDING", inboundCheckedAt: new Date() },
    select: RECEIVING_DOMAIN_SELECT,
  });
  return { domain: updated, mx, identity };
}

export async function disableReceiving(teamId: number, domainId: number) {
  const domain = await db.domain.findFirst({
    where: { id: domainId, teamId },
    select: { ...RECEIVING_DOMAIN_SELECT, pendingRegion: true, retiredRegion: true, sesTenantId: true },
  });
  if (!domain) throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
  const fqdn = receivingFqdn(domain);
  if (fqdn && domain.inboundDkimSelector) await deleteReceivingIdentity(fqdn);
  const keptIdentityStillNeeded = domain.retiredRegion === env.INBOUND_REGION || domain.pendingRegion === env.INBOUND_REGION;
  if (receivesThroughKeptIdentity(domain) && !keptIdentityStillNeeded) {
    try {
      await ses.deleteDomain(domain.name, env.INBOUND_REGION, domain.sesTenantId ?? undefined);
    } catch (error) {
      logger.error({ err: error, domainId: domain.id }, "[InboundDomain]: Failed to delete the identity kept for receiving");
    }
  }
  return db.domain.update({
    where: { id: domain.id },
    data: {
      inboundEnabled: false,
      inboundSubdomain: null,
      inboundStatus: null,
      inboundCheckedAt: null,
      inboundDkimSelector: null,
      inboundPublicKey: null,
    },
    select: RECEIVING_DOMAIN_SELECT,
  });
}
