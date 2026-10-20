import { describe, expect, it } from "vitest";
import { domainAgeDays, isInNewTeamRamp, newTeamRampEndsAt } from "./trust";

const now = new Date("2026-10-20T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const freeTeam = { createdAt: daysAgo(1), sendingApprovedAt: null, plan: "FREE", isActive: true, customPlanEnabled: false };

describe("isInNewTeamRamp", () => {
  it("applies to free teams in their first week", () => {
    expect(isInNewTeamRamp(freeTeam, now)).toBe(true);
  });

  it("ends after seven days", () => {
    expect(isInNewTeamRamp({ ...freeTeam, createdAt: daysAgo(7) }, now)).toBe(false);
  });

  it("is lifted by admin approval", () => {
    expect(isInNewTeamRamp({ ...freeTeam, sendingApprovedAt: now }, now)).toBe(false);
  });

  it("skips paying teams and custom plans", () => {
    expect(isInNewTeamRamp({ ...freeTeam, plan: "HOBBY" }, now)).toBe(false);
    expect(isInNewTeamRamp({ ...freeTeam, customPlanEnabled: true }, now)).toBe(false);
  });

  it("applies to a lapsed paid plan, which falls back to free", () => {
    expect(isInNewTeamRamp({ ...freeTeam, plan: "HOBBY", isActive: false }, now)).toBe(true);
  });

  it("reports when the ramp ends", () => {
    expect(newTeamRampEndsAt({ createdAt: daysAgo(1) }).toISOString()).toBe(daysAgo(-6).toISOString());
  });
});

describe("domainAgeDays", () => {
  it("counts whole days", () => {
    expect(domainAgeDays(daysAgo(3.5), now)).toBe(3);
  });
});
