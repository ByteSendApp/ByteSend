"use client";

import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { Panel } from "@bytesend/ui/src/panel";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@bytesend/ui/src/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@bytesend/ui/src/tabs";
import { useUrlState } from "~/hooks/useUrlState";
import { api } from "~/trpc/react";
import { DmarcOverview } from "./dmarc-overview";
import { DmarcReports } from "./dmarc-reports";
import { DmarcSetup } from "./dmarc-setup";

const RANGES = [7, 30, 90] as const;
export type DmarcRange = (typeof RANGES)[number];

export default function DmarcPage() {
  const [tab, setTab] = useUrlState("tab");
  const [rangeParam, setRange] = useUrlState("days", "30");
  const [domain, setDomain] = useUrlState("domain");
  const days = (RANGES.find((r) => String(r) === rangeParam) ?? 30) as DmarcRange;

  const setup = api.dmarc.setup.useQuery();
  const summary = api.dmarc.summary.useQuery({ days, domain: domain ?? undefined });
  const hasReports = (summary.data?.totals.reports ?? 0) > 0 || Boolean(domain);
  const activeTab = tab ?? (summary.data && !hasReports ? "setup" : "overview");

  if (setup.data && !setup.data.enabled) {
    return (
      <div className="space-y-5">
        <PageHeader title="DMARC reports" description="See who sends email as your domains, and whether it passes SPF and DKIM." />
        <Panel flush>
          <EmptyState
            icon={<ShieldCheck />}
            title="Receiving isn't switched on here"
            description="DMARC reports arrive by email, so this ByteSend instance needs receiving set up first. See the self-hosting docs for inbound email."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="DMARC reports"
        description={`Mailbox providers report every message they see from your domains. Kept for ${setup.data?.retentionDays ?? 90} days.`}
      />

      <Tabs value={activeTab} onValueChange={setTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
          </TabsList>
          {activeTab !== "setup" ? (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Select value={domain ?? "all"} onValueChange={(value) => setDomain(value === "all" ? null : value)}>
                <SelectTrigger className="h-8 w-full text-[13px] sm:w-44">
                  <span className="truncate">{domain ?? "All domains"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  {[...new Set([...(summary.data?.domains ?? []), ...(domain ? [domain] : [])])].map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(days)} onValueChange={setRange}>
                <SelectTrigger className="h-8 w-full text-[13px] sm:w-36">Last {days} days</SelectTrigger>
                <SelectContent>
                  {RANGES.map((range) => (
                    <SelectItem key={range} value={String(range)}>
                      Last {range} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <TabsContent value="overview" className="mt-4">
          <DmarcOverview summary={summary.data} isLoading={summary.isLoading} onSetUp={() => setTab("setup")} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <DmarcReports days={days} domain={domain} />
        </TabsContent>
        <TabsContent value="setup" className="mt-4">
          <DmarcSetup setup={setup.data} isLoading={setup.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
