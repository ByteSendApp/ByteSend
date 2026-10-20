import { describe, expect, it, vi } from "vitest";

vi.mock("~/env", () => ({ env: { NEXTAUTH_URL: "https://bytesend.cloud" } }));
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/logger/log", () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));
vi.mock("~/server/mailer", () => ({ sendMail: vi.fn() }));
vi.mock("~/server/service/domain-service", () => ({ checkDomainDnsHealth: vi.fn() }));
vi.mock("~/server/service/notification-emitter", () => ({ NotificationEmitter: {} }));
vi.mock("~/server/service/team-service", () => ({ TeamService: {} }));

import { dnsHealthTransition } from "~/server/service/domain-health-service";

const issue = ["DKIM record bytesend._domainkey.acme.com is missing"];

describe("dnsHealthTransition", () => {
  it("does nothing for a healthy domain", () => {
    expect(dnsHealthTransition({ issues: [], previousIssues: [], notified: false })).toBe("healthy");
  });

  it("waits for a second check before alerting", () => {
    expect(dnsHealthTransition({ issues: issue, previousIssues: [], notified: false })).toBe("first_seen");
    expect(dnsHealthTransition({ issues: issue, previousIssues: issue, notified: false })).toBe("notify_broken");
  });

  it("doesn't alert again while the problem lasts", () => {
    expect(dnsHealthTransition({ issues: issue, previousIssues: issue, notified: true })).toBe("still_broken");
  });

  it("says when it's fixed, but only if the team was told it broke", () => {
    expect(dnsHealthTransition({ issues: [], previousIssues: issue, notified: true })).toBe("notify_fixed");
    expect(dnsHealthTransition({ issues: [], previousIssues: issue, notified: false })).toBe("healthy");
  });
});
