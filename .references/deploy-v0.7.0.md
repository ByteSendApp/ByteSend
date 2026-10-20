# Deploying v0.7.0

Checklist for shipping v0.7.0 (new pricing, dashboard overview, domain monitoring, new-account limit) to ByteSend Cloud. Do it in this order. Items marked **(if not done)** carry over from v0.5.0 and v0.6.0.

## 1. Before deploying

- [ ] **Check VAT with your accountant.** NodeByte is UK-registered, so UK customers are charged 20% VAT once you're VAT-registered (required above £90k turnover a year). EU consumers need EU VAT via the OSS scheme from the first sale, because there's no threshold for non-EU sellers of digital services. EU businesses with a VAT number are reverse-charged. US sales tax only applies once you pass a state's threshold. Stripe Tax monitors these thresholds for you.
- [ ] **Turn on Stripe Tax** (Stripe dashboard → Tax):
  - Set the origin address to NodeByte's UK address.
  - Set the product tax code to *Software as a service (SaaS), business use* (`txcd_10103001`).
  - Add a registration for **United Kingdom**, and for **EU (OSS)** once you've registered.
  - The seed creates every price (all currencies) as tax-exclusive, so VAT is added on top of $5 / $20 / $90.
- [ ] **Decide what to do about existing CAD customers.** A Stripe customer who has been billed in CAD can't be moved to a USD price. Existing subscribers keep working as they are, but if one of them changes plan, checkout or the portal will refuse. You have two options:
  - add `cad` to `currencyOptions()` in `packages/lib/src/stripe/seed.ts`, with suggested amounts CA$7 / CA$28 / CA$125; or
  - handle these customers by hand: cancel at period end, then resubscribe them under a new customer.

  There are few of them, so doing it by hand is fine for now.
- [ ] **Check custom contracts.** `customMonthlyPriceCents` was entered in CAD but now displays with `$`. Re-enter it in USD for any team with a custom plan (Admin → Teams → team → Custom plan).

## 2. Deploy

- [ ] **Set env vars** on the web app:
  - `STRIPE_AUTOMATIC_TAX=true`, only after Stripe Tax is set up. If it's on without a registration, checkout fails.
  - `DISCORD_LINKED_ROLES_CLIENT_ID` and `DISCORD_LINKED_ROLES_CLIENT_SECRET` **(if not done)**. These go on the web app, not the bot.
- [ ] **Run migrations** with `pnpm db:migrate-deploy` (or `prisma migrate deploy`). Pending since v0.6.0:
  - `20261020000000_add_blocklist`
  - `20261020010000_new_team_ramp_and_domain_age`
  - `20261020020000_usage_alerts_and_domain_health`
  - `20261020030000_add_scale_plan` (adds `SCALE` to the `Plan` enum)
- [ ] **Re-seed Stripe**: run `pnpm stripe:seed:prod`.
  - It archives the old products and creates Starter, Pro and Scale with USD prices plus GBP and EUR `currency_options`. Prices are tagged `metadata.pricing = 2026-10-usd`.
  - It skips Lite and Lifetime.
  - It reuses the existing usage meters, so overage for current subscribers keeps reporting.
  - Archived products and prices keep billing existing subscriptions. Plans are resolved from `price.metadata.plan`, so nobody gets downgraded.
  - Check the output for the new `STRIPE_SCALE_*` price IDs; they're stored in `AppSetting` in whichever database `DATABASE_URL` points at.
  - Run it once. Recreate mode is on, so a second run archives the products the first one made.
  - Webhook registration uses `NEXTAUTH_URL`. With a localhost URL it's skipped, and the existing prod endpoint is left as it is.
- [ ] Deploy the web app, and restart the worker so the domain health job (twice daily) gets scheduled.

## 3. Stripe dashboard after seeding

- [ ] **Customer portal** (live mode, Settings → Billing → Customer portal):
  - Turn on **Customers can switch plans**. Remove the archived products, and add ByteSend Starter, Pro and Scale with their $ monthly price. GBP and EUR come from the same price.
  - Don't add the add-ons, Lite or Lifetime.
  - Set downgrades to apply at the end of the billing period, and cancellations to take effect at period end.
  - The portal only swaps the monthly price. The webhook then moves the overage prices to match, so this needs the v0.7.0 web app deployed.
- [ ] Do a test checkout with a UK and an EU address, and confirm it shows £ or € and adds VAT.
- [ ] Check that one existing CAD subscriber still shows their plan on Settings → Billing.

## 4. Things that change for existing users

- **Free teams drop from 12,500 to 5,000 emails a month, and from 5,000 to 200 a day, as soon as you deploy.** Announce this first: email free teams and post in Discord, ideally a week ahead. Teams already over 5,000 this month are stopped until the month resets.
- New free teams are limited to 50 emails a day for their first 7 days. Admins can lift this per team (Admin → Teams → team → Approve sending).
- Lite and Lifetime teams keep everything. Their billing page shows a "legacy plan" note.
- Paid subscribers keep their CAD price until they change plan.

## 5. Carry-overs (if not done)

- [ ] **Discord bot env:** `EVENT_LOG_CHANNEL_ID`, `MEMBER_ROLE_ID`, `BOT_ROLE_ID`. In the Developer Portal, enable the **Server Members** intent. Give the bot **Manage Roles**, with its role placed above Members and Bots.
- [ ] **S3 uploads 403:** add a public-read bucket policy for the uploads prefix (or put CloudFront in front), and make sure `S3_REGION` matches the bucket's region.
- [ ] **SES callbacks:** in Admin → SES regions, run **Repair** on us-east-1 (event destination pointing at the `-full` topic). In ca-central-1, fix the subscription whose callback URL has a doubled path.
- [ ] **Status page:** rename the component to "US West (N. California)".
- [ ] **GitHub:** check that CODEOWNERS and branch protection on `ByteSendApp/ByteSend` use the new org's teams.

## 6. Release

- [ ] Tag `v0.7.0` from `main` after merging `develop` (see `release-playbook.md`). CHANGELOG already has the `[0.7.0]` section.
- [ ] Post the announcement: new prices, Scale plan, local currency, the free plan change and the new-account limit.
