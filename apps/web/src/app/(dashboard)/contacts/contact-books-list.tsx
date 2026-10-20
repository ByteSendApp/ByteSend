"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { BookUser } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Panel } from "@bytesend/ui/src/panel";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { SearchInput } from "@bytesend/ui/src/search-input";
import { api } from "~/trpc/react";
import { useUrlState } from "~/hooks/useUrlState";
import DeleteContactBook from "./delete-contact-book";
import EditContactBook from "./edit-contact-book";

export default function ContactBooksList() {
  const [search, setSearch] = useUrlState("search");
  const contactBooksQuery = api.contacts.getContactBooks.useQuery({ search: search ?? undefined });
  const books = contactBooksQuery.data ?? [];

  const debouncedSearch = useDebouncedCallback((value: string) => setSearch(value || null), 400);

  return (
    <div className="space-y-3">
      <SearchInput
        placeholder="Search contact books"
        className="w-full sm:w-72"
        defaultValue={search ?? ""}
        onChange={(e) => debouncedSearch(e.target.value)}
      />

      {contactBooksQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <Panel flush>
          <EmptyState
            icon={<BookUser />}
            title={search ? "No contact books match" : "No contact books yet"}
            description={
              search
                ? "Try a different search."
                : "A contact book is a list of people you can send campaigns and broadcasts to. Create one, then add or import contacts."
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <div
              key={book.id}
              className="group relative flex flex-col rounded-lg border border-border bg-card transition-colors hover:border-primary/40"
            >
              <Link href={`/contacts/${book.id}`} className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-lg">
                    {book.emoji || "📋"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{book.name}</p>
                    <p className="text-xs text-muted-foreground">Created {formatDistanceToNow(book.createdAt, { addSuffix: true })}</p>
                  </div>
                </div>
                <p className="mt-auto text-xl font-semibold tabular-nums tracking-tight text-foreground">
                  {book._count.contacts.toLocaleString()}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {book._count.contacts === 1 ? "contact" : "contacts"}
                  </span>
                </p>
              </Link>
              <div className="absolute right-2 top-2 flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <EditContactBook contactBook={book} />
                <DeleteContactBook contactBook={book} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
