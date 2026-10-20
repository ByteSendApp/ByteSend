"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@bytesend/ui/src/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bytesend/ui/src/dialog";
import { Skeleton } from "@bytesend/ui/src/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@bytesend/ui/src/tabs";
import { Textarea } from "@bytesend/ui/src/textarea";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";
import { SPAM_FLAG_SCORE, SPAM_HOLD_SCORE, SPAM_RULE_LABELS } from "~/lib/constants/spam";
import { AdminPageHeader } from "../_components/admin-page-header";
import { StatusPill } from "../_components/status-pill";
import { EmailDetailSheet } from "../emails/email-detail-sheet";

type Filter = "held" | "flagged" | "reviewed";

export default function AdminSpamPage() {
  const utils = api.useUtils();
  const [filter, setFilter] = useState<Filter>("held");
  const [openEmailId, setOpenEmailId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const scansQuery = api.admin.listSpamScans.useInfiniteQuery(
    { filter, limit: 25 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );
  const scans = scansQuery.data?.pages.flatMap((page) => page.scans) ?? [];

  const refresh = async () => {
    await Promise.all([
      utils.admin.listSpamScans.invalidate(),
      utils.admin.countHeldSpam.invalidate(),
      utils.admin.listAuditLog.invalidate(),
    ]);
  };

  const release = api.admin.releaseSpamHold.useMutation({
    onSuccess: async () => {
      toast.success("Released and queued for sending");
      await refresh();
    },
    onError: (error) => toast.error("Could not release", { description: error.message }),
  });
  const reject = api.admin.rejectSpamHold.useMutation({
    onSuccess: async () => {
      toast.success("Rejected");
      setRejecting(null);
      setReason("");
      await refresh();
    },
    onError: (error) => toast.error("Could not reject", { description: error.message }),
  });

  return (
    <>
      <AdminPageHeader
        title="Spam review"
        description={`Outbound messages scoring ${SPAM_FLAG_SCORE}+ are flagged and still sent; ${SPAM_HOLD_SCORE}+ are held until reviewed. Five holds in 24 hours blocks the team automatically.`}
      />

      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList>
          <TabsTrigger value="held">Held</TabsTrigger>
          <TabsTrigger value="flagged">Flagged</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
        </TabsList>
      </Tabs>

      {scansQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : scans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {filter === "held" ? "Nothing is waiting for review." : "No messages here yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {scans.map((scan) => (
            <li key={scan.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={scan.verdict === "HOLD" ? "destructive" : "warning"}>
                      {scan.verdict === "HOLD" ? "Held" : "Flagged"} · score {scan.score}
                    </StatusPill>
                    {scan.reviewDecision ? (
                      <StatusPill tone={scan.reviewDecision === "RELEASED" ? "success" : "muted"}>
                        {scan.reviewDecision === "RELEASED" ? "Released" : "Rejected"}
                      </StatusPill>
                    ) : null}
                    <Link href={`/admin/teams/${scan.team.id}`} className="text-sm font-medium hover:underline">
                      {scan.team.name}
                    </Link>
                    {scan.team.isBlocked ? <StatusPill tone="destructive">Team blocked</StatusPill> : null}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(scan.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  {scan.email ? (
                    <div className="text-sm">
                      <p className="truncate font-medium">{scan.email.subject || "(no subject)"}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {scan.email.from} → {scan.email.to.join(", ")}
                      </p>
                    </div>
                  ) : scan.campaign ? (
                    <div className="text-sm">
                      <p className="truncate font-medium">
                        Campaign: {scan.campaign.name}{" "}
                        <span className="text-muted-foreground">({scan.campaign.total} recipients)</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {scan.campaign.subject} · <span className="font-mono">{scan.campaign.from}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">The message has been deleted.</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {scan.email ? (
                    <Button size="sm" variant="outline" onClick={() => setOpenEmailId(scan.email!.id)}>
                      Inspect
                    </Button>
                  ) : null}
                  {scan.verdict === "HOLD" && !scan.reviewedAt ? (
                    <>
                      <Button
                        size="sm"
                        disabled={release.isPending}
                        onClick={() => release.mutate({ scanId: scan.id })}
                      >
                        Release
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejecting(scan.id)}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {scan.hits.map((hit, index) => (
                  <li
                    key={`${hit.rule}-${index}`}
                    className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs"
                    title={hit.detail}
                  >
                    <span className="font-mono text-muted-foreground">+{hit.score}</span>{" "}
                    {SPAM_RULE_LABELS[hit.rule] ?? hit.rule}
                    {hit.detail ? <span className="text-muted-foreground"> · {hit.detail.slice(0, 48)}</span> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {scansQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={scansQuery.isFetchingNextPage}
            onClick={() => scansQuery.fetchNextPage()}
          >
            {scansQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}

      <EmailDetailSheet emailId={openEmailId} onClose={() => setOpenEmailId(null)} />

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject held message</DialogTitle>
            <DialogDescription>
              The message will not be sent and the customer sees it as rejected. The reason is saved to the audit log.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. credential phishing impersonating a bank"
            rows={3}
            aria-label="Reason"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || reject.isPending}
              onClick={() => rejecting && reject.mutate({ scanId: rejecting, reason })}
            >
              {reject.isPending ? "Rejecting…" : "Reject message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
