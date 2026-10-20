"use client";

import { Button } from "@bytesend/ui/src/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bytesend/ui/src/select";
import Spinner from "@bytesend/ui/src/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bytesend/ui/src/table";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { useUrlState } from "~/hooks/useUrlState";
import { api } from "~/trpc/react";
import { getGravatarUrl } from "~/utils/gravatar-utils";
import DeleteContact from "./delete-contact";
import EditContact from "./edit-contact";
import { ResendDoubleOptInConfirmation } from "./resend-double-opt-in-confirmation";
import { Badge } from "@bytesend/ui/src/badge";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { FilterBar, SearchInput } from "@bytesend/ui/src/search-input";
import { PaginationBar } from "@bytesend/ui/src/pagination-bar";
import { useDebouncedCallback } from "use-debounce";
import { getContactPropertyValue } from "~/lib/contact-properties";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@bytesend/ui/src/tooltip";
import { UnsubscribeReason } from "@prisma/client";
import { Download, Users } from "lucide-react";

function sanitizeFilename(
  name: string | undefined,
  fallback = "contacts",
): string {
  if (!name) return fallback;

  // Remove or replace unsafe characters:
  // - Path separators: / \
  // - Reserved characters: : * ? " < > |
  // - Control characters (0x00-0x1F, 0x7F)
  // - Single quotes and backticks
  const sanitized = name.replace(/[/\\:*?"<>|'\x00-\x1F\x7F]/g, "-").trim();

  // Limit length to prevent excessively long filenames (max 100 chars)
  const limited = sanitized.slice(0, 100).trim();

  // Return fallback if result is empty after sanitization
  return limited || fallback;
}

function getUnsubscribeReason(reason: UnsubscribeReason) {
  switch (reason) {
    case UnsubscribeReason.BOUNCED:
      return "Email bounced";
    case UnsubscribeReason.COMPLAINED:
      return "User complained";
    case UnsubscribeReason.UNSUBSCRIBED:
      return "User unsubscribed";
    default:
      return "User unsubscribed";
  }
}

export default function ContactList({
  contactBookId,
  contactBookName,
  doubleOptInEnabled,
  contactBookVariables,
}: {
  contactBookId: string;
  contactBookName?: string;
  doubleOptInEnabled?: boolean;
  contactBookVariables?: string[];
}) {
  const [page, setPage] = useUrlState("page", "1");
  const [status, setStatus] = useUrlState("status");
  const [search, setSearch] = useUrlState("search");

  const pageNumber = Number(page);

  const contactsQuery = api.contacts.contacts.useQuery({
    contactBookId,
    page: pageNumber,
    search: search ?? undefined,
    subscribed:
      status === "Subscribed"
        ? true
        : status === "Unsubscribed"
          ? false
          : undefined,
  });

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value || null);
    setPage("1");
  }, 1000);

  const handleStatusChange = (val: string) => {
    setStatus(val === "All" ? null : val);
    setPage("1");
  };

  const exportQuery = api.contacts.exportContacts.useQuery(
    {
      contactBookId,
      search: search ?? undefined,
      subscribed:
        status === "Subscribed"
          ? true
          : status === "Unsubscribed"
            ? false
            : undefined,
    },
    {
      enabled: false,
    },
  );

  const escapeCell = (str: string): string => {
    // Wrap in quotes if contains comma, newline, or quote
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) return;

    // CSV Header
    const headers = [
      "Email",
      "First Name",
      "Last Name",
      "Subscribed",
      "Unsubscribe Reason",
      "Created At",
      ...(contactBookVariables ?? []),
    ];

    // CSV Rows
    const rows = result.data.map((contact) => [
      escapeCell(contact.email ?? ""),
      escapeCell(contact.firstName ?? ""),
      escapeCell(contact.lastName ?? ""),
      escapeCell(contact.subscribed ? "Yes" : "No"),
      escapeCell(contact.unsubscribeReason ?? ""),
      escapeCell(contact.createdAt.toISOString()),
      ...(contactBookVariables ?? []).map((variable) =>
        escapeCell(
          getContactPropertyValue(
            (contact.properties as Record<string, unknown> | undefined) ?? {},
            variable,
            contactBookVariables ?? [],
          ) ?? "",
        ),
      ),
    ]);

    // Build CSV with UTF-8 BOM
    const csvContent = [
      headers.map(escapeCell).join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    // Download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const today = new Date().toISOString().split("T")[0];
    const safeContactBookName = sanitizeFilename(contactBookName);
    link.download = `contacts-${safeContactBookName}-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const contacts = contactsQuery.data?.contacts ?? [];
  const totalPages = contactsQuery.data?.totalPage ?? 0;
  const hasFilters = Boolean(search || status);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        <FilterBar>
          <SearchInput
            placeholder="Search by email or name"
            className="w-full sm:w-72"
            defaultValue={search ?? ""}
            onChange={(e) => debouncedSearch(e.target.value)}
          />
          <div className="flex gap-2">
            <Select value={status ?? "All"} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 w-full text-[13px] capitalize sm:w-40">{status || "Any status"}</SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Any status</SelectItem>
                <SelectItem value="Subscribed">Subscribed</SelectItem>
                <SelectItem value="Unsubscribed">Unsubscribed</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={exportQuery.isFetching} size="sm" variant="outline">
              {exportQuery.isFetching ? <Spinner className="size-3.5" innerSvgClass="stroke-primary" /> : <Download className="size-3.5" />}
              Export CSV
            </Button>
          </div>
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
          {contactsQuery.isLoading ? (
            <ListSkeleton rows={6} />
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title={hasFilters ? "No contacts match" : "This list is empty"}
              description={
                hasFilters ? "Try a different search or status." : "Add contacts one by one or import a CSV using the buttons above."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Contact</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="hidden w-36 sm:table-cell">Added</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => {
                  const isPendingConfirmation = Boolean(doubleOptInEnabled) && !contact.subscribed && !contact.unsubscribeReason;
                  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

                  return (
                    <TableRow key={contact.id}>
                      <TableCell className="max-w-0">
                        <div className="flex items-center gap-2.5">
                          <Image
                            src={getGravatarUrl(contact.email, { size: 56, defaultImage: "robohash" })}
                            alt=""
                            width={28}
                            height={28}
                            className="size-7 shrink-0 rounded-full border border-border bg-muted"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{contact.email}</p>
                            {name ? <p className="truncate text-xs text-muted-foreground">{name}</p> : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.subscribed ? (
                          <Badge variant="success" dot>
                            Subscribed
                          </Badge>
                        ) : isPendingConfirmation ? (
                          <Badge variant="warning" dot>
                            Pending
                          </Badge>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="neutral" dot>
                                Unsubscribed
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{getUnsubscribeReason(contact.unsubscribeReason ?? UnsubscribeReason.UNSUBSCRIBED)}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {isPendingConfirmation ? (
                            <ResendDoubleOptInConfirmation contactBookId={contactBookId} contactId={contact.id} email={contact.email} />
                          ) : null}
                          <EditContact contact={contact} contactBookVariables={contactBookVariables} />
                          <DeleteContact contact={contact} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </TooltipProvider>
  );
}
