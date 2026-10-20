"use client";

import { WebhookCallStatus, type Webhook } from "@prisma/client";
import { Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@bytesend/ui/src/button";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { Badge } from "@bytesend/ui/src/badge";
import { KeyValueList } from "@bytesend/ui/src/panel";
import { Stat, StatGroup } from "@bytesend/ui/src/stat";

export function WebhookInfo({ webhook }: { webhook: Webhook }) {
  const [showSecret, setShowSecret] = useState(false);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const callsQuery = api.webhook.listCalls.useQuery({
    webhookId: webhook.id,
    limit: 50,
  });
  const domainsQuery = api.domain.domains.useQuery();

  const calls = callsQuery.data?.items ?? [];
  const last7DaysCalls = calls.filter(
    (call) => new Date(call.createdAt) >= sevenDaysAgo,
  );

  const deliveredCount = last7DaysCalls.filter(
    (c) => c.status === WebhookCallStatus.DELIVERED,
  ).length;
  const failedCount = last7DaysCalls.filter(
    (c) => c.status === WebhookCallStatus.FAILED,
  ).length;
  const pendingCount = last7DaysCalls.filter(
    (c) =>
      c.status === WebhookCallStatus.PENDING ||
      c.status === WebhookCallStatus.IN_PROGRESS,
  ).length;

  const domainNameById = new Map(
    (domainsQuery.data ?? []).map((domain) => [domain.id, domain.name]),
  );
  const selectedDomainLabels = (webhook.domainIds ?? []).map(
    (domainId) => domainNameById.get(domainId) ?? `Domain #${domainId}`,
  );

  const handleCopySecret = () => {
    navigator.clipboard.writeText(webhook.secret);
    toast.success("Secret copied to clipboard");
  };

  const listOrAll = (items: string[], all: string) =>
    items.length === 0 ? (
      <span className="text-foreground">{all}</span>
    ) : (
      <span className="flex flex-wrap justify-end gap-1">
        {items.slice(0, 3).map((item) => (
          <Badge key={item} variant="neutral" className="font-mono text-[11px]">
            {item}
          </Badge>
        ))}
        {items.length > 3 ? <span className="text-xs text-muted-foreground">+{items.length - 3} more</span> : null}
      </span>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <StatGroup className="md:grid-flow-row md:grid-cols-3">
        <Stat label="Delivered · 7d" value={deliveredCount.toLocaleString()} />
        <Stat label="Failed · 7d" value={failedCount.toLocaleString()} tone={failedCount > 0 ? "danger" : "default"} />
        <Stat label="Pending" value={pendingCount.toLocaleString()} />
      </StatGroup>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <KeyValueList
          items={[
            { label: "Events", value: listOrAll(webhook.eventTypes, "All events") },
            { label: "Domains", value: listOrAll(selectedDomainLabels, "All domains") },
            {
              label: "Signing secret",
              value: (
                <span className="inline-flex items-center gap-1">
                  <code className="max-w-48 truncate font-mono text-xs font-normal">
                    {showSecret ? webhook.secret : "whsec_••••••••••••••••"}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSecret(!showSecret)}
                    className="size-6 text-muted-foreground hover:text-foreground"
                    aria-label={showSecret ? "Hide secret" : "Show secret"}
                  >
                    {showSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleCopySecret} className="size-6 text-muted-foreground hover:text-foreground" aria-label="Copy secret">
                    <Copy className="size-3.5" />
                  </Button>
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
