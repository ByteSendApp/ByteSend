import { Button } from "@bytesend/ui/src/button";
import Spinner from "@bytesend/ui/src/spinner";
import { api } from "~/trpc/react";

type CheckoutPlan = "HOBBY" | "BASIC" | "SCALE";
export type { CheckoutPlan };

export const UpgradeButton = ({
  plan = "BASIC",
  label,
  className,
}: {
  plan?: CheckoutPlan;
  label?: string;
  className?: string;
}) => {
  const checkoutMutation = api.billing.createCheckoutSession.useMutation();

  const onClick = async () => {
    const url = await checkoutMutation.mutateAsync({ plan });
    if (url) {
      window.location.href = url;
    }
  };

  return (
    <Button
      onClick={onClick}
      className={className ?? "w-full"}
      disabled={checkoutMutation.isPending}
    >
      {checkoutMutation.isPending ? (
        <Spinner className="w-4 h-4" />
      ) : (
        (label ?? "Choose Plan")
      )}
    </Button>
  );
};
