import { promises as dns } from "node:dns";
import { DmarcLookupError, normalizeDomainInput, type DmarcFinding as ToolFinding } from "./dmarc-check-service";

export type SpfGrade = "missing" | "invalid" | "strict" | "softfail" | "neutral" | "open";

export type SpfCheck = {
  domain: string;
  record: string | null;
  grade: SpfGrade;
  lookups: number;
  includes: string[];
  findings: ToolFinding[];
};

const MAX_LOOKUPS = 10;
const MAX_FETCHES = 25;
const LOOKUP_TERMS = /^[+\-~?]?(include:|a\b|a:|a\/|mx\b|mx:|mx\/|ptr\b|ptr:|exists:|redirect=)/i;

async function spfRecords(domain: string) {
  try {
    const answers = await dns.resolveTxt(domain);
    return answers.map((chunks) => chunks.join("")).filter((record) => /^v=spf1(\s|$)/i.test(record.trim()));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") return [];
    throw new DmarcLookupError("Couldn't look up that domain's DNS. Try again in a moment.");
  }
}

export function spfTerms(record: string) {
  return record.trim().split(/\s+/).slice(1);
}

function targetOf(term: string) {
  const match = /^[+\-~?]?(?:include:|redirect=)(.+)$/i.exec(term);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function countSpfLookups(record: string, budget = { fetches: 0 }, seen = new Set<string>()): Promise<number> {
  let lookups = 0;
  for (const term of spfTerms(record)) {
    if (!LOOKUP_TERMS.test(term)) continue;
    lookups++;
    const target = targetOf(term);
    if (!target || seen.has(target) || budget.fetches >= MAX_FETCHES) continue;
    seen.add(target);
    budget.fetches++;
    const nested = (await spfRecords(target).catch(() => []))[0];
    if (nested) lookups += await countSpfLookups(nested, budget, seen);
    if (lookups > MAX_LOOKUPS) return lookups;
  }
  return lookups;
}

export function gradeSpf(record: string, lookups: number): { grade: SpfGrade; findings: ToolFinding[] } {
  const terms = spfTerms(record);
  const findings: ToolFinding[] = [];
  const all = terms.find((term) => /^[+\-~?]?all$/i.test(term));
  const qualifier = all ? (/^[+\-~?]/.test(all) ? all[0] : "+") : null;
  const redirects = terms.some((term) => /^redirect=/i.test(term));

  let grade: SpfGrade;
  if (qualifier === "-") {
    grade = "strict";
    findings.push({ level: "good", title: "Unlisted servers fail (-all)", detail: "Mail from any server not in this record fails SPF." });
  } else if (qualifier === "~") {
    grade = "softfail";
    findings.push({
      level: "good",
      title: "Unlisted servers soft-fail (~all)",
      detail: "Mail from servers not in this record is marked suspicious. Most senders use this, and DMARC decides what happens next.",
    });
  } else if (qualifier === "?") {
    grade = "neutral";
    findings.push({
      level: "warning",
      title: "No opinion on unlisted servers (?all)",
      detail: "Mail from any server is treated as neutral, so SPF gives no protection. Use ~all or -all.",
    });
  } else if (qualifier === "+") {
    grade = "open";
    findings.push({
      level: "problem",
      title: "Any server is allowed (+all)",
      detail: "This record says every server on the internet may send as this domain. Change +all to ~all or -all straight away.",
    });
  } else if (redirects) {
    grade = "softfail";
    findings.push({ level: "good", title: "Uses another domain's policy", detail: "redirect= hands the decision to another domain's SPF record." });
  } else {
    grade = "neutral";
    findings.push({
      level: "warning",
      title: "No all mechanism",
      detail: "Without ~all or -all at the end, servers that aren't listed are treated as neutral. Add ~all.",
    });
  }

  if (lookups > MAX_LOOKUPS) {
    grade = "invalid";
    findings.push({
      level: "problem",
      title: `Too many DNS lookups (${lookups})`,
      detail: "SPF allows at most 10. Past that, mail providers treat the record as broken and SPF fails for every message. Remove includes you no longer use.",
    });
  } else {
    findings.push({
      level: lookups >= 8 ? "warning" : "good",
      title: `${lookups} of 10 DNS lookups used`,
      detail: lookups >= 8 ? "You're close to the limit. Adding another provider could break SPF." : "Well within SPF's limit of 10.",
    });
  }

  if (terms.some((term) => /^[+\-~?]?ptr(:|$)/i.test(term))) {
    findings.push({ level: "warning", title: "Uses ptr", detail: "The ptr mechanism is slow, unreliable and discouraged by the SPF standard. Replace it with ip4:, ip6: or include:." });
  }

  return { grade, findings };
}

export async function checkDomainSpf(input: string): Promise<SpfCheck> {
  const parsed = normalizeDomainInput(input);
  if (!parsed) throw new DmarcLookupError("That doesn't look like a domain. Try something like example.com.");

  const records = await spfRecords(parsed.host);
  if (records.length === 0) {
    return {
      domain: parsed.host,
      record: null,
      grade: "missing",
      lookups: 0,
      includes: [],
      findings: [
        {
          level: "problem",
          title: "No SPF record",
          detail: "Nothing says which servers may send as this domain. If it sends email, add a TXT record starting with v=spf1. If it never sends, publish v=spf1 -all.",
        },
      ],
    };
  }
  if (records.length > 1) {
    return {
      domain: parsed.host,
      record: records[0]!,
      grade: "invalid",
      lookups: 0,
      includes: [],
      findings: [
        {
          level: "problem",
          title: "More than one SPF record",
          detail: "A domain may only publish one. With two, SPF fails for every message. Merge them into a single record.",
        },
      ],
    };
  }

  const record = records[0]!;
  const lookups = await countSpfLookups(record);
  const includes = spfTerms(record).map(targetOf).filter((target): target is string => Boolean(target));
  return { domain: parsed.host, record, lookups, includes, ...gradeSpf(record, lookups) };
}
