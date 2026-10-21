import { promises as dns } from "node:dns";
import * as tldts from "tldts";

export type DmarcFinding = { level: "good" | "warning" | "problem"; title: string; detail: string };

export type DmarcGrade = "missing" | "invalid" | "monitoring" | "partial" | "enforced";

export type DmarcCheck = {
  domain: string;
  lookedUp: string;
  inherited: boolean;
  record: string | null;
  tags: Record<string, string>;
  grade: DmarcGrade;
  findings: DmarcFinding[];
  suggestion: string | null;
};

export class DmarcLookupError extends Error {}

export function normalizeDomainInput(input: string) {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^[^@]*@/, "")
    .split(/[/?#:]/)[0]!
    .replace(/\.$/, "");
  const parsed = tldts.parse(host);
  if (!parsed.domain || !parsed.isIcann || parsed.isIp || host.length > 253) return null;
  return { host, orgDomain: parsed.domain };
}

export function parseDmarcTags(record: string) {
  const tags: Record<string, string> = {};
  for (const part of record.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (key && !(key in tags)) tags[key] = value;
  }
  return tags;
}

const POLICIES = new Set(["none", "quarantine", "reject"]);

export function analyzeDmarc(records: string[], domain: string): Omit<DmarcCheck, "domain" | "lookedUp" | "inherited"> {
  const dmarc = records.filter((record) => record.trim().toLowerCase().startsWith("v=dmarc1"));
  const findings: DmarcFinding[] = [];

  if (dmarc.length === 0) {
    findings.push({
      level: "problem",
      title: "No DMARC record",
      detail: "Anyone can send email that claims to be from this domain, and Gmail and Yahoo require DMARC from bulk senders.",
    });
    return { record: null, tags: {}, grade: "missing", findings, suggestion: "v=DMARC1; p=none; rua=mailto:dmarc@" + domain };
  }

  if (dmarc.length > 1) {
    findings.push({
      level: "problem",
      title: "More than one DMARC record",
      detail: "Mail providers ignore DMARC entirely when a domain publishes two records. Keep one and delete the rest.",
    });
    return { record: dmarc[0]!, tags: parseDmarcTags(dmarc[0]!), grade: "invalid", findings, suggestion: null };
  }

  const record = dmarc[0]!;
  const tags = parseDmarcTags(record);
  const policy = tags.p?.toLowerCase();

  if (!policy || !POLICIES.has(policy)) {
    findings.push({
      level: "problem",
      title: "The policy is missing or invalid",
      detail: "The p= tag must be none, quarantine or reject. Without a valid one, mail providers treat the record as broken.",
    });
    return { record, tags, grade: "invalid", findings, suggestion: null };
  }

  const pct = tags.pct === undefined ? 100 : Number.parseInt(tags.pct, 10);
  let grade: DmarcGrade = policy === "none" ? "monitoring" : pct < 100 ? "partial" : "enforced";

  if (policy === "none") {
    findings.push({
      level: "warning",
      title: "Monitoring only (p=none)",
      detail: "Failing mail is still delivered. That's the right place to start, but spoofed mail gets through until you move to quarantine or reject.",
    });
  } else if (pct < 100) {
    findings.push({
      level: "warning",
      title: `Applied to ${Number.isFinite(pct) ? pct : 0}% of failing mail`,
      detail: `pct=${tags.pct} means the ${policy} policy only covers part of the mail that fails. Raise it to 100 once you're confident.`,
    });
  } else {
    findings.push({
      level: "good",
      title: policy === "reject" ? "Spoofed mail is rejected" : "Spoofed mail goes to spam",
      detail: `p=${policy} applies to all mail that fails DMARC.`,
    });
  }

  const subPolicy = tags.sp?.toLowerCase();
  if (policy !== "none" && subPolicy === "none") {
    grade = "partial";
    findings.push({
      level: "warning",
      title: "Subdomains aren't protected",
      detail: "sp=none lets mail from any subdomain through, even though the main domain is protected.",
    });
  }

  const rua = (tags.rua ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
  if (rua.length === 0) {
    findings.push({
      level: "warning",
      title: "Reports aren't being sent anywhere",
      detail: "Without a rua= address you can't see who's sending as your domain, which you need before tightening the policy.",
    });
  } else {
    findings.push({
      level: "good",
      title: "Reports are being collected",
      detail: `Aggregate reports go to ${rua.map((address) => address.replace(/^mailto:/i, "")).join(", ")}.`,
    });
  }

  if (tags.adkim?.toLowerCase() === "s" || tags.aspf?.toLowerCase() === "s") {
    findings.push({
      level: "good",
      title: "Strict alignment",
      detail: "DKIM or SPF must match the From domain exactly, not just the same organisation.",
    });
  }

  return { record, tags, grade, findings, suggestion: rua.length === 0 ? `${record.replace(/;\s*$/, "")}; rua=mailto:dmarc@${domain}` : null };
}

async function lookupDmarc(name: string) {
  try {
    const answers = await dns.resolveTxt(`_dmarc.${name}`);
    return answers.map((chunks) => chunks.join(""));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") return [];
    throw new DmarcLookupError("Couldn't look up that domain's DNS. Try again in a moment.");
  }
}

export async function checkDomainDmarc(input: string): Promise<DmarcCheck> {
  const parsed = normalizeDomainInput(input);
  if (!parsed) throw new DmarcLookupError("That doesn't look like a domain. Try something like example.com.");

  let lookedUp = parsed.host;
  let records = await lookupDmarc(parsed.host);
  let inherited = false;
  if (!records.some((record) => record.toLowerCase().startsWith("v=dmarc1")) && parsed.host !== parsed.orgDomain) {
    lookedUp = parsed.orgDomain;
    records = await lookupDmarc(parsed.orgDomain);
    inherited = true;
  }

  return { domain: parsed.host, lookedUp, inherited, ...analyzeDmarc(records, parsed.orgDomain) };
}
