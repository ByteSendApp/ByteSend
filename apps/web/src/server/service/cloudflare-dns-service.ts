import * as tldts from "tldts";
import type { Domain } from "@prisma/client";
import { logger } from "../logger/log";
import { buildDnsRecords } from "./domain-service";
import { ROOT_RECEIVING, receivingRecords } from "./inbound-domain-service";

const API = "https://api.cloudflare.com/client/v4";
const TXT_CHUNK = 255;

export type DesiredRecord = { type: "MX" | "TXT"; name: string; content: string; priority?: number; kind: "dkim" | "spf" | "mx" | "dmarc" };
export type RecordOutcome = {
  type: "MX" | "TXT";
  name: string;
  status: "created" | "updated" | "exists" | "conflict" | "failed";
  message?: string;
};

type CloudflareRecord = { id: string; type: string; name: string; content: string; priority?: number };
type CloudflareResponse<T> = { success: boolean; errors?: Array<{ code: number; message: string }>; result: T };

export class CloudflareError extends Error {}

async function cloudflare<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new CloudflareError("Couldn't reach Cloudflare. Try again in a moment.");
  }
  const body = (await response.json().catch(() => null)) as CloudflareResponse<T> | null;
  if (response.status === 401 || response.status === 403) {
    throw new CloudflareError("Cloudflare rejected the token. Check it's active and was made with the Edit zone DNS template for this domain.");
  }
  if (!body?.success) {
    throw new CloudflareError(body?.errors?.[0]?.message ?? `Cloudflare returned an error (${response.status}).`);
  }
  return body.result;
}

export function normalizeTxt(content: string) {
  return content.trim().replace(/"\s+"/g, "").replace(/^"|"$/g, "");
}

export function quoteTxt(value: string) {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += TXT_CHUNK) chunks.push(value.slice(i, i + TXT_CHUNK));
  return chunks.map((chunk) => `"${chunk}"`).join(" ");
}

export function desiredRecords(domain: Domain): DesiredRecord[] {
  const zone = tldts.getDomain(domain.name) ?? domain.name;
  const sending = buildDnsRecords(domain).map((record): DesiredRecord => {
    const name = `${record.name}.${zone}`;
    const kind = record.type === "MX" ? "mx" : record.name.startsWith("_dmarc") ? "dmarc" : record.value.startsWith("v=spf1") ? "spf" : "dkim";
    return { type: record.type, name, content: record.value, priority: record.priority ? Number(record.priority) : undefined, kind };
  });
  const receiving = domain.inboundEnabled
    ? receivingRecords(domain).map((record): DesiredRecord => ({
        type: record.type,
        name: record.name === ROOT_RECEIVING ? domain.name : `${record.name}.${domain.name}`,
        content: record.value,
        priority: record.priority,
        kind: record.type === "MX" ? "mx" : "dkim",
      }))
    : [];
  return [...sending, ...receiving];
}

export function planRecord(desired: DesiredRecord, existing: CloudflareRecord[]): { action: "create" | "update" | "none" | "conflict"; id?: string; message?: string } {
  const sameType = existing.filter((r) => r.type === desired.type);

  if (desired.type === "MX") {
    if (sameType.some((r) => r.content.toLowerCase() === desired.content.toLowerCase())) return { action: "none" };
    if (sameType.length) {
      return { action: "conflict", message: `Already has an MX record pointing at ${sameType[0]!.content}. Change it to ${desired.content} and try again.` };
    }
    return { action: "create" };
  }

  const values = sameType.map((r) => ({ id: r.id, value: normalizeTxt(r.content) }));
  if (values.some((r) => r.value === desired.content)) return { action: "none" };

  if (desired.kind === "dmarc") {
    return values.some((r) => r.value.toLowerCase().startsWith("v=dmarc1")) ? { action: "none", message: "Kept your existing DMARC policy." } : { action: "create" };
  }
  if (desired.kind === "spf") {
    const spf = values.find((r) => r.value.toLowerCase().startsWith("v=spf1"));
    if (!spf) return { action: "create" };
    return spf.value.includes("include:amazonses.com")
      ? { action: "none" }
      : { action: "conflict", message: `Already has an SPF record (${spf.value}). Add include:amazonses.com to it.` };
  }
  const dkim = values.find((r) => r.value.startsWith("p=") || r.value.toLowerCase().startsWith("v=dkim1"));
  return dkim ? { action: "update", id: dkim.id } : { action: "create" };
}

export async function setUpDomainOnCloudflare(domain: Domain, token: string): Promise<RecordOutcome[]> {
  const zoneName = tldts.getDomain(domain.name) ?? domain.name;
  const zones = await cloudflare<Array<{ id: string; name: string }>>(token, `/zones?name=${encodeURIComponent(zoneName)}`);
  const zone = zones.find((z) => z.name === zoneName);
  if (!zone) {
    throw new CloudflareError(`This token can't see ${zoneName}. Make sure the domain is on this Cloudflare account and selected under the token's Zone Resources.`);
  }

  const outcomes: RecordOutcome[] = [];
  for (const desired of desiredRecords(domain)) {
    try {
      const existing = await cloudflare<CloudflareRecord[]>(token, `/zones/${zone.id}/dns_records?name=${encodeURIComponent(desired.name)}&per_page=100`);
      const plan = planRecord(desired, existing);
      const body = JSON.stringify({
        type: desired.type,
        name: desired.name,
        content: desired.type === "TXT" ? quoteTxt(desired.content) : desired.content,
        ttl: 1,
        proxied: false,
        ...(desired.priority !== undefined ? { priority: desired.priority } : {}),
        comment: "Added by ByteSend",
      });

      if (plan.action === "create") {
        await cloudflare(token, `/zones/${zone.id}/dns_records`, { method: "POST", body });
        outcomes.push({ type: desired.type, name: desired.name, status: "created" });
      } else if (plan.action === "update") {
        await cloudflare(token, `/zones/${zone.id}/dns_records/${plan.id}`, { method: "PATCH", body });
        outcomes.push({ type: desired.type, name: desired.name, status: "updated" });
      } else {
        outcomes.push({ type: desired.type, name: desired.name, status: plan.action === "none" ? "exists" : "conflict", message: plan.message });
      }
    } catch (error) {
      if (!(error instanceof CloudflareError)) throw error;
      outcomes.push({ type: desired.type, name: desired.name, status: "failed", message: error.message });
    }
  }

  logger.info({ domainId: domain.id, outcomes: outcomes.map((o) => `${o.name}:${o.status}`) }, "[CloudflareDNS]: Set up domain records");
  return outcomes;
}
