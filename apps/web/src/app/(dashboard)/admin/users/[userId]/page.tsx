"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@bytesend/ui/src/avatar";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Switch } from "@bytesend/ui/src/switch";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { AuditLogTable } from "../../_components/audit-log-table";
import { StatusPill } from "../../_components/status-pill";
import { BanUserDialog } from "./ban-user-dialog";

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  discord: "Discord",
  email: "Email link",
  credentials: "Password",
};

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function FlagRow({
  label,
  description,
  checked,
  disabled,
  disabledReason,
  destructive,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  destructive?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{disabled && disabledReason ? disabledReason : description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={label}
        className={destructive && checked ? "data-[state=checked]:bg-destructive" : undefined}
      />
    </div>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const { data: session } = useSession();
  const isFounder = Boolean(session?.user?.isFounder);
  const isSelf = session?.user?.id === userId;
  const utils = api.useUtils();

  const userQuery = api.admin.getUserDetail.useQuery(
    { userId },
    { enabled: Number.isInteger(userId), retry: false },
  );
  const user = userQuery.data;

  const refresh = async () => {
    await Promise.all([
      utils.admin.getUserDetail.invalidate({ userId }),
      utils.admin.listUsers.invalidate(),
      utils.admin.listAuditLog.invalidate(),
    ]);
  };
  const onError = (error: { message: string }) => toast.error("Could not update user", { description: error.message });

  const updateBeta = api.admin.updateUserBeta.useMutation({ onSuccess: refresh, onError });
  const setAdmin = api.admin.setUserAdmin.useMutation({ onSuccess: refresh, onError });
  const banUser = api.admin.banUser.useMutation({ onSuccess: refresh, onError });
  const relatedQuery = api.admin.getRelatedAccounts.useQuery({ userId }, { enabled: Number.isFinite(userId) });
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const isPending = updateBeta.isPending || setAdmin.isPending || banUser.isPending;

  if (userQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Users
        </Link>
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {userQuery.error?.message ?? "User not found"}
        </div>
      </div>
    );
  }

  const initials = (user.name ?? user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Users
      </Link>

      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight">{user.name ?? user.email}</h2>
            {user.isBanned ? <StatusPill tone="destructive">Banned</StatusPill> : null}
            {user.isAdmin ? <StatusPill tone="warning">Admin</StatusPill> : null}
            {user.isBetaUser ? <StatusPill tone="muted">Beta</StatusPill> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {user.email} · <span className="font-mono">#{user.id}</span> · joined{" "}
            <span title={format(user.createdAt, "yyyy-MM-dd HH:mm")}>
              {formatDistanceToNow(user.createdAt, { addSuffix: true })}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Access">
          <div className="divide-y divide-border/60">
            <FlagRow
              label="Banned"
              description="Blocks dashboard access and the API keys of teams they administer."
              checked={user.isBanned}
              destructive
              disabled={isPending || isSelf}
              disabledReason={isSelf ? "You can't ban yourself." : undefined}
              onChange={(isBanned) => (isBanned ? setBanDialogOpen(true) : banUser.mutate({ userId, isBanned: false }))}
            />
            <FlagRow
              label="Platform admin"
              description="Full access to this admin panel."
              checked={user.isAdmin}
              disabled={isPending || !isFounder || isSelf}
              disabledReason={!isFounder ? "Only the founder can change admin access." : "You can't change your own admin access."}
              onChange={(isAdmin) => setAdmin.mutate({ userId, isAdmin })}
            />
            <FlagRow
              label="Beta access"
              description="Early access to features in beta."
              checked={user.isBetaUser}
              disabled={isPending || !isFounder}
              disabledReason="Only the founder can change beta access."
              onChange={(isBetaUser) => updateBeta.mutate({ userId, isBetaUser })}
            />
          </div>
        </Panel>

        <Panel title="Security">
          <dl className="divide-y divide-border/60 text-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Email verified</dt>
              <dd>{user.emailVerified ? format(user.emailVerified, "MMM d, yyyy") : <StatusPill tone="warning">No</StatusPill>}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Two-factor auth</dt>
              <dd>
                <StatusPill tone={user.twoFactorEnabled ? "success" : "muted"}>
                  {user.twoFactorEnabled ? "Enabled" : "Off"}
                </StatusPill>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Sign-in methods</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                {user.accounts.length === 0 ? (
                  <span className="text-muted-foreground">Email link only</span>
                ) : (
                  user.accounts.map((account) => (
                    <StatusPill key={account.id} tone="muted">
                      {PROVIDER_LABELS[account.provider] ?? account.provider}
                    </StatusPill>
                  ))
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Active sessions</dt>
              <dd className="font-mono tabular-nums">{user._count.sessions}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">Backup emails</dt>
              <dd className="flex flex-col items-end gap-1">
                {user.backupEmails.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  user.backupEmails.map((backup) => (
                    <span key={backup.id} className="flex items-center gap-1.5 text-xs">
                      {backup.email}
                      {!backup.emailVerified ? <StatusPill tone="warning">Unverified</StatusPill> : null}
                    </span>
                  ))
                )}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      {relatedQuery.data && relatedQuery.data.length > 0 ? (
        <Panel title="Related accounts" description="Accounts that look like the same person. Same mailbox is a strong match; same name is only a hint.">
          <ul className="divide-y divide-border/60">
            {relatedQuery.data.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <Link href={`/admin/users/${account.id}`} className="min-w-0 hover:underline">
                  <span className="block truncate font-medium">{account.name ?? account.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {account.email} · <span className="font-mono">#{account.id}</span>
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone={account.reason === "same_mailbox" ? "destructive" : "warning"}>
                    {account.reason === "same_mailbox" ? "Same mailbox" : "Same name"}
                  </StatusPill>
                  {account.isBanned ? <StatusPill tone="muted">Banned</StatusPill> : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <BanUserDialog
        user={{ id: user.id, email: user.email, name: user.name }}
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        onDone={async () => {
          await Promise.all([refresh(), relatedQuery.refetch()]);
        }}
      />

      <Panel title="Teams">
        {user.teamUsers.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Not a member of any team.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {user.teamUsers.map(({ role, team }) => (
              <li key={team.id}>
                <Link
                  href={`/admin/teams/${team.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{team.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">#{team.id}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {team.isBlocked ? <StatusPill tone="destructive">Blocked</StatusPill> : null}
                    <StatusPill tone="muted">{team.plan}</StatusPill>
                    <StatusPill tone="muted">{role === "ADMIN" ? "Admin" : "Member"}</StatusPill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Admin activity on this user</h3>
        <AuditLogTable
          targetType="user"
          targetId={String(user.id)}
          showTarget={false}
          pageSize={25}
          emptyLabel="No admin changes to this user yet"
        />
      </div>
    </div>
  );
}
