import { crc32, deflateRawSync, gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockDns } = vi.hoisted(() => ({
  mockDb: {
    domain: { findMany: vi.fn() },
    dmarcReport: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
  mockDns: { reverse: vi.fn(), resolveTxt: vi.fn() },
}));

vi.mock("~/env", () => ({ env: { INBOUND_HOSTED_DOMAIN: "in.bytesend.test" } }));
vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("node:dns", () => ({ promises: mockDns }));

import {
  extractReportXml,
  hostedDmarcAddress,
  ingestDmarcMessage,
  isDmarcRecipient,
  parseAggregateReport,
  storeDmarcReport,
  suggestRecord,
} from "./dmarc-service";
import type { ParsedMail } from "mailparser";

const REPORT = `<?xml version="1.0" encoding="UTF-8" ?>
<feedback>
  <report_metadata>
    <org_name>google.com</org_name>
    <email>noreply-dmarc-support@google.com</email>
    <report_id>1234567890</report_id>
    <date_range><begin>1792368000</begin><end>1792454399</end></date_range>
  </report_metadata>
  <policy_published>
    <domain>acme.com</domain><adkim>r</adkim><aspf>r</aspf><p>none</p><sp>none</sp><pct>100</pct>
  </policy_published>
  <record>
    <row>
      <source_ip>54.240.8.1</source_ip><count>120</count>
      <policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated>
    </row>
    <identifiers><header_from>acme.com</header_from></identifiers>
    <auth_results>
      <dkim><domain>acme.com</domain><selector>bytesend</selector><result>pass</result></dkim>
      <dkim><domain>amazonses.com</domain><selector>abc</selector><result>pass</result></dkim>
      <spf><domain>mail.acme.com</domain><result>pass</result></spf>
    </auth_results>
  </record>
  <record>
    <row>
      <source_ip>203.0.113.9</source_ip><count>4</count>
      <policy_evaluated><disposition>quarantine</disposition><dkim>fail</dkim><spf>fail</spf></policy_evaluated>
    </row>
    <identifiers><header_from>acme.com</header_from></identifiers>
    <auth_results><spf><domain>spoofer.example</domain><result>fail</result></spf></auth_results>
  </record>
</feedback>`;

function javaStyleZip(name: string, content: Buffer) {
  const data = deflateRawSync(content);
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x08, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(nameBytes.length, 26);
  const descriptor = Buffer.alloc(16);
  descriptor.writeUInt32LE(0x08074b50, 0);
  descriptor.writeUInt32LE(crc32(content), 4);
  descriptor.writeUInt32LE(data.length, 8);
  descriptor.writeUInt32LE(content.length, 12);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x08, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc32(content), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const body = Buffer.concat([local, nameBytes, data, descriptor]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, central, nameBytes, end]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDns.reverse.mockImplementation(async (ip: string) => (ip === "54.240.8.1" ? ["a8-1.smtp-out.amazonses.com."] : []));
  mockDb.domain.findMany.mockResolvedValue([{ id: 3, name: "acme.com", dkimSelector: "bytesend" }]);
  mockDb.dmarcReport.findUnique.mockResolvedValue(null);
  mockDb.dmarcReport.count.mockResolvedValue(0);
  mockDb.dmarcReport.create.mockResolvedValue({ id: "rep_1" });
});

describe("addresses", () => {
  it("recognises the hosted +dmarc tag and dmarc@ on receiving subdomains", () => {
    expect(isDmarcRecipient("acme+dmarc@in.bytesend.test", true)).toBe(true);
    expect(isDmarcRecipient("acme@in.bytesend.test", true)).toBe(false);
    expect(isDmarcRecipient("dmarc@reply.acme.com", false)).toBe(true);
    expect(isDmarcRecipient("support@reply.acme.com", false)).toBe(false);
    expect(hostedDmarcAddress("acme")).toBe("acme+dmarc@in.bytesend.test");
  });
});

