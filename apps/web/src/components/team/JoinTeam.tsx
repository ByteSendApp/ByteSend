"use client";

import { Button } from "@bytesend/ui/src/button";
import { AuthDivider } from "~/components/auth/auth-shell";
import { Spinner } from "@bytesend/ui/src/spinner";
import { api } from "~/trpc/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@bytesend/ui/src/toaster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@bytesend/ui/src/dialog";
import { useState } from "react";
import type { AppRouter } from "~/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Invite = NonNullable<
  RouterOutputs["invitation"]["getUserInvites"]
>[number];

export default function JoinTeam({
  showCreateTeam = false,
}: {
  showCreateTeam?: boolean;
}) {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("inviteId");

  const { data: invites, status: invitesStatus } =
    api.invitation.getUserInvites.useQuery({
      inviteId,
    });
  const joinTeamMutation = api.invitation.acceptTeamInvite.useMutation();
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const utils = api.useUtils();
  const router = useRouter();

  const handleAcceptInvite = (invite: Invite) => {
    setSelectedInvite(invite);
    setDialogOpen(true);
  };

  const confirmAcceptInvite = () => {
    if (!selectedInvite) return;

    joinTeamMutation.mutate(
      {
        inviteId: selectedInvite.id,
      },
      {
        onSuccess: async () => {
          toast.success(`Successfully joined ${selectedInvite.team.name}`);
          await Promise.all([
            utils.invitation.getUserInvites.invalidate(),
            utils.team.getTeams.invalidate(),
          ]);
          setDialogOpen(false);
          router.replace("/dashboard");
        },
        onError: (error) => {
          toast.error(`Failed to join team: ${error.message}`);
          setDialogOpen(false);
        },
      }
    );
  };

  if (!invites?.length) {
    return !showCreateTeam ? <p className="text-sm text-muted-foreground">You don&apos;t have any team invitations.</p> : null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-foreground">You&apos;ve been invited</p>
        {invites.map((invite) => (
          <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground">{invite.team.name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {invite.role.toLowerCase()} · invited {invite.createdAt.toLocaleDateString()}
              </p>
            </div>
            <Button onClick={() => handleAcceptInvite(invite)} disabled={joinTeamMutation.isPending} size="sm">
              {joinTeamMutation.isPending ? <Spinner className="size-4" /> : "Join"}
            </Button>
          </div>
        ))}
      </div>
      {showCreateTeam ? <AuthDivider label="or start a new team" /> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {selectedInvite?.team.name}?</DialogTitle>
            <DialogDescription>
              You&apos;ll join as{" "}
              <span className="font-medium lowercase text-foreground">{selectedInvite?.role.toLowerCase()}</span> and can switch
              between teams from the sidebar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={joinTeamMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAcceptInvite}
              disabled={joinTeamMutation.isPending}
            >
              {joinTeamMutation.isPending ? (
                <Spinner className="w-5 h-5" />
              ) : (
                "Join team"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
