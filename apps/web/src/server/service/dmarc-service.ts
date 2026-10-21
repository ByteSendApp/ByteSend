import { promises as dns } from "node:dns";
import { gunzipSync, inflateRawSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import * as tldts from "tldts";
import { Prisma } from "@prisma/client";
import type { ParsedMail } from "mailparser";
import { env } from "~/env";
import { db } from "../db";
import { logger } from "../logger/log";

export const DMARC_RETENTION_DAYS = 90;
export const DMARC_TAG = "dmarc";
const MAX_XML_BYTES = 25 * 1024 * 1024;
const MAX_RECORDS_PER_REPORT = 10_000;
const MAX_REPORTS_PER_TEAM_PER_DAY = 2_000;
const MAX_REVERSE_LOOKUPS = 200;

export type DkimAuthResult = { domain: string; selector: string | null; result: string };
export type SpfAuthResult = { domain: string; scope: string | null; result: string };

export type ParsedDmarcRecord = {
  sourceIp: string;
  count: number;
  disposition: string;
  dkim: string;
  spf: string;
  headerFrom: string;
  envelopeFrom: string | null;
  dkimResults: DkimAuthResult[];
  spfResults: SpfAuthResult[];
};

export type ParsedDmarcReport = {
  orgName: string;
  reporterEmail: string | null;
  reportId: string;
  beginAt: Date;
  endAt: Date;
  policy: { domain: string; p: string | null; sp: string | null; pct: string | null; adkim: string | null; aspf: string | null };
  records: ParsedDmarcRecord[];
};

export function isDmarcRecipient(recipient: string, onHostedDomain: boolean) {
  const [base, tag] = recipient.split("@")[0]!.split("+");
  return onHostedDomain ? tag === DMARC_TAG : base === DMARC_TAG;
}

export function hostedDmarcAddress(slug: string) {
  return env.INBOUND_HOSTED_DOMAIN ? `${slug}+${DMARC_TAG}@${env.INBOUND_HOSTED_DOMAIN}` : null;
}

function unzipXmlEntries(zip: Buffer) {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Not a zip file");

  const entries = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const files: string[] = [];

  for (let n = 0; n < entries && offset + 46 <= zip.length; n++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) break;
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (!name.toLowerCase().endsWith(".xml") || localOffset + 30 > zip.length) continue;
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    if (method === 0 && data.length <= MAX_XML_BYTES) files.push(data.toString("utf8"));
    else if (method === 8) files.push(inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES }).toString("utf8"));
  }
  return files;
}

export function extractReportXml(attachments: Array<{ filename?: string | null; contentType: string; content: Buffer }>) {
  const documents: string[] = [];
  for (const attachment of attachments) {
    const name = (attachment.filename ?? "").toLowerCase();
    const type = attachment.contentType.toLowerCase();
    const content = attachment.content;
    try {
      const isGzip = content[0] === 0x1f && content[1] === 0x8b;
      const isZip = content.readUInt32LE(0) === 0x04034b50;
      if (isGzip) documents.push(gunzipSync(content, { maxOutputLength: MAX_XML_BYTES }).toString("utf8"));
      else if (isZip) documents.push(...unzipXmlEntries(content));
      else if ((name.endsWith(".xml") || type.includes("xml")) && content.length <= MAX_XML_BYTES) documents.push(content.toString("utf8"));
    } catch (error) {
      logger.warn({ err: error, filename: attachment.filename }, "[DMARC]: Couldn't unpack attachment");
    }
  }
  return documents;
}

const ARRAY_PATHS = new Set(["feedback.record", "feedback.record.auth_results.dkim", "feedback.record.auth_results.spf"]);

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  processEntities: false,
  isArray: (_name, jpath) => ARRAY_PATHS.has(String(jpath)),
});

type XmlNode = Record<string, unknown> | string | undefined;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim());
const optional = (value: unknown) => text(value) || null;
const node = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

function unixDate(value: unknown) {
  const seconds = Number(text(value));
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("Invalid report date range");
  return new Date(seconds * 1000);
}

