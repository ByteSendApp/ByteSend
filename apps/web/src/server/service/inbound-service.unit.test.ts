import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockStore, mockEmit, mockSendEmail, mockIngestDmarc, mockRecordCanary, env } = vi.hoisted(() => ({
  mockDb: {
    team: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    domain: { findFirst: vi.fn(), findUnique: vi.fn() },
    email: { findFirst: vi.fn() },
    inboundEmail: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    inboundForwardRule: { findMany: vi.fn() },
  },
  mockStore: { get: vi.fn(), put: vi.fn(), remove: vi.fn() },
  mockEmit: vi.fn(),
  mockSendEmail: vi.fn(),
  mockIngestDmarc: vi.fn(),
  mockRecordCanary: vi.fn(),
  env: {
    INBOUND_HOSTED_DOMAIN: "in.bytesend.test",
    INBOUND_REGION: "us-east-1",
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "https://app.example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("~/env", () => ({ env }));
vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("./inbound-storage", () => ({ getInboundStore: () => mockStore }));
vi.mock("./webhook-service", () => ({ WebhookService: { emit: mockEmit } }));
vi.mock("./email-service", () => ({ sendEmail: mockSendEmail }));
vi.mock("../aws/ses-receiving", () => ({ INBOUND_RAW_PREFIX: "raw/" }));
vi.mock("./inbound-canary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./inbound-canary")>()),
  recordInboundCanary: mockRecordCanary,
}));
vi.mock("./dmarc-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dmarc-service")>()),
  ingestDmarcMessage: mockIngestDmarc,
}));

import {
  attachmentUrl,
  processInbound,
  resolveRecipient,
  ruleMatches,
  verifyAttachmentSignature,
  type SesInboundNotification,
} from "./inbound-service";

function mime({ to, inReplyTo, attachment }: { to: string; inReplyTo?: string; attachment?: boolean }) {
  const lines = [
    "From: Jane Doe <jane@example.com>",
    `To: ${to}`,
    "Subject: Order question",
    "Message-ID: <abc@example.com>",
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="b"',
    "",
    "--b",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Where is my order?",
    ...(attachment
      ? ["--b", 'Content-Type: text/plain; name="note.txt"', 'Content-Disposition: attachment; filename="note.txt"', "Content-Transfer-Encoding: base64", "", Buffer.from("hello").toString("base64")]
      : []),
    "--b--",
    "",
  ];
  return Buffer.from(lines.join("\r\n"));
}

function notification(to: string, raw: Buffer): SesInboundNotification {
  return {
    notificationType: "Received",
    mail: { messageId: "ses-123", timestamp: new Date().toISOString(), source: "jane@example.com", destination: [to] },
    receipt: {
      recipients: [to],
      spamVerdict: { status: "PASS" },
      virusVerdict: { status: "PASS" },
      spfVerdict: { status: "PASS" },
      dkimVerdict: { status: "PASS" },
      dmarcVerdict: { status: "PASS" },
      action: { type: "SNS", encoding: "BASE64" },
    },
    content: raw.toString("base64"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.team.findUnique.mockImplementation(async ({ where }: { where: { inboundSlug?: string; id?: number } }) => {
    if (where.inboundSlug === "acme") return { id: 7 };
    if (where.id === 7) return { plan: "FREE" };
    return null;
  });
  mockDb.domain.findFirst.mockResolvedValue(null);
  mockDb.inboundEmail.findUnique.mockResolvedValue(null);
  mockDb.inboundEmail.count.mockResolvedValue(0);
  mockDb.inboundEmail.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, receivedAt: new Date() }));
  mockDb.inboundEmail.findUniqueOrThrow.mockImplementation(async () => mockDb.inboundEmail.create.mock.results.at(-1)!.value);
  mockDb.inboundForwardRule.findMany.mockResolvedValue([]);
  mockDb.email.findFirst.mockResolvedValue(null);
});

