"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { AppSidebar } from "~/components/AppSideBar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@bytesend/ui/src/sidebar";
import { UpgradeModal } from "~/components/payments/UpgradeModal";
import { BreadcrumbProvider, useBreadcrumbLabels } from "~/components/dashboard/breadcrumbs";
import { CommandMenu } from "~/components/dashboard/command-menu";
import { AdminCommandSearch } from "./admin/_components/admin-command-search";
import { isCloud } from "~/utils/common";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Overview",
  logs: "Audit log",
  emails: "Emails",
  inbox: "Inbox",
  dmarc: "DMARC",
  templates: "Templates",
  suppressions: "Suppressions",
  contacts: "Contacts",
  campaigns: "Campaigns",
  broadcasts: "Broadcasts",
  domains: "Domains",
  webhooks: "Webhooks",
  "dev-settings": "Developer settings",
  settings: "Settings",
  admin: "Admin",
  "join-team": "Join team",
  smtp: "SMTP",
  billing: "Billing",
  team: "Team",
  account: "Account",
  members: "Members",
  usage: "Usage",
  notifications: "Notifications",
  "api-keys": "API keys",
  users: "Users",
  teams: "Teams",
  "email-analytics": "Email analytics",
  deliverability: "Deliverability",
  blacklists: "Blacklists",
  blocklist: "Blocklist",
  spam: "Spam review",
  audit: "Audit log",
  ses: "SES regions",
  edit: "Edit",
  compose: "Compose",
  "double-opt-in": "Double opt-in",
};

const ID_SEGMENT = /^(\d+|c[a-z0-9]{20,}|[0-9a-f-]{20,})$/i;

function useCrumbs(pathname: string) {
  const labels = useBreadcrumbLabels();
  const segments = pathname.split("/").filter(Boolean);
  let path = "";
  return segments.map((segment) => {
    path += `/${segment}`;
    const label =
      labels[path] ?? ROUTE_LABELS[segment] ?? (ID_SEGMENT.test(segment) ? "…" : segment.replace(/-/g, " "));
    return { label, href: path };
  });
}

function HeaderBar() {
  const pathname = usePathname() ?? "";
  const crumbs = useCrumbs(pathname);
  const inAdmin = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-xl md:px-4">
      <SidebarTrigger className="size-7 shrink-0 text-muted-foreground transition-colors hover:text-foreground" />
      <div className="h-4 w-px shrink-0 bg-border" />
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={crumb.href} className={`flex min-w-0 items-center gap-1 ${isLast ? "" : "hidden sm:flex"}`}>
              {i > 0 ? <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground/50 sm:block" /> : null}
              {isLast ? (
                <span aria-current="page" className="truncate text-[13px] font-medium text-foreground first-letter:uppercase">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-[13px] text-muted-foreground transition-colors first-letter:uppercase hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
      {inAdmin ? isCloud() ? <AdminCommandSearch /> : null : <CommandMenu />}
    </header>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const isEditor = /\/(edit|compose|double-opt-in)$/.test(pathname ?? "");

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
      mainRef.current.scrollLeft = 0;
    }
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background md:h-dvh md:overflow-hidden">
      <BreadcrumbProvider>
        <SidebarProvider className="overflow-x-clip md:h-full">
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <HeaderBar />
            <main
              ref={mainRef}
              className={`flex-1 overflow-x-clip md:overflow-y-auto md:overflow-x-hidden ${isEditor ? "" : "px-4 py-5 md:px-8 md:py-7"}`}
            >
              <div className={isEditor ? "h-full w-full" : "mx-auto w-full max-w-300"}>{children}</div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </BreadcrumbProvider>
      <UpgradeModal />
    </div>
  );
}
