"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FullScreenLoading } from "~/components/FullScreenLoading";
import { AddSesSettings } from "~/components/settings/AddSesSettings";
import CreateTeam from "~/components/team/CreateTeam";
import { ProfileSetup } from "~/components/auth/ProfileSetup";
import { env } from "~/env";
import { api } from "~/trpc/react";
import { TeamProvider } from "./team-context";
import { Input } from "@bytesend/ui/src/input";
import { Button } from "@bytesend/ui/src/button";
import { toast } from "@bytesend/ui/src/toaster";

const TWO_FACTOR_SESSION_KEY = "bytesend_2fa_verified_user";

export const DashboardProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data: session, status: sessionStatus } = useSession();
  const { data: profile, status: profileStatus } = api.user.getProfile.useQuery();
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorVerified, setTwoFactorVerified] = useState(false);
  const [useRecoveryMode, setUseRecoveryMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!session?.user.id) {
      setTwoFactorVerified(false);
      return;
    }

    const verifiedFor = sessionStorage.getItem(TWO_FACTOR_SESSION_KEY);
    setTwoFactorVerified(verifiedFor === String(session.user.id));
  }, [session?.user.id]);

  const shouldRequireTwoFactor =
    !!profile?.twoFactorEnabled &&
    !twoFactorVerified &&
    profileStatus === "success";

  const { data: teams, status } = api.team.getTeams.useQuery(undefined, {
    enabled: !shouldRequireTwoFactor,
  });
  const { data: settings, status: settingsStatus } =
    api.admin.getSesSettings.useQuery(undefined, {
      enabled:
        (!env.NEXT_PUBLIC_IS_CLOUD || session?.user.isAdmin) && !shouldRequireTwoFactor,
    });

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault();
    setIsVerifying(true);
    try {
      const body = useRecoveryMode
        ? { recoveryCode: twoFactorCode }
        : { code: twoFactorCode };
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Verification failed");
        return;
      }
      if (session?.user.id) {
        sessionStorage.setItem(TWO_FACTOR_SESSION_KEY, String(session.user.id));
      }
      setTwoFactorVerified(true);
      setTwoFactorCode("");
      toast.success("Two-factor verification complete");
    } catch {
      toast.error("Verification failed");
    } finally {
      setIsVerifying(false);
    }
  }

  if (
    status === "pending" ||
    profileStatus === "pending" ||
    sessionStatus === "loading" ||
    (settingsStatus === "pending" && !env.NEXT_PUBLIC_IS_CLOUD)
  ) {
    return <FullScreenLoading />;
  }

  if (shouldRequireTwoFactor) {
    return (
      <div className="min-h-[60vh] w-full flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card/30 p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-foreground">Two-factor verification required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {useRecoveryMode
              ? "Enter one of your recovery codes to continue."
              : "Enter the 6-digit code from your authenticator app to continue."}
          </p>

          <form
            className="mt-4 flex gap-3"
            onSubmit={handleVerify2FA}
          >
            <Input
              placeholder={useRecoveryMode ? "AABBCCDDEE" : "123456"}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.trim())}
              maxLength={useRecoveryMode ? 10 : 6}
            />
            <Button
              type="submit"
              isLoading={isVerifying}
              disabled={useRecoveryMode ? twoFactorCode.length !== 10 : twoFactorCode.length !== 6}
            >
              Verify
            </Button>
          </form>

          <button
            type="button"
            className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => { setUseRecoveryMode(!useRecoveryMode); setTwoFactorCode(""); }}
          >
            {useRecoveryMode ? "Use authenticator app instead" : "Use a recovery code"}
          </button>
        </div>
      </div>
    );
  }

  if (session && !session.user.name) {
    return <ProfileSetup />;
  }

  if (
    settings?.length === 0 &&
    (!env.NEXT_PUBLIC_IS_CLOUD || session?.user.isAdmin)
  ) {
    return <AddSesSettings />;
  }

  if (!teams || teams.length === 0) {
    return <CreateTeam />;
  }

  return <TeamProvider>{children}</TeamProvider>;
};
