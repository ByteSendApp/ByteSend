"use client";

import { api } from "~/trpc/react";
import { useUrlState } from "~/hooks/useUrlState";
import { CampaignStatus } from "@prisma/client";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@bytesend/ui/src/select";
import { Megaphone } from "lucide-react";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { FilterBar, SearchInput } from "@bytesend/ui/src/search-input";
import { PaginationBar } from "@bytesend/ui/src/pagination-bar";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import { useDebouncedCallback } from "use-debounce";
import CampaignRow from "./campaign-card";

type MarketingIntent = "CAMPAIGN" | "BROADCAST";

interface CampaignListProps {
  intent: MarketingIntent;
  basePath: "/campaigns" | "/broadcasts";
}

export default function CampaignList({ intent, basePath }: CampaignListProps) {
  const [page, setPage] = useUrlState("page", "1");
  const [status, setStatus] = useUrlState("status");
  const [search, setSearch] = useUrlState("search");

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 300);

  const pageNumber = Number(page);
  const noun = intent === "BROADCAST" ? "broadcast" : "campaign";
  const nounPlural = `${noun}s`;

  const campaignsQuery = api.campaign.getCampaigns.useQuery(
    {
      page: pageNumber,
      status: status as CampaignStatus | null,
      search,
      intent,
    },
    {
      refetchInterval: (query) => {
        const c = query.state.data?.campaigns;
        if (!c) return false;
        const shouldPoll = c.some(
          (campaign) =>
            campaign.status === CampaignStatus.RUNNING ||
            campaign.status === CampaignStatus.SCHEDULED,
        );
        return shouldPoll ? 5000 : false;
      },
    },
  );

  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const totalPages = campaignsQuery.data?.totalPage ?? 0;
  const hasFilters = Boolean(search || status);

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <SearchInput
          placeholder={`Search ${nounPlural}`}
          className="w-full sm:w-72"
          defaultValue={search || ""}
          onChange={(e) => debouncedSearch(e.target.value)}
        />
        <Select value={status ?? "all"} onValueChange={(val) => setStatus(val === "all" ? null : val)}>
          <SelectTrigger className="h-8 w-full text-[13px] capitalize sm:w-40">{status ? status.toLowerCase() : "Any status"}</SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value={CampaignStatus.DRAFT}>Draft</SelectItem>
            <SelectItem value={CampaignStatus.SCHEDULED}>Scheduled</SelectItem>
            <SelectItem value={CampaignStatus.RUNNING}>Sending</SelectItem>
            <SelectItem value={CampaignStatus.PAUSED}>Paused</SelectItem>
            <SelectItem value={CampaignStatus.SENT}>Sent</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <Panel
        flush
        footer={
          totalPages > 1 ? (
            <PaginationBar
              page={pageNumber}
              hasNext={pageNumber < totalPages}
              onPageChange={(next) => setPage(String(next))}
              summary={`Page ${pageNumber} of ${totalPages}`}
            />
          ) : null
        }
      >
        {campaignsQuery.isLoading ? (
          <ListSkeleton rows={5} />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title={hasFilters ? `No ${nounPlural} match` : `No ${nounPlural} yet`}
            description={
              hasFilters
                ? "Try a different search or status."
                : intent === "BROADCAST"
                  ? "A broadcast is a one-off email to a contact book, like a newsletter or announcement. Send it now or schedule it."
                  : "A campaign is an email you design, then send or schedule to one or more contact books."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="hidden md:table-cell">Progress</TableHead>
                <TableHead className="hidden w-36 lg:table-cell">Updated</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <CampaignRow key={campaign.id} campaign={campaign} basePath={basePath} />
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
