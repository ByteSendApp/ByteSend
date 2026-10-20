#!/usr/bin/env tsx
/**
 * Stripe + DB Seed
 *
 * Syncs ByteSend plans to Stripe (creating/updating products and prices)
 * then persists all resulting IDs to the `AppSetting` table so that no
 * plan-specific STRIPE_*_PRICE_ID env vars are needed at runtime.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY  — Stripe secret key (sk_live_* or sk_test_*)
 *   DATABASE_URL       — Postgres connection string
 *
 * Usage (from repo root):
 *   pnpm stripe:seed          (defaults to "dev")
 *   pnpm stripe:seed:prod     (environment label = "production")
 */

import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import {
  syncPlansToStripe,
  generateDbConfig,
  DB_CONFIG_KEYS,
  PRICING_VERSION,
} from "../../../packages/lib/src/stripe/seed.ts";
import { STRIPE_ADDON_PRODUCTS } from "../../../packages/lib/src/stripe/products.ts";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const ENVIRONMENT = process.argv[2] ?? process.env.NODE_ENV ?? "dev";
const FORCE_RECREATE_PRODUCTS = true;

async function upsertAddonProductAndPrice(params: {
  stripe: Stripe;
  environment: string;
  addonCode: "ADDITIONAL_DOMAIN" | "EXTRA_MEMBER";
  productName: string;
  productDescription: string;
  priceMonthly: number;
  priceMetadataType: string;
  forceRecreateProducts: boolean;
}): Promise<{ productId: string; priceId: string }> {
  const {
    stripe,
    environment,
    addonCode,
    productName,
    productDescription,
    priceMonthly,
    priceMetadataType,
    forceRecreateProducts,
  } = params;

  const displayName = `${productName} (${environment})`;

  const existingProducts = await stripe.products.search({
    query: `name:"${displayName}" AND active:'true'`,
    limit: 100,
  });

  if (forceRecreateProducts) {
    for (const existing of existingProducts.data) {
      await stripe.products.update(existing.id, { active: false });
      console.log(`  ✓ Archived existing add-on product: ${existing.id}`);
    }
  }

  let product: Stripe.Product;
  if (!forceRecreateProducts && existingProducts.data.length > 0) {
    product = existingProducts.data[0];
    await stripe.products.update(product.id, {
      description: productDescription,
      metadata: { bytesend_addon: addonCode, environment },
    });
    console.log(`  ✓ Updated add-on product: ${product.id}`);
  } else {
    product = await stripe.products.create({
      name: displayName,
      description: productDescription,
      metadata: { bytesend_addon: addonCode, environment },
    });
    console.log(`  ✓ Created add-on product: ${product.id}`);
  }

  const existingPrices = await stripe.prices.search({
    query: `product:'${product.id}' AND active:'true' AND metadata['type']:'${priceMetadataType}' AND metadata['pricing']:'${PRICING_VERSION}'`,
    limit: 1,
  });

  let price: Stripe.Price;
  if (existingPrices.data.length > 0) {
    price = existingPrices.data[0];
    console.log(`  ✓ Found add-on price: ${price.id}`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: priceMonthly,
      // Add-ons cost the same number in every currency ($1 / £1 / €1 per domain).
      tax_behavior: "exclusive",
      currency_options: {
        gbp: { unit_amount: priceMonthly, tax_behavior: "exclusive" },
        eur: { unit_amount: priceMonthly, tax_behavior: "exclusive" },
      },
      recurring: { interval: "month", usage_type: "licensed" },
      metadata: { type: priceMetadataType, environment, pricing: PRICING_VERSION },
    });
    console.log(`  ✓ Created add-on price: ${price.id}`);
  }

  return { productId: product.id, priceId: price.id };
}

