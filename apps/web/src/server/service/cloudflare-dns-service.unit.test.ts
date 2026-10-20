import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Domain } from "@prisma/client";

vi.mock("../logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("./domain-service", () => ({
  buildDnsRecords: (domain: Domain) => [
    { type: "MX", name: "mail", value: `feedback-smtp.${domain.region}.amazonses.com`, priority: "10" },
    { type: "TXT", name: "bytesend._domainkey", value: `p=${domain.publicKey}` },
    { type: "TXT", name: "mail", value: "v=spf1 include:amazonses.com ~all" },
    { type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none;" },
  ],
}));
vi.mock("./inbound-domain-service", () => ({ receivingRecords: () => [] }));

import { CloudflareError, desiredRecords, normalizeTxt, planRecord, quoteTxt, setUpDomainOnCloudflare } from "./cloudflare-dns-service";

const domain = { id: 1, name: "acme.com", region: "us-east-1", publicKey: "KEY", inboundEnabled: false } as unknown as Domain;
const byKind = (kind: string) => desiredRecords(domain).find((r) => r.kind === kind)!;
const record = (type: string, content: string, id = "rec") => ({ id, type, name: "x", content });

describe("TXT values", () => {
  it("splits long values into 255-character quoted strings and reads them back", () => {
    const long = "p=" + "A".repeat(400);
    const quoted = quoteTxt(long);
    expect(quoted).toMatch(/^"p=A{253}" "A{147}"$/);
    expect(normalizeTxt(quoted)).toBe(long);
    expect(normalizeTxt("v=spf1 ~all")).toBe("v=spf1 ~all");
  });
});

describe("desiredRecords", () => {
  it("names records in the zone", () => {
    expect(desiredRecords(domain).map((r) => `${r.type} ${r.name}`)).toEqual([
      "MX mail.acme.com",
      "TXT bytesend._domainkey.acme.com",
      "TXT mail.acme.com",
      "TXT _dmarc.acme.com",
    ]);
  });
});

describe("planRecord", () => {
  it("creates missing records and skips ones already right", () => {
    expect(planRecord(byKind("mx"), []).action).toBe("create");
    expect(planRecord(byKind("mx"), [record("MX", "feedback-smtp.us-east-1.amazonses.com")]).action).toBe("none");
    expect(planRecord(byKind("dkim"), [record("TXT", '"p=KEY"')]).action).toBe("none");
  });

  it("never replaces someone else's MX or SPF", () => {
    expect(planRecord(byKind("mx"), [record("MX", "mx.google.com")])).toMatchObject({ action: "conflict" });
    expect(planRecord(byKind("spf"), [record("TXT", "v=spf1 include:_spf.google.com ~all")])).toMatchObject({ action: "conflict" });
    expect(planRecord(byKind("spf"), [record("TXT", "v=spf1 include:amazonses.com include:x ~all")]).action).toBe("none");
  });

  it("keeps an existing DMARC policy and updates a stale DKIM key", () => {
    expect(planRecord(byKind("dmarc"), [record("TXT", "v=DMARC1; p=reject")]).action).toBe("none");
    expect(planRecord(byKind("dkim"), [record("TXT", "p=OLDKEY", "dkim1")])).toEqual({ action: "update", id: "dkim1" });
  });
});

describe("setUpDomainOnCloudflare", () => {
  const fetchMock = vi.fn();
  const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }), { status: 200 });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("finds the zone and adds what's missing", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/zones?name=")) return ok([{ id: "z1", name: "acme.com" }]);
      if (init?.method === "POST") return ok({ id: "new" });
      if (url.includes("_dmarc")) return ok([record("TXT", "v=DMARC1; p=quarantine")]);
      return ok([]);
    });
    const outcomes = await setUpDomainOnCloudflare(domain, "token-1234567890abcdefghij");
    expect(outcomes.map((o) => o.status)).toEqual(["created", "created", "created", "exists"]);
    const created = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").map(([, init]) => JSON.parse(init.body));
    expect(created[0]).toMatchObject({ type: "MX", name: "mail.acme.com", priority: 10, proxied: false });
    expect(created[1]).toMatchObject({ type: "TXT", content: '"p=KEY"' });
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe("Bearer token-1234567890abcdefghij");
  });

  it("explains a rejected token or a zone the token can't see", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, errors: [] }), { status: 403 }));
    await expect(setUpDomainOnCloudflare(domain, "t")).rejects.toThrow(CloudflareError);
    fetchMock.mockResolvedValueOnce(ok([]));
    await expect(setUpDomainOnCloudflare(domain, "t")).rejects.toThrow(/can't see acme.com/);
  });
});
