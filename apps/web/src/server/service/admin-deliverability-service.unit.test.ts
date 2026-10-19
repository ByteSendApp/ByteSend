import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/service/team-service", () => ({ TeamService: {} }));
vi.mock("~/server/service/admin-audit-service", () => ({ AdminAuditService: {} }));

import { classifyDeliverability } from "~/server/service/admin-deliverability-service";

describe("classifyDeliverability", () => {
  it("treats teams under the minimum volume as low volume regardless of rate", () => {
    expect(classifyDeliverability({ delivered: 50, hardBounced: 25, complained: 5 }).status).toBe("low_volume");
  });

  it("is healthy below both warning thresholds", () => {
    expect(classifyDeliverability({ delivered: 10_000, hardBounced: 100, complained: 5 }).status).toBe("ok");
  });

  it("warns between the warning and hard bounce limits", () => {
    expect(classifyDeliverability({ delivered: 10_000, hardBounced: 160, complained: 0 }).status).toBe("warning");
  });

  it("flags complaint rate over the hard limit even with clean bounces", () => {
    const result = classifyDeliverability({ delivered: 10_000, hardBounced: 0, complained: 10 });
    expect(result.status).toBe("over_limit");
    expect(result.complaintRate).toBeCloseTo(0.001);
  });

  it("ranks complaints and bounces on the same scale", () => {
    const bounceOnly = classifyDeliverability({ delivered: 10_000, hardBounced: 150, complained: 0 });
    const complaintOnly = classifyDeliverability({ delivered: 10_000, hardBounced: 0, complained: 8 });
    expect(bounceOnly.riskScore).toBeCloseTo(complaintOnly.riskScore);
  });

  it("handles zero deliveries without dividing by zero", () => {
    expect(classifyDeliverability({ delivered: 0, hardBounced: 0, complained: 0 })).toMatchObject({
      bounceRate: 0,
      complaintRate: 0,
      status: "low_volume",
    });
  });
});
