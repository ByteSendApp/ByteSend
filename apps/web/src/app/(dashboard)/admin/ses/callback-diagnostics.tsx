"use client";

import { Button } from "@bytesend/ui/src/button";
import Spinner from "@bytesend/ui/src/spinner";
import { toast } from "@bytesend/ui/src/toaster";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw } from "lucide-react";
import { api } from "~/trpc/react";
import { StatusPill, type StatusTone } from "../_components/status-pill";

const SUBSCRIPTION_TONE: Record<string, { tone: StatusTone; label: string }> = {
  confirmed: { tone: "success", label: "Subscribed" },
  pending: { tone: "warning", label: "Pending confirmation" },
  missing: { tone: "destructive", label: "Not subscribed" },
  error: { tone: "destructive", label: "Lookup failed" },
};

export default function CallbackDiagnostics() {
  const utils = api.useUtils();
  const diagnosticsQuery = api.admin.getSesCallbackDiagnostics.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const repair = api.admin.repairSesCallbacks.useMutation({
    onSuccess: async (result) => {
      toast.success(result.actions.length ? "Repaired" : "Nothing to repair", {
        description: result.actions.length
          ? `${result.actions.join(". ")}. Re-check in a few seconds.`
          : "Everything already looks correct in AWS.",
      });
      await Promise.all([utils.admin.getSesCallbackDiagnostics.invalidate(), utils.admin.getSesSettings.invalidate()]);
    },
    onError: (error) => toast.error("Repair failed", { description: error.message }),
  });

  const data = diagnosticsQuery.data;

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Delivery callbacks</h2>
          <p className="text-sm text-muted-foreground">
            Delivered, bounced, opened and clicked statuses only arrive when SES can reach this site through SNS.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => diagnosticsQuery.refetch()}
          disabled={diagnosticsQuery.isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${diagnosticsQuery.isFetching ? "animate-spin" : ""}`} />
          Re-check
        </Button>
      </div>

      {data?.lastRejected && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Callbacks are being rejected</p>
          <p className="mt-1 text-muted-foreground">
            SNS posted from <code className="font-mono text-xs">{data.lastRejected.topicArn}</code>{" "}
            {formatDistanceToNow(new Date(data.lastRejected.at), { addSuffix: true })}, which doesn&apos;t match any
            region below. Those events were dropped.
          </p>
        </div>
      )}

      {diagnosticsQuery.isLoading ? (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <Spinner className="h-6 w-6" innerSvgClass="stroke-primary" />
        </div>
      ) : diagnosticsQuery.error ? (
        <p className="rounded-lg border p-4 text-sm text-destructive">{diagnosticsQuery.error.message}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data?.regions.map((region) => {
            const subscription = SUBSCRIPTION_TONE[region.subscription.state]!;
            const healthy = region.problems.length === 0;
            return (
              <div key={region.settingId} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium">{region.region}</span>
                  <StatusPill tone={healthy ? "success" : "destructive"}>
                    {healthy ? "Healthy" : `${region.problems.length} problem${region.problems.length === 1 ? "" : "s"}`}
                  </StatusPill>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">SNS subscription</dt>
                    <dd>
                      <StatusPill tone={subscription.tone}>{subscription.label}</StatusPill>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Event destinations</dt>
                    <dd className="tabular-nums">
                      {region.configSets.filter((configSet) => configSet.ok).length} / {region.configSets.length} OK
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Last callback</dt>
                    <dd>
                      {region.lastReceivedAt
                        ? formatDistanceToNow(new Date(region.lastReceivedAt), { addSuffix: true })
                        : "None recorded"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="shrink-0 text-muted-foreground">Callback URL</dt>
                    <dd className="truncate font-mono text-xs" title={region.callbackUrl}>
                      {region.callbackUrl}
                    </dd>
                  </div>
                </dl>

                {!healthy && (
                  <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                    {region.problems.map((problem) => (
                      <li key={problem} className="flex gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-destructive" />
                        <span className="break-all">{problem}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {!healthy && (
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => repair.mutate({ settingsId: region.settingId })}
                    disabled={repair.isPending}
                  >
                    {repair.isPending && repair.variables?.settingsId === region.settingId ? "Repairing…" : "Repair"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
