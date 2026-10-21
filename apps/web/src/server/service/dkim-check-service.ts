import { createPublicKey } from "node:crypto";
import { promises as dns } from "node:dns";
import { DmarcLookupError, normalizeDomainInput, parseDmarcTags as parseTags, type DmarcFinding as ToolFinding } from "./dmarc-check-service";

export const COMMON_DKIM_SELECTORS = [
  "bytesend",
  "google",
  "selector1",
  "selector2",
  "default",
  "dkim",
  "mail",
  "k1",
  "k2",
  "s1",
  "s2",
  "resend",
  "mandrill",
  "smtp",
  "everlytickey1",
];

const SELECTOR = /^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$/i;

export type DkimKey = {
  selector: string;
  record: string;
  keyType: string;
  bits: number | null;
  findings: ToolFinding[];
  grade: "strong" | "ok" | "weak" | "broken";
};

export type DkimCheck = {
  domain: string;
  searched: string[];
  keys: DkimKey[];
  grade: "missing" | "broken" | "weak" | "ok" | "strong";
};

async function lookupKey(domain: string, selector: string) {
  try {
    const answers = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
    return answers.map((chunks) => chunks.join("")).find((record) => /(^|;)\s*p=/i.test(record) || /^v=dkim1/i.test(record.trim())) ?? null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN" || code === "ESERVFAIL") return null;
    throw new DmarcLookupError("Couldn't look up that domain's DNS. Try again in a moment.");
  }
}

export function analyzeDkimKey(selector: string, record: string): DkimKey {
  const tags = parseTags(record);
  const keyType = (tags.k ?? "rsa").toLowerCase();
  const publicKey = (tags.p ?? "").replace(/\s+/g, "");
  const findings: ToolFinding[] = [];

  if (!publicKey) {
    findings.push({ level: "problem", title: "Key revoked", detail: "This selector publishes an empty key, so signatures using it fail. That's expected if you've retired it." });
    return { selector, record, keyType, bits: null, findings, grade: "broken" };
  }

  let bits: number | null = null;
  if (keyType === "ed25519") {
    bits = 256;
  } else {
    try {
      bits = createPublicKey({ key: Buffer.from(publicKey, "base64"), format: "der", type: "spki" }).asymmetricKeyDetails?.modulusLength ?? null;
    } catch {
      findings.push({ level: "problem", title: "The key can't be read", detail: "The p= value isn't a valid public key, often because it was cut off when it was pasted into DNS." });
      return { selector, record, keyType, bits: null, findings, grade: "broken" };
    }
  }

  let grade: DkimKey["grade"];
  if (keyType === "ed25519") {
    grade = "strong";
    findings.push({ level: "good", title: "Ed25519 key", detail: "A modern, strong key type. Some providers don't verify it yet, so it's usually published next to an RSA key." });
  } else if (bits !== null && bits >= 2048) {
    grade = "strong";
    findings.push({ level: "good", title: `${bits}-bit RSA key`, detail: "Strong. This is the recommended size." });
  } else if (bits !== null && bits >= 1024) {
    grade = "ok";
    findings.push({ level: "warning", title: `${bits}-bit RSA key`, detail: "Still accepted, but 2048-bit keys are recommended. Rotate to a longer key when you can." });
  } else {
    grade = "weak";
    findings.push({ level: "problem", title: `${bits ?? "Unknown"}-bit RSA key`, detail: "Too short to be trusted. Many providers ignore keys under 1024 bits. Generate a 2048-bit key." });
  }

  if ((tags.t ?? "").toLowerCase().split(":").includes("y")) {
    findings.push({ level: "warning", title: "Testing mode (t=y)", detail: "Receivers may treat signatures from this key as unverified. Remove t=y once you're done testing." });
  }

  return { selector, record, keyType, bits, findings, grade };
}

const RANK: Record<DkimKey["grade"], number> = { broken: 0, weak: 1, ok: 2, strong: 3 };

export async function checkDomainDkim(input: string, selectorInput?: string | null): Promise<DkimCheck> {
  const parsed = normalizeDomainInput(input);
  if (!parsed) throw new DmarcLookupError("That doesn't look like a domain. Try something like example.com.");

  const selector = selectorInput?.trim().toLowerCase().replace(/\._domainkey.*$/, "");
  if (selector && !SELECTOR.test(selector)) {
    throw new DmarcLookupError("That selector doesn't look right. It's the part before ._domainkey, like google or selector1.");
  }

  const searched = selector ? [selector] : COMMON_DKIM_SELECTORS;
  const found = await Promise.all(searched.map(async (name) => ({ name, record: await lookupKey(parsed.host, name) })));
  const keys = found.filter((entry) => entry.record).map((entry) => analyzeDkimKey(entry.name, entry.record!));

  const best = keys.reduce<DkimKey["grade"] | null>((current, key) => (current === null || RANK[key.grade] > RANK[current] ? key.grade : current), null);
  return { domain: parsed.host, searched, keys, grade: best ?? "missing" };
}
