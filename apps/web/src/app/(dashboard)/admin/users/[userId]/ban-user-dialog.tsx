"use client";

import { useEffect, useState } from "react";
import { Button } from "@bytesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bytesend/ui/src/dialog";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Textarea } from "@bytesend/ui/src/textarea";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";

function CheckRow({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-destructive"
      />
      <span className="min-w-0 text-sm">
        <span className="block break-all">{title}</span>
        {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </label>
  );
}

export function BanUserDialog({
  user,
  open,
  onOpenChange,
  onDone,
}: {
  user: { id: number; email: string | null; name: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const preview = api.admin.getBanPreview.useQuery({ userId: user.id }, { enabled: open });
  const [reason, setReason] = useState("");
  const [blockMailboxes, setBlockMailboxes] = useState(true);
  const [domains, setDomains] = useState<Set<string>>(new Set());
  const [related, setRelated] = useState<Set<number>>(new Set());

  // Pre-tick strong signals (same mailbox, domains on teams only this user is in); leave weak ones for the admin.
  useEffect(() => {
    if (!preview.data) return;
    setDomains(new Set(preview.data.domains.filter((d) => !d.sharedTeam).map((d) => d.name)));
    setRelated(new Set(preview.data.related.filter((r) => r.reason === "same_mailbox").map((r) => r.id)));
  }, [preview.data]);

  const ban = api.admin.banUser.useMutation({
    onSuccess: async () => {
      const extra = related.size ? ` and ${related.size} related account${related.size === 1 ? "" : "s"}` : "";
      toast.success(`Banned ${user.email ?? `#${user.id}`}${extra}`);
      onOpenChange(false);
      setReason("");
      await onDone();
    },
    onError: (error) => toast.error("Could not ban user", { description: error.message }),
  });

  const toggle = <T,>(set: Set<T>, value: T, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(value);
    else next.delete(value);
    return next;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ban {user.name ?? user.email ?? `#${user.id}`}</DialogTitle>
          <DialogDescription>
            They lose dashboard and API access. Choose what else to block so they can&apos;t simply come back.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            ban.mutate({
              userId: user.id,
              isBanned: true,
              reason,
              blockMailboxes,
              blockDomains: [...domains],
              alsoBanUserIds: [...related],
            });
          }}
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Phishing campaign from a dynamic-DNS domain"
            aria-label="Reason"
            rows={2}
            autoFocus
          />

          {preview.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : preview.data ? (
            <>
              <section className="space-y-1">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sign-ups</h4>
                <CheckRow
                  checked={blockMailboxes}
                  onChange={setBlockMailboxes}
                  title="Block their email addresses, including aliases"
                  detail={
                    preview.data.mailboxes.length
                      ? preview.data.mailboxes.join(", ")
                      : "No email addresses on this account"
                  }
                />
              </section>

              {preview.data.domains.length > 0 && (
                <section className="space-y-1">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sending domains
                  </h4>
                  {preview.data.domains.map((domain) => (
                    <CheckRow
                      key={domain.name}
                      checked={domains.has(domain.name)}
                      onChange={(on) => setDomains((current) => toggle(current, domain.name, on))}
                      title={<span className="font-mono text-xs">{domain.name}</span>}
                      detail={
                        domain.sharedTeam
                          ? `Team ${domain.teamName} has other members, so this isn't ticked by default`
                          : `Team ${domain.teamName}. Blocks re-adding it, and its subdomains, on any account`
                      }
                    />
                  ))}
                </section>
              )}

              {preview.data.related.length > 0 && (
                <section className="space-y-1">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Related accounts
                  </h4>
                  {preview.data.related.map((account) => (
                    <CheckRow
                      key={account.id}
                      checked={related.has(account.id)}
                      onChange={(on) => setRelated((current) => toggle(current, account.id, on))}
                      title={
                        <>
                          Also ban {account.email ?? account.name} <span className="font-mono text-xs">#{account.id}</span>
                        </>
                      }
                      detail={account.reason === "same_mailbox" ? "Same mailbox (email alias)" : "Same name, so double-check before banning"}
                    />
                  ))}
                </section>
              )}
            </>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={reason.trim().length < 3 || ban.isPending || preview.isLoading}>
              {ban.isPending ? "Banning…" : related.size ? `Ban ${related.size + 1} accounts` : "Ban user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
