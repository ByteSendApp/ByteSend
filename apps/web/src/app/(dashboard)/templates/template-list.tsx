"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { LayoutTemplate } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@bytesend/ui/src/table";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { SearchInput } from "@bytesend/ui/src/search-input";
import { PaginationBar } from "@bytesend/ui/src/pagination-bar";
import { CopyButton } from "@bytesend/ui/src/copy-field";
import { api } from "~/trpc/react";
import { useUrlState } from "~/hooks/useUrlState";
import DeleteTemplate from "./delete-template";
import DuplicateTemplate from "./duplicate-template";

export default function TemplateList({ action }: { action?: React.ReactNode }) {
  const router = useRouter();
  const [page, setPage] = useUrlState("page", "1");
  const [search, setSearch] = useUrlState("search");
  const pageNumber = Number(page);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value || null);
    setPage("1");
  }, 400);

  const templateQuery = api.template.getTemplates.useQuery({ page: pageNumber, search: search ?? undefined });
  const templates = templateQuery.data?.templates ?? [];
  const totalPages = templateQuery.data?.totalPage ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        placeholder="Search templates"
        className="w-full sm:w-72"
        defaultValue={search ?? ""}
        onChange={(e) => debouncedSearch(e.target.value)}
      />

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
        {templateQuery.isLoading ? (
          <ListSkeleton rows={5} />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<LayoutTemplate />}
            title={search ? "No templates match" : "No templates yet"}
            description={
              search
                ? "Try a different search."
                : "Design an email once, then send it from the API with variables like {{name}} filled in."
            }
            action={search ? null : action}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Template</TableHead>
                <TableHead className="hidden md:table-cell">ID</TableHead>
                <TableHead className="hidden lg:table-cell">Edited by</TableHead>
                <TableHead className="hidden w-36 sm:table-cell">Updated</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => {
                const href = `/templates/${template.id}/edit`;
                return (
                  <TableRow key={template.id} className="cursor-pointer" onClick={() => router.push(href)}>
                    <TableCell className="max-w-0">
                      <Link href={href} className="block truncate font-medium text-foreground" onClick={(e) => e.stopPropagation()}>
                        {template.name}
                      </Link>
                      {template.subject ? <p className="truncate text-xs text-muted-foreground">{template.subject}</p> : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        {template.id.slice(0, 12)}…
                        <CopyButton value={template.id} />
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{template.updatedBy ?? "–"}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDistanceToNow(new Date(template.updatedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <DuplicateTemplate template={template} />
                        <DeleteTemplate template={template} />
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
  );
}
