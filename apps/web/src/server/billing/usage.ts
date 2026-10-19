import Stripe from "stripe";
import { env } from "~/env";
import { getUsageTimestamp } from "~/lib/usage";
import { METER_EVENT_NAMES } from "@bytesend/lib";

type EmailUsageType = "marketing" | "transactional";

export async function sendUsageToStripe(
  customerId: string,
  usage: number,
  type: EmailUsageType = "marketing"
) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-03-31.basil",
  });

  const eventName = METER_EVENT_NAMES[type];

  const meterEvent = await stripe.billing.meterEvents.create({
    event_name: eventName,
    payload: {
      value: usage.toString(),
      stripe_customer_id: customerId,
    },
    timestamp: getUsageTimestamp(),
  });

  return meterEvent;
}
