"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";

import { Button } from "@bytesend/ui/src/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@bytesend/ui/src/form";
import { Input } from "@bytesend/ui/src/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bytesend/ui/src/dialog";
import { toast } from "@bytesend/ui/src/toaster";
import { Callout } from "@bytesend/ui/src/callout";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { Panel, SettingRow } from "@bytesend/ui/src/panel";
import { TeamAvatar } from "~/components/dashboard/team-avatar";

import { api } from "~/trpc/react";
import { useTeam } from "~/providers/team-context";

const teamSettingsSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters"),
});
type FormData = z.infer<typeof teamSettingsSchema>;

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export default function TeamGeneralSettings() {
  const { currentTeam, currentIsAdmin } = useTeam();
  const utils = api.useUtils();
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(
    currentTeam?.image ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateTeamMutation = api.team.updateTeam.useMutation();
  const deleteTeamMutation = api.team.deleteTeam.useMutation();

  const form = useForm<FormData>({
    resolver: zodResolver(teamSettingsSchema),
    defaultValues: { name: currentTeam?.name ?? "" },
  });

  async function onSaveName(data: FormData) {
    updateTeamMutation.mutate(
      { name: data.name },
      {
        onSuccess: () => {
          utils.team.getTeams.invalidate();
          toast.success("Team name updated");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, WebP or GIF image");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be smaller than 2 MB");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("teamId", String(currentTeam?.id));
      fd.append("type", "team-image");

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error ?? "Upload failed");
      }
      const { publicUrl } = await res.json() as { publicUrl: string };

      await updateTeamMutation.mutateAsync({ image: publicUrl });
      setImagePreview(publicUrl);
      utils.team.getTeams.invalidate();
      toast.success("Team image updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveImage() {
    updateTeamMutation.mutate(
      { image: null },
      {
        onSuccess: () => {
          setImagePreview(null);
          utils.team.getTeams.invalidate();
          toast.success("Team image removed");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  async function handleDeleteTeam() {
    deleteTeamMutation.mutate(undefined, {
      onSuccess: () => {
        utils.team.getTeams.invalidate();
        toast.success("Team deleted");
        setDeleteOpen(false);
        router.replace("/dashboard");
      },
      onError: (e) => toast.error(e.message),
    });
  }

  const header = <PageHeader title="General" description="Your team's name and image, as shown to members and in the team switcher." />;

  if (!currentIsAdmin) {
    return (
      <>
        {header}
        <Callout tone="info" title="Only team admins can change these settings">
          Ask an admin of {currentTeam?.name ?? "this team"} if something needs updating.
        </Callout>
      </>
    );
  }

  return (
    <>
      {header}

      <Panel flush title="Team profile">
        <SettingRow
          title="Image"
          description="Square images work best. JPEG, PNG, WebP or GIF, up to 2 MB."
          control={
            <div className="flex items-center gap-3">
              <TeamAvatar image={imagePreview} name={currentTeam?.name ?? "Team"} size={40} />
              <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="hidden" onChange={handleImageChange} />
              <Button variant="outline" size="sm" isLoading={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" />
                {imagePreview ? "Change" : "Upload"}
              </Button>
              {imagePreview ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={handleRemoveImage}
                  disabled={updateTeamMutation.isPending}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          }
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSaveName)}>
            <SettingRow
              title="Name"
              description="Shown to everyone in the team."
              control={
                <div className="flex w-full items-start gap-2 sm:w-80">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="My team" className="h-8" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="sm" isLoading={updateTeamMutation.isPending} disabled={!form.formState.isDirty}>
                    Save
                  </Button>
                </div>
              }
            />
          </form>
        </Form>
      </Panel>

      <Panel flush tone="danger" title="Danger zone">
        <SettingRow
          title="Delete this team"
          description="Permanently removes its domains, emails, contacts, campaigns and API keys. This can't be undone."
          control={
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-3.5" />
                  Delete team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {currentTeam?.name}?</DialogTitle>
                  <DialogDescription>
                    Everything in this team is deleted for good: domains, emails, contacts, campaigns and API keys.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <p className="text-[13px] text-muted-foreground">
                    Type <span className="font-mono font-medium text-foreground">{currentTeam?.name}</span> to confirm.
                  </p>
                  <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={currentTeam?.name} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={confirmName !== currentTeam?.name}
                    isLoading={deleteTeamMutation.isPending}
                    onClick={handleDeleteTeam}
                  >
                    Delete team
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
      </Panel>
    </>
  );
}
