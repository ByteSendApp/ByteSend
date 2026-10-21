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
  const utils = api.useUtils();
  const refresh = () => utils.inbound.domains.invalidate();

  const enable = api.inbound.enableDomain.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const check = api.inbound.checkDomain.useMutation({
    onSuccess: async (result) => {
      await refresh();
      if (result.domain.inboundStatus === "SUCCESS") toast.success(`${result.domain.inboundSubdomain}.${domain.name} is ready to receive mail`);
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
            {domain.status === "SUCCESS" ? "Not receiving. Pick a subdomain to receive on." : "Verify this domain for sending first."}
          </p>
        </div>
        {canEdit && domain.status === "SUCCESS" ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              enable.mutate({ domainId: domain.id, subdomain });
            }}
          >
            <div className="flex h-8 items-center rounded-md border border-input bg-background text-[13px] shadow-xs focus-within:ring-2 focus-within:ring-ring/20">
              <Input
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                className="h-full w-24 border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0"
                aria-label="Subdomain"
              />
              <span className="pr-2 text-muted-foreground">.{domain.name}</span>
            </div>
            <Button size="sm" type="submit" isLoading={enable.isPending}>
              Set up
            </Button>
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
            Only this subdomain&apos;s mail comes to ByteSend. Your normal mailboxes on {domain.name} aren&apos;t affected.
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

      <Panel flush title="Your domains" description={`Receive on a subdomain of a domain you send from. Mail is received in ${region ?? "us-east-1"}.`}>
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
