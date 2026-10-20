import { describe, expect, it, vi } from "vitest";
import type { Team } from "@prisma/client";

vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/server/service/usage-service", () => ({ getThisMonthUsage: vi.fn() }));
vi.mock("~/server/service/limit-service", () => ({
  getActivePlan: vi.fn(),
  getCustomMonthlyTotalLimit: vi.fn(),
  getEffectiveDailyEmailLimit: vi.fn(),
  hasCustomPlan: vi.fn(),
}));

import { sendingState } from "~/server/service/dashboard-overview-service";

const team = (overrides: Partial<Team> = {}) =>
  ({
    isBlocked: false,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    sendingApprovedAt: null,
    plan: "FREE",
    isActive: true,
    customPlanEnabled: false,
    ...overrides,
  }) as Team;

const healthy = { delivered: 1000, bounceRate: 0.001, complaintRate: 0 };
const base = { usedToday: 10, usedThisMonth: 100, dailyLimit: 5000, monthlyCap: 12500, deliverability: healthy };

describe("sendingState", () => {
  it("is active when nothing is limiting", () => {
    expect(sendingState({ ...base, team: team() }).status).toBe("active");
  });

  it("reports a block before anything else", () => {
    expect(sendingState({ ...base, team: team({ isBlocked: true }), usedToday: 5000 }).status).toBe("blocked");
  });

  it("pauses on high bounce or complaint rates, but only with enough volume", () => {
    expect(sendingState({ ...base, team: team(), deliverability: { ...healthy, bounceRate: 0.03 } }).status).toBe("bounce_paused");
    expect(sendingState({ ...base, team: team(), deliverability: { ...healthy, complaintRate: 0.002 } }).status).toBe("complaint_paused");
    expect(
      sendingState({ ...base, team: team(), deliverability: { delivered: 20, bounceRate: 0.5, complaintRate: 0 } }).status,
    ).toBe("active");
  });

  it("reports daily and monthly limits", () => {
    expect(sendingState({ ...base, team: team(), usedToday: 5000 }).status).toBe("daily_limit");
    expect(sendingState({ ...base, team: team(), usedThisMonth: 12500 }).status).toBe("monthly_limit");
  });

  it("explains the new-team limit", () => {
    const state = sendingState({ ...base, team: team({ createdAt: new Date() }), dailyLimit: 50 });
    expect(state.status).toBe("new_team");
  });

  it("never reports a monthly limit for plans that bill overage", () => {
    expect(sendingState({ ...base, team: team({ plan: "BASIC" }), monthlyCap: null, usedThisMonth: 1_000_000 }).status).toBe("active");
  });
});
