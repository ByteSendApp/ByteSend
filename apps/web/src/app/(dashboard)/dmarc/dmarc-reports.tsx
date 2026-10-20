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
        <SheetContent className="overflow-y-auto no-scrollbar sm:max-w-2xl">
          <SheetTitle className="sr-only">DMARC report</SheetTitle>
          <SheetDescription className="sr-only">Every source and result in one DMARC report.</SheetDescription>
          {selected ? <ReportDetails id={selected} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

type AuthResult = { domain: string; selector?: string | null; scope?: string | null; result: string };

function AuthResults({ results }: { results: unknown }) {
  const list = (results as AuthResult[]) ?? [];
  if (list.length === 0) return <span className="text-muted-foreground">none</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {list.map((r, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <Badge variant={r.result === "pass" ? "success" : r.result === "none" ? "neutral" : "danger"}>{r.result || "?"}</Badge>
          <span className="truncate font-mono text-xs">
            {r.domain}
            {r.selector ? ` (${r.selector})` : ""}
          </span>
        </span>
      ))}
    </span>
  );
}

function ReportDetails({ id }: { id: string }) {
  const query = api.dmarc.report.useQuery({ id });
  const report = query.data;
  if (!report) return <ListSkeleton rows={8} />;
  const policy = report.policy as { p?: string | null; sp?: string | null; pct?: string | null; adkim?: string | null; aspf?: string | null };

  return (
    <div className="space-y-5 p-1">
      <div>
        <h2 className="text-base font-semibold text-foreground">{report.orgName}</h2>
        <p className="text-[13px] text-muted-foreground">
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
                <span className="font-mono text-xs font-normal">
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
        <h3 className="text-sm font-medium text-foreground">Sources</h3>
        {report.records.map((record) => (
          <Panel key={record.id} flush>
            <KeyValueList
              items={[
                {
                  label: "Source",
                  value: (
                    <span className="flex items-center justify-end gap-1.5">
                      {record.viaByteSend ? <Badge variant="brand">ByteSend</Badge> : null}
                      <span className="font-mono text-xs font-normal">{record.sourceHost ? `${record.sourceHost} (${record.sourceIp})` : record.sourceIp}</span>
                    </span>
                  ),
                },
                { label: "Messages", value: record.count.toLocaleString() },
                {
                  label: "Result",
                  value: (
                    <span className="flex flex-wrap justify-end gap-1">
                      <Badge variant={record.dkim === "pass" ? "success" : "danger"}>DKIM {record.dkim}</Badge>
                      <Badge variant={record.spf === "pass" ? "success" : "danger"}>SPF {record.spf}</Badge>
                      {record.disposition !== "none" ? <Badge variant="warning">{record.disposition}</Badge> : null}
                    </span>
                  ),
                },
                { label: "From", value: record.headerFrom },
                ...(record.envelopeFrom ? [{ label: "Envelope from", value: record.envelopeFrom }] : []),
                { label: "DKIM signatures", value: <AuthResults results={record.dkimResults} /> },
                { label: "SPF checks", value: <AuthResults results={record.spfResults} /> },
              ]}
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}