describe("parseAggregateReport", () => {
  it("reads metadata, policy and every record", () => {
    const report = parseAggregateReport(REPORT);
    expect(report).toMatchObject({
      orgName: "google.com",
      reportId: "1234567890",
      policy: { domain: "acme.com", p: "none", pct: "100" },
    });
    expect(report.beginAt.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(report.records).toHaveLength(2);
    expect(report.records[0]).toMatchObject({ sourceIp: "54.240.8.1", count: 120, dkim: "pass", spf: "pass" });
    expect(report.records[0]!.dkimResults).toEqual([
      { domain: "acme.com", selector: "bytesend", result: "pass" },
      { domain: "amazonses.com", selector: "abc", result: "pass" },
    ]);
    expect(report.records[1]).toMatchObject({ disposition: "quarantine", dkimResults: [], spfResults: [{ domain: "spoofer.example", scope: null, result: "fail" }] });
  });

  it("handles a single record and namespaced (DMARCbis) documents", () => {
    const namespaced = REPORT.replace("<feedback>", '<d:feedback xmlns:d="urn:ietf:params:xml:ns:dmarc-2.0">')
      .replace("</feedback>", "</d:feedback>")
      .replace(/<record>[\s\S]*?<\/record>\s*(?=<record>)/, "");
    const report = parseAggregateReport(namespaced);
    expect(report.records).toHaveLength(1);
    expect(report.records[0]!.sourceIp).toBe("203.0.113.9");
  });

  it("rejects documents that aren't reports", () => {
    expect(() => parseAggregateReport("<html><body>hi</body></html>")).toThrow();
  });
});

describe("extractReportXml", () => {
  it("unpacks plain, gzip and zip attachments and skips anything else", () => {
    const xml = Buffer.from(REPORT);
    const documents = extractReportXml([
      { filename: "report.xml", contentType: "text/xml", content: xml },
      { filename: "report.xml.gz", contentType: "application/gzip", content: gzipSync(xml) },
      { filename: "google.com!acme.com!1!2.zip", contentType: "application/zip", content: javaStyleZip("google.com!acme.com.xml", xml) },
      { filename: "logo.png", contentType: "image/png", content: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    ]);
    expect(documents).toHaveLength(3);
    for (const document of documents) expect(parseAggregateReport(document).reportId).toBe("1234567890");
  });

  it("refuses to inflate past the size limit", () => {
    const bomb = Buffer.alloc(30 * 1024 * 1024);
    expect(extractReportXml([{ filename: "bomb.xml.gz", contentType: "application/gzip", content: gzipSync(bomb) }])).toEqual([]);
    expect(extractReportXml([{ filename: "bomb.zip", contentType: "application/zip", content: javaStyleZip("bomb.xml", bomb) }])).toEqual([]);
  });
});

describe("suggestRecord", () => {
  const address = "acme+dmarc@in.bytesend.test";
  it("proposes a monitoring record when there is none", () => {
    expect(suggestRecord(null, address)).toBe("v=DMARC1; p=none; rua=mailto:acme+dmarc@in.bytesend.test");
  });
  it("keeps the existing policy and adds or appends our address", () => {
    expect(suggestRecord("v=DMARC1; p=reject;", address)).toBe("v=DMARC1; p=reject; rua=mailto:acme+dmarc@in.bytesend.test");
    expect(suggestRecord("v=DMARC1; p=quarantine; rua=mailto:a@b.com", address)).toBe(
      "v=DMARC1; p=quarantine; rua=mailto:a@b.com,mailto:acme+dmarc@in.bytesend.test",
    );
    expect(suggestRecord(`v=DMARC1; p=none; rua=mailto:${address}`, address)).toBe(`v=DMARC1; p=none; rua=mailto:${address}`);
  });
});

describe("storeDmarcReport", () => {
  it("stores the report, tags ByteSend's own traffic and names the source", async () => {
    await expect(storeDmarcReport(7, parseAggregateReport(REPORT))).resolves.toBe("rep_1");
    const data = mockDb.dmarcReport.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ teamId: 7, domainId: 3, domain: "acme.com", messageCount: 124, passCount: 120 });
    expect(data.records.create[0]).toMatchObject({ viaByteSend: true, sourceHost: "a8-1.smtp-out.amazonses.com" });
    expect(data.records.create[1]).toMatchObject({ viaByteSend: false, sourceHost: null });
  });

  it("ignores reports about domains the team doesn't have", async () => {
    mockDb.domain.findMany.mockResolvedValue([{ id: 4, name: "other.com", dkimSelector: "bytesend" }]);
    await expect(storeDmarcReport(7, parseAggregateReport(REPORT))).resolves.toBeNull();
    expect(mockDb.dmarcReport.create).not.toHaveBeenCalled();
  });

  it("accepts a report for the organisational domain of a subdomain the team sends from", async () => {
    mockDb.domain.findMany.mockResolvedValue([{ id: 5, name: "mail.acme.com", dkimSelector: "bytesend" }]);
    await storeDmarcReport(7, parseAggregateReport(REPORT));
    expect(mockDb.dmarcReport.create.mock.calls[0]![0].data).toMatchObject({ domainId: null, domain: "acme.com" });
  });

  it("doesn't store the same report twice", async () => {
    mockDb.dmarcReport.findUnique.mockResolvedValue({ id: "rep_existing" });
    await expect(storeDmarcReport(7, parseAggregateReport(REPORT))).resolves.toBe("rep_existing");
    expect(mockDb.dmarcReport.create).not.toHaveBeenCalled();
  });
});

describe("ingestDmarcMessage", () => {
  const message = { from: { text: "noreply@google.com" }, attachments: [{ filename: "r.xml.gz", contentType: "application/gzip", content: gzipSync(REPORT) }] } as unknown as ParsedMail;

  it("reads reports from authenticated senders", async () => {
    await expect(ingestDmarcMessage(7, message, { spf: "fail", dkim: "pass" })).resolves.toBe(1);
  });

  it("ignores mail whose sender passed neither SPF nor DKIM", async () => {
    await expect(ingestDmarcMessage(7, message, { spf: "fail", dkim: "fail" })).resolves.toBe(0);
    expect(mockDb.dmarcReport.create).not.toHaveBeenCalled();
  });
});
