"use client";

import { useState } from "react";
import { Button } from "@bytesend/ui/src/button";
import { PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bytesend/ui/src/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";
import { Input } from "@bytesend/ui/src/input";
import { useForm } from "react-hook-form";
import { api } from "~/trpc/react";
import { toast } from "@bytesend/ui/src/toaster";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bytesend/ui/src/form";
import { useTeam } from "~/providers/team-context";
import { isCloud, isSelfHosted } from "~/utils/common";
import { useUpgradeModalStore } from "~/store/upgradeModalStore";
import { LimitReason } from "~/lib/constants/plans";

const inviteTeamMemberSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"], {
    required_error: "Please select a role",
  }),
});

type FormData = z.infer<typeof inviteTeamMemberSchema>;

export default function InviteTeamMember() {
  const { currentIsAdmin } = useTeam();
  const { data: domains } = api.domain.domains.useQuery();

  const limitsQuery = api.limits.get.useQuery({
    type: LimitReason.TEAM_MEMBER,
  });
  const { openModal } = useUpgradeModalStore((s) => s.action);

  const [open, setOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(inviteTeamMemberSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
  });

  const utils = api.useUtils();

  const createInvite = api.team.createTeamInvite.useMutation();
  const purchaseMemberAddonMutation = api.billing.purchaseAddonMemberSlots.useMutation();

  // Calculate remaining slots
  const remaining = limitsQuery.data
    ? limitsQuery.data.limit === -1
      ? -1
      : limitsQuery.data.limit - limitsQuery.data.currentCount
    : 0;
  const isAtLimit = limitsQuery.data?.isLimitReached ?? false;

  function onSubmit(values: FormData) {
    if (limitsQuery.data?.isLimitReached) {
      openModal(limitsQuery.data.reason);
      return;
    }

    createInvite.mutate(
      {
        email: values.email,
        role: values.role,
        sendEmail: true,
      },
      {
        onSuccess: () => {
          form.reset();
          setOpen(false);
          void utils.team.getTeamInvites.invalidate();
          toast.success("Invitation sent successfully");
        },
        onError: (error) => {
          console.error(error);
          toast.error(error.message || "Failed to send invitation");
        },
      },
    );
  }

  async function onCopyLink() {
    if (limitsQuery.data?.isLimitReached) {
      openModal(limitsQuery.data.reason);
      return;
    }

    createInvite.mutate(
      {
        email: form.getValues("email"),
        role: form.getValues("role"),
        sendEmail: false,
      },
      {
        onSuccess: (invite) => {
          void utils.team.getTeamInvites.invalidate();
          navigator.clipboard.writeText(
            `${location.origin}/join-team?inviteId=${invite.id}`,
          );
          form.reset();
          setOpen(false);
          toast.success("Invitation link copied to clipboard");
        },
        onError: (error) => {
          console.error(error);
          toast.error(error.message || "Failed to copy invitation link");
        },
      },
    );
  }

  function onOpenChange(_open: boolean) {
    setOpen(_open);
  }

  if (!currentIsAdmin) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_open) => (_open !== open ? onOpenChange(_open) : null)}
    >
      <DialogTrigger asChild>
        <div className="flex items-center gap-2">
          <Button size="sm">
            <PlusIcon className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
          {/* Show usage counter next to button */}
          {limitsQuery.data && limitsQuery.data.limit !== -1 && (
            <span className="text-xs text-muted-foreground">
              {limitsQuery.data.currentCount} / {limitsQuery.data.limit}
            </span>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          {limitsQuery.data && limitsQuery.data.limit !== -1 && (
            <div className="text-sm text-muted-foreground pt-1">
              Using {limitsQuery.data.currentCount} of {limitsQuery.data.limit} member slots
            </div>
          )}
        </DialogHeader>
        <div className="space-y-6 pt-4">
          {!isAtLimit && (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, formState }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="colleague@example.com" {...field} />
                      </FormControl>
                      {formState.errors.email ? (
                        <FormMessage />
                      ) : (
                        <FormDescription>
                          Enter your colleague's email address
                        </FormDescription>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <div className="capitalize">{field.value.toLowerCase()}</div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ADMIN">
                            <div>Admin</div>
                            <div className="text-xs text-muted-foreground">Manage users, update payments</div>
                          </SelectItem>
                          <SelectItem value="MEMBER">
                            <div>Member</div>
                            <div className="text-xs text-muted-foreground">Manage emails, domains and contacts</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isSelfHosted() && domains?.length ? (
                  <div className="text-sm text-muted-foreground">
                    Will use <span className="font-bold">hello@{domains[0]?.name}</span> to send invitation
                  </div>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  {isSelfHosted() ? (
                    <Button
                      disabled={createInvite.isPending || limitsQuery.isLoading}
                      isLoading={createInvite.isPending}
                      className="w-37.5"
                      onClick={form.handleSubmit(onCopyLink)}
                    >
                      Copy Invitation
                    </Button>
                  ) : null}
                  {isCloud() || domains?.length ? (
                    <Button
                      type="submit"
                      disabled={createInvite.isPending || limitsQuery.isLoading}
                      isLoading={createInvite.isPending}
                      className="w-37.5"
                    >
                      Send Invitation
                    </Button>
                  ) : null}
                </div>
              </form>
            </Form>
          )}

          <div className="border-t border-border/40 pt-4">
            {isAtLimit && (
              <p className="text-sm text-muted-foreground mb-3">
                You've reached your team member limit of {limitsQuery.data?.limit}. Purchase an extra slot to invite more.
              </p>
            )}
            {!isAtLimit && (
              <p className="text-sm text-muted-foreground mb-3">
                Need more seats? Purchase extra member slots for $2/mo each.
              </p>
            )}
            <Button
              onClick={async () => {
                try {
                  const url = await purchaseMemberAddonMutation.mutateAsync({ quantity: 1 });
                  window.location.href = url;
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to open checkout");
                }
              }}
              disabled={purchaseMemberAddonMutation.isPending}
              className="w-full"
              variant="outline"
            >
              {purchaseMemberAddonMutation.isPending ? "Opening checkout…" : "Buy 1 extra member slot ($2/mo)"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
