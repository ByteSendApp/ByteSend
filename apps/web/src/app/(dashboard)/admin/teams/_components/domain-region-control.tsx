"use client";

import { useState } from "react";
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
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { StatusPill } from "../../_components/status-pill";

export function DomainRegionControl({
  teamId,
  domain,
}: {
  teamId: number;
  domain: { id: number; name: string; region: string; status: string; pendingRegion: string | null; retiredRegion: string | null };
}) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState("");
  const regionsQuery = api.domain.getAvailableRegions.useQuery(undefined, { enabled: open });
  const regions = (regionsQuery.data ?? []).filter((option) => option !== domain.region);

  const refresh = async () => {
    await Promise.all([utils.admin.getTeamDetail.invalidate({ teamId }), utils.admin.listAuditLog.invalidate()]);
  };

  const start = api.admin.adminStartRegionMove.useMutation({
    onSuccess: async () => {
      toast.success(`Move to ${region} started. The customer must add the new DNS records.`);
      setOpen(false);
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const cancel = api.admin.adminCancelRegionMove.useMutation({
    onSuccess: async () => {
      toast.success("Region move cancelled");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  if (domain.pendingRegion) {
    return (
      <span className="inline-flex items-center gap-1">
        <StatusPill tone="warning">Moving → {domain.pendingRegion}</StatusPill>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-xs"
          disabled={cancel.isPending}
          onClick={() => {
            if (!window.confirm(`Cancel moving ${domain.name} to ${domain.pendingRegion}?`)) return;
            cancel.mutate({ domainId: domain.id });
          }}
        >
          Cancel
        </Button>
      </span>
    );
  }

  if (domain.status !== "SUCCESS" || domain.retiredRegion) return null;

  return (
    <>
      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => setOpen(true)}>
        Move region
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {domain.name}</DialogTitle>
            <DialogDescription>
              Registers the domain in the new region. Sending stays on <span className="font-mono">{domain.region}</span>{" "}
              until the customer adds the new DKIM and MX records and they verify. The customer sees the steps on their
              domain page.
            </DialogDescription>
          </DialogHeader>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger aria-label="New region">
              <SelectValue placeholder={regionsQuery.isLoading ? "Loading…" : "Choose a region"} />
            </SelectTrigger>
            <SelectContent>
              {regions.map((option) => (
                <SelectItem key={option} value={option} className="font-mono">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!region || start.isPending} onClick={() => start.mutate({ domainId: domain.id, region })}>
              {start.isPending ? "Starting…" : "Start move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