describe("resolveRecipient", () => {
  it("matches a team's hosted address, ignoring +tags", async () => {
    await expect(resolveRecipient("Acme+orders@In.ByteSend.test")).resolves.toEqual({
      teamId: 7,
      domainId: null,
      recipient: "acme+orders@in.bytesend.test",
    });
  });

  it("matches a domain's inbound subdomain", async () => {
    mockDb.domain.findFirst.mockResolvedValue({ id: 3, teamId: 9 });
    await expect(resolveRecipient("support@reply.acme.com")).resolves.toEqual({ teamId: 9, domainId: 3, recipient: "support@reply.acme.com" });
    expect(mockDb.domain.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "acme.com", inboundEnabled: true, inboundSubdomain: "reply" } }),
    );
  });

  it("matches a domain that receives on the domain itself", async () => {
    mockDb.domain.findFirst.mockImplementation(async ({ where }: { where: { name: string; inboundSubdomain: string } }) =>
      where.name === "acme.com" && where.inboundSubdomain === "@" ? { id: 4, teamId: 11 } : null,
    );
    await expect(resolveRecipient("Hey@Acme.com")).resolves.toEqual({ teamId: 11, domainId: 4, recipient: "hey@acme.com" });
  });

  it("prefers a receiving subdomain over a domain of the same name", async () => {
    mockDb.domain.findFirst.mockImplementation(async ({ where }: { where: { name: string; inboundSubdomain: string } }) => {
      if (where.name === "acme.com" && where.inboundSubdomain === "reply") return { id: 3, teamId: 9 };
      if (where.name === "reply.acme.com" && where.inboundSubdomain === "@") return { id: 8, teamId: 12 };
      return null;
    });
    await expect(resolveRecipient("support@reply.acme.com")).resolves.toMatchObject({ teamId: 9, domainId: 3 });
  });

  it("ignores addresses nobody owns", async () => {
    await expect(resolveRecipient("someone@in.bytesend.test")).resolves.toBeNull();
    await expect(resolveRecipient("someone@acme.com")).resolves.toBeNull();
  });
});

describe("forwarding rules", () => {
  it("matches *, local parts and full addresses", () => {
    expect(ruleMatches("*", "a@reply.acme.com")).toBe(true);
    expect(ruleMatches("support", "support+1@reply.acme.com")).toBe(true);
    expect(ruleMatches("support", "sales@reply.acme.com")).toBe(false);
    expect(ruleMatches("Support@Reply.Acme.com", "support@reply.acme.com")).toBe(true);
  });
});

describe("attachment links", () => {
  it("accepts its own signature and rejects tampering or expiry", () => {
    const url = new URL(attachmentUrl("inb_1", "att_1"));
    const expires = Number(url.searchParams.get("expires"));
    const sig = url.searchParams.get("sig")!;
    expect(url.pathname).toBe("/api/inbound/attachments/inb_1/att_1");
    expect(verifyAttachmentSignature("inb_1", "att_1", expires, sig)).toBe(true);
    expect(verifyAttachmentSignature("inb_1", "att_2", expires, sig)).toBe(false);
    expect(verifyAttachmentSignature("inb_1", "att_1", expires + 1, sig)).toBe(false);
    expect(verifyAttachmentSignature("inb_1", "att_1", Math.floor(Date.now() / 1000) - 10, sig)).toBe(false);
  });
});

