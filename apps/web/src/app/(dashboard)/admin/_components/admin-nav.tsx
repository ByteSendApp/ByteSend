"use client";

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
import { isCloud } from "~/utils/common";

type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  cloudOnly?: boolean;
  requiresAdminFlag?: boolean;
};

export type AdminNavGroup = { label?: string; items: AdminNavItem[] };

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

export function isActiveAdminPath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Admin sections the current admin can open, rendered by the main sidebar on /admin pages. */
export function getAdminNavGroups(isAdmin: boolean): AdminNavGroup[] {
  const cloud = isCloud();
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => (!item.cloudOnly || cloud) && (!item.requiresAdminFlag || isAdmin)),
  })).filter((group) => group.items.length > 0);
}
