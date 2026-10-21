import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveTxt } = vi.hoisted(() => ({ mockResolveTxt: vi.fn() }));
vi.mock("node:dns", () => ({ promises: { resolveTxt: mockResolveTxt } }));

import { analyzeDkimKey, checkDomainDkim } from "./dkim-check-service";
import { checkDomainSpf, countSpfLookups, gradeSpf } from "./spf-check-service";

const notFound = () => Object.assign(new Error("none"), { code: "ENOTFOUND" });
const rsaKey = (bits: number) =>
  generateKeyPairSync("rsa", { modulusLength: bits }).publicKey.export({ format: "der", type: "spki" }).toString("base64");

beforeEach(() => mockResolveTxt.mockReset());

describe("SPF", () => {
  it("grades the all mechanism", () => {
    expect(gradeSpf("v=spf1 include:amazonses.com -all", 1).grade).toBe("strict");
    expect(gradeSpf("v=spf1 include:amazonses.com ~all", 1).grade).toBe("softfail");
    expect(gradeSpf("v=spf1 ?all", 0).grade).toBe("neutral");
    expect(gradeSpf("v=spf1 +all", 0).grade).toBe("open");
    expect(gradeSpf("v=spf1 all", 0).grade).toBe("open");
  });

  it("marks more than 10 lookups as broken", () => {
    expect(gradeSpf("v=spf1 ~all", 11).grade).toBe("invalid");
  });

  it("counts lookups through includes, without looping forever", async () => {
    mockResolveTxt.mockImplementation(async (name: string) => {
      if (name === "_spf.google.com") return [["v=spf1 include:_netblocks.google.com include:_spf.google.com ~all"]];
      if (name === "_netblocks.google.com") return [["v=spf1 ip4:35.190.247.0/24 a mx ~all"]];
      throw notFound();
    });
    expect(await countSpfLookups("v=spf1 include:_spf.google.com include:amazonses.com ip4:1.2.3.4 ~all")).toBe(6);
  });

  it("reports a missing record and duplicates", async () => {
    mockResolveTxt.mockRejectedValue(notFound());
    expect((await checkDomainSpf("example.com")).grade).toBe("missing");

    mockResolveTxt.mockResolvedValue([["v=spf1 -all"], ["v=spf1 ~all"], ["google-site-verification=x"]]);
    expect((await checkDomainSpf("example.com")).grade).toBe("invalid");
  });
});

describe("DKIM", () => {
  it("grades keys by size and spots broken ones", () => {
    expect(analyzeDkimKey("s", `v=DKIM1; k=rsa; p=${rsaKey(2048)}`)).toMatchObject({ grade: "strong", bits: 2048 });
    expect(analyzeDkimKey("s", `v=DKIM1; k=rsa; p=${rsaKey(1024)}`)).toMatchObject({ grade: "ok", bits: 1024 });
    expect(analyzeDkimKey("s", "v=DKIM1; p=").grade).toBe("broken");
    expect(analyzeDkimKey("s", "v=DKIM1; p=notakey").grade).toBe("broken");
    expect(analyzeDkimKey("s", `v=DKIM1; t=y; p=${rsaKey(2048)}`).findings.some((f) => f.title.startsWith("Testing"))).toBe(true);
  });

  it("finds keys under common selectors when none is given", async () => {
    const key = rsaKey(2048);
    mockResolveTxt.mockImplementation(async (name: string) => {
      if (name === "google._domainkey.example.com") return [[`v=DKIM1; k=rsa; p=${key.slice(0, 200)}`, key.slice(200)]];
      throw notFound();
    });
    const result = await checkDomainDkim("example.com");
    expect(result.grade).toBe("strong");
    expect(result.keys.map((k) => k.selector)).toEqual(["google"]);
  });

  it("checks only the selector given", async () => {
    mockResolveTxt.mockRejectedValue(notFound());
    const result = await checkDomainDkim("example.com", "selector9._domainkey.example.com");
    expect(result).toMatchObject({ grade: "missing", searched: ["selector9"] });
  });
});
