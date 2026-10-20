"use client";

import { PageHeader } from "@bytesend/ui/src/page-header";
import { useUrlState } from "~/hooks/useUrlState";
import { useTeam } from "~/providers/team-context";
import EmailChart from "./email-chart";
import DashboardFilters from "./dashboard-filters";
import { ReputationMetrics } from "./reputation-metrics";
import { OverviewAttention, OverviewPanels, SetupProgress } from "./overview";

export default function Dashboard() {
  const [days, setDays] = useUrlState("days", "30");
  const [domain, setDomain] = useUrlState("domain");
  const { currentTeam } = useTeam();
  const isPaidTeam = currentTeam?.plan !== "FREE";
  const range = Number(days ?? "30");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="How your sending is doing, and anything that needs you."
        actions={<DashboardFilters days={days ?? "30"} setDays={setDays} domain={domain} setDomain={setDomain} />}
      />
      <OverviewAttention />
      <SetupProgress />
      <EmailChart days={range} domain={domain} isPaidTeam={Boolean(isPaidTeam)} />
      <OverviewPanels />
      <ReputationMetrics days={range} domain={domain} />
    </div>
  );
}
