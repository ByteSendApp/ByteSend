<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../apps/web/public/brand/wordmark-dark.png">
    <img alt="ByteSend" src="../apps/web/public/brand/wordmark-light.png" width="420">
  </picture>
</p>

<p align="center">
  <strong>Open-source email infrastructure for developers.</strong><br>
  Transactional and marketing email through a REST API, SMTP relay and SDKs managed on
  <a href="https://bytesend.cloud">bytesend.cloud</a> or self-hosted on your own AWS account.
</p>

<p align="center">
  <a href="https://bytesend.cloud">Website</a> ·
  <a href="https://docs.bytesend.cloud">Docs</a> ·
  <a href="https://docs.bytesend.cloud/api-reference/introduction">API reference</a> ·
  <a href="https://github.com/NodeByteLTD/ByteSend/releases">Releases</a> ·
  <a href="https://discord.gg/nodebyte">Discord</a>
</p>

<p align="center">
  <a href="../LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-0057ff"></a>
  <a href="https://github.com/NodeByteLTD/ByteSend/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/NodeByteLTD/ByteSend?color=1fb5ff"></a>
  <a href="https://discord.gg/nodebyte"><img alt="Discord" src="https://img.shields.io/badge/chat-discord-00c3d6"></a>
</p>

---

## Send your first email

```ts
import { ByteSend } from "bytesend-js";

const bytesend = new ByteSend("bs_your_api_key");

await bytesend.emails.send({
  from: "Acme <hello@acme.com>",
  to: "customer@example.com",
  subject: "Welcome to Acme",
  html: "<p>Thanks for signing up!</p>",
});
```

Prefer another language or no code at all? Use the [Python](../packages/python-sdk) or [Go](../packages/go-sdk) SDK, call the [REST API](https://docs.bytesend.cloud/api-reference/introduction) directly, or point any app at the [SMTP relay](https://docs.bytesend.cloud/get-started/smtp).

## What's included

**Sending**
- REST API, SMTP relay, and SDKs for TypeScript, Python and Go
- Scheduled sends, batch sends of up to 100 emails, idempotency keys and custom headers
- Templates built in a visual editor, with variables
- Per-domain open and click tracking

**Marketing**
- Contact books with double opt-in and one-click (RFC 8058) unsubscribe
- Campaigns with batching and send windows

**Deliverability**
- Guided domain setup with DKIM, SPF (custom MAIL FROM) and DMARC checks
- Automatic suppression of hard bounces and complaints
- Bounce and complaint rates enforced per team at Google and Yahoo sender thresholds
- Outbound spam scoring: suspicious mail is flagged, high-risk mail is held for review
- Daily domain blocklist monitoring (Spamhaus DBL, SURBL, URIBL)
- Move a domain between SES regions without downtime

**Operations**
- Signed webhooks with retries for every email and domain event
- Team notifications to Discord, Slack, Microsoft Teams, Telegram or any webhook
- Teams with roles, API keys scoped by permission and domain, and 2FA
- An admin panel with platform overview, audit log, email explorer and spam review

## Cloud or self-hosted

**Cloud** — [bytesend.cloud](https://bytesend.cloud) is the fastest start: sign up, verify a domain and send. No infrastructure to run.

**Self-hosted** — ByteSend is free to self-host under AGPL-3.0. You bring PostgreSQL, Redis and an AWS account with SES.

```bash
git clone https://github.com/NodeByteLTD/ByteSend.git
cd ByteSend
cp docker/prod/.env.example docker/prod/.env   # fill in your values
docker compose -f docker/prod/compose.yml --env-file docker/prod/.env up -d
docker compose -f docker/prod/compose.yml --env-file docker/prod/.env exec web pnpm db:migrate-deploy
```

The [self-hosting guide](https://docs.bytesend.cloud/self-hosting/overview) covers SES setup, reverse proxy and TLS, the SMTP relay and upgrades.

## Local development

You need Node.js 20.19+, pnpm 9+ and Docker.

```bash
pnpm install
cp .env.example .env     # fill in values
pnpm dx:up               # Postgres, Redis and MinIO in Docker
pnpm db:migrate-dev      # apply database migrations
pnpm dev                 # web app on http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm dev` | Run every app in watch mode |
| `pnpm build` | Production build |
| `pnpm lint` | Lint all packages |
| `pnpm test:web` | Web unit tests (Vitest) |
| `pnpm test:web:all` | Unit and integration tests (needs `pnpm dx:up`) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm dx:down` | Stop the local Docker services |

The [local setup guide](https://docs.bytesend.cloud/get-started/local) walks through the environment variables.

## Repository layout

| Path | What's there |
|---|---|
| [`apps/web`](../apps/web) | Next.js dashboard, tRPC API, public REST API (Hono) and background jobs |
| [`apps/smtp-server`](../apps/smtp-server) | SMTP relay that forwards mail to the ByteSend API |
| [`apps/docs`](../apps/docs) | Documentation site |
| [`packages/sdk`](../packages/sdk) | TypeScript SDK (`bytesend-js`) |
| [`packages/python-sdk`](../packages/python-sdk) | Python SDK (`bytesend`) |
| [`packages/go-sdk`](../packages/go-sdk) | Go SDK (`github.com/nodebyteltd/bytesend-go`) |
| [`packages/ui`](../packages/ui) | Shared UI components |
| [`packages/email-editor`](../packages/email-editor) | Visual email template editor |

**Built with** Next.js 16 · TypeScript · tRPC · Hono · Prisma · PostgreSQL · Redis · BullMQ · AWS SES · NextAuth · Tailwind CSS · Turborepo

## Contributing

Contributions are welcome.

1. Open or comment on an issue first, so work doesn't overlap.
2. Branch from `develop` and use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope): …`, `fix(scope): …`).
3. Open your pull request against `develop`.

Read the [contributing guide](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md) before you start. Notes for AI coding agents are in [AGENTS.md](../AGENTS.md).

Found a security issue? Please report it privately as described in the [security policy](SECURITY.md) rather than opening an issue. For help, see [support](SUPPORT.md).

## License

ByteSend is licensed under the [GNU Affero General Public License v3.0](../LICENSE). If you run a modified version as a network service, the AGPL requires you to make your changes available to its users.
