"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@bytesend/ui/src/button";
import { Input } from "@bytesend/ui/src/input";
import { Label } from "@bytesend/ui/src/label";
import { Avatar, AvatarFallback, AvatarImage } from "@bytesend/ui/src/avatar";
import Spinner from "@bytesend/ui/src/spinner";
import { api } from "~/trpc/react";
import { BrandMark } from "~/lib/brand";

export function ProfileSetup() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [imageUrl, setImageUrl] = useState(session?.user?.image ?? "");
  const [error, setError] = useState<string | null>(null);

  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: async () => {
      // Refresh the NextAuth session so session.user.name is populated
      await update();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    updateProfile.mutate({
      name: name.trim(),
      image: imageUrl.trim() || null,
    });
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6 shadow-xl sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="mb-1 flex size-11 items-center justify-center rounded-lg border border-border bg-muted/50">
            <BrandMark size={17} />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">What should we call you?</h2>
          <p className="text-sm text-muted-foreground">
            Your name shows to teammates and in the audit log.
          </p>
        </div>

        {/* Avatar preview */}
        <div className="flex justify-center">
          <Avatar className="size-16 border border-border">
            <AvatarImage src={imageUrl} alt={name} />
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/25 bg-destructive/[0.06] p-3 text-[13px] text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full name <span className="text-destructive">*</span></Label>
            <Input
              id="profile-name"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              autoFocus
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-image">
              Avatar URL <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Input
              id="profile-image"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              autoComplete="photo"
              className="h-10"
            />
          </div>

          <Button
            type="submit"
            className="h-10 w-full"
            disabled={updateProfile.isPending || !name.trim()}
          >
            {updateProfile.isPending ? (
              <Spinner className="size-4" />
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