export function parseAggregateReport(xml: string): ParsedDmarcReport {
  const feedback = node((parser.parse(xml) as Record<string, XmlNode>).feedback);
  const metadata = node(feedback.report_metadata);
  const published = node(feedback.policy_published);
  const range = node(metadata.date_range);

  const reportId = text(metadata.report_id);
  const domain = text(published.domain).toLowerCase();
  if (!reportId || !domain) throw new Error("Not a DMARC aggregate report");

  const records = ((feedback.record as unknown[]) ?? []).slice(0, MAX_RECORDS_PER_REPORT).flatMap((raw): ParsedDmarcRecord[] => {
    const row = node(node(raw).row);
    const evaluated = node(row.policy_evaluated);
    const identifiers = node(node(raw).identifiers);
    const auth = node(node(raw).auth_results);
    const sourceIp = text(row.source_ip);
    const count = Number.parseInt(text(row.count), 10);
    if (!sourceIp || !Number.isFinite(count) || count < 0) return [];
    return [
      {
        sourceIp,
        count,
        disposition: text(evaluated.disposition).toLowerCase() || "none",
        dkim: text(evaluated.dkim).toLowerCase() || "fail",
        spf: text(evaluated.spf).toLowerCase() || "fail",
        headerFrom: text(identifiers.header_from).toLowerCase() || domain,
        envelopeFrom: optional(identifiers.envelope_from)?.toLowerCase() ?? null,
        dkimResults: ((auth.dkim as unknown[]) ?? []).map((entry) => ({
          domain: text(node(entry).domain).toLowerCase(),
          selector: optional(node(entry).selector),
          result: text(node(entry).result).toLowerCase(),
        })),
        spfResults: ((auth.spf as unknown[]) ?? []).map((entry) => ({
          domain: text(node(entry).domain).toLowerCase(),
          scope: optional(node(entry).scope),
          result: text(node(entry).result).toLowerCase(),
        })),
      },
    ];
  });

  return {
    orgName: text(metadata.org_name) || "Unknown reporter",
    reporterEmail: optional(metadata.email),
    reportId,
    beginAt: unixDate(range.begin),
    endAt: unixDate(range.end),
    policy: {
      domain,
      p: optional(published.p),
      sp: optional(published.sp),
      pct: optional(published.pct),
      adkim: optional(published.adkim),
      aspf: optional(published.aspf),
    },
    records,
  };
}

export const dmarcPassed = (record: Pick<ParsedDmarcRecord, "dkim" | "spf">) => record.dkim === "pass" || record.spf === "pass";

type TeamDomain = { id: number; name: string; dkimSelector: string | null };

function sentByByteSend(record: ParsedDmarcRecord, domain: TeamDomain | undefined) {
  if (!domain) return false;
  const selector = domain.dkimSelector ?? "bytesend";
  return (
    record.dkimResults.some((r) => r.domain === domain.name && r.selector === selector && r.result === "pass") ||
    record.spfResults.some((r) => r.domain.endsWith(`mail.${domain.name}`) && r.result === "pass")
  );
}

