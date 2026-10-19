import { PublicStatsService } from "~/server/service/public-stats-service";
import { isCloud } from "~/utils/common";

export const dynamic = "force-dynamic";

// The same aggregate, platform-wide numbers as /stats, for the Discord bot and anyone else.
export async function GET() {
  if (!isCloud()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const stats = await PublicStatsService.get();
  return Response.json(stats, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
