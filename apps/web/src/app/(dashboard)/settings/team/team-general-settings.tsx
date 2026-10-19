"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2, Upload, ImageIcon } from "lucide-react";

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

  return (
    <div className="flex flex-col gap-8 mt-6">
      {!currentIsAdmin ? null : (
        <>
          {/* ── Team image ── */}
          <div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-sm p-6">
            <h3 className="text-sm font-semibold mb-1">Team Image</h3>
            <p className="text-xs text-muted-foreground mb-5">
              Shown in the sidebar and team switcher. Max 2 MB. JPEG, PNG, WebP or GIF.
            </p>

            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 overflow-hidden">
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Team image"
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-7 text-muted-foreground" />
                )}
              </div>

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  className="hidden"
                  onChange={handleImageChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5 mr-1.5" />
                  {imagePreview ? "Change" : "Upload"}
                </Button>
                {imagePreview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveImage}
                    disabled={updateTeamMutation.isPending}
                  >
                    <Trash2 className="size-3.5 mr-1.5 text-destructive" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ── Team name ── */}
          <div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-sm p-6">
            <h3 className="text-sm font-semibold mb-1">Team Name</h3>
            <p className="text-xs text-muted-foreground mb-5">
              This is the display name for your team.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSaveName)} className="flex gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="My Team" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  isLoading={updateTeamMutation.isPending}
                >
                  Save
                </Button>
              </form>
            </Form>
          </div>

          {/* ── Danger zone ── */}
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <h3 className="text-sm font-semibold text-destructive mb-1">
              Danger Zone
            </h3>
            <p className="text-xs text-muted-foreground mb-5">
              Deleting a team is permanent and will remove all associated data including domains,
              emails, campaigns, and contacts.
            </p>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-3.5 mr-1.5" />
                  Delete Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete team</DialogTitle>
                  <DialogDescription>
                    This will permanently delete{" "}
                    <span className="font-semibold text-foreground">
                      {currentTeam?.name}
                    </span>{" "}
                    and all its data. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-2 flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Type <span className="font-mono font-semibold text-foreground">{currentTeam?.name}</span> to confirm.
                  </p>
                  <Input
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={currentTeam?.name}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={confirmName !== currentTeam?.name}
                    isLoading={deleteTeamMutation.isPending}
                    onClick={handleDeleteTeam}
                  >
                    Delete Team
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}
    </div>
  );
}
