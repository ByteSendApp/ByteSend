import { timingSafeEqual } from "node:crypto";
import { env } from "~/env";
import type { SesRegionHealth } from "~/server/service/ses-health-service";

export function isAuthorized(request: Request) {
  const expected = env.HEALTH_CHECK_TOKEN;
  if (!expected) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Enforcement and quota details reveal account reputation, so they're only shared with authorised monitors.
export function present(health: SesRegionHealth, authorized: boolean) {
  return authorized
    ? health
    : { region: health.region, status: health.status, checkedAt: health.checkedAt };
}

export const NO_STORE = { "Cache-Control": "no-store" };
