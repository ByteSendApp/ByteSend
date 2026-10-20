"use client";

import { Button } from "@bytesend/ui/src/button";
import { api } from "~/trpc/react";
import { toast } from "@bytesend/ui/src/toaster";
import { Copy, RotateCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@bytesend/ui/src/tooltip";
import { isSelfHosted } from "~/utils/common";

export const ResendTeamInvite: React.FC<{
  invite: { id: string; email: string };
}> = ({ invite }) => {
  const resendInviteMutation = api.team.resendTeamInvite.useMutation();

  async function onResendInvite() {
    resendInviteMutation.mutate(
      {
        inviteId: invite.id,
      },
      {
        onSuccess: async () => {
          toast.success(`Invite resent to ${invite.email}`);
        },
        onError: async (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" aria-label="Resend invite" onClick={onResendInvite}>
            <RotateCw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Resend invite</p>
        </TooltipContent>
      </Tooltip>

      {isSelfHosted() ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label="Copy invite link"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${location.origin}/join-team?inviteId=${invite.id}`
                );
                toast.success(`Invite link copied to clipboard`);
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy invite link</p>
          </TooltipContent>
        </Tooltip>
      ) : null}
    </TooltipProvider>
  );
};

export default ResendTeamInvite;
