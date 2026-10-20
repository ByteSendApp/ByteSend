"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@bytesend/ui/src/table";
import { api } from "~/trpc/react";
import { ChevronLeft, ChevronRight, Download, Mail } from "lucide-react";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { FilterBar, SearchInput } from "@bytesend/ui/src/search-input";
import { toast } from "@bytesend/ui/src/toaster";
import { formatDate, formatDistanceToNow } from "date-fns";
import { EmailStatus } from "@prisma/client";
import { EmailStatusBadge } from "./email-status-badge";
import EmailDetails from "./email-details";
import dynamic from "next/dynamic";
import { useUrlState } from "~/hooks/useUrlState";
import { Button } from "@bytesend/ui/src/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bytesend/ui/src/select";
import Spinner from "@bytesend/ui/src/spinner";
import { DEFAULT_QUERY_LIMIT } from "~/lib/constants";
import { useDebouncedCallback } from "use-debounce";
import { SheetTitle, SheetDescription } from "@bytesend/ui/src/sheet";

const DynamicSheetWithNoSSR = dynamic(
  () => import("@bytesend/ui/src/sheet").then((mod) => mod.Sheet),
  { ssr: false },
);

const DynamicSheetContentWithNoSSR = dynamic(
  () => import("@bytesend/ui/src/sheet").then((mod) => mod.SheetContent),
  { ssr: false },
);

const STATUS_FILTERS = [
  "SENT",
  "SCHEDULED",
  "QUEUED",
  "DELIVERED",
  "BOUNCED",
  "CLICKED",
  "OPENED",
  "DELIVERY_DELAYED",
  "COMPLAINED",
  "SUPPRESSED",
] as const;

