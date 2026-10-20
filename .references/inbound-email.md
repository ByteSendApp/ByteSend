# Inbound email

Last reviewed: 2026-10-20

## Pipeline

1. Mail arrives at `inbound-smtp.<INBOUND_REGION>.amazonaws.com` (the MX for the hosted domain and every customer receiving subdomain).
2. The active SES receipt rule set `bytesend-inbound`, rule `bytesend-store-and-notify`, matches every recipient. It writes the raw MIME to `s3://<INBOUND_S3_BUCKET>/raw/<sesMessageId>` and publishes to `INBOUND_SNS_TOPIC_ARN`. Spam and virus scanning are on.
3. SNS posts to `/api/inbound_callback`. The route only trusts `INBOUND_SNS_TOPIC_ARN` (403 otherwise), confirms subscriptions itself from that ARN, and queues `Received` notifications on `inbound-email` (job id = SES message id, 5 attempts, exponential backoff).
4. `processInbound` (`apps/web/src/server/service/inbound-service.ts`):
   - resolves each recipient to a team: `slug(+tag)@INBOUND_HOSTED_DOMAIN`, or `*@<inboundSubdomain>.<domain>` for domains with `inboundEnabled`. Unknown recipients are dropped silently;
   - skips duplicates (`sesMessageId` is `<sesId>:<teamId>`), and drops mail over the plan's `inboundEmailsPerMonth`;
   - parses with mailparser, stores attachments at `attachments/<teamId>/<inboundId>/<attId>`, links replies through `In-Reply-To`/`References` to `Email.sesEmailId`;
   - runs forwarding rules (never when the virus verdict is `fail`), then emits `email.received`.
5. The `inbound-cleanup` job runs daily at 03:40 UTC and deletes rows past `expiresAt` (30 days) with their raw message and attachments.
6. Mail to `<slug>+dmarc@<hosted>` or `dmarc@<receiving subdomain>` skips the inbox and the allowance. `dmarc-service.ts` reads it only when SES's SPF or DKIM verdict passed, unpacks `.xml`, `.gz` and `.zip` attachments (each capped at 25 MB inflated), and stores reports for domains the team owns, at most 2,000 a day per team. The raw message is deleted straight away. Reports are kept 90 days and removed by the same cleanup job.

Attachment links are `/api/inbound/attachments/<emailId>/<attId>?expires&sig`, HMAC-SHA256 with `NEXTAUTH_SECRET`, valid for one hour, always served as downloads with `nosniff`.

## AWS setup

Use one region that supports SES receiving (for example `us-east-1`, `us-west-2`, `eu-west-1`) for everything below, and set it as `INBOUND_REGION`.

1. **S3 bucket**, private, with this bucket policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowSESPuts",
         "Effect": "Allow",
         "Principal": { "Service": "ses.amazonaws.com" },
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::<bucket>/*",
         "Condition": { "StringEquals": { "AWS:SourceAccount": "<account-id>" } }
       }
     ]
   }
   ```

   Add a lifecycle rule that expires `raw/` after 31 days. Mail for unknown recipients, or over a team's allowance, is never linked to a row, so the cleanup job can't remove it.

2. **IAM**: the app's key (`AWS_ACCESS_KEY`) needs `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on the bucket, `ses:CreateReceiptRuleSet`, `ses:DescribeReceiptRuleSet`, `ses:DescribeActiveReceiptRuleSet`, `ses:CreateReceiptRule`, `ses:UpdateReceiptRule` and `ses:SetActiveReceiptRuleSet`, plus the SES v2 identity permissions (`ses:CreateEmailIdentity`, `ses:GetEmailIdentity`, `ses:DeleteEmailIdentity`) it already has for sending.

3. **SNS topic** in the same region. Its access policy must let `ses.amazonaws.com` call `sns:Publish` (condition `AWS:SourceAccount`). Subscribe `https://<app>/api/inbound_callback` over HTTPS; the app confirms the subscription by itself once `INBOUND_SNS_TOPIC_ARN` is set and deployed.

4. **Env vars**: `INBOUND_REGION`, `INBOUND_S3_BUCKET`, `INBOUND_SNS_TOPIC_ARN`, and optionally `INBOUND_HOSTED_DOMAIN`. Receiving is off in production until `INBOUND_S3_BUCKET` is set.

5. **Hosted domain** (optional, for example `in.bytesend.cloud`): verify it as an SES identity in `INBOUND_REGION` and add `MX 10 inbound-smtp.<region>.amazonaws.com`.

6. **DMARC reports on the hosted domain**: reporters only send to an address on another domain when that domain agrees to receive them (RFC 7489 §7.1). Publish one wildcard record so every customer domain is covered:

   ```
   *._report._dmarc.<INBOUND_HOSTED_DOMAIN>  TXT  "v=DMARC1"
   ```

   Addresses on a customer's own receiving subdomain (`dmarc@reply.acme.com`) need nothing extra.

7. **Receipt rule**: Admin → SES regions → Receiving → **Create receiving rule**. It creates or updates the rule and makes the rule set active, and is safe to run again. Only one receipt rule set can be active per account and region, so this replaces any other active set there.

## Customer domains

`enableReceiving` (`inbound-domain-service.ts`) needs a verified sending domain and a single-label subdomain. If the domain sends from `INBOUND_REGION`, its existing identity covers the subdomain and the customer adds only the MX. Otherwise the app creates a separate identity for `<sub>.<domain>` in `INBOUND_REGION` with a new DKIM key under the selector `bytesend-inbound`, and the customer also adds that TXT record. `checkReceiving` looks up the MX and the identity's status. Disabling deletes the separate identity.

## Limits

`inboundEmailsPerMonth` in `packages/lib/src/stripe/plans.ts`: Free 1,000 · Starter 10,000 · Lite 20,000 · Pro 50,000 · Scale and Lifetime 250,000, counted per calendar month (UTC). SES accepts messages up to 30 MB.

## Troubleshooting

- **Nothing arrives**: check the rule set is active (`aws ses describe-active-receipt-rule-set --region <region>`), the MX resolves, and the SNS subscription is *Confirmed*.
- **403 from the callback**: the notification's `TopicArn` doesn't match `INBOUND_SNS_TOPIC_ARN`.
- **Rows marked FAILED**: forwarding needs a verified sending domain on the team; the error is on the row and in the Inbox detail.
- **Local**: with `pnpm dx:up` and `pnpm dev:local`, use "Send mail to ByteSend" at `http://localhost:5350`. Without a bucket, development stores mail under `apps/web/.data/inbound`.
