"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  BookUser,
  CreditCard,
  Gauge,
  Globe,
  HouseIcon,
  KeyRound,
  LayoutTemplate,
  Mail,
  Plus,
  ScrollText,
  Search,
  Server,
  Settings,
  UserRoundX,
  Users,
  Volume2,
  Webhook,
  Bell,
  BookOpenText,
  UserIcon,
} from "lucide-react";
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

const PAGES = [
  { label: "Overview", href: "/dashboard", icon: HouseIcon },
  { label: "Emails", href: "/emails", icon: Mail },
  { label: "Domains", href: "/domains", icon: Globe },
  { label: "Webhooks", href: "/webhooks", icon: Webhook },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
  { label: "Suppressions", href: "/suppressions", icon: UserRoundX },
  { label: "Audit log", href: "/logs", icon: ScrollText },
  { label: "Contacts", href: "/contacts", icon: BookUser },
  { label: "Broadcasts", href: "/broadcasts", icon: Volume2 },
  { label: "Campaigns", href: "/campaigns", icon: BookOpenText },
];

const SETTINGS = [
  { label: "Team settings", href: "/settings/team", icon: Settings },
  { label: "Your account", href: "/settings/account", icon: UserIcon },
  { label: "Members", href: "/settings/members", icon: Users },
  { label: "API keys", href: "/settings/api-keys", icon: KeyRound },
  { label: "SMTP", href: "/settings/smtp", icon: Server },
  { label: "Usage", href: "/settings/usage", icon: Gauge },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
  { label: "Notifications", href: "/settings/notifications", icon: Bell },
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const domainsQuery = api.domain.domains.useQuery(undefined, { enabled: open, staleTime: 60_000 });

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

  const go = (href: string) => {
    setOpen(false);
    if (href.startsWith("http")) window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 items-center gap-2 rounded-md border border-border bg-muted/40 px-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:w-56"
      >
        <Search className="size-3.5" />
        <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
        <kbd className="hidden rounded border border-border bg-background px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-1.5 [&_[cmdk-input]]:h-11 [&_[cmdk-item]]:gap-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2 [&_[cmdk-item]_svg]:size-4 [&_[cmdk-item]_svg]:text-muted-foreground">
            <CommandInput placeholder="Search pages, domains and actions…" />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Quick actions">
                <CommandItem onSelect={() => go("/domains?add=1")}>
                  <Plus />
                  Add a domain
                </CommandItem>
                <CommandItem onSelect={() => go("/settings/api-keys")}>
                  <KeyRound />
                  Create an API key
                </CommandItem>
                <CommandItem onSelect={() => go("/webhooks")}>
                  <Webhook />
                  Add a webhook
                </CommandItem>
                <CommandItem onSelect={() => go("https://docs.bytesend.cloud")}>
                  <BookOpen />
                  Open the docs
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Pages">
                {PAGES.map((page) => (
                  <CommandItem key={page.href} value={`page ${page.label}`} onSelect={() => go(page.href)}>
                    <page.icon />
                    {page.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Settings">
                {SETTINGS.map((page) => (
                  <CommandItem key={page.href} value={`settings ${page.label}`} onSelect={() => go(page.href)}>
                    <page.icon />
                    {page.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {domainsQuery.data?.length ? (
                <CommandGroup heading="Domains">
                  {domainsQuery.data.map((domain) => (
                    <CommandItem key={domain.id} value={`domain ${domain.name}`} onSelect={() => go(`/domains/${domain.id}`)}>
                      <Globe />
                      <span className="flex-1 truncate">{domain.name}</span>
                      <span className="text-xs text-muted-foreground">{domain.status.toLowerCase()}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