export default function EmailsList() {
  const [selectedEmail, setSelectedEmail] = useUrlState("emailId");
  const [page, setPage] = useUrlState("page", "1");
  const [status, setStatus] = useUrlState("status");
  const [search, setSearch] = useUrlState("search");
  const [domain, setDomain] = useUrlState("domain");
  const [apiKey, setApiKey] = useUrlState("apikey");

  const pageNumber = Number(page);
  const domainId = domain ? Number(domain) : undefined;
  const apiId = apiKey ? Number(apiKey) : undefined;

  const emailsQuery = api.email.emails.useQuery({
    page: pageNumber,
    status: status?.toUpperCase() as EmailStatus,
    domain: domainId,
    search,
    apiId: apiId,
  });

  const exportQuery = api.email.exportEmails.useQuery(
    {
      status: status?.toUpperCase() as EmailStatus,
      domain: domainId,
      search,
      apiId: apiId,
    },
    { enabled: false },
  );

  const { data: domainsQuery } = api.domain.domains.useQuery();
  const { data: apiKeysQuery } = api.apiKey.getApiKeys.useQuery();

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmail(emailId);
  };

  const handleDomain = (val: string) => {
    setDomain(val === "All Domains" ? null : val);
  };

  const handleApiKey = (val: string) => {
    setApiKey(val === "All API Keys" ? null : val);
  };

  const handleSheetChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedEmail(null);
    }
  };

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 1000);

  const handleExport = async () => {
    try {
      const resp = await exportQuery.refetch();
      if (!resp.data) return;

      const escape = (val: unknown) => {
        const s = String(val ?? "");
        const startsRisky = /^\s*[=+\-@]/.test(s);
        const safe = (startsRisky ? "'" : "") + s.replace(/"/g, '""');
        return /[",\r\n]/.test(safe) ? `"${safe}"` : safe;
      };

      const header = [
        "To",
        "Status",
        "Subject",
        "Sent At",
        "Bounce Type",
        "Bounce Subtype",
        "Bounce Reason",
      ].join(",");
      const rows = resp.data.map((e) =>
        [
          e.to,
          e.status,
          e.subject,
          e.sentAt,
          e.bounceType,
          e.bounceSubType,
          e.bounceReason,
        ]
          .map(escape)
          .join(","),
      );
      const csv = [header, ...rows].join("\n");

      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `emails-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };

  const emails = emailsQuery.data?.emails ?? [];
  const hasFilters = Boolean(status || search || domain || apiKey);
  const hasNextPage = emails.length === DEFAULT_QUERY_LIMIT;
  const selectTrigger = "h-8 w-full text-[13px] sm:w-40";

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <SearchInput
          placeholder="Search subject or recipient"
          className="w-full sm:w-72"
          defaultValue={search ?? ""}
          onChange={(e) => debouncedSearch(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select value={status ?? "All statuses"} onValueChange={(val) => setStatus(val === "All statuses" ? null : val)}>
            <SelectTrigger className={`${selectTrigger} capitalize`}>
              {status ? status.toLowerCase().replace("_", " ") : "All statuses"}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All statuses">All statuses</SelectItem>
              {STATUS_FILTERS.map((value) => (
                <SelectItem key={value} value={value} className="capitalize">
                  {value.toLowerCase().replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={domain ?? "All Domains"} onValueChange={(val) => handleDomain(val)}>
            <SelectTrigger className={selectTrigger}>
              <span className="truncate">{domain ? domainsQuery?.find((d) => d.id === Number(domain))?.name : "All domains"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Domains">All domains</SelectItem>
              {domainsQuery?.map((d) => (
                <SelectItem key={d.id} value={d.id.toString()}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={apiKey ?? "All API Keys"} onValueChange={(val) => handleApiKey(val)}>
            <SelectTrigger className={selectTrigger}>
              <span className="truncate">{apiKey ? apiKeysQuery?.find((k) => k.id === Number(apiKey))?.name : "All API keys"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All API Keys">All API keys</SelectItem>
              {apiKeysQuery?.map((k) => (
                <SelectItem key={k.id} value={k.id.toString()}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exportQuery.isFetching}>
            {exportQuery.isFetching ? <Spinner className="size-3.5" /> : <Download className="size-3.5" />}
            Export CSV
          </Button>
        </div>
      </FilterBar>

      <Panel
        flush
        footer={
          emails.length || pageNumber > 1 ? (
            <>
              <span className="text-xs text-muted-foreground">Page {pageNumber}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage((pageNumber - 1).toString())} disabled={pageNumber === 1}>
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage((pageNumber + 1).toString())} disabled={!hasNextPage}>
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </>
          ) : null
        }
      >
        {emailsQuery.isLoading ? (
          <ListSkeleton rows={8} />
        ) : emails.length === 0 ? (
          <EmptyState
            icon={<Mail />}
            title={hasFilters ? "No emails match these filters" : "No emails yet"}
            description={
              hasFilters
                ? "Try a different status, domain or search."
                : "Emails you send through the API, SMTP or a campaign show up here with their delivery status."
            }
            action={
              hasFilters ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStatus(null);
                    setSearch(null);
                    setDomain(null);
                    setApiKey(null);
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <a href="https://docs.bytesend.cloud/get-started/examples" target="_blank" rel="noopener noreferrer">
                    Send your first email
                  </a>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Recipient</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="hidden md:table-cell">Subject</TableHead>
                <TableHead className="w-36 text-right">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => {
                const when = email.scheduledAt ?? email.createdAt;
                return (
                  <TableRow key={email.id} onClick={() => handleSelectEmail(email.id)} className="cursor-pointer">
                    <TableCell className="max-w-0">
                      <p className="truncate font-medium text-foreground">{email.to}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">{email.subject}</p>
                    </TableCell>
                    <TableCell>
                      <EmailStatusBadge status={email.latestStatus ?? "SENT"} />
                    </TableCell>
                    <TableCell className="hidden max-w-0 text-muted-foreground md:table-cell">
                      <p className="truncate">{email.subject}</p>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <span title={formatDate(when, "PPpp")}>
                        {email.latestStatus === "SCHEDULED"
                          ? `for ${formatDate(when, "MMM d, HH:mm")}`
                          : formatDistanceToNow(when, { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <DynamicSheetWithNoSSR open={!!selectedEmail} onOpenChange={handleSheetChange}>
        <DynamicSheetContentWithNoSSR className="overflow-y-auto no-scrollbar sm:max-w-2xl">
          <SheetTitle className="sr-only">Email details</SheetTitle>
          <SheetDescription className="sr-only">Delivery details and events for the selected email.</SheetDescription>
          {selectedEmail ? <EmailDetails emailId={selectedEmail} /> : null}
        </DynamicSheetContentWithNoSSR>
      </DynamicSheetWithNoSSR>
    </div>
  );
}
