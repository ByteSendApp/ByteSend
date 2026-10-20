"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@bytesend/ui/src/button";
import { CopyField } from "@bytesend/ui/src/copy-field";
import { Input } from "@bytesend/ui/src/input";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { Panel, SettingRow } from "@bytesend/ui/src/panel";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";

interface Props {
  smtpHost: string;
  smtpPort: string;
  smtpDefaultUsername: string;
  currentSmtpUsername: string | null;
}

export function SmtpSettingsClient({ smtpHost, smtpPort, smtpDefaultUsername, currentSmtpUsername }: Props) {
  const [username, setUsername] = useState(currentSmtpUsername ?? "");
  const [isDirty, setIsDirty] = useState(false);

  const updateMutation = api.team.updateSmtpUsername.useMutation({
    onSuccess: () => {
      toast.success("SMTP username updated");
      setIsDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const effectiveUsername = currentSmtpUsername ?? smtpDefaultUsername;

  const handleSave = () => {
    const trimmed = username.trim();
    updateMutation.mutate({ smtpUsername: trimmed === "" || trimmed === smtpDefaultUsername ? null : trimmed });
  };

  const handleReset = () => {
    setUsername("");
    updateMutation.mutate({ smtpUsername: null });
  };

  const connection = [
    { label: "Host", value: smtpHost, hint: null },
    { label: "Port", value: smtpPort, hint: "465 uses SSL. For STARTTLS use 587, 2465 or 2587." },
    { label: "Username", value: effectiveUsername, hint: currentSmtpUsername ? null : "The default for your team" },
    { label: "Password", value: "Any API key", hint: "Create one under API keys. Sending-only keys work." },
  ];

  return (
    <>
      <PageHeader
        title="SMTP"
        description={
          <>
            Send through SMTP from apps that can&apos;t use the API, such as WordPress, Supabase Auth or a mail client.{" "}
            <a href="https://docs.bytesend.cloud/get-started/smtp" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              SMTP guide
            </a>
          </>
        }
      />

      <Panel flush title="Connection details" description="Paste these into your app's SMTP settings.">
        <div className="divide-y divide-border/70">
          {connection.map((row) => (
            <div key={row.label} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-4">
              <div>
                <p className="text-[13px] font-medium text-foreground">{row.label}</p>
                {row.hint ? <p className="text-xs text-muted-foreground sm:hidden">{row.hint}</p> : null}
              </div>
              <div className="min-w-0 sm:max-w-md">
                {row.label === "Password" ? (
                  <p className="text-[13px] text-muted-foreground">{row.value}</p>
                ) : (
                  <CopyField value={row.value} />
                )}
                {row.hint ? <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{row.hint}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel flush title="Custom username">
        <SettingRow
          title="Username"
          description="Change it if your app needs something specific. Leave empty to use the default."
          control={
            <div className="flex w-full items-center gap-2 sm:w-80">
              <Input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setIsDirty(true);
                }}
                placeholder={smtpDefaultUsername}
                className="h-8 font-mono text-[13px]"
                maxLength={64}
              />
              {isDirty ? (
                <Button size="sm" onClick={handleSave} isLoading={updateMutation.isPending}>
                  Save
                </Button>
              ) : currentSmtpUsername ? (
                <Button size="sm" variant="ghost" onClick={handleReset} disabled={updateMutation.isPending} className="text-muted-foreground">
                  <RotateCcw className="size-3.5" />
                  Reset
                </Button>
              ) : null}
            </div>
          }
        />
      </Panel>
    </>
  );
}
