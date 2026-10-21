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
  "id" | "name" | "region" | "status" | "inboundEnabled" | "inboundSubdomain" | "inboundStatus" | "inboundCheckedAt" | "inboundDkimSelector" | "inboundPublicKey"
>;

export const RECEIVING_DOMAIN_SELECT = {
  id: true,
  name: true,
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

export function receivingFqdn(domain: Pick<Domain, "name" | "inboundSubdomain">) {
  return domain.inboundSubdomain ? `${domain.inboundSubdomain}.${domain.name}` : null;
}

export function receivingRecords(domain: ReceivingDomain) {
  if (!domain.inboundSubdomain) return [];
  const records: Array<{ type: "MX" | "TXT"; name: string; value: string; priority?: number }> = [
    { type: "MX", name: domain.inboundSubdomain, value: inboundMxHost(), priority: 10 },
  ];
  if (domain.inboundDkimSelector && domain.inboundPublicKey) {
    records.push({
      type: "TXT",
      name: `${domain.inboundDkimSelector}._domainkey.${domain.inboundSubdomain}`,
      value: `p=${domain.inboundPublicKey}`,
    });
  }
  return records;
}

export async function enableReceiving(teamId: number, domainId: number, rawSubdomain: string) {
  const subdomain = rawSubdomain.trim().toLowerCase();
  if (!LABEL.test(subdomain)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Use a single subdomain like \"reply\" or \"inbound\": letters, numbers and dashes." });
  }
  const domain = await db.domain.findFirst({ where: { id: domainId, teamId }, select: RECEIVING_DOMAIN_SELECT });
  if (!domain) throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
  if (domain.status !== "SUCCESS") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Verify the domain for sending first, then set up receiving." });
  }

  const fqdn = `${subdomain}.${domain.name}`;
  const needsIdentity = domain.region !== env.INBOUND_REGION;
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
