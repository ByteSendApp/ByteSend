import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/aws/ses", () => ({ getAccount: vi.fn() }));
vi.mock("~/server/logger/log", () => ({ logger: { error: vi.fn() } }));
vi.mock("~/server/service/ses-settings-service", () => ({ SesSettingsService: { getAllSettings: vi.fn() } }));

import { classifySesAccount } from "~/server/service/ses-health-service";

const healthy = {
  SendingEnabled: true,
  ProductionAccessEnabled: true,
  EnforcementStatus: "HEALTHY",
  SendQuota: { SentLast24Hours: 100, Max24HourSend: 50_000 },
};

describe("classifySesAccount", () => {
  it("is operational when sending, in production and healthy", () => {
    expect(classifySesAccount(healthy)).toEqual({ status: "operational", reasons: [] });
  });

  it("is down when sending is disabled", () => {
    expect(classifySesAccount({ ...healthy, SendingEnabled: false }).status).toBe("down");
  });

  it("is down when AWS has shut the account down", () => {
    expect(classifySesAccount({ ...healthy, EnforcementStatus: "SHUTDOWN" }).status).toBe("down");
  });

  it("is degraded while on probation", () => {
    const result = classifySesAccount({ ...healthy, EnforcementStatus: "PROBATION" });
    expect(result.status).toBe("degraded");
    expect(result.reasons[0]).toContain("probation");
  });

  it("is degraded in the SES sandbox", () => {
    expect(classifySesAccount({ ...healthy, ProductionAccessEnabled: false }).status).toBe("degraded");
  });

  it("is degraded above 90% of the 24-hour quota", () => {
    expect(
      classifySesAccount({ ...healthy, SendQuota: { SentLast24Hours: 46_000, Max24HourSend: 50_000 } }).status,
    ).toBe("degraded");
  });

  it("stays down when a degrading signal is also present", () => {
    expect(classifySesAccount({ ...healthy, SendingEnabled: false, ProductionAccessEnabled: false }).status).toBe("down");
  });
});
