"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { SiDiscord, SiGithub, SiGoogle } from "react-icons/si";
import type { IconType } from "react-icons";
import { Button } from "@bytesend/ui/src/button";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";

const PROVIDER_META: Record<string, { name: string; icon: IconType }> = {
  github: { name: "GitHub", icon: SiGithub },
  google: { name: "Google", icon: SiGoogle },
  discord: { name: "Discord", icon: SiDiscord },
};

export function ConnectedAccounts({
  currentEmail,
  onUseEmail,
  isUsingEmail,
}: {
  currentEmail: string | null | undefined;
  onUseEmail: (email: string) => void;
  isUsingEmail: boolean;
}) {
  const utils = api.useUtils();
  const [availableProviders, setAvailableProviders] = useState<string[] | null>(null);
  const accountsQuery = api.user.listLinkedAccounts.useQuery();

  useEffect(() => {
    let cancelled = false;
    void getProviders().then((providers) => {
      if (cancelled) return;
      setAvailableProviders(
        Object.values(providers ?? {})
          .filter((provider) => provider.type === "oauth" && provider.id in PROVIDER_META)
          .map((provider) => provider.id),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlink = api.user.unlinkAccount.useMutation({
    onSuccess: async () => {
      toast.success("Account disconnected");
      await Promise.all([utils.user.listLinkedAccounts.invalidate(), utils.user.getProfile.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const connect = (provider: string) => {
    void signIn(provider, { callbackUrl: "/settings/account" });
  };

  const linked = accountsQuery.data ?? [];
  const providerIds = [...new Set([...(availableProviders ?? []), ...linked.map((account) => account.provider)])];

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-sm p-6">
      <h3 className="text-sm font-semibold mb-1">Connected Accounts</h3>
      <p className="text-xs text-muted-foreground mb-5">
        Sign in with these providers. Reconnect one to refresh the email and avatar it shares with ByteSend.
      </p>

      {availableProviders === null || accountsQuery.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
      ) : providerIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sign-in providers are configured on this instance.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {providerIds.map((providerId) => {
            const meta = PROVIDER_META[providerId] ?? { name: providerId, icon: SiGithub };
            const Icon = meta.icon;
            const account = linked.find((item) => item.provider === providerId);
            const canUseEmail =
              !!account?.email && account.email.toLowerCase() !== (currentEmail ?? "").toLowerCase();
            const isAvailable = availableProviders.includes(providerId);

            return (
              <li key={providerId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{meta.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account ? (account.email ?? "Connected. Reconnect to see its email") : "Not connected"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {canUseEmail ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUsingEmail}
                      onClick={() => onUseEmail(account.email!)}
                    >
                      Use this email
                    </Button>
                  ) : null}
                  {isAvailable ? (
                    <Button size="sm" variant={account ? "outline" : "default"} onClick={() => connect(providerId)}>
                      {account ? "Reconnect" : "Connect"}
                    </Button>
                  ) : null}
                  {account ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={unlink.isPending}
                      onClick={() => {
                        if (!window.confirm(`Disconnect ${meta.name}? You can reconnect it later.`)) return;
                        unlink.mutate({ accountId: account.id });
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