describe("processInbound", () => {
  it("stores the message and its attachments, then fires email.received", async () => {
    const raw = mime({ to: "acme@in.bytesend.test", attachment: true });
    await expect(processInbound(notification("acme@in.bytesend.test", raw))).resolves.toEqual({ stored: 1, reports: 0 });

    expect(mockStore.put).toHaveBeenCalledWith("raw/ses-123", raw, "message/rfc822");
    const data = mockDb.inboundEmail.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      teamId: 7,
      recipient: "acme@in.bytesend.test",
      from: "jane@example.com",
      fromName: "Jane Doe",
      subject: "Order question",
      sesMessageId: "ses-123:7",
      spfVerdict: "pass",
    });
    expect(data.text).toContain("Where is my order?");
    expect(data.attachments).toHaveLength(1);
    expect(data.attachments[0]).toMatchObject({ filename: "note.txt", size: 5 });
    expect(mockStore.put).toHaveBeenCalledWith(data.attachments[0].key, Buffer.from("hello"), "text/plain");

    expect(mockEmit).toHaveBeenCalledWith(7, "email.received", expect.objectContaining({ subject: "Order question" }), { domainId: null });
    const payload = mockEmit.mock.calls[0]![2];
    expect(payload.attachments[0].url).toMatch(/^https:\/\/app\.example\.com\/api\/inbound\/attachments\//);
  });

  it("links a reply to the email it answers", async () => {
    mockDb.email.findFirst.mockResolvedValue({ id: "email_sent_1" });
    await processInbound(notification("acme@in.bytesend.test", mime({ to: "acme@in.bytesend.test", inReplyTo: "<0100018f-abc@us-east-1.amazonses.com>" })));
    expect(mockDb.email.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: 7, sesEmailId: { in: ["0100018f-abc"] } } }));
    expect(mockDb.inboundEmail.create.mock.calls[0]![0].data.inReplyToEmailId).toBe("email_sent_1");
  });

  it("drops mail once the monthly allowance is used", async () => {
    mockDb.inboundEmail.count.mockResolvedValue(1_000);
    await expect(processInbound(notification("acme@in.bytesend.test", mime({ to: "acme@in.bytesend.test" })))).resolves.toEqual({ stored: 0, reports: 0 });
    expect(mockDb.inboundEmail.create).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("drops mail for unknown addresses without reading it", async () => {
    await expect(processInbound(notification("nobody@in.bytesend.test", mime({ to: "nobody@in.bytesend.test" })))).resolves.toEqual({ stored: 0, reports: 0 });
    expect(mockStore.put).not.toHaveBeenCalled();
  });

  it("does nothing when SNS redelivers a message already stored", async () => {
    mockDb.inboundEmail.findUnique.mockResolvedValue({ id: "inb_existing" });
    await expect(processInbound(notification("acme@in.bytesend.test", mime({ to: "acme@in.bytesend.test" })))).resolves.toEqual({ stored: 0, reports: 0 });
    expect(mockDb.inboundEmail.create).not.toHaveBeenCalled();
  });

  it("records the status canary without storing it anywhere", async () => {
    const result = await processInbound(notification("status-canary@in.bytesend.test", mime({ to: "status-canary@in.bytesend.test" })));
    expect(result).toEqual({ stored: 0, reports: 0 });
    expect(mockRecordCanary).toHaveBeenCalledTimes(1);
    expect(mockDb.inboundEmail.create).not.toHaveBeenCalled();
    expect(mockDb.team.findUnique).not.toHaveBeenCalled();
  });

  it("sends mail for the DMARC address to the report parser, not the inbox", async () => {
    mockIngestDmarc.mockResolvedValue(1);
    const raw = mime({ to: "acme+dmarc@in.bytesend.test" });
    await expect(processInbound(notification("acme+dmarc@in.bytesend.test", raw))).resolves.toEqual({ stored: 0, reports: 1 });
    expect(mockIngestDmarc).toHaveBeenCalledWith(7, expect.objectContaining({ subject: "Order question" }), { spf: "pass", dkim: "pass" });
    expect(mockDb.inboundEmail.create).not.toHaveBeenCalled();
    expect(mockDb.inboundEmail.count).not.toHaveBeenCalled();
    expect(mockStore.remove).toHaveBeenCalledWith(["raw/ses-123"]);
  });

  it("keeps the raw message when a stored email points at it", async () => {
    await processInbound(notification("acme@in.bytesend.test", mime({ to: "acme@in.bytesend.test" })));
    expect(mockStore.remove).not.toHaveBeenCalled();
  });

  it("forwards matching mail from the team's verified domain", async () => {
    mockDb.inboundForwardRule.findMany.mockResolvedValue([{ match: "*", forwardTo: "Help@Desk.com" }]);
    mockDb.domain.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.status === "SUCCESS" ? { name: "acme.com", status: "SUCCESS" } : null,
    );
    await processInbound(notification("acme@in.bytesend.test", mime({ to: "acme@in.bytesend.test" })));
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 7,
        from: '"Jane Doe via ByteSend" <forwarding@acme.com>',
        to: ["help@desk.com"],
        replyTo: ["jane@example.com"],
        subject: "Order question",
      }),
    );
    expect(mockDb.inboundEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FORWARDED", forwardedTo: ["help@desk.com"] } }),
    );
  });
});
