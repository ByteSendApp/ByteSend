import { describe, expect, it, vi } from "vitest";

vi.mock("~/env", () => ({ env: { INBOUND_REGION: "us-east-1", INBOUND_HOSTED_DOMAIN: "in.bytesend.test" } }));
vi.mock("../logger/log", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../redis", () => ({ withCache: vi.fn(), getRedis: vi.fn(), redisKey: (k: string) => k }));
vi.mock("../aws/ses-receiving", () => ({ getReceivingRuleState: vi.fn() }));
vi.mock("../jobs/inbound-job", () => ({ getInboundQueueCounts: vi.fn() }));

import { canaryStatus } from "./inbound-health-service";

const minutes = (n: number) => n * 60 * 1000;
const now = Date.UTC(2026, 9, 21, 12, 0, 0);

describe("canaryStatus", () => {
  it("is operational before any canary has been sent", () => {
    expect(canaryStatus({ firstSentAt: null, lastSeenAt: null }, now)).toBe("operational");
  });

  it("gives a fresh deploy time for the first canary to arrive", () => {
    expect(canaryStatus({ firstSentAt: now - minutes(5), lastSeenAt: null }, now)).toBe("operational");
    expect(canaryStatus({ firstSentAt: now - minutes(45), lastSeenAt: null }, now)).toBe("down");
  });

  it("degrades, then goes down, as the last arrival gets older", () => {
    expect(canaryStatus({ firstSentAt: now - minutes(500), lastSeenAt: now - minutes(12) }, now)).toBe("operational");
    expect(canaryStatus({ firstSentAt: now - minutes(500), lastSeenAt: now - minutes(25) }, now)).toBe("degraded");
    expect(canaryStatus({ firstSentAt: now - minutes(500), lastSeenAt: now - minutes(41) }, now)).toBe("down");
  });
});
