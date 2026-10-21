"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { Building2, Globe, Mail, Search, User } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bytesend/ui/src/command";
import { Dialog, DialogContent, DialogTitle } from "@bytesend/ui/src/dialog";
import { api } from "~/trpc/react";
import { StatusPill } from "./status-pill";

const MIN_QUERY_LENGTH = 2;

export function AdminCommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [query] = useDebounce(input.trim(), 200);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchQuery = api.admin.globalSearch.useQuery(
    { query },
    { enabled: open && query.length >= MIN_QUERY_LENGTH, placeholderData: (prev) => prev, staleTime: 15_000 },
  );
  const results = query.length >= MIN_QUERY_LENGTH ? searchQuery.data : undefined;
  const hasResults =
    !!results &&
    results.users.length + results.teams.length + results.domains.length + results.emails.length > 0;

  const go = (href: string) => {
    setOpen(false);
    setInput("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 shrink-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:w-64"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden min-w-0 flex-1 truncate whitespace-nowrap text-left sm:inline">Search users, teams, domains…</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-background px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setInput("");
        }}
      >
        <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-xl">
          <DialogTitle className="sr-only">Admin search</DialogTitle>
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
          >
            <CommandInput
              value={input}
              onValueChange={setInput}
              placeholder="User email, team name, domain, team or user ID, email ID…"
            />
            <CommandList className="max-h-[60vh]">
              {query.length < MIN_QUERY_LENGTH ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Type at least {MIN_QUERY_LENGTH} characters. Recipient addresses search the last 30 days of mail.
                </p>
              ) : searchQuery.isLoading ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Searching…</p>
              ) : (
                <CommandEmpty>No matches for “{query}”</CommandEmpty>
              )}

              {results && hasResults ? (
                <>
                  {results.users.length ? (
                    <CommandGroup heading="Users">
                      {results.users.map((user) => (
                        <CommandItem key={`u-${user.id}`} value={`u-${user.id}`} onSelect={() => go(`/admin/users/${user.id}`)}>
                          <User className="mr-2 size-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{user.email ?? user.name}</span>
                          {user.isBanned ? <StatusPill tone="destructive">Banned</StatusPill> : null}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">#{user.id}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.teams.length ? (
                    <CommandGroup heading="Teams">
                      {results.teams.map((team) => (
                        <CommandItem key={`t-${team.id}`} value={`t-${team.id}`} onSelect={() => go(`/admin/teams/${team.id}`)}>
                          <Building2 className="mr-2 size-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{team.name}</span>
                          {team.isBlocked ? <StatusPill tone="destructive">Blocked</StatusPill> : null}
                          <span className="ml-2 text-xs text-muted-foreground">{team.plan}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.domains.length ? (
                    <CommandGroup heading="Domains">
                      {results.domains.map((domain) => (
                        <CommandItem
                          key={`d-${domain.id}`}
                          value={`d-${domain.id}`}
                          onSelect={() => go(`/admin/teams/${domain.team.id}`)}
                        >
                          <Globe className="mr-2 size-4 text-muted-foreground" />
                          <span className="flex-1 truncate font-mono text-sm">{domain.name}</span>
                          <span className="ml-2 truncate text-xs text-muted-foreground">{domain.team.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.emails.length ? (
                    <CommandGroup heading="Emails">
                      {results.emails.map((email) => (
                        <CommandItem
                          key={`e-${email.id}`}
                          value={`e-${email.id}`}
                          onSelect={() => go(`/admin/emails?id=${email.id}`)}
                        >
                          <Mail className="mr-2 size-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{email.subject || "(no subject)"}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{email.latestStatus.toLowerCase()}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                </>
              ) : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
