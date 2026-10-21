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
import { CopyField } from "@bytesend/ui/src/copy-field";
import { Callout } from "@bytesend/ui/src/callout";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { PageHeader } from "@bytesend/ui/src/page-header";
import { Panel, SettingRow } from "@bytesend/ui/src/panel";
import { RegionLabel } from "~/components/dashboard/region-label";
import { useBreadcrumb } from "~/components/dashboard/breadcrumbs";
import React, { use } from "react";
import { Switch } from "@bytesend/ui/src/switch";
import DeleteDomain from "./delete-domain";
import { DnsStatusBadge } from "./dns-status-badge";
import { RegionMoveCard } from "./region-move-card";
import { CloudflareSetup } from "./cloudflare-setup";
import { Button } from "@bytesend/ui/src/button";
import { toast } from "@bytesend/ui/src/toaster";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bytesend/ui/src/dropdown-menu";
import {
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
        onSuccess: async () => {
          const { data } = await domainQuery.refetch();
          if (!data || data.isVerifying) return;
          const issues = Array.isArray(data.dnsIssues) ? (data.dnsIssues as string[]) : [];
          if (data.status !== DomainStatus.SUCCESS) {
            toast.error("Some records still aren't right. Check the table below.");
          } else if (issues.length) {
            toast.warning(`Verified with SES, but ${issues.length === 1 ? "1 DNS record needs" : `${issues.length} DNS records need`} fixing.`);
          } else {
            toast.success("All records check out.");
          }
        },
        onError: (error) => {
          toast.error(error.message || "Couldn't check the records. Try again.");
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
  useBreadcrumb(`/domains/${domainId}`, domain?.name);
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

  const actions = domain ? (
    <>
      {domain.status === DomainStatus.SUCCESS ? (
        <Button variant="outline" size="sm" onClick={handleSendTestEmail} disabled={sendTestEmailMutation.isPending}>
          {sendTestEmailMutation.isPending ? <Spinner className="size-3.5" /> : <SendHorizonal className="size-3.5" />}
          Send test
        </Button>
      ) : (
        <Button size="sm" onClick={handleVerify} disabled={verifyQuery.isPending || domain.isVerifying}>
          {verifyQuery.isPending || domain.isVerifying ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
          {domain.isVerifying ? "Checking…" : "Verify records"}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            More
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={handleVerify} disabled={verifyQuery.isPending || domain.isVerifying}>
            <RefreshCw className="mr-2 size-4" />
            {domain.status === DomainStatus.SUCCESS ? "Verify again" : "Verify records"}
          </DropdownMenuItem>
          {domain.status !== DomainStatus.SUCCESS ? (
            <DropdownMenuItem onClick={handleReregisterDkim} disabled={reregisterDkimMutation.isPending}>
              <KeyRound className="mr-2 size-4" />
              Regenerate DKIM keys
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleSendTestEmail} disabled={sendTestEmailMutation.isPending}>
              <SendHorizonal className="mr-2 size-4" />
              Send test email
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  ) : null;

  if (domainQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!domain) {
    return <EmptyState icon={<Globe />} title="Domain not found" description="It may have been deleted, or it belongs to another team." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={domain.name}
        meta={<DomainStatusBadge status={domain.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Sends from <RegionLabel region={domain.region} full />
            </span>
            {domain.isVerifying ? (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Spinner className="size-3" />
                Checking DNS…
              </span>
            ) : null}
          </span>
        }
        actions={actions}
      />

      {dkimReregistered ? (
        <Callout tone="warning" title="New DKIM keys were generated">
          The old record was in your DNS, but Amazon SES wasn&apos;t picking it up. Replace the DKIM TXT record with the new value
          below, then{" "}
          <button type="button" onClick={handleVerify} className="text-foreground underline">
            verify again
          </button>
          .
        </Callout>
      ) : null}

      {Array.isArray(domain.dnsIssues) && domain.dnsIssues.length > 0 && domain.dnsIssuesNotifiedAt ? (
        <Callout tone="danger" title="Your DNS records changed after this domain was verified">
          <ul className="list-disc space-y-0.5 pl-4">
            {(domain.dnsIssues as string[]).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <p className="mt-1">Mail from this domain may fail or land in spam until the records below are restored.</p>
        </Callout>
      ) : null}

      {dkimIsStuck && dnsPrecheck?.dkim === "wrong_key" ? (
        <Callout tone="warning" title="The DKIM record in your DNS has a different key">
          Use <strong>More → Regenerate DKIM keys</strong> to make a new key pair, then update the TXT record with the new value.
        </Callout>
      ) : null}

      {dkimIsStuck && dnsPrecheck?.dkim === "not_found" && dkimStatus !== DomainStatus.NOT_STARTED ? (
        <Callout tone="info" title="We can&apos;t see your DKIM record yet">
          DNS changes can take up to 48 hours to spread. Check the TXT record matches the one below exactly.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        <SignalCard label="DKIM" description="Proves the mail came from you" status={dkimStatus} dnsCheck={dnsPrecheck?.dkim} />
        <SignalCard label="SPF" description="Allows SES to send for you" status={spfStatus} dnsCheck={dnsPrecheck?.spf} />
        <SignalCard label="DMARC" description="Tells inboxes what to do with fakes" status={dmarcStatus} dnsCheck={dnsPrecheck?.mx} />
      </div>

      <Panel
        flush
        title="DNS records"
        description="Add these at your DNS provider (Cloudflare, Route 53, GoDaddy…). Copy each value exactly."
        actions={<CloudflareSetup domainId={domain.id} domainName={domain.name} />}
      >
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16">Type</TableHead>
                <TableHead className="w-[30%]">Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-20 text-right">Priority</TableHead>
                <TableHead className="w-28 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domain.dnsRecords.map((record) => (
                <TableRow key={`${record.type}-${record.name}`} className="hover:bg-transparent">
                  <TableCell className="align-top">
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {record.type}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-0 align-top">
                    <CopyField value={record.name} />
                    {record.recommended ? <p className="mt-1 text-[11px] text-muted-foreground">Recommended</p> : null}
                  </TableCell>
                  <TableCell className="max-w-0 align-top">
                    <CopyField value={record.value} />
                  </TableCell>
                  <TableCell className="text-right align-top text-muted-foreground">{record.priority ?? "–"}</TableCell>
                  <TableCell className="text-right align-top">
                    <DnsStatusBadge status={record.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="divide-y divide-border/70 md:hidden">
          {domain.dnsRecords.map((record) => (
            <div key={`${record.type}-${record.name}`} className="space-y-2 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {record.type}
                  {record.priority != null ? ` · priority ${record.priority}` : ""}
                </span>
                <DnsStatusBadge status={record.status} />
              </div>
              <CopyField value={record.name} />
              <CopyField value={record.value} />
            </div>
          ))}
        </div>
      </Panel>

      <RegionMoveCard domain={domain} />

      <DomainSettings domain={domain} />
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
  const iconClass = isVerified ? "text-success" : isFailed ? "text-destructive" : isPending ? "text-warning" : "text-muted-foreground/60";
  const statusText = isVerified ? "Verified" : status === DomainStatus.NOT_STARTED ? "Not set up" : isFailed ? "Failed" : "Pending";

  let hint: string | null = null;
  if (dnsCheck === "wrong_key") hint = "Key doesn't match";
  else if (dnsCheck === "not_found" && status !== DomainStatus.NOT_STARTED) hint = "Not in DNS yet";
  else if (dnsCheck === "found" && !isVerified) hint = "Found in DNS, waiting for SES";

  return (
    <div className="flex items-start gap-3 bg-card px-4 py-3">
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">
          {label} <span className="font-normal text-muted-foreground">· {statusText}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint ?? description}</p>
      </div>
    </div>
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
    <>
      <Panel flush title="Tracking" description="Applies to every email sent from this domain.">
        <SettingRow
          title="Click tracking"
          description="Rewrites links so you can see which ones people click."
          control={<Switch checked={clickTracking} onCheckedChange={handleClickTrackingChange} disabled={updateDomain.isPending} />}
        />
        <SettingRow
          title="Open tracking"
          description="Adds an invisible 1×1 image to detect opens. Some inboxes treat this as a spam signal."
          control={<Switch checked={openTracking} onCheckedChange={handleOpenTrackingChange} disabled={updateDomain.isPending} />}
        />
      </Panel>

      <Panel flush tone="danger" title="Danger zone">
        <SettingRow
          title="Delete this domain"
          description="Stops all email from it straight away. This can't be undone."
          control={<DeleteDomain domain={domain} />}
        />
      </Panel>
    </>
  );
};
