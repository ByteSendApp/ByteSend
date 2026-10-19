import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "~/env";
import {
  getStripe,
  syncStripeData,
  syncLifetimePayment,
} from "~/server/billing/payments";
import { getWebhookSecret } from "~/server/billing/stripe-config";

const allowedEvents: Stripe.Event.Type[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
  "invoice.marked_uncollectible",
  "invoice.payment_succeeded",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
];

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature");

  if (!signature) {
    console.error("No signature");
    return new NextResponse("No signature", { status: 400 });
  }

  // Collect all candidate secrets: env var first, then DB-stored (stripe:seed).
  // Trying both handles local `stripe listen` sessions where the CLI issues a
  // per-session whsec that differs from what's stored in STRIPE_WEBHOOK_SECRET.
  const envSecret = env.STRIPE_WEBHOOK_SECRET ?? null;
  const dbSecret  = await getWebhookSecret().catch(() => null);
  const secrets   = [envSecret, dbSecret].filter((s): s is string => Boolean(s));

  if (secrets.length === 0) {
    console.error("[Stripe webhook] No webhook secret configured: set STRIPE_WEBHOOK_SECRET or run pnpm stripe:seed");
    return new NextResponse("No webhook secret", { status: 400 });
  }

  const stripe = getStripe();

  try {
    let event: Stripe.Event | undefined;
    for (const secret of secrets) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, secret);
        break;
      } catch {
        // try next candidate
      }
    }

    if (!event) {
      console.error(
        `[Stripe webhook] Signature verification failed with ${secrets.length} candidate secret(s). ` +
        `Make sure STRIPE_WEBHOOK_SECRET in .env matches the whsec_ printed by \`stripe listen\`.`
      );
      return new NextResponse("Invalid signature", { status: 400 });
    }

    console.log(`[Stripe webhook] Received: ${event.type} (${event.id})`);

    if (!allowedEvents.includes(event.type)) {
      return new NextResponse("OK", { status: 200 });
    }

    // Handle LIFETIME one-time payment checkout separately:
    // these have no subscription so syncStripeData would be a no-op.
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.plan === "LIFETIME") {
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (customerId) {
          await syncLifetimePayment(customerId);
        }
        return new NextResponse("OK", { status: 200 });
      }

      // For addon (extra domain slots) checkout, fall through to syncStripeData
      // which now inspects all subscriptions and sums extraDomainSlots automatically.
      if (session.metadata?.addonType === "EXTRA_DOMAIN") {
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (customerId) {
          await syncStripeData(customerId);
        }
        return new NextResponse("OK", { status: 200 });
      }
    }

    // Extract customer ID: some event types (e.g. payment_intent.*) can have
    // customer as null or an expanded object, so we normalize defensively.
    const rawCustomer = (event.data.object as { customer?: string | { id: string } | null }).customer;
    const customerId =
      typeof rawCustomer === "string"
        ? rawCustomer
        : typeof rawCustomer === "object" && rawCustomer !== null
          ? rawCustomer.id
          : null;

    if (!customerId) {
      // Event has no customer: nothing to sync (e.g. anonymous payment intent)
      console.log(`[Stripe webhook] Skipping ${event.type}: no customer ID`);
      return new NextResponse("OK", { status: 200 });
    }

    console.log(`[Stripe webhook] Syncing customer ${customerId} for event ${event.type}`);
    await syncStripeData(customerId);

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new NextResponse("Webhook error", { status: 400 });
  }
}
