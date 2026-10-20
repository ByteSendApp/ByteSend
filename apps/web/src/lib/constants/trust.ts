const DAY_MS = 24 * 60 * 60 * 1000;

/** New free teams can only send this many emails a day until they're this many days old or approved. */
export const NEW_TEAM_RAMP_DAYS = 7;
export const NEW_TEAM_DAILY_LIMIT = 50;

/** Sending domains registered more recently than this add to the spam score. */
export const YOUNG_DOMAIN_DAYS = 30;
export const VERY_YOUNG_DOMAIN_DAYS = 7;

type RampTeam = {
  createdAt: Date;
  sendingApprovedAt: Date | null;
  plan: string;
  isActive: boolean;
  customPlanEnabled?: boolean | null;
};

/**
 * Whether the team is still in its new-account ramp. Paying teams and custom plans skip it:
 * a payment method is already a strong signal, and the ramp exists to make throwaway free
 * accounts useless for abuse.
 */
export function isInNewTeamRamp(team: RampTeam, now = new Date()): boolean {
  if (team.sendingApprovedAt) return false;
  if (team.customPlanEnabled) return false;
  if (team.isActive && team.plan !== "FREE") return false;
  return now.getTime() - team.createdAt.getTime() < NEW_TEAM_RAMP_DAYS * DAY_MS;
}

export function newTeamRampEndsAt(team: { createdAt: Date }): Date {
  return new Date(team.createdAt.getTime() + NEW_TEAM_RAMP_DAYS * DAY_MS);
}

export function domainAgeDays(registeredAt: Date, now = new Date()): number {
  return Math.floor((now.getTime() - registeredAt.getTime()) / DAY_MS);
}
