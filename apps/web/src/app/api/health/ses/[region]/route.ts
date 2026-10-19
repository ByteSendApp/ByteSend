import { SesHealthService } from "~/server/service/ses-health-service";
import { NO_STORE, isAuthorized, present } from "../shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ region: string }> }) {
  const { region } = await params;
  const regions = await SesHealthService.listRegions();

  if (!regions.includes(region)) {
    return Response.json({ error: "Unknown SES region" }, { status: 404, headers: NO_STORE });
  }

  const health = await SesHealthService.check(region);
  return Response.json(present(health, isAuthorized(request)), {
    status: health.status === "down" ? 503 : 200,
    headers: NO_STORE,
  });
}
