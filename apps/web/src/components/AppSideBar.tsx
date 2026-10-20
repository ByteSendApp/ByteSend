"use client";

import {
  Activity,
  BookUser,
  Code,
  Cog,
  MessageSquare,
  Globe,
  LayoutTemplate,
  Mail,
  Server,
  Volume2,
  BookOpenText,
  BookOpenIcon,
  LogOutIcon,
  MoreVerticalIcon,
  UsersIcon,
  GaugeIcon,
  UserRoundX,
  Webhook,
  HouseIcon,
  ChevronsUpDown,
  Check,
  PlusIcon,
  ScrollText,
  UserIcon,
  ArrowLeft,
} from "lucide-react";
import { FaBook } from "react-icons/fa";
import { SiDiscord } from "react-icons/si";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useTeam } from "~/providers/team-context";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@bytesend/ui/src/sidebar";
import Link from "next/link";
import { MiniThemeSwitcher, ThemeSwitcher } from "./theme/ThemeSwitcher";
import { useSession } from "next-auth/react";
import { isCloud, isSelfHosted } from "~/utils/common";
import { usePathname } from "next/navigation";
import { Badge } from "@bytesend/ui/src/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@bytesend/ui/src/avatar";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bytesend/ui/src/dropdown-menu";
import { FeedbackDialog } from "./FeedbackDialog";
import { env } from "~/env";
import { getAdminNavGroups, isActiveAdminPath } from "~/app/(dashboard)/admin/_components/admin-nav";
import { BrandIcon } from "~/lib/brand";

// General items
const generalItems = [
  {
    title: "Emails",
    url: "/emails",
    icon: Mail,
  },
  {
    title: "Overview",
    url: "/dashboard",
    icon: HouseIcon,
  },
  {
    title: "Domains",
    url: "/domains",
    icon: Globe,
  },
  {
    title: "Webhooks",
    url: "/webhooks",
    icon: Webhook,
  },
  {
    title: "Templates",
    url: "/templates",
    icon: LayoutTemplate,
  },
  {
    title: "Suppressions",
    url: "/suppressions",
    icon: UserRoundX,
  },
  {
    title: "Audit Logs",
    url: "/logs",
    icon: ScrollText,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Cog,
  }
];

// Marketing items
const marketingItems = [
  {
    title: "Contacts",
    url: "/contacts",
    icon: BookUser,
  },
  {
    title: "Broadcasts",
    url: "/broadcasts",
    icon: Volume2,
  },
  {
    title: "Campaigns",
    url: "/campaigns",
    icon: BookOpenText,
  },
];

export function AppSidebar() {
  const { data: session } = useSession();
  const showFeedback = isCloud();
  const { currentTeam, teams, setCurrentTeam } = useTeam();

  const pathname = usePathname();
  const inAdmin = pathname?.startsWith("/admin") ?? false;
  const adminGroups = inAdmin ? getAdminNavGroups(Boolean(session?.user?.isAdmin)) : [];

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border/40">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  tooltip="Switch team"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 shrink-0 overflow-hidden">
                    {currentTeam?.image ? (
                      <Image
                        src={currentTeam.image}
                        alt={currentTeam.name}
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BrandIcon size={20} />
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold tracking-tight">
                      {currentTeam?.name ?? "No team"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                className="w-56"
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Your teams
                </DropdownMenuLabel>
                {teams.map((team) => (
                  <DropdownMenuItem
                    key={team.id}
                    onSelect={() => setCurrentTeam(team.id)}
                    className="flex items-center gap-2"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20 overflow-hidden">
                      {team.image ? (
                        <Image
                          src={team.image}
                          alt={team.name}
                          width={20}
                          height={20}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BrandIcon size={14} />
                      )}
                    </div>
                    <span className="flex-1 truncate">{team.name}</span>
                    {team.id === currentTeam?.id && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/join-team" className="flex items-center gap-2 cursor-pointer">
                    <PlusIcon className="size-3.5" />
                    <span>Create team</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {inAdmin ? (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Back to dashboard">
                      <Link href="/dashboard">
                        <ArrowLeft />
                        <span>Back to dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {adminGroups.map((group, index) => (
              <SidebarGroup key={group.label ?? `admin-${index}`} className="py-1">
                {group.label ? (
                  <SidebarGroupLabel>
                    <span>{group.label}</span>
                  </SidebarGroupLabel>
                ) : null}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild tooltip={item.label} isActive={isActiveAdminPath(pathname ?? "", item.href)}>
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </>
        ) : (
        <>
        <SidebarGroup>
          <SidebarGroupLabel>
            <span>General</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {generalItems.map((item) => {
                const isActive = pathname?.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>
            <span>Marketing</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {marketingItems.map((item) => {
                const isActive = pathname?.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                      className="text-sidebar-foreground"
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        </>
        )}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {showFeedback ? (
                <SidebarMenuItem>
                  <FeedbackDialog
                    trigger={
                      <SidebarMenuButton tooltip="Feedback">
                        <MessageSquare />
                        <span>Feedback</span>
                      </SidebarMenuButton>
                    }
                  />
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Documentation">
                  <Link href="https://docs.bytesend.cloud" target="_blank">
                    <FaBook className="size-4 shrink-0" />
                    <span>Documentation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isCloud() ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Service status">
                    <Link href="https://status.bytesend.cloud" target="_blank">
                      <Activity className="size-4 shrink-0" />
                      <span>Status</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Discord">
                  <Link href="https://discord.gg/C2Q4GHXKQA" target="_blank">
                    <SiDiscord className="size-4 shrink-0" />
                    <span>Discord</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="shrink-0">
        {<VersionInfo />}
        <NavUser
          user={{
            name:
              session?.user.name ||
              session?.user.email?.split("@")[0] ||
              "User",
            email: session?.user.email || "",
            avatar: session?.user.image || "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

export function NavUser({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
}) {
  const { data: session } = useSession();
  const { isMobile } = useSidebar();
  const canAccessAdminPanel = isSelfHosted() || Boolean(session?.user?.isAdmin);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user.avatar ? (
                  <AvatarImage
                    src={user.avatar}
                    alt={user.name ?? user.email ?? ""}
                  />
                ) : null}
                <AvatarFallback className="rounded-lg capitalize">
                  {user.name?.charAt(0) ?? user.email?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {user.name ?? user.email ?? "User"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.name ? user.email : ""}
                </span>
              </div>
              <MoreVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl"
            side={isMobile ? "bottom" : "top"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatar ? (
                    <AvatarImage
                      src={user.avatar}
                      alt={user.name ?? user.email ?? ""}
                    />
                  ) : null}
                  <AvatarFallback className="rounded-lg capitalize">
                    {user.name?.charAt(0) ?? user.email?.charAt(0) ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user.name ?? user.email ?? "User"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.name ? user.email : ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/">
                  <HouseIcon />
                  Home
                </Link>
              </DropdownMenuItem>
              {canAccessAdminPanel && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Server />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings/account">
                  <UserIcon />
                  Account Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/usage">
                  <GaugeIcon />
                  Usage Breakdown
                </Link>
              </DropdownMenuItem>
              <div className="px-2 py-0.5">
                <ThemeSwitcher />
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function VersionInfo() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.json())
      .then((data: { version: string }) => setVersion(data.version))
      .catch(() => setVersion("unknown"));
  }, []);

  return (
    <div className="px-2 py-2 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span>Version</span>
        <span className="font-mono">{version ?? "..."}</span>
      </div>
    </div>
  );
}
