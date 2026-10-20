"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, RotateCw } from "lucide-react";
import { PLANS } from "@bytesend/lib";
import { Button } from "@bytesend/ui/src/button";
import { EmptyState } from "@bytesend/ui/src/empty-state";
import { Panel } from "@bytesend/ui/src/panel";
import Spinner from "@bytesend/ui/src/spinner";
import { api } from "~/trpc/react";

const TIMEOUT_MS = 30_000;

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResult />
    </Suspense>
  );
}

function PaymentResult() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  return (
    <Panel flush className="mx-auto mt-6 max-w-xl">
      {success ? (
        <VerifySuccess />
      ) : (
        <EmptyState
          className="py-16"
          icon={<CreditCard />}
          title={canceled ? "Checkout cancelled" : "Nothing to show here"}
          description={canceled ? "You weren't charged. Your plan hasn't changed." : "This page shows the result of a checkout."}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/billing">Back to billing</Link>
            </Button>
          }
        />
      )}
    </Panel>
  );
}

function VerifySuccess() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const utils = api.useUtils();

  const { data: teams, refetch } = api.team.getTeams.useQuery(undefined, { refetchInterval: 3000 });

  const syncMutation = api.billing.syncSubscription.useMutation({
    onSuccess: async () => {
      await utils.team.getTeams.invalidate();
      await refetch();
    },
  });

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  // The active team is remembered in localStorage, so check that team rather than the first one.
  const [activeTeamId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("bytesend:active-team-id");
    return stored ? parseInt(stored, 10) : null;
  });

  const activeTeam = activeTeamId ? (teams?.find((t) => t.id === activeTeamId) ?? teams?.[0]) : teams?.[0];

  if (activeTeam && activeTeam.plan !== "FREE") {
    const planName = PLANS[activeTeam.plan]?.displayName ?? activeTeam.plan;
    return (
      <EmptyState
        className="py-16"
        icon={<CheckCircle2 className="text-success" />}
        title={`You're on ${planName}`}
        description={`Thanks! ${activeTeam.name} has been upgraded and the new limits apply straight away.`}
        action={
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard">Go to the overview</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/billing">Billing</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (timedOut || syncMutation.isError) {
    return (
      <EmptyState
        className="py-16"
        icon={<CreditCard />}
        title="Payment received, plan not updated yet"
        description={
          <>
            Stripe hasn&apos;t told us about it yet. Sync now to pull it straight from Stripe.
            {syncMutation.isError ? <span className="mt-2 block text-destructive">{syncMutation.error.message}</span> : null}
            {sessionId ? <span className="mt-2 block font-mono text-[11px]">Reference {sessionId}</span> : null}
          </>
        }
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? <Spinner className="size-3.5" innerSvgClass="stroke-primary-foreground" /> : <RotateCw className="size-3.5" />}
              Sync from Stripe
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/billing">Billing</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <EmptyState
      className="py-16"
      icon={<Spinner className="size-5" innerSvgClass="stroke-muted-foreground" />}
      title="Confirming your payment"
      description="This usually takes a few seconds. You can leave this page; your plan updates either way."
    />
  );
}