async function main() {
  console.log("\n🚀  ByteSend Stripe + DB Seed");
  console.log("================================\n");

  if (!STRIPE_SECRET_KEY) {
    console.error("❌  STRIPE_SECRET_KEY is not set");
    process.exit(1);
  }
  if (!DATABASE_URL) {
    console.error("❌  DATABASE_URL is not set");
    process.exit(1);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
  const db = new PrismaClient();

  console.log(`📦  Environment : ${ENVIRONMENT}`);
  console.log(`🔑  Stripe key  : ${STRIPE_SECRET_KEY.slice(0, 20)}...`);
  console.log(`♻️   Recreate mode: ${FORCE_RECREATE_PRODUCTS ? "enabled" : "disabled"}`);
  console.log("\n📝  Syncing plans to Stripe...\n");

  // ── Step 1: Sync core plans ──────────────────────────────────────────────
  const result = await syncPlansToStripe(stripe, ENVIRONMENT, {
    forceRecreateProducts: FORCE_RECREATE_PRODUCTS,
  });

  if (!result.success) {
    console.error("\n❌  Stripe sync failed:");
    result.errors?.forEach((e) => console.error(`   - ${e}`));
    await db.$disconnect();
    process.exit(1);
  }

  console.log(`\n✅  Synced ${result.products.length} core plans`);

  // ── Step 2: Sync add-ons (domain + member) ───────────────────────────────
  console.log("\n📎  Syncing add-ons...");

  const domainAddon = await upsertAddonProductAndPrice({
    stripe,
    environment: ENVIRONMENT,
    addonCode: "ADDITIONAL_DOMAIN",
    productName: STRIPE_ADDON_PRODUCTS.ADDITIONAL_DOMAIN.name,
    productDescription: STRIPE_ADDON_PRODUCTS.ADDITIONAL_DOMAIN.description,
    priceMonthly: STRIPE_ADDON_PRODUCTS.ADDITIONAL_DOMAIN.priceMonthly,
    priceMetadataType: "addon-domain-monthly",
    forceRecreateProducts: FORCE_RECREATE_PRODUCTS,
  });

  const memberAddon = await upsertAddonProductAndPrice({
    stripe,
    environment: ENVIRONMENT,
    addonCode: "EXTRA_MEMBER",
    productName: STRIPE_ADDON_PRODUCTS.EXTRA_MEMBER.name,
    productDescription: STRIPE_ADDON_PRODUCTS.EXTRA_MEMBER.description,
    priceMonthly: STRIPE_ADDON_PRODUCTS.EXTRA_MEMBER.priceMonthly,
    priceMetadataType: "addon-member-monthly",
    forceRecreateProducts: FORCE_RECREATE_PRODUCTS,
  });

  // ── Step 3: Build DB config map ──────────────────────────────────────────
  const dbConfig = generateDbConfig(
    result,
    domainAddon.productId,
    domainAddon.priceId,
    memberAddon.productId,
    memberAddon.priceId,
  );

  console.log(`\n💾  Writing ${Object.keys(dbConfig).length} config keys to AppSetting...\n`);

  // Upsert every key into AppSetting
  let savedCount = 0;
  for (const [key, value] of Object.entries(dbConfig)) {
    await db.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    console.log(`  ✓ ${key}`);
    savedCount++;
  }

  console.log(`\n✅  Saved ${savedCount} keys to AppSetting`);

  // ── Step 4: Register webhook endpoint ───────────────────────────────────
  const isDev = ENVIRONMENT === "dev" || ENVIRONMENT === "development" || ENVIRONMENT === "test";
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL;

  if (isDev) {
    console.log("\n🔔  Webhook: skipping registration for dev environment.");
    console.log("   Run `pnpm stripe:listen` to forward events to localhost.");
  } else if (!appUrl) {
    console.warn("\n⚠️   Webhook: NEXTAUTH_URL / APP_URL not set — skipping endpoint registration.");
    console.warn("   Set NEXTAUTH_URL and re-run to auto-register the webhook.");
  } else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(appUrl)) {
    console.warn(`\n⚠️   Webhook: ${appUrl} isn't publicly reachable, so Stripe can't send to it. Skipping registration.`);
    console.warn("   Your existing endpoint and stored secret are unchanged.");
  } else {
    const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhook/stripe`;
    console.log(`\n🔔  Registering webhook endpoint: ${webhookUrl}`);

    const enabledEvents: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
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

    // Check if endpoint already registered for this URL
    const existingEndpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const existing = existingEndpoints.data.find((e) => e.url === webhookUrl);

    let webhookSecret: string | undefined;

    if (existing) {
      console.log(`  ✓ Endpoint already registered: ${existing.id}`);
      console.log(`    Status: ${existing.status}`);

      // Update enabled events in case they changed
      await stripe.webhookEndpoints.update(existing.id, { enabled_events: enabledEvents });
      console.log(`  ✓ Enabled events updated`);

      // Check if we already have the secret stored
      const existingSecret = await db.appSetting.findUnique({
        where: { key: DB_CONFIG_KEYS.webhook.secret },
      });
      if (existingSecret) {
        console.log(`  ✓ Webhook secret already in AppSetting`);
      } else {
        console.warn(`  ⚠️  Webhook secret not in AppSetting — endpoint was created previously.`);
        console.warn(`     Re-create the endpoint manually or delete it and re-run the seed.`);
      }
    } else {
      const endpoint = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: enabledEvents,
        metadata: { environment: ENVIRONMENT, bytesend: "true" },
      });
      webhookSecret = endpoint.secret;
      console.log(`  ✓ Created endpoint: ${endpoint.id}`);

      // Save endpoint ID and secret to AppSetting
      await db.appSetting.upsert({
        where: { key: DB_CONFIG_KEYS.webhook.endpointId },
        update: { value: endpoint.id },
        create: { key: DB_CONFIG_KEYS.webhook.endpointId, value: endpoint.id },
      });
      await db.appSetting.upsert({
        where: { key: DB_CONFIG_KEYS.webhook.secret },
        update: { value: webhookSecret! },
        create: { key: DB_CONFIG_KEYS.webhook.secret, value: webhookSecret! },
      });
      console.log(`  ✓ Webhook secret saved to AppSetting`);
      console.log(`\n  ℹ️  Optionally set in .env for faster startup:`);
      console.log(`     STRIPE_WEBHOOK_SECRET=${webhookSecret}`);
    }
  }

  // ── Step 5: Print summary ────────────────────────────────────────────────
  console.log("\n📊  Price IDs stored:");
  console.log("─────────────────────────────────────────");

  const prices = Object.entries(dbConfig).filter(([k]) => k.startsWith("stripe.price."));
  for (const [key, value] of prices) {
    console.log(`  ${key.padEnd(50)} ${value}`);
  }

  console.log("\n✅  Done. You only need STRIPE_SECRET_KEY in your .env.");
  console.log("   All price/product IDs and the webhook secret are stored in the database.\n");

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  const db = new PrismaClient();
  await db.$disconnect();
  process.exit(1);
});
