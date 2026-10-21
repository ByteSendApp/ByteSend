import { checkInboundHealth } from "~/server/service/inbound-health-service";
import { isInboundEnabled } from "~/server/service/inbound-storage";
import { NO_STORE, isAuthorized } from "../ses/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isInboundEnabled()) {
    return Response.json({ error: "Receiving isn't set up on this instance" }, { status: 404, headers: NO_STORE });
  }

  const health = await checkInboundHealth();
  const body = isAuthorized(request) ? health : { status: health.status, checkedAt: health.checkedAt };
  return Response.json(body, { status: health.status === "down" ? 503 : 200, headers: NO_STORE });
}
