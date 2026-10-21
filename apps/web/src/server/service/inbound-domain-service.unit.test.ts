import { describe, expect, it, vi } from "vitest";
import type { Domain } from "@prisma/client";

const { mockDb } = vi.hoisted(() => ({ mockDb: { domain: { findFirst: vi.fn(), update: vi.fn() } } }));

vi.mock("~/env", () => ({ env: { INBOUND_REGION: "us-east-1", NODE_ENV: "test" } }));
vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../aws/ses", () => ({ deleteDomain: vi.fn() }));
vi.mock("../aws/ses-receiving", () => ({
  createReceivingIdentity: vi.fn(),
  deleteReceivingIdentity: vi.fn(),
  isIdentityVerified: vi.fn(),
  inboundMxHost: () => "inbound-smtp.us-east-1.amazonaws.com",
}));

import { enableReceiving, receivingFqdn, receivingRecords } from "./inbound-domain-service";

const base = {
  id: 1,
  name: "acme.com",
  region: "us-east-1",
  status: "SUCCESS",
  inboundEnabled: true,
  inboundStatus: "PENDING",
  inboundCheckedAt: null,
  inboundDkimSelector: null,
  inboundPublicKey: null,
} as unknown as Domain;

describe("receiving addresses", () => {
  it("builds the address and MX record for a subdomain", () => {
    const domain = { ...base, inboundSubdomain: "reply" };
    expect(receivingFqdn(domain)).toBe("reply.acme.com");
    expect(receivingRecords(domain)).toEqual([{ type: "MX", name: "reply", value: "inbound-smtp.us-east-1.amazonaws.com", priority: 10 }]);
  });

  it("builds the address and records for the domain itself", () => {
    const domain = { ...base, inboundSubdomain: "@", inboundDkimSelector: "bytesend-inbound", inboundPublicKey: "KEY" };
    expect(receivingFqdn(domain)).toBe("acme.com");
    expect(receivingRecords(domain)).toEqual([
      { type: "MX", name: "@", value: "inbound-smtp.us-east-1.amazonaws.com", priority: 10 },
      { type: "TXT", name: "bytesend-inbound._domainkey", value: "p=KEY" },
    ]);
  });
});

describe("enableReceiving", () => {
  it("won't take over a domain's mail without confirmation", async () => {
    mockDb.domain.findFirst.mockResolvedValue({ ...base, inboundEnabled: false, inboundSubdomain: null });
    await expect(enableReceiving(7, 1, "@")).rejects.toThrow(/Confirm/);
    expect(mockDb.domain.update).not.toHaveBeenCalled();
  });

  it("turns on receiving for the domain itself once confirmed", async () => {
    mockDb.domain.findFirst.mockResolvedValue({ ...base, inboundEnabled: false, inboundSubdomain: null });
    mockDb.domain.update.mockImplementation(async ({ data }) => ({ ...base, ...data }));
    await enableReceiving(7, 1, "", true);
    expect(mockDb.domain.update.mock.calls[0]![0].data).toMatchObject({ inboundEnabled: true, inboundSubdomain: "@" });
  });
});
