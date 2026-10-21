import { logger } from "~/server/logger/log";
import { DmarcLookupError, checkDomainDmarc } from "~/server/service/dmarc-check-service";
import { toolRateLimited } from "~/server/service/tool-rate-limit";
import { isCloud } from "~/utils/common";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCloud()) return Response.json({ error: "Not found" }, { status: 404 });

  const domain = new URL(request.url).searchParams.get("domain") ?? "";
  if (!domain || domain.length > 300) {
    return Response.json({ error: "Enter a domain, like example.com." }, { status: 400 });
  }
  if (await toolRateLimited(request, "dmarc")) {
    return Response.json({ error: "That's a lot of checks. Wait a minute and try again." }, { status: 429 });
  }

  try {
    return Response.json(await checkDomainDmarc(domain), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DmarcLookupError) return Response.json({ error: error.message }, { status: 400 });
    logger.error({ err: error, domain }, "[DmarcTool]: Check failed");
    return Response.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}
