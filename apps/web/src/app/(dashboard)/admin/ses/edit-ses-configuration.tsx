"use client";

import { Button } from "@bytesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@bytesend/ui/src/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bytesend/ui/src/dropdown-menu";
import { Edit, EllipsisVertical, Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "~/trpc/react";
import { Input } from "@bytesend/ui/src/input";
import { toast } from "@bytesend/ui/src/toaster";
import Spinner from "@bytesend/ui/src/spinner";
import { SesSetting } from "@prisma/client";

const FormSchema = z.object({
  settingsId: z.string(),
  sendRate: z.coerce.number(),
  transactionalQuota: z.coerce.number().min(0).max(100),
});

export default function SesConfigurationActions({
  setting,
}: {
  setting: SesSetting;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const utils = api.useUtils();

  const toggleActive = api.admin.toggleSesSettingsActive.useMutation({
    onSuccess: () => {
      utils.admin.getSesSettings.invalidate();
      toast.success(
        setting.isActive
          ? `${setting.region} marked as inactive`
          : `${setting.region} marked as active`
      );
    },
    onError: (e) => toast.error("Failed to update status", { description: e.message }),
  });

  const deleteSetting = api.admin.deleteSesSettings.useMutation({
    onSuccess: () => {
      utils.admin.getSesSettings.invalidate();
      setDeleteOpen(false);
      toast.success(`${setting.region} configuration deleted`);
    },
    onError: (e) => toast.error("Failed to delete", { description: e.message }),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 data-[state=open]:bg-muted"
          >
            <EllipsisVertical className="h-4 w-4" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            {setting.region}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              toggleActive.mutate({
                settingsId: setting.id,
                isActive: !setting.isActive,
              })
            }
            disabled={toggleActive.isPending}
          >
            {setting.isActive ? (
              <>
                <PowerOff className="mr-2 h-4 w-4 text-amber-500" />
                <span className="text-amber-500">Set inactive</span>
              </>
            ) : (
              <>
                <Power className="mr-2 h-4 w-4 text-emerald-500" />
                <span className="text-emerald-500">Set active</span>
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => (o !== editOpen ? setEditOpen(o) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit SES configuration</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <EditSesSettingsForm
              setting={setting}
              onSuccess={() => setEditOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => (o !== deleteOpen ? setDeleteOpen(o) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SES configuration</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the{" "}
              <span className="font-semibold text-foreground">
                {setting.region}
              </span>{" "}
              configuration? This will also delete the associated SNS topic and
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteSetting.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  deleteSetting.mutate({ settingsId: setting.id })
                }
                disabled={deleteSetting.isPending}
              >
                {deleteSetting.isPending ? (
                  <Spinner className="w-4 h-4" />
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type SesSettingsProps = {
  setting: SesSetting;
  onSuccess?: () => void;
};

export const EditSesSettingsForm: React.FC<SesSettingsProps> = ({
  setting,
  onSuccess,
}) => {
  const updateSesSettings = api.admin.updateSesSettings.useMutation();

  const utils = api.useUtils();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      settingsId: setting.id,
      sendRate: setting.sesEmailRateLimit,
      transactionalQuota: setting.transactionalQuota,
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    updateSesSettings.mutate(data, {
      onSuccess: () => {
        utils.admin.invalidate();
        onSuccess?.();
      },
      onError: (e) => {
        toast.error("Failed to update", {
          description: e.message,
        });
      },
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className=" flex flex-col gap-8 w-full"
      >
        <FormField
          control={form.control}
          name="sendRate"
          render={({ field, formState }) => (
            <FormItem>
              <FormLabel>Send Rate</FormLabel>
              <FormControl>
                <Input placeholder="1" className="w-full" {...field} />
              </FormControl>
              {formState.errors.sendRate ? (
                <FormMessage />
              ) : (
                <FormDescription>
                  The number of emails to send per second.
                </FormDescription>
              )}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="transactionalQuota"
          render={({ field, formState }) => (
            <FormItem>
              <FormLabel>Transactional Quota</FormLabel>
              <FormControl>
                <Input placeholder="0" className="w-full" {...field} />
              </FormControl>
              {formState.errors.transactionalQuota ? (
                <FormMessage />
              ) : (
                <FormDescription>
                  The percentage of the quota to be used for transactional
                  emails (0-100%).
                </FormDescription>
              )}
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={updateSesSettings.isPending}
          className="w-[200px] mx-auto"
        >
          {updateSesSettings.isPending ? (
            <Spinner className="w-5 h-5" />
          ) : (
            "Update"
          )}
        </Button>
      </form>
    </Form>
  );
};
