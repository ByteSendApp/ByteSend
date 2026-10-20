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
      <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card shadow-xl p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-1">
            <BrandMark size={17} />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Set up your profile</h2>
          <p className="text-sm text-muted-foreground">
            Tell us a little about yourself before you get started
          </p>
        </div>

        {/* Avatar preview */}
        <div className="flex justify-center">
          <Avatar className="size-20 ring-2 ring-primary/20">
            <AvatarImage src={imageUrl} alt={name} />
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
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
              className="h-11 rounded-xl"
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
              className="h-11 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl shadow-lg shadow-primary/20"
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
