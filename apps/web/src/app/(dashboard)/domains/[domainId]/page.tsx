"use client";

import { api } from "~/trpc/react";
import { DomainStatus } from "@prisma/client";
import { DomainStatusBadge } from "../domain-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bytesend/ui/src/table";
import { TextWithCopyButton } from "@bytesend/ui/src/text-with-copy";
import React, { use } from "react";
import { Switch } from "@bytesend/ui/src/switch";
import DeleteDomain from "./delete-domain";
import { DnsStatusBadge } from "./dns-status-badge";
import { RegionMoveCard } from "./region-move-card";
import { Button } from "@bytesend/ui/src/button";
import Link from "next/link";
import { toast } from "@bytesend/ui/src/toaster";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bytesend/ui/src/dropdown-menu";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe,
  KeyRound,
  RefreshCw,
  SendHorizonal,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Spinner from "@bytesend/ui/src/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@bytesend/ui/src/tooltip";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DomainResponse = NonNullable<RouterOutputs["domain"]["getDomain"]>;

type DnsPrecheck = {
  dkim: "found" | "wrong_key" | "not_found";
  spf: "found" | "wrong_key" | "not_found";
  mx: "found" | "wrong_key" | "not_found";
};

export default function DomainItemPage({
  params,
}: {
  params: Promise<{ domainId: string }>;
}) {
  const { domainId } = use(params);

  const domainQuery = api.domain.getDomain.useQuery(
    { id: Number(domainId) },
    {
      refetchInterval: (q) => (q?.state.data?.isVerifying ? 8000 : false),
      refetchIntervalInBackground: true,
    },
  );

  const verifyQuery = api.domain.startVerification.useMutation();
  const reregisterDkimMutation = api.domain.reregisterDkim.useMutation();
  const sendTestEmailMutation = api.domain.sendTestEmailFromDomain.useMutation();
  const utils = api.useUtils();

  const handleVerify = () => {
    verifyQuery.mutate(
      { id: Number(domainId) },
      {
        onSettled: () => {
          domainQuery.refetch();
        },
      },
    );
  };

  const handleReregisterDkim = () => {
    reregisterDkimMutation.mutate(
      { id: Number(domainId) },
      {
        onSuccess: () => {
          toast.success(
            "DKIM keys regenerated. Update the TXT record in your DNS with the new value below, then click Verify.",
          );
          utils.domain.getDomain.invalidate({ id: Number(domainId) });
        },
        onError: (err) => {
          toast.error(err.message || "Failed to re-register DKIM");
        },
      },
    );
  };

  const handleSendTestEmail = () => {
    sendTestEmailMutation.mutate(
      { id: Number(domainId) },
      {
        onSuccess: () => {
          toast.success("Test email sent");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to send test email");
        },
      },
    );
  };

  const domain = domainQuery.data;
  const dnsPrecheck = (domain as any)?.dnsPrecheck as DnsPrecheck | undefined;
  const dkimReregistered = (domain as any)?.dkimReregistered as boolean | undefined;

  const dkimStatus = domain?.dkimStatus
    ? (domain.dkimStatus as DomainStatus)
    : DomainStatus.NOT_STARTED;
  const spfStatus = domain?.spfDetails
    ? (domain.spfDetails as DomainStatus)
    : DomainStatus.NOT_STARTED;
  const dmarcStatus = domain?.dmarcAdded ? DomainStatus.SUCCESS : DomainStatus.NOT_STARTED;

  const dkimIsStuck = dkimStatus !== DomainStatus.SUCCESS && domain && !domain.isVerifying;

  return (
    <div className="space-y-6">
      {domainQuery.isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="h-5 w-5" />
        </div>
      ) : !domain ? (
        <div className="text-muted-foreground text-sm">Domain not found.</div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
                <h1 className="text-xl font-semibold tracking-tight text-foreground break-all">
                  {domain.name}
                </h1>
                <DomainStatusBadge status={domain.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Region: <span className="text-foreground">{domain.region}</span></span>
                {domain.isVerifying && (
                  <span className="flex items-center gap-1.5 text-primary">
                    <Spinner className="h-3 w-3" />
                    Checking DNS &amp; SES…
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start">
              {domain.status === DomainStatus.SUCCESS && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestEmail}
                  disabled={sendTestEmailMutation.isPending}
                  className="gap-1.5"
                >
                  {sendTestEmailMutation.isPending ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <SendHorizonal className="h-3.5 w-3.5" />
                  )}
                  Send test
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Actions
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onClick={handleVerify}
                    disabled={verifyQuery.isPending || domain.isVerifying}
                  >
                    {verifyQuery.isPending || domain.isVerifying ? (
                      <Spinner className="h-4 w-4 mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {domain.isVerifying
                      ? "Verifying…"
                      : domain.status === DomainStatus.SUCCESS
                        ? "Verify again"
                        : "Verify domain"}
                  </DropdownMenuItem>
                  {domain.status !== DomainStatus.SUCCESS && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleReregisterDkim}
                        disabled={reregisterDkimMutation.isPending}
                      >
                        {reregisterDkimMutation.isPending ? (
                          <Spinner className="h-4 w-4 mr-2" />
                        ) : (
                          <KeyRound className="h-4 w-4 mr-2" />
                        )}
                        Re-generate DKIM keys
                      </DropdownMenuItem>
                    </>
                  )}
                  {domain.status === DomainStatus.SUCCESS && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleSendTestEmail}
                        disabled={sendTestEmailMutation.isPending}
                      >
                        {sendTestEmailMutation.isPending ? (
                          <Spinner className="h-4 w-4 mr-2" />
                        ) : (
                          <SendHorizonal className="h-4 w-4 mr-2" />
                        )}
                        Send test email
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Auto re-registered banner */}
          {dkimReregistered && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-600 dark:text-amber-400">
                DKIM keys were automatically regenerated because the record was found in DNS but SES wasn&apos;t picking it up.
                Update the DKIM TXT record in your DNS provider with the new value shown below, then click{" "}
                <button onClick={handleVerify} className="underline font-medium">
                  Verify domain
                </button>
                .
              </p>
            </div>
          )}

          {Array.isArray(domain.dnsIssues) && domain.dnsIssues.length > 0 && domain.dnsIssuesNotifiedAt ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-destructive">DNS records have changed since this domain was verified</p>
                <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {(domain.dnsIssues as string[]).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground">
                  Email from this domain may fail or land in spam until the records below are restored.
                </p>
              </div>
            </div>
          ) : null}

          {/* DNS status summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SignalCard
              label="DKIM"
              status={dkimStatus}
              dnsCheck={dnsPrecheck?.dkim}
              description="Email signing key"
            />
            <SignalCard
              label="SPF"
              status={spfStatus}
              dnsCheck={dnsPrecheck?.spf}
              description="Sender policy"
            />
            <SignalCard
              label="DMARC"
              status={dmarcStatus}
              dnsCheck={dnsPrecheck?.mx}
              description="Abuse policy"
            />
          </div>

          {/* DKIM stuck helpers */}
          {dkimIsStuck && dnsPrecheck?.dkim === "wrong_key" && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-600 dark:text-amber-400 space-y-1">
                <p className="font-medium">DKIM record found but key doesn&apos;t match</p>
                <p>
                  Your DNS has a DKIM TXT record but the public key doesn&apos;t match ByteSend&apos;s expected value.
                  Use <strong>Actions → Re-generate DKIM keys</strong> to create a new key pair, then update your DNS record with the new value.
                </p>
              </div>
            </div>
          )}

          {dkimIsStuck && dnsPrecheck?.dkim === "not_found" && dkimStatus !== DomainStatus.NOT_STARTED && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/8 px-4 py-3">
              <Clock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-500 dark:text-blue-400">
                DKIM record not yet found in DNS. Propagation can take up to 48 hours, so make sure you&apos;ve added the TXT record exactly as shown below.
              </p>
            </div>
          )}

          <RegionMoveCard domain={domain} />

          {/* DNS Records table */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">DNS Records</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add these records in your DNS provider to verify ownership and enable sending
                </p>
              </div>
              {!domain.isVerifying && domain.status !== DomainStatus.SUCCESS && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleVerify}
                  disabled={verifyQuery.isPending}
                  className="gap-1.5 shrink-0"
                >
                  {verifyQuery.isPending ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Verify records
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/60">
                  <TableHead className="w-16 pl-4">Type</TableHead>
                  <TableHead className="w-55">Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-16">TTL</TableHead>
                  <TableHead className="w-20">Priority</TableHead>
                  <TableHead className="w-32 text-right pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domain.dnsRecords.map((record) => {
                  const key = `${record.type}-${record.name}`;
                  const isDkim = record.name.includes("_domainkey");

                  return (
                    <TableRow key={key} className="border-b border-border/40 last:border-0">
                      <TableCell className="pl-4">
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {record.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {record.recommended && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                              recommended
                            </span>
                          )}
                          <TextWithCopyButton value={record.name} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <TextWithCopyButton
                          value={record.value}
                          className={
                            isDkim
                              ? "max-w-90 truncate"
                              : "max-w-90 truncate"
                          }
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {record.ttl}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {record.priority ?? "—"}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <DnsStatusBadge status={record.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Settings */}
          <DomainSettings domain={domain} />
        </>
      )}
    </div>
  );
}

