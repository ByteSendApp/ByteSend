"use client";

import { useState } from "react";
import { Button } from "@bytesend/ui/src/button";
import { Card } from "@bytesend/ui/src/card";
import { Spinner } from "@bytesend/ui/src/spinner";
import { format } from "date-fns";
import { useTeam } from "~/providers/team-context";
import { api } from "~/trpc/react";
import { PlanDetails } from "~/components/payments/PlanDetails";
import { PLANS } from "@bytesend/lib";
import { BillingPlanSelector } from "~/components/payments/BillingPlanSelector";

export default function SettingsPage() {
  const { currentTeam, currentIsAdmin } = useTeam();
  const manageSessionUrl = api.billing.getManageSessionUrl.useMutation();
  const updateBillingEmailMutation =
    api.billing.updateBillingEmail.useMutation();

  const { data: subscription } = api.billing.getSubscriptionDetails.useQuery();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [billingEmail, setBillingEmail] = useState(
    currentTeam?.billingEmail || "",
  );

  const apiUtils = api.useUtils();

  const onManageClick = async () => {
    const url = await manageSessionUrl.mutateAsync();
    if (url) {
      window.location.href = url;
    }
  };

  const handleEditEmail = () => {
    setBillingEmail(currentTeam?.billingEmail || "");
    setIsEditingEmail(true);
  };

  const handleSaveEmail = async () => {
    try {
      await updateBillingEmailMutation.mutateAsync({ billingEmail });
      await apiUtils.team.getTeams.invalidate();
      setIsEditingEmail(false);
    } catch (error) {
      console.error("Failed to update billing email:", error);
    }
  };

  const paymentMethod =
    subscription?.paymentMethod && subscription.paymentMethod !== "null"
      ? JSON.parse(subscription.paymentMethod)
      : {};

  if (!currentIsAdmin) {
    return null;
  }

  if (!currentTeam?.plan) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className=" rounded-xl mt-10 p-8 px-8">
        <PlanDetails />
        <div className="mt-4">
          {currentTeam?.plan !== "FREE" ? (
            <Button
              onClick={onManageClick}
              className="mt-4 w-30"
              disabled={manageSessionUrl.isPending}
            >
              {manageSessionUrl.isPending ? (
                <Spinner className="w-4 h-4" />
              ) : (
                "Manage"
              )}
            </Button>
          ) : null}
        </div>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select monthly marketing and transactional limits, then lock in that exact Stripe contract here.
        </p>
        <div className="space-y-4">
          <BillingPlanSelector
            currentPlan={currentTeam.plan}
            onManageClick={onManageClick}
            isManaging={manageSessionUrl.isPending}
          />

          {currentTeam.plan === "LIFETIME" || currentTeam.plan === "LITE" ? (
            <Card className="rounded-xl border border-border/70 p-4 sm:p-5">
              <h4 className="text-sm font-semibold">You&apos;re on a legacy plan</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {PLANS[currentTeam.plan].displayName} is no longer sold, but you keep it, its limits and your price for as
                long as you stay on it.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <Card className="p-6">
          <div>
            <div className="text-sm text-muted-foreground">Payment Method</div>
            {subscription ? (
              <div className="mt-2">
                <div className="text-lg font-mono uppercase flex items-center gap-2">
                  {subscription.paymentMethod &&
                    subscription.paymentMethod !== "null" ? (
                    <>
                      <span>💳</span>
                      <span className="capitalize">
                        {paymentMethod?.card?.brand || ""} ••••{" "}
                        {paymentMethod?.card?.last4 || ""}
                      </span>
                      {paymentMethod?.card && (
                        <span className="text-sm text-muted-foreground lowercase">
                          (Expires: {paymentMethod.card.exp_month}/
                          {paymentMethod.card.exp_year})
                        </span>
                      )}
                    </>
                  ) : (
                    "No Payment Method"
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Next billing date:{" "}
                  {subscription.currentPeriodEnd
                    ? format(
                      new Date(subscription.currentPeriodEnd),
                      "MMM dd, yyyy",
                    )
                    : "N/A"}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mt-2">
                No active subscription
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <div className="text-sm text-muted-foreground">Billing Email</div>
            {isEditingEmail ? (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter billing email"
                  />
                  <Button
                    onClick={handleSaveEmail}
                    disabled={updateBillingEmailMutation.isPending}
                    size="sm"
                  >
                    {updateBillingEmailMutation.isPending ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    onClick={() => setIsEditingEmail(false)}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="font-mono">
                    {currentTeam?.billingEmail || "No billing email set"}
                  </div>
                  <Button onClick={handleEditEmail} variant="default" size="sm">
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