async function reverseLookups(ips: string[]) {
  const hosts = new Map<string, string>();
  const unique = [...new Set(ips)].slice(0, MAX_REVERSE_LOOKUPS);
  for (let i = 0; i < unique.length; i += 20) {
    await Promise.all(
      unique.slice(i, i + 20).map(async (ip) => {
        const host = await Promise.race([
          dns.reverse(ip).then((names) => names[0] ?? null, () => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
        ]);
        if (host) hosts.set(ip, host.replace(/\.$/, "").toLowerCase());
      }),
    );
  }
  return hosts;
}

export async function storeDmarcReport(teamId: number, report: ParsedDmarcReport) {
  const domains = await db.domain.findMany({ where: { teamId }, select: { id: true, name: true, dkimSelector: true } });
  const orgDomain = tldts.getDomain(report.policy.domain) ?? report.policy.domain;
  const owned = domains.filter((d) => d.name === report.policy.domain || tldts.getDomain(d.name) === orgDomain);
  if (owned.length === 0) {
    logger.info({ teamId, domain: report.policy.domain }, "[DMARC]: Report for a domain this team doesn't have, ignored");
    return null;
  }

  const existing = await db.dmarcReport.findUnique({
    where: { teamId_orgName_reportId: { teamId, orgName: report.orgName, reportId: report.reportId } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const exact = owned.find((d) => d.name === report.policy.domain);
  const domainFor = (headerFrom: string) => owned.find((d) => d.name === headerFrom) ?? exact;
  const hosts = await reverseLookups(report.records.map((r) => r.sourceIp));

  const created = await db.dmarcReport.create({
    data: {
      teamId,
      domainId: exact?.id ?? null,
      domain: report.policy.domain,
      orgName: report.orgName,
      reporterEmail: report.reporterEmail,
      reportId: report.reportId,
      beginAt: report.beginAt,
      endAt: report.endAt,
      policy: report.policy as Prisma.InputJsonValue,
      messageCount: report.records.reduce((sum, r) => sum + r.count, 0),
      passCount: report.records.filter(dmarcPassed).reduce((sum, r) => sum + r.count, 0),
      records: {
        create: report.records.map((record) => ({
          sourceIp: record.sourceIp,
          sourceHost: hosts.get(record.sourceIp) ?? null,
          count: record.count,
          disposition: record.disposition,
          dkim: record.dkim,
          spf: record.spf,
          headerFrom: record.headerFrom,
          envelopeFrom: record.envelopeFrom,
          dkimResults: record.dkimResults as Prisma.InputJsonValue,
          spfResults: record.spfResults as Prisma.InputJsonValue,
          viaByteSend: sentByByteSend(record, domainFor(record.headerFrom)),
        })),
      },
    },
    select: { id: true },
  });
  return created.id;
}

export async function ingestDmarcMessage(teamId: number, parsed: ParsedMail, verdicts: { spf: string | null; dkim: string | null }) {
  if (verdicts.spf !== "pass" && verdicts.dkim !== "pass") {
    logger.info({ teamId, from: parsed.from?.text }, "[DMARC]: Sender not authenticated, report ignored");
    return 0;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await db.dmarcReport.count({ where: { teamId, createdAt: { gte: since } } })) >= MAX_REPORTS_PER_TEAM_PER_DAY) {
    logger.warn({ teamId }, "[DMARC]: Daily report limit reached, report ignored");
    return 0;
  }

  let stored = 0;
  for (const xml of extractReportXml(parsed.attachments)) {
    try {
      if (await storeDmarcReport(teamId, parseAggregateReport(xml))) stored++;
    } catch (error) {
      logger.warn({ err: error, teamId }, "[DMARC]: Couldn't read report");
    }
  }
  return stored;
}

export async function deleteExpiredDmarcReports() {
  const cutoff = new Date(Date.now() - DMARC_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await db.dmarcReport.deleteMany({ where: { endAt: { lt: cutoff } } });
  return count;
}

export type DmarcSource = {
  sourceIp: string;
  sourceHost: string | null;
  headerFrom: string;
  messages: number;
  dkimPass: number;
  spfPass: number;
  dmarcPass: number;
  viaByteSend: boolean;
  quarantined: number;
  rejected: number;
};

export async function getDmarcSummary(teamId: number, since: Date, domain?: string) {
  const reportWhere: Prisma.DmarcReportWhereInput = { teamId, endAt: { gte: since }, ...(domain ? { domain } : {}) };

  const [reports, records] = await Promise.all([
    db.dmarcReport.findMany({
      where: reportWhere,
      select: { domain: true, beginAt: true, messageCount: true, passCount: true },
    }),
    db.dmarcRecord.findMany({
      where: { report: reportWhere },
      select: { sourceIp: true, sourceHost: true, headerFrom: true, count: true, dkim: true, spf: true, disposition: true, viaByteSend: true },
    }),
  ]);

  const sources = new Map<string, DmarcSource>();
  for (const record of records) {
    const key = `${record.sourceIp}|${record.headerFrom}`;
    const source = sources.get(key) ?? {
      sourceIp: record.sourceIp,
      sourceHost: record.sourceHost,
      headerFrom: record.headerFrom,
      messages: 0,
      dkimPass: 0,
      spfPass: 0,
      dmarcPass: 0,
      viaByteSend: false,
      quarantined: 0,
      rejected: 0,
    };
    source.messages += record.count;
    if (record.dkim === "pass") source.dkimPass += record.count;
    if (record.spf === "pass") source.spfPass += record.count;
    if (dmarcPassed(record)) source.dmarcPass += record.count;
    if (record.disposition === "quarantine") source.quarantined += record.count;
    if (record.disposition === "reject") source.rejected += record.count;
    source.viaByteSend ||= record.viaByteSend;
    source.sourceHost ??= record.sourceHost;
    sources.set(key, source);
  }

  const daily = new Map<string, { date: string; pass: number; fail: number }>();
  for (const report of reports) {
    const date = report.beginAt.toISOString().slice(0, 10);
    const day = daily.get(date) ?? { date, pass: 0, fail: 0 };
    day.pass += report.passCount;
    day.fail += report.messageCount - report.passCount;
    daily.set(date, day);
  }

  const messages = reports.reduce((sum, r) => sum + r.messageCount, 0);
  const passed = reports.reduce((sum, r) => sum + r.passCount, 0);
  return {
    totals: { reports: reports.length, messages, passed, failed: messages - passed },
    domains: [...new Set(reports.map((r) => r.domain))].sort(),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    sources: [...sources.values()].sort((a, b) => b.messages - a.messages),
  };
}

export async function checkDmarcRecord(domain: string, reportAddress: string | null) {
  const orgDomain = tldts.getDomain(domain) ?? domain;
  let record: string | null = null;
  try {
    const answers = await dns.resolveTxt(`_dmarc.${orgDomain}`);
    record = answers.map((chunks) => chunks.join("")).find((value) => value.toLowerCase().startsWith("v=dmarc1")) ?? null;
  } catch {
    record = null;
  }
  const reportsToUs = Boolean(record && reportAddress && record.toLowerCase().includes(`mailto:${reportAddress.toLowerCase()}`));
  return { orgDomain, record, reportsToUs, suggested: suggestRecord(record, reportAddress) };
}

export function suggestRecord(current: string | null, reportAddress: string | null) {
  if (!reportAddress) return null;
  const mailto = `mailto:${reportAddress}`;
  if (!current) return `v=DMARC1; p=none; rua=${mailto}`;
  const tags = current.split(";").map((tag) => tag.trim()).filter(Boolean);
  const rua = tags.findIndex((tag) => tag.toLowerCase().startsWith("rua="));
  if (rua === -1) tags.push(`rua=${mailto}`);
  else if (!tags[rua]!.toLowerCase().includes(mailto.toLowerCase())) tags[rua] = `${tags[rua]},${mailto}`;
  return tags.join("; ");
}
