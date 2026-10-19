import { EmailUsageType, Subscription } from "@prisma/client";
import { db } from "../db";
import { format } from "date-fns";

export async function getThisMonthUsage(teamId: number) {
  const team = await db.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    throw new Error("Team not found");
  }

  let subscription: Subscription | null = null;
  const isPaidPlan = team.plan !== "FREE";

  if (isPaidPlan) {
    subscription = await db.subscription.findFirst({
      where: { teamId: team.id },
      orderBy: { status: "asc" },
    });
  }

  const isoStartDate = subscription?.currentPeriodStart
    ? format(subscription.currentPeriodStart, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-01");
  const today = format(new Date(), "yyyy-MM-dd");

  const [monthUsage, dayUsage] = await Promise.all([
    db.$queryRaw<Array<{ type: EmailUsageType; sent: number }>>`
        SELECT 
          type,
          SUM(sent)::integer AS sent
        FROM "DailyEmailUsage"
        WHERE "teamId" = ${team.id}
        AND "date" >= ${isoStartDate}
        GROUP BY "type"
      `,
    db.$queryRaw<Array<{ type: EmailUsageType; sent: number }>>`
        SELECT 
          type,
          SUM(sent)::integer AS sent
        FROM "DailyEmailUsage"
        WHERE "teamId" = ${team.id}
        AND "date" = ${today}
        GROUP BY "type"
      `,
  ]);

  return {
    month: monthUsage,
    day: dayUsage,
  };
}
