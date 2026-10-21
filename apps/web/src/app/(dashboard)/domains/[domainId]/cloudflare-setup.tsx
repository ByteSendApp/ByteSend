"use client";

import { useState } from "react";
import { ExternalLink, Zap } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { Badge } from "@bytesend/ui/src/badge";
import { Button } from "@bytesend/ui/src/button";
import { Callout } from "@bytesend/ui/src/callout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@bytesend/ui/src/dialog";
import { Input } from "@bytesend/ui/src/input";
import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";

type Outcome = inferRouterOutputs<AppRouter>["domain"]["setUpCloudflare"][number];

const STATUS: Record<Outcome["status"], { label: string; variant: "success" | "neutral" | "warning" | "danger" }> = {
  created: { label: "Added", variant: "success" },
  updated: { label: "Updated", variant: "success" },
  exists: { label: "Already set", variant: "neutral" },
  conflict: { label: "Needs you", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
};

export function CloudflareSetup({ domainId, domainName }: { domainId: number; domainName: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const utils = api.useUtils();
  const setUp = api.domain.setUpCloudflare.useMutation({
    onSuccess: () => {
      setToken("");
      void utils.domain.getDomain.invalidate({ id: domainId });
    },
  });
  const outcomes = setUp.data;
  const needsAttention = outcomes?.some((o) => o.status === "conflict" || o.status === "failed");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setToken("");
          setUp.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Zap className="size-3.5" />
          Set up on Cloudflare
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add the records on Cloudflare</DialogTitle>
          <DialogDescription>We add the DNS records for {domainName} for you. Nothing you already have is removed.</DialogDescription>
        </DialogHeader>

        {outcomes ? (
          <div className="space-y-3">
            <ul className="divide-y divide-border rounded-md border border-border text-[13px]">
              {outcomes.map((outcome) => (
                <li key={`${outcome.type}-${outcome.name}`} className="space-y-1 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-mono text-xs">
                      <span className="text-muted-foreground">{outcome.type}</span> {outcome.name}
                    </span>
                    <Badge variant={STATUS[outcome.status].variant} className="shrink-0">
                      {STATUS[outcome.status].label}
                    </Badge>
                  </div>
                  {outcome.message ? <p className="text-xs text-muted-foreground">{outcome.message}</p> : null}
                </li>
              ))}
            </ul>
            {needsAttention ? (
              <Callout tone="warning">Fix the records marked above in Cloudflare, then run this again or click Verify.</Callout>
            ) : (
              <Callout tone="success">Done. We&apos;re checking the records now, which usually takes a few minutes.</Callout>
            )}
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setUp.mutate({ id: domainId, token });
            }}
          >
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-muted-foreground">
              <li>
                Open{" "}
                <a
                  href="https://dash.cloudflare.com/profile/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  API tokens in Cloudflare <ExternalLink className="size-3" />
                </a>{" "}
                and click Create Token.
              </li>
              <li>
                Use the <span className="text-foreground">Edit zone DNS</span> template, and pick {domainName} under Zone Resources.
              </li>
              <li>Create it and paste it below. You can delete it in Cloudflare straight after.</li>
            </ol>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cloudflare API token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">The token is used once for this request and never stored.</p>
            {setUp.error ? <Callout tone="danger">{setUp.error.message}</Callout> : null}
            <DialogFooter>
              <Button type="submit" isLoading={setUp.isPending} disabled={token.trim().length < 20}>
                Add records
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
