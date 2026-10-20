import { Bell, CreditCard, Gauge, KeyRound, Server, Settings, User, Users, type LucideIcon } from "lucide-react";
import { isCloud } from "~/utils/common";

export type SettingsNavItem = { href: string; label: string; icon: LucideIcon };

export function getSettingsNavGroups(isTeamAdmin: boolean): Array<{ label: string; items: SettingsNavItem[] }> {
  return [
    {
      label: "Team",
      items: [
        { href: "/settings/team", label: "General", icon: Settings },
        { href: "/settings/members", label: "Members", icon: Users },
        ...(isTeamAdmin && isCloud() ? [{ href: "/settings/billing", label: "Billing", icon: CreditCard }] : []),
        ...(isCloud() ? [{ href: "/settings/usage", label: "Usage", icon: Gauge }] : []),
        { href: "/settings/notifications", label: "Notifications", icon: Bell },
      ],
    },
    {
      label: "Developers",
      items: [
        { href: "/settings/api-keys", label: "API keys", icon: KeyRound },
        { href: "/settings/smtp", label: "SMTP", icon: Server },
      ],
    },
    {
      label: "You",
      items: [{ href: "/settings/account", label: "Account", icon: User }],
    },
  ];
}
