"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { Callout } from "@bytesend/ui/src/callout";
import { CopyField } from "@bytesend/ui/src/copy-field";
import { EmptyState, ListSkeleton } from "@bytesend/ui/src/empty-state";
import { Input } from "@bytesend/ui/src/input";
import { Panel } from "@bytesend/ui/src/panel";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { useTeam } from "~/providers/team-context";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";

type ReceivingDomain = inferRouterOutputs<AppRouter>["inbound"]["domains"][number];

function DomainReceiving({ domain, canEdit }: { domain: ReceivingDomain; canEdit: boolean }) {
  const [subdomain, setSubdomain] = useState("reply");
  const [mode, setMode] = useState<"subdomain" | "root">("subdomain");
  const [confirmed, setConfirmed] = useState(false);
  const mailHosts = api.inbound.mailHosts.useQuery({ domainId: domain.id }, { enabled: mode === "root" && !domain.inboundEnabled });
  const otherMailbox = mailHosts.data && mailHosts.data.hosts.length > 0 && !mailHosts.data.alreadyByteSend;
  const utils = api.useUtils();
  const refresh = () => utils.inbound.domains.invalidate();

  const enable = api.inbound.enableDomain.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const check = api.inbound.checkDomain.useMutation({
    onSuccess: async (result) => {
      await refresh();
      if (result.domain.inboundStatus === "SUCCESS") toast.success(`${domain.address ?? domain.name} is ready to receive mail`);
      else toast.message(result.mx ? "MX found. Still waiting for the DKIM record." : "We can't see the MX record yet. DNS can take a while to update.");
    },
    onError: (e) => toast.error(e.message),
  });
  const disable = api.inbound.disableDomain.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });

  if (!domain.inboundEnabled) {
    return (
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">{domain.name}</p>
          <p className="text-xs text-muted-foreground">
            {domain.status === "SUCCESS" ? "Not receiving. Receive on a subdomain, or on the domain itself." : "Verify this domain for sending first."}
          </p>
        </div>
        {canEdit && domain.status === "SUCCESS" ? (
          <form
            className="flex flex-col gap-2 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              enable.mutate({ domainId: domain.id, subdomain: mode === "root" ? "@" : subdomain, confirmRoot: mode === "root" });
            }}
          >
            <div role="radiogroup" aria-label="Where to receive" className="inline-flex rounded-md border border-border bg-muted/50 p-0.5 text-xs">
              {(
                [
                  ["subdomain", "A subdomain"],
                  ["root", "The domain itself"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => {
                    setMode(value);
                    setConfirmed(false);
                  }}
                  className={`rounded-[5px] px-2.5 py-1 font-medium transition-colors ${
                    mode === value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {mode === "subdomain" ? (
                <div className="flex h-8 items-center rounded-md border border-input bg-background text-[13px] shadow-xs focus-within:ring-2 focus-within:ring-ring/20">
                  <Input
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                    className="h-full w-24 border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0"
                    aria-label="Subdomain"
                  />
                  <span className="pr-2 text-muted-foreground">.{domain.name}</span>
                </div>
              ) : (
                <span className="font-mono text-[13px] text-foreground">anything@{domain.name}</span>
              )}
              <Button size="sm" type="submit" isLoading={enable.isPending} disabled={mode === "root" && (mailHosts.isLoading || (otherMailbox && !confirmed))}>
                Set up
              </Button>
            </div>
            {mode === "root" && mailHosts.data ? (
              otherMailbox ? (
                <div className="max-w-md rounded-md border border-warning/30 bg-warning/[0.07] p-3 text-xs text-foreground sm:text-left">
                  <p>
                    Mail for <span className="font-medium">{domain.name}</span> currently goes to{" "}
                    <span className="font-medium">{mailHosts.data.provider ?? mailHosts.data.hosts[0]!.host}</span>. Receiving here sends{" "}
                    <span className="font-medium">all</span> of it to ByteSend instead, so those mailboxes stop getting new mail. Use a subdomain if
                    you want to keep them, or forwarding rules to pass addresses on.
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-muted-foreground">
                    <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                    I understand all mail for {domain.name} will come to ByteSend
                  </label>
                </div>
              ) : (
                <p className="max-w-md text-xs text-muted-foreground sm:text-right">
                  {mailHosts.data.alreadyByteSend ? `${domain.name} already points at ByteSend.` : `${domain.name} doesn't receive mail anywhere else today, so nothing else is affected.`}
                </p>
              )
            ) : null}
          </form>
        ) : null}
      </div>
    );
  }

  const ready = domain.inboundStatus === "SUCCESS";
  return (
    <div className="space-y-3 border-b border-border/70 px-4 py-3.5 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-medium text-foreground">*@{domain.address}</p>
          <Badge variant={ready ? "success" : "warning"} dot>
            {ready ? "Receiving" : "Waiting for DNS"}
          </Badge>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => check.mutate({ domainId: domain.id })} isLoading={check.isPending}>
            <RefreshCw className="size-3.5" />
            Check DNS
          </Button>
          {canEdit ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => disable.mutate({ domainId: domain.id })}
              disabled={disable.isPending}
            >
              Turn off
            </Button>
          ) : null}
        </div>
      </div>
      {!ready ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Add these records at your DNS provider for {domain.name}:</p>
          {domain.records.map((record) => (
            <div key={`${record.type}-${record.name}`} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.6fr)] sm:items-center">
              <span className="font-mono text-[11px] text-muted-foreground">
                {record.type}
                {record.priority ? ` ${record.priority}` : ""}
              </span>
              <CopyField value={record.name} />
              <CopyField value={record.value} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {domain.inboundSubdomain === "@"
              ? `All mail for ${domain.name} will come to ByteSend once this MX record is in place, replacing any existing MX records. Add forwarding rules for addresses that should still reach a mailbox.`
              : `Only this subdomain's mail comes to ByteSend. Your normal mailboxes on ${domain.name} aren't affected.`}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ReceivingAddresses({ hostedAddress, region }: { hostedAddress: string | null; region?: string }) {
  const { currentIsAdmin } = useTeam();
  const domains = api.inbound.domains.useQuery();

  return (
    <div className="space-y-4">
      {hostedAddress ? (
        <Panel title="Your hosted address" description="Works straight away with no DNS changes. Add +anything before the @ to tell senders apart, like orders+42@.">
          <CopyField value={hostedAddress} className="max-w-md" />
        </Panel>
      ) : null}

      <Panel flush title="Your domains" description={`Receive on a subdomain like reply.yourdomain.com, or on the domain itself. Mail is received in ${region ?? "us-east-1"}.`}>
        {domains.isLoading ? (
          <ListSkeleton rows={2} />
        ) : !domains.data?.length ? (
          <EmptyState
            className="py-10"
            title="No domains yet"
            description="Add and verify a sending domain first, then come back to receive on it."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/domains?add=1">Add a domain</Link>
              </Button>
            }
          />
        ) : (
          domains.data.map((domain) => <DomainReceiving key={domain.id} domain={domain} canEdit={currentIsAdmin} />)
        )}
      </Panel>

      <Callout tone="info" title="Getting the mail into your app">
        Add a webhook for the <code className="font-mono">email.received</code> event, or fetch messages with{" "}
        <code className="font-mono">GET /v1/inbound/emails</code>. Attachments come as signed links that work for an hour.
      </Callout>
    </div>
  );
}
