# Local SES and SNS

A small stand-in for Amazon SES v2 and SNS, so you can run ByteSend locally without an AWS account. `pnpm dx:up` starts it on port 5350.

## What it does

- Answers the SES v2, SNS and STS calls ByteSend makes.
- **Verifies every domain straight away**, so you don't need real DNS records.
- Keeps every email instead of sending it. Open <http://localhost:5350> to see them, with HTML, text and headers.
- Sends the delivery events SES would (Send, then Delivery, Bounce or Complaint) to the app's `/api/ses_callback`, in the same SNS format, so statuses, webhooks and analytics behave like production.
- Remembers domains, topics and subscriptions across restarts (in `/data/state.json` inside the container).

## Testing bounces and complaints

| Send to | You get |
| --- | --- |
| `success@simulator.amazonses.com` or any other address | Delivery |
| `bounce@simulator.amazonses.com`, or any address with `+bounce` (e.g. `me+bounce@example.com`) | A permanent bounce |
| `complaint@simulator.amazonses.com`, or `+complaint` | Delivery, then a complaint |
| `suppressionlist@simulator.amazonses.com`, or `+suppressionlist` | A bounce for an address on the suppression list |

## Settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5350` (`3000` in Docker) | Port to listen on |
| `LOCALHOST_ALIAS` | unset | Rewrites `localhost` in callback URLs, e.g. `host.docker.internal`, so the container can reach an app running on your machine |
| `WEBHOOK_URL` | unset | Where to send events when a topic has no subscribers |
| `DELIVERY_DELAY_MS` | `800` | Wait before the delivery, bounce or complaint event |
| `DATA_FILE` | `/data/state.json` | Where state is saved |

Point the web app at it with `AWS_SES_ENDPOINT` and `AWS_SNS_ENDPOINT` set to `http://localhost:5350` (already done in `.env.local`).

## Running without Docker

It isn't part of `pnpm dev` (Docker runs it). To run it directly on port 5350 instead, stop the Docker container first:

```sh
pnpm --filter @bytesend/local-ses-sns emulator:watch
```

## Publishing

It's published with the other images by `.github/workflows/docker-publish.yml`, for amd64 and arm64: `bytesend/local-ses-sns` on Docker Hub and `ghcr.io/bytesendapp/local-ses-sns` on GitHub Packages. Pushes to `develop` publish the `develop` tag, and `main` and release tags publish `latest`.