/* ---------- sub-components ---------- */

const SignalCard: React.FC<{
  label: string;
  status: DomainStatus;
  dnsCheck?: "found" | "wrong_key" | "not_found";
  description: string;
}> = ({ label, status, dnsCheck, description }) => {
  const isVerified = status === DomainStatus.SUCCESS;
  const isPending = status === DomainStatus.PENDING || status === DomainStatus.TEMPORARY_FAILURE;
  const isFailed = status === DomainStatus.FAILED;

  const Icon = isVerified ? CheckCircle2 : isFailed ? XCircle : isPending ? Clock : ShieldCheck;

  const iconClass = isVerified
    ? "text-emerald-500"
    : isFailed
      ? "text-destructive"
      : isPending
        ? "text-amber-500"
        : "text-muted-foreground/60";

  const borderClass = isVerified
    ? "border-emerald-500/20"
    : isFailed
      ? "border-destructive/20"
      : isPending
        ? "border-amber-500/20"
        : "border-border/60";

  const bgClass = isVerified
    ? "bg-emerald-500/5"
    : isFailed
      ? "bg-destructive/5"
      : isPending
        ? "bg-amber-500/5"
        : "bg-card/40";

  const statusLabel =
    status === DomainStatus.NOT_STARTED
      ? "Not configured"
      : status === DomainStatus.SUCCESS
        ? "Verified"
        : status
            .split("_")
            .map((w) => w[0] + w.slice(1).toLowerCase())
            .join(" ");

  let hint: string | null = null;
  if (dnsCheck === "wrong_key") hint = "Key mismatch in DNS";
  else if (dnsCheck === "not_found" && status !== DomainStatus.NOT_STARTED) hint = "Not found in DNS yet";
  else if (dnsCheck === "found" && !isVerified) hint = "DNS propagated · awaiting SES";

  const hintClass =
    dnsCheck === "wrong_key"
      ? "text-amber-500"
      : dnsCheck === "found" && !isVerified
        ? "text-blue-400"
        : "text-muted-foreground/70";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`rounded-xl border ${borderClass} ${bgClass} px-4 py-4 flex flex-col gap-3 select-none`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
              <Icon className={`h-4.5 w-4.5 mt-0.5 shrink-0 ${iconClass}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{statusLabel}</p>
              {hint && (
                <p className={`text-[11px] mt-0.5 ${hintClass}`}>{hint}</p>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">SES status: {status.toLowerCase().replace(/_/g, " ")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const DomainSettings: React.FC<{ domain: DomainResponse }> = ({ domain }) => {
  const updateDomain = api.domain.updateDomain.useMutation();
  const utils = api.useUtils();

  const [clickTracking, setClickTracking] = React.useState(domain.clickTracking);
  const [openTracking, setOpenTracking] = React.useState(domain.openTracking);

  function handleClickTrackingChange() {
    const next = !clickTracking;
    setClickTracking(next);
    updateDomain.mutate(
      { id: domain.id, clickTracking: next },
      {
        onSuccess: () => {
          utils.domain.invalidate();
          toast.success("Click tracking updated");
        },
        onError: () => setClickTracking(!next),
      },
    );
  }

  function handleOpenTrackingChange() {
    const next = !openTracking;
    setOpenTracking(next);
    updateDomain.mutate(
      { id: domain.id, openTracking: next },
      {
        onSuccess: () => {
          utils.domain.invalidate();
          toast.success("Open tracking updated");
        },
        onError: () => setOpenTracking(!next),
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* Tracking */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 bg-muted/20">
          <p className="text-sm font-semibold text-foreground">Tracking</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure link and open tracking for emails sent from this domain
          </p>
        </div>
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Click tracking</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Wrap links in emails to track clicks
              </p>
            </div>
            <Switch
              checked={clickTracking}
              onCheckedChange={handleClickTrackingChange}
              disabled={updateDomain.isPending}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Open tracking</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Embed a 1×1 pixel to detect opens. May affect deliverability
              </p>
            </div>
            <Switch
              checked={openTracking}
              onCheckedChange={handleOpenTrackingChange}
              disabled={updateDomain.isPending}
            />
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-destructive/20 bg-destructive/5">
          <p className="text-sm font-semibold text-destructive">Danger zone</p>
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">Delete domain</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently removes this domain and stops all outbound email from it
            </p>
          </div>
          <DeleteDomain domain={domain} />
        </div>
      </div>
    </div>
  );
};
