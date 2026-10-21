"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ArrowRight, Globe, RefreshCw } from "lucide-react";
import { DomainStatus } from "@prisma/client";
import type { inferRouterOutputs } from "@trpc/server";
import { Button } from "@bytesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bytesend/ui/src/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";
import { CopyField } from "@bytesend/ui/src/copy-field";
import { RegionLabel } from "~/components/dashboard/region-label";
import { toast } from "@bytesend/ui/src/toaster";
import type { AppRouter } from "~/server/api/root";
import { useTeam } from "~/providers/team-context";
import { api } from "~/trpc/react";
import { DnsStatusBadge } from "./dns-status-badge";

type DomainResponse = NonNullable<inferRouterOutputs<AppRouter>["domain"]["getDomain"]>;

function StartMoveDialog({
  domain,
  open,
  onOpenChange,
}: {
  domain: DomainResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const regionsQuery = api.domain.getAvailableRegions.useQuery(undefined, { enabled: open });
  const regions = (regionsQuery.data ?? []).filter((region) => region !== domain.region);
  const [region, setRegion] = useState<string>("");

  const start = api.domain.startRegionMove.useMutation({
    onSuccess: async () => {
      toast.success("Region move started. Add the new DNS records below.");
      onOpenChange(false);
      await utils.domain.getDomain.invalidate({ id: domain.id });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change sending region</DialogTitle>
          <DialogDescription>
            {domain.name} keeps sending from <span className="font-mono">{domain.region}</span> until the new region is
            verified, so there is no downtime. You&apos;ll add one new DKIM record and update your MX record.
          </DialogDescription>
        </DialogHeader>
        {regionsQuery.isLoading ? (
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        ) : regions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other sending regions are available.</p>
        ) : (
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger aria-label="New region">
              <SelectValue placeholder="Choose a region" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((option) => (
                <SelectItem key={option} value={option} className="font-mono">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!region || start.isPending}
            isLoading={start.isPending}
            onClick={() => start.mutate({ id: domain.id, region })}
          >
            Start move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RegionMoveCard({ domain }: { domain: DomainResponse }) {
  const utils = api.useUtils();
  const { currentIsAdmin } = useTeam();
  const [dialogOpen, setDialogOpen] = useState(false);
  const move = domain.regionMove;

  const check = api.domain.checkRegionMove.useMutation({
    onSuccess: async (result) => {
      if (result.switched) {
        toast.success(`${domain.name} now sends from ${move?.toRegion}`);
      } else {
        const missing = [
          result.dnsPrecheck?.dkim !== "found" ? "DKIM record" : null,
          result.dnsPrecheck?.mx !== "found" ? "MX record" : null,
        ].filter(Boolean);
        toast.info(
          missing.length
            ? `Not visible in DNS yet: ${missing.join(" and ")}. DNS changes can take up to an hour.`
            : "Records found. Waiting for AWS to confirm. This usually takes a few minutes.",
        );
      }
      await utils.domain.getDomain.invalidate({ id: domain.id });
    },
    onError: (error) => toast.error(error.message),
  });

  const cancel = api.domain.cancelRegionMove.useMutation({
    onSuccess: async () => {
      toast.success("Region move cancelled");
      await utils.domain.getDomain.invalidate({ id: domain.id });
    },
    onError: (error) => toast.error(error.message),
  });

  if (!move) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">Sending region</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mail for this domain is sent from <RegionLabel region={domain.region} full />.
              {domain.retiredRegion && domain.retiredRegionAt
                ? ` The previous region (${domain.retiredRegion}) is retired after ${format(
                    new Date(new Date(domain.retiredRegionAt).getTime() + 24 * 60 * 60 * 1000),
                    "MMM d, HH:mm",
                  )}; ${
                    domain.inboundEnabled && !domain.inboundDkimSelector
                      ? "keep its old DKIM record, because the mail you receive still uses it."
                      : "you can remove its old DKIM record after that."
                  }`
                : ""}
            </p>
          </div>
        </div>
        {currentIsAdmin && domain.status === DomainStatus.SUCCESS && !domain.retiredRegion ? (
          <>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setDialogOpen(true)}>
              Change region
            </Button>
            <StartMoveDialog domain={domain} open={dialogOpen} onOpenChange={setDialogOpen} />
          </>
        ) : null}
      </div>
    );
  }

  const [dkimRecord, mxRecord] = move.records;

  return (
    <div className="overflow-hidden rounded-lg border border-warning/30 bg-card">
      <div className="flex flex-col gap-3 border-b border-warning/20 bg-warning/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Moving region
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-normal text-muted-foreground">
              {move.fromRegion} <ArrowRight className="h-3 w-3" /> {move.toRegion}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Still sending from {move.fromRegion}. We switch automatically once both records below verify
            {move.startedAt ? ` · started ${format(new Date(move.startedAt), "MMM d, HH:mm")}` : ""}.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={check.isPending}
            onClick={() => check.mutate({ id: domain.id })}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${check.isPending ? "animate-spin" : ""}`} />
            Check now
          </Button>
          {currentIsAdmin ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={cancel.isPending}
              onClick={() => {
                if (!window.confirm(`Cancel the move to ${move.toRegion}? Sending stays on ${move.fromRegion}.`)) return;
                cancel.mutate({ id: domain.id });
              }}
            >
              Cancel move
            </Button>
          ) : null}
        </div>
      </div>

      <ol className="divide-y divide-border/70">
        {dkimRecord ? (
          <li className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">
                <span className="font-semibold">1.</span> Add a new DKIM <span className="font-mono text-xs">TXT</span>{" "}
                record <span className="text-muted-foreground">(keep the existing one until the move finishes)</span>
              </p>
              <DnsStatusBadge status={dkimRecord.status} />
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-[6rem_1fr]">
              <span className="text-muted-foreground">Name</span>
              <CopyField value={dkimRecord.name} />
              <span className="text-muted-foreground">Value</span>
              <CopyField value={dkimRecord.value} />
            </div>
          </li>
        ) : null}
        {mxRecord ? (
          <li className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">
                <span className="font-semibold">2.</span> Change the <span className="font-mono text-xs">MX</span> record
                on <span className="font-mono text-xs">{mxRecord.name}</span> to the new region
              </p>
              <DnsStatusBadge status={mxRecord.status} />
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-[6rem_1fr]">
              <span className="text-muted-foreground">Value</span>
              <CopyField value={mxRecord.value} />
              <span className="text-muted-foreground">Priority</span>
              <span>{mxRecord.priority}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Replace the current value (<span className="font-mono">feedback-smtp.{move.fromRegion}.amazonses.com</span>).
              Until the switch, bounces still reach us and mail still passes DMARC through DKIM.
            </p>
          </li>
        ) : null}
      </ol>
    </div>
  );
}
