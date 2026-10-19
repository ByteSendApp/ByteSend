import { SesHealthService, type SesHealthStatus } from "~/server/service/ses-health-service";
import { NO_STORE, isAuthorized, present } from "./shared";

export const dynamic = "force-dynamic";

const SEVERITY: Record<SesHealthStatus, number> = { operational: 0, degraded: 1, down: 2 };

export async function GET(request: Request) {
  const regions = await SesHealthService.listRegions();
  const results = await Promise.all(regions.map((region) => SesHealthService.check(region)));

  const status = results.reduce<SesHealthStatus>(
    (worst, result) => (SEVERITY[result.status] > SEVERITY[worst] ? result.status : worst),
    "operational",
  );
  const authorized = isAuthorized(request);

  return Response.json(
    { status, regions: results.map((result) => present(result, authorized)) },
    { status: status === "down" ? 503 : 200, headers: NO_STORE },
  );
}
