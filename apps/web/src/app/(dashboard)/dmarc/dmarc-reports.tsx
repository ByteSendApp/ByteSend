"use client";

import { formatDate } from "date-fns";
import { FileText } from "lucide-react";
import { Badge } from "@bytesend/ui/src/badge";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { KeyValueList, Panel } from "@bytesend/ui/src/panel";
import { PaginationBar } from "@bytesend/ui/src/pagination-bar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@bytesend/ui/src/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import { useUrlState } from "~/hooks/useUrlState";
import { api } from "~/trpc/react";
import { ResultBadge } from "./dmarc-overview";
import type { DmarcRange } from "./page";

const period = (begin: Date, end: Date) => `${formatDate(begin, "MMM d")} – ${formatDate(end, "MMM d, yyyy")}`;

export function DmarcReports({ days, domain }: { days: DmarcRange; domain: string | null }) {
  const [page, setPage] = useUrlState("page", "1");
  const [selected, setSelected] = useUrlState("report");
  const pageNumber = Number(page) || 1;
  const query = api.dmarc.reports.useQuery({ page: pageNumber, days, domain: domain ?? undefined });
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.pageSize ?? 25)));

  return (
    <>
      <Panel
        flush
        footer={
          totalPages > 1 ? (
            <PaginationBar page={pageNumber} hasNext={pageNumber < totalPages} onPageChange={(next) => setPage(String(next))} summary={`Page ${pageNumber} of ${totalPages}`} />
          ) : null
        }
      >
        {query.isLoading ? (
          <ListSkeleton rows={6} />
        ) : !query.data?.reports.length ? (
          <EmptyState icon={<FileText />} title="No reports in this period" description="Reports show up here as mailbox providers send them, usually once a day." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Reporter</TableHead>
                <TableHead className="hidden md:table-cell">Domain</TableHead>
                <TableHead className="hidden sm:table-cell">Period</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Passed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.reports.map((report) => (
                <TableRow key={report.id} className="cursor-pointer" onClick={() => setSelected(report.id)}>
                  <TableCell className="max-w-0">
                    <p className="truncate font-medium text-foreground">{report.orgName}</p>
                    <p className="truncate text-xs text-muted-foreground sm:hidden">{period(report.beginAt, report.endAt)}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell">{report.domain}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{period(report.beginAt, report.endAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{report.messageCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <ResultBadge passed={report.passCount} total={report.messageCount} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full max-w-full overflow-x-hidden overflow-y-auto no-scrollbar sm:max-w-2xl">
          <SheetTitle className="sr-only">DMARC report</SheetTitle>
          <SheetDescription className="sr-only">Every source and result in one DMARC report.</SheetDescription>
          {selected ? <ReportDetails id={selected} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

type AuthResult = { domain: string; selector?: string | null; scope?: string | null; result: string };

function AuthResults({ label, results }: { label: string; results: unknown }) {
  const list = (results as AuthResult[]) ?? [];
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      {list.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">None</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {list.map((r, i) => (
            <li key={i} className="flex min-w-0 items-start gap-1.5">
              <Badge variant={r.result === "pass" ? "success" : r.result === "none" ? "neutral" : "danger"}>{r.result || "?"}</Badge>
              <span className="min-w-0 font-mono text-xs leading-5 [overflow-wrap:anywhere]">
                {r.domain}
                {r.selector ? <span className="text-muted-foreground"> · {r.selector}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type SourceRecord = {
  id: string;
  sourceIp: string;
  sourceHost: string | null;
  count: number;
  disposition: string;
  dkim: string;
  spf: string;
  headerFrom: string;
  envelopeFrom: string | null;
  dkimResults: unknown;
  spfResults: unknown;
  viaByteSend: boolean;
};

function SourceCard({ record }: { record: SourceRecord }) {
  const passed = record.dkim === "pass" || record.spf === "pass";
  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={passed ? "success" : "danger"}>{passed ? "Passed DMARC" : "Failed DMARC"}</Badge>
            {record.viaByteSend ? <Badge variant="brand">ByteSend</Badge> : null}
            {record.disposition !== "none" ? <Badge variant="warning">{record.disposition}</Badge> : null}
          </div>
          <p className="mt-2 font-mono text-[13px] text-foreground [overflow-wrap:anywhere]">{record.sourceHost ?? record.sourceIp}</p>
          {record.sourceHost ? <p className="font-mono text-xs text-muted-foreground">{record.sourceIp}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold tabular-nums text-foreground">{record.count.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{record.count === 1 ? "message" : "messages"}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-[13px] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">From</dt>
          <dd className="[overflow-wrap:anywhere]">{record.headerFrom}</dd>
        </div>
        {record.envelopeFrom ? (
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Envelope from</dt>
            <dd className="[overflow-wrap:anywhere]">{record.envelopeFrom}</dd>
          </div>
        ) : null}
      </dl>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AuthResults label={`DKIM: ${record.dkim}`} results={record.dkimResults} />
        <AuthResults label={`SPF: ${record.spf}`} results={record.spfResults} />
      </div>
    </section>
  );
}

function ReportDetails({ id }: { id: string }) {
  const query = api.dmarc.report.useQuery({ id });
  const report = query.data;
  if (!report) return <ListSkeleton rows={8} />;
  const policy = report.policy as { p?: string | null; sp?: string | null; pct?: string | null; adkim?: string | null; aspf?: string | null };

  return (
    <div className="min-w-0 space-y-5 p-1">
      <div className="min-w-0 pr-8">
        <h2 className="text-base font-semibold text-foreground [overflow-wrap:anywhere]">{report.orgName}</h2>
        <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
          {report.domain} · {period(report.beginAt, report.endAt)}
        </p>
      </div>

      <Panel flush>
        <KeyValueList
          items={[
            { label: "Messages", value: report.messageCount.toLocaleString() },
            { label: "Passed DMARC", value: <ResultBadge passed={report.passCount} total={report.messageCount} /> },
            {
              label: "Published policy",
              value: (
                <span className="font-mono text-xs font-normal [overflow-wrap:anywhere]">
                  p={policy.p ?? "?"}
                  {policy.sp ? ` sp=${policy.sp}` : ""} pct={policy.pct ?? "100"} adkim={policy.adkim ?? "r"} aspf={policy.aspf ?? "r"}
                </span>
              ),
            },
            { label: "Report ID", value: <span className="font-mono text-xs font-normal">{report.reportId}</span> },
            ...(report.reporterEmail ? [{ label: "Sent by", value: report.reporterEmail }] : []),
          ]}
        />
      </Panel>

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">Sources</h3>
          <p className="text-xs text-muted-foreground">A source passes DMARC when DKIM or SPF passes for your domain.</p>
        </div>
        {report.records.map((record) => (
          <SourceCard key={record.id} record={record} />
        ))}
      </div>
    </div>
  );
}
