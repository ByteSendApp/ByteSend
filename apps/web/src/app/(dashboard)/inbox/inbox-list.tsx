"use client";

import { formatDate, formatDistanceToNow } from "date-fns";
import { Inbox, Paperclip, Reply } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { CopyField } from "@bytesend/ui/src/copy-field";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { PaginationBar } from "@bytesend/ui/src/pagination-bar";
import { Panel } from "@bytesend/ui/src/panel";
import { SearchInput } from "@bytesend/ui/src/search-input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@bytesend/ui/src/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import { useUrlState } from "~/hooks/useUrlState";
import { api } from "~/trpc/react";
import { InboundEmailDetails } from "./inbound-email-details";

export function InboxList({ hostedAddress, onSetUp }: { hostedAddress: string | null; onSetUp: () => void }) {
  const [page, setPage] = useUrlState("page", "1");
  const [search, setSearch] = useUrlState("search");
  const [selected, setSelected] = useUrlState("id");
  const pageNumber = Number(page);

  const query = api.inbound.list.useQuery({ page: pageNumber, search: search ?? undefined }, { refetchInterval: 15_000 });
  const emails = query.data?.emails ?? [];
  const debounced = useDebouncedCallback((value: string) => {
    setSearch(value || null);
    setPage("1");
  }, 400);

  return (
    <div className="space-y-3">
      <SearchInput placeholder="Search sender, subject or address" className="w-full sm:w-72" defaultValue={search ?? ""} onChange={(e) => debounced(e.target.value)} />

      <Panel
        flush
        footer={
          (query.data?.totalPages ?? 1) > 1 ? (
            <PaginationBar
              page={pageNumber}
              hasNext={pageNumber < (query.data?.totalPages ?? 1)}
              onPageChange={(next) => setPage(String(next))}
              summary={`Page ${pageNumber} of ${query.data?.totalPages}`}
            />
          ) : null
        }
      >
        {query.isLoading ? (
          <ListSkeleton rows={6} />
        ) : emails.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={search ? "Nothing matches" : "Nothing received yet"}
            description={
              search ? (
                "Try a different search."
              ) : hostedAddress ? (
                <div className="space-y-3">
                  <p>Send an email to your hosted address to see it arrive here:</p>
                  <CopyField value={hostedAddress} className="mx-auto max-w-xs" />
                </div>
              ) : (
                "Set up an address on one of your domains to start receiving mail."
              )
            }
            action={
              search ? null : (
                <Button size="sm" variant="outline" onClick={onSetUp}>
                  Set up an address
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>From</TableHead>
                <TableHead className="hidden md:table-cell">Subject</TableHead>
                <TableHead className="hidden lg:table-cell">To</TableHead>
                <TableHead className="w-32 text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id} className="cursor-pointer" onClick={() => setSelected(email.id)}>
                  <TableCell className="max-w-0">
                    <p className="truncate font-medium text-foreground">{email.fromName || email.from}</p>
                    <p className="truncate text-xs text-muted-foreground md:hidden">{email.subject || "(no subject)"}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-0 md:table-cell">
                    <p className="flex items-center gap-1.5 truncate text-foreground">
                      {email.inReplyToEmailId ? <Reply className="size-3.5 shrink-0 text-primary" aria-label="Reply to an email you sent" /> : null}
                      <span className="truncate">{email.subject || "(no subject)"}</span>
                      {email.attachmentCount > 0 ? <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Has attachments" /> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{email.preview}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-0 text-muted-foreground lg:table-cell">
                    <p className="truncate">{email.recipient}</p>
                    {email.status === "FAILED" ? (
                      <Badge variant="danger" className="mt-1">
                        Forward failed
                      </Badge>
                    ) : email.status === "FORWARDED" ? (
                      <Badge variant="neutral" className="mt-1">
                        Forwarded
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <span title={formatDate(email.receivedAt, "PPpp")}>{formatDistanceToNow(email.receivedAt, { addSuffix: true })}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto no-scrollbar sm:max-w-2xl">
          <SheetTitle className="sr-only">Received email</SheetTitle>
          <SheetDescription className="sr-only">The content, attachments and headers of a received email.</SheetDescription>
          {selected ? <InboundEmailDetails id={selected} onDeleted={() => setSelected(null)} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
