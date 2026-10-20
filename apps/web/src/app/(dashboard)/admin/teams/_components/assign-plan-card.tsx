"use client";

import { useState } from "react";
import type { Plan } from "@prisma/client";
import { Button } from "@bytesend/ui/src/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bytesend/ui/src/select";
import { toast } from "@bytesend/ui/src/toaster";
import { api } from "~/trpc/react";

const PLAN_OPTIONS: Array<{ value: Plan; label: string }> = [
  { value: "FREE", label: "Free" },
  { value: "HOBBY", label: "Starter ($5/mo)" },
  { value: "BASIC", label: "Pro ($20/mo)" },
  { value: "SCALE", label: "Scale ($90/mo)" },
  { value: "LITE", label: "Lite (legacy)" },
  { value: "LIFETIME", label: "Lifetime (legacy)" },
];

export function AssignPlanCard({ teamId, currentPlan }: { teamId: number; currentPlan: Plan }) {
  const utils = api.useUtils();
  const [plan, setPlan] = useState<Plan>(currentPlan === "FREE" ? "BASIC" : currentPlan);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const assignPlan = api.admin.adminAssignPlan.useMutation({
    onSuccess: async (result) => {
      if (result.method === "checkout_link" && result.url) {
        setCheckoutUrl(result.url);
        toast.success("Checkout link created");
      } else {
        toast.success("Plan assigned");
      }
      await Promise.all([
        utils.admin.getTeamDetail.invalidate({ teamId }),
        utils.admin.listAuditLog.invalidate(),
      ]);
    },
    onError: (error) => toast.error("Could not assign plan", { description: error.message }),
  });

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-medium text-foreground">Plan</h3>
        <p className="text-xs text-muted-foreground">
          Assign a plan directly at no cost, or create a Stripe checkout link for the team to pay.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={plan} onValueChange={(value) => setPlan(value as Plan)} disabled={assignPlan.isPending}>
          <SelectTrigger className="sm:w-64" aria-label="Plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            disabled={assignPlan.isPending || plan === currentPlan}
            onClick={() => {
              setCheckoutUrl(null);
              assignPlan.mutate({ teamId, plan, method: "complimentary" });
            }}
          >
            Assign free of charge
          </Button>
          <Button
            variant="outline"
            disabled={assignPlan.isPending || plan === "FREE"}
            onClick={() => {
              setCheckoutUrl(null);
              assignPlan.mutate({ teamId, plan, method: "checkout_link" });
            }}
          >
            Checkout link
          </Button>
        </div>
      </div>
      {checkoutUrl ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Share this link with the team:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded border border-border/60 bg-background px-2 py-1 font-mono text-xs">
              {checkoutUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(checkoutUrl);
                toast.success("Copied to clipboard");
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
