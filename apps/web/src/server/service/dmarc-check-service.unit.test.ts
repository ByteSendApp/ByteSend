import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveTxt } = vi.hoisted(() => ({ mockResolveTxt: vi.fn() }));
vi.mock("node:dns", () => ({ promises: { resolveTxt: mockResolveTxt } }));

import { analyzeDmarc, checkDomainDmarc, normalizeDomainInput } from "./dmarc-check-service";

describe("normalizeDomainInput", () => {
  it("accepts domains, URLs and email addresses", () => {
    expect(normalizeDomainInput("Example.COM")).toEqual({ host: "example.com", orgDomain: "example.com" });
    expect(normalizeDomainInput("https://mail.example.co.uk/path")).toEqual({ host: "mail.example.co.uk", orgDomain: "example.co.uk" });
    expect(normalizeDomainInput("jane@example.com")).toEqual({ host: "example.com", orgDomain: "example.com" });
  });

  it("rejects things that aren't public domains", () => {
    expect(normalizeDomainInput("localhost")).toBeNull();
    expect(normalizeDomainInput("10.0.0.1")).toBeNull();
    expect(normalizeDomainInput("not a domain")).toBeNull();
  });
});

describe("analyzeDmarc", () => {
  it("flags a missing record and suggests a monitoring one", () => {
    const result = analyzeDmarc([], "example.com");
    expect(result.grade).toBe("missing");
    expect(result.suggestion).toBe("v=DMARC1; p=none; rua=mailto:dmarc@example.com");
  });

  it("treats duplicate records as invalid", () => {
    expect(analyzeDmarc(["v=DMARC1; p=none", "v=DMARC1; p=reject"], "example.com").grade).toBe("invalid");
  });

  it("grades policies and keeps an existing one in the suggestion", () => {
    const monitoring = analyzeDmarc(["v=DMARC1; p=none;"], "example.com");
    expect(monitoring.grade).toBe("monitoring");
    expect(monitoring.suggestion).toBe("v=DMARC1; p=none; rua=mailto:dmarc@example.com");

    expect(analyzeDmarc(["v=DMARC1; p=quarantine; pct=50; rua=mailto:a@b.com"], "example.com").grade).toBe("partial");
    expect(analyzeDmarc(["v=DMARC1; p=reject; sp=none; rua=mailto:a@b.com"], "example.com").grade).toBe("partial");

    const enforced = analyzeDmarc(["v=DMARC1; p=reject; rua=mailto:a@b.com"], "example.com");
    expect(enforced.grade).toBe("enforced");
    expect(enforced.suggestion).toBeNull();
  });

  it("ignores unrelated TXT records", () => {
    expect(analyzeDmarc(["google-site-verification=abc"], "example.com").grade).toBe("missing");
  });

  it("calls out an invalid policy", () => {
    expect(analyzeDmarc(["v=DMARC1; p=block"], "example.com").grade).toBe("invalid");
  });
});

describe("checkDomainDmarc", () => {
  beforeEach(() => mockResolveTxt.mockReset());

  it("falls back to the organisational domain like mail providers do", async () => {
    mockResolveTxt.mockImplementation(async (name: string) => {
      if (name === "_dmarc.example.com") return [["v=DMARC1; p=reject; rua=mailto:a@b.com"]];
      throw Object.assign(new Error("none"), { code: "ENOTFOUND" });
    });
    const result = await checkDomainDmarc("mail.example.com");
    expect(result).toMatchObject({ domain: "mail.example.com", lookedUp: "example.com", inherited: true, grade: "enforced" });
  });

  it("joins records split across several strings", async () => {
    mockResolveTxt.mockResolvedValue([["v=DMARC1; p=quar", "antine; rua=mailto:a@b.com"]]);
    expect((await checkDomainDmarc("example.com")).grade).toBe("enforced");
  });
});
