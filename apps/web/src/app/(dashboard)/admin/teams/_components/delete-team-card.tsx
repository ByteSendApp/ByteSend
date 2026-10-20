"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@bytesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bytesend/ui/src/dialog";
import { Input } from "@bytesend/ui/src/input";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";

export function DeleteTeamCard({ team }: { team: { id: number; name: string } }) {
  const router = useRouter();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const deleteTeam = api.admin.adminDeleteTeam.useMutation({
    onSuccess: async () => {
      toast.success(`${team.name} deleted`);
      await utils.admin.listTeams.invalidate();
      router.push("/admin/teams");
    },
    onError: (error) => toast.error("Could not delete team", { description: error.message }),
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-medium text-destructive">Delete team</h3>
        <p className="text-xs text-muted-foreground">
          Permanently deletes the team with its domains, emails, contacts and API keys.
        </p>
      </div>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete team
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmation("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {team.name}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Type <span className="font-mono text-foreground">{team.name}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-label="Team name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmation !== team.name || deleteTeam.isPending}
              onClick={() => deleteTeam.mutate({ teamId: team.id })}
            >
              {deleteTeam.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
