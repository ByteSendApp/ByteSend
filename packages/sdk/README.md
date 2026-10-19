# ByteSend SDK

## Prerequisites

- [ByteSend API key](https://bytesend.cloud/settings/api-keys)
- [Verified domain](https://bytesend.cloud/domains)

## Installation

### NPM

```bash
npm install bytesend-js
```

### Yarn

```bash
yarn add bytesend-js
```

### PNPM

```bash
pnpm add bytesend-js
```

### Bun

```bash
bun add bytesend-js
```

## Usage

```javascript
import { ByteSend } from "bytesend-js";

const bytesend = new ByteSend("bs_12345");

// for self-hosted installations you can pass your base URL
// const bytesend = new ByteSend("bs_12345", "https://bytesend.cloud");

bytesend.emails.send({
  to: "hello@acme.com",
  from: "hello@company.com",
  subject: "ByteSend email",
  html: "<p>ByteSend is the best product to send emails</p>",
  text: "ByteSend is the best product to send emails",
});

// Safely retry sends with an idempotency key
await bytesend.emails.send(
  {
    to: "hello@acme.com",
    from: "hello@company.com",
    subject: "ByteSend email",
    html: "<p>ByteSend is the best product to send emails</p>",
  },
  { idempotencyKey: "signup-123" },
);

// Works for bulk sends too
await bytesend.emails.batch(
  [
    {
      to: "a@example.com",
      from: "hello@company.com",
      subject: "Welcome",
      html: "<p>Hello A</p>",
    },
    {
      to: "b@example.com",
      from: "hello@company.com",
      subject: "Welcome",
      html: "<p>Hello B</p>",
    },
  ],
  { idempotencyKey: "bulk-welcome-1" },
);
// Reusing the same key with a different payload returns HTTP 409.
```

## Campaigns

Create and manage email campaigns:

```javascript
import { ByteSend } from "bytesend-js";

const bytesend = new ByteSend("bs_12345");

// Create a campaign
const campaign = await bytesend.campaigns.create({
  name: "Welcome Series",
  from: "hello@company.com",
  subject: "Welcome to our platform!",
  contactBookId: "cb_12345",
  html: "<h1>Welcome!</h1><p>Thanks for joining us.</p>",
  sendNow: false,
});

// Schedule a campaign
await bytesend.campaigns.schedule(campaign.data.id, {
  scheduledAt: "2024-12-01T09:00:00Z",
  batchSize: 1000,
});

// Get campaign details
const details = await bytesend.campaigns.get(campaign.data.id);

// Pause a campaign
await bytesend.campaigns.pause(campaign.data.id);

// Resume a campaign
await bytesend.campaigns.resume(campaign.data.id);
```

## Webhooks

Verify webhook signatures and get typed events:

```ts
import { ByteSend } from "bytesend-js";

const bytesend = new ByteSend("bs_12345");
const webhooks = bytesend.webhooks(process.env.BYTESEND_WEBHOOK_SECRET!);

// In a Next.js App Route
export async function POST(request: Request) {
  try {
    const rawBody = await request.text(); // important: raw body, not parsed JSON
    const event = webhooks.constructEvent(rawBody, {
      headers: request.headers,
    });

    if (event.type === "email.delivered") {
      // event.data is strongly typed here
    }

    return new Response("ok");
  } catch (error) {
    return new Response((error as Error).message, { status: 400 });
  }
}
```

You can also use the `Webhooks` class directly:

```ts
import { Webhooks } from "bytesend-js";

const webhooks = new Webhooks(process.env.BYTESEND_WEBHOOK_SECRET!);
const event = webhooks.constructEvent(rawBody, { headers: request.headers });
```

Need only signature verification? Use the `verify` method:

```ts
const isValid = webhooks.verify(rawBody, { headers: request.headers });

if (!isValid) {
  return new Response("Invalid signature", { status: 401 });
}
```

Express example (ensure raw body is preserved):

```ts
import express from "express";
import { Webhooks } from "bytesend-js";

const webhooks = new Webhooks(process.env.BYTESEND_WEBHOOK_SECRET!);

const app = express();
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = webhooks.constructEvent(req.body, {
      headers: req.headers,
    });

    if (event.type === "email.bounced") {
      // handle bounce
    }

    res.status(200).send("ok");
  } catch (error) {
    res.status(400).send((error as Error).message);
  }
});
```

Headers sent by ByteSend:

- `X-ByteSend-Signature`: `v1=` + HMAC-SHA256 of `${timestamp}.${rawBody}`
- `X-ByteSend-Timestamp`: Unix epoch in milliseconds
- `X-ByteSend-Event`: webhook event type
- `X-ByteSend-Call`: unique webhook attempt id

By default, signatures are only accepted within 5 minutes of the timestamp. Override with `toleranceMs` if needed.
