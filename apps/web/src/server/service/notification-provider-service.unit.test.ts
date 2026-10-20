import { describe, expect, it, vi } from "vitest";

vi.mock("~/env", () => ({ env: {} }));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/redis", () => ({ getRedis: vi.fn(), redisKey: (key: string) => key }));
vi.mock("~/server/logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { providerReceives } from "~/server/service/notification-provider-service";

describe("providerReceives", () => {
  it("sends low-volume alerts to providers with no events selected", () => {
    expect(providerReceives([], "DOMAIN_VERIFIED")).toBe(true);
    expect(providerReceives([], "USAGE_ALERT")).toBe(true);
    expect(providerReceives([], "CAMPAIGN_COMPLETED")).toBe(true);
  });

  it("never sends per-email or contact events unless they were selected", () => {
    expect(providerReceives([], "EMAIL_DELIVERED")).toBe(false);
    expect(providerReceives([], "CONTACT_CREATED")).toBe(false);
    expect(providerReceives(["EMAIL_BOUNCED"], "EMAIL_BOUNCED")).toBe(true);
  });

  it("only sends selected events once a selection is made", () => {
    expect(providerReceives(["EMAIL_BOUNCED"], "DOMAIN_VERIFIED")).toBe(false);
  });
});
