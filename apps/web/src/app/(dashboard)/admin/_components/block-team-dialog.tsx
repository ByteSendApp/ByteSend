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
import { Textarea } from "@bytesend/ui/src/textarea";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";

export function BlockTeamDialog({
  team,
  open,
  onOpenChange,
}: {
  team: { id: number; name: string; isBlocked: boolean } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const utils = api.useUtils();
  const willBlock = !team?.isBlocked;

  const mutation = api.admin.setTeamBlocked.useMutation({
    onSuccess: async (updated) => {
      toast.success(updated.isBlocked ? `${updated.name} blocked` : `${updated.name} unblocked`);
      setReason("");
      onOpenChange(false);
      await Promise.all([
        utils.admin.listDeliverability.invalidate(),
        utils.admin.getOverview.invalidate(),
        utils.admin.listAuditLog.invalidate(),
        utils.admin.listTeams.invalidate(),
        utils.admin.getTeamDetail.invalidate({ teamId: updated.id }),
      ]);
    },
    onError: (error) => toast.error("Could not update team", { description: error.message }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {willBlock ? "Block" : "Unblock"} {team?.name}
          </DialogTitle>
          <DialogDescription>
            {willBlock
              ? "All sending for this team will be rejected until it is unblocked. The reason is saved to the audit log."
              : "The team will be able to send again, subject to its normal limits. The reason is saved to the audit log."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!team) return;
            mutation.mutate({ teamId: team.id, isBlocked: willBlock, reason });
          }}
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={willBlock ? "e.g. 3.4% hard-bounce rate, purchased list suspected" : "e.g. list cleaned, reviewed with customer"}
            aria-label="Reason"
            rows={3}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={willBlock ? "destructive" : "default"}
              disabled={reason.trim().length < 3 || mutation.isPending}
            >
              {mutation.isPending ? "Saving…" : willBlock ? "Block team" : "Unblock team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
