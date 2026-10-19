"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Ban,
  Building2,
  CreditCard,
  Globe,
  LayoutDashboard,
  Mail,
  MailWarning,
  ScrollText,
  Server,
  ShieldAlert,
  ShieldBan,
  Users,
  Webhook,
} from "lucide-react";
import { cn } from "@bytesend/ui/lib/utils";
import { isCloud } from "~/utils/common";

type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  cloudOnly?: boolean;
  requiresAdminFlag?: boolean;
};

type AdminNavGroup = { label?: string; items: AdminNavItem[] };

const NAV_GROUPS: AdminNavGroup[] = [
  { items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Platform",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, cloudOnly: true, requiresAdminFlag: true },
      { href: "/admin/teams", label: "Teams", icon: Building2, cloudOnly: true },
      { href: "/admin/domains", label: "Domains", icon: Globe, cloudOnly: true },
      { href: "/admin/emails", label: "Emails", icon: Mail },
    ],
  },
  {
    label: "Health",
    items: [
      { href: "/admin/email-analytics", label: "Email analytics", icon: Activity, cloudOnly: true },
      { href: "/admin/deliverability", label: "Deliverability", icon: ShieldAlert },
      { href: "/admin/blacklists", label: "Blacklists", icon: ShieldBan, cloudOnly: true },
      { href: "/admin/spam", label: "Spam review", icon: MailWarning },
      { href: "/admin/blocklist", label: "Blocklist", icon: Ban },
    ],
  },
  {
    label: "Business",
    items: [{ href: "/admin/billing", label: "Billing", icon: CreditCard, cloudOnly: true }],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/admin/ses", label: "SES regions", icon: Server },
      { href: "/admin/webhooks", label: "Webhooks", icon: Webhook, cloudOnly: true },
    ],
  },
  { items: [{ href: "/admin/audit", label: "Audit log", icon: ScrollText }] },
];

function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const cloud = isCloud();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => (!item.cloudOnly || cloud) && (!item.requiresAdminFlag || isAdmin),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Admin" className="lg:sticky lg:top-6">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
        {groups.map((group, index) => (
          <div key={group.label ?? index} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
            {group.label ? (
              <p className="hidden px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 lg:block">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const Icon = item.icon;

              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
