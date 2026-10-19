import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolve4 } = vi.hoisted(() => ({ mockResolve4: vi.fn() }));

vi.mock("dns", () => ({ default: { promises: { resolve4: mockResolve4 } } }));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/logger/log", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
vi.mock("~/env", () => ({ env: { SPAMHAUS_DQS_KEY: undefined } }));

import {
  BLACKLISTS,
  classifyBitmaskList,
  classifySpamhausDbl,
  lookupDomain,
} from "~/server/service/blacklist-service";

const dbl = BLACKLISTS.find((list) => list.id === "spamhaus-dbl")!;
const surbl = BLACKLISTS.find((list) => list.id === "surbl")!;

function dnsError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("classifySpamhausDbl", () => {
  it("treats 127.0.1.x as listed", () => {
    expect(classifySpamhausDbl("127.0.1.2")).toBe("LISTED");
    expect(classifySpamhausDbl("127.0.1.102")).toBe("LISTED");
  });

  it("treats refused / rate-limited queries as errors, not listings", () => {
    expect(classifySpamhausDbl("127.255.255.254")).toBe("ERROR");
    expect(classifySpamhausDbl("127.255.255.255")).toBe("ERROR");
  });
});

describe("classifyBitmaskList", () => {
  it("treats 127.0.0.1 as a refused query", () => {
    expect(classifyBitmaskList("127.0.0.1")).toBe("ERROR");
  });

  it("treats other 127.0.0.x answers as listings", () => {
    expect(classifyBitmaskList("127.0.0.2")).toBe("LISTED");
    expect(classifyBitmaskList("127.0.0.64")).toBe("LISTED");
  });
});

describe("lookupDomain", () => {
  beforeEach(() => {
    mockResolve4.mockReset();
  });

  it("queries the public DBL zone when no DQS key is configured", async () => {
    mockResolve4.mockRejectedValue(dnsError("ENOTFOUND"));
    await lookupDomain("example.com", dbl);
    expect(mockResolve4).toHaveBeenCalledWith("example.com.dbl.spamhaus.org");
  });

  it("is clean when the list has no record", async () => {
    mockResolve4.mockRejectedValue(dnsError("ENOTFOUND"));
    await expect(lookupDomain("example.com", dbl)).resolves.toEqual({
      list: "spamhaus-dbl",
      status: "CLEAN",
      returnCode: null,
    });
  });

  it("reports a listing with its return code", async () => {
    mockResolve4.mockResolvedValue(["127.0.1.4"]);
    await expect(lookupDomain("bad.example", dbl)).resolves.toEqual({
      list: "spamhaus-dbl",
      status: "LISTED",
      returnCode: "127.0.1.4",
    });
  });

  it("does not report a refused public-resolver query as clean", async () => {
    mockResolve4.mockResolvedValue(["127.0.0.1"]);
    await expect(lookupDomain("example.com", surbl)).resolves.toMatchObject({ status: "ERROR" });
  });

  it("reports network failures as errors", async () => {
    mockResolve4.mockRejectedValue(dnsError("ESERVFAIL"));
    await expect(lookupDomain("example.com", dbl)).resolves.toMatchObject({ status: "ERROR" });
  });
});
