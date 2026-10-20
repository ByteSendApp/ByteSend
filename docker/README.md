# Docker Setup for ByteSend

ByteSend uses a monorepo structure with separate services for the web application and SMTP server. This guide walks you through setting up both services using Docker.

## Architecture

- **`Dockerfile.web`**: Builds the Next.js web application with all workspace dependencies
- **`Dockerfile.smtp`**: Builds the SMTP server with workspace dependencies
- Both respect the pnpm workspace and share package layers

## Prerequisites

Before you begin, ensure that you have the following installed:

- Docker
- Docker Compose
- Node.js 20.19 or newer (for local development)

## Building Docker Images

To build both images:

```bash
./docker/build.sh
```

This builds:
- `bytesend/bytesend:latest` - The ByteSend web application
- `bytesend/smtp-proxy:latest` - The SMTP server

## Option 1: Development Setup with Docker Compose

Start the complete development environment with Docker:

```bash
cd docker/dev
docker-compose up -d
```

This starts:
- PostgreSQL database
- Redis
- ByteSend web application (port 3000)
- ByteSend SMTP server (ports 25, 465, 587, 2465, 2587)
- Local S3 (MinIO) for storage
- Local SES/SNS mock service

## Option 2: Production Setup with Docker Compose

1. Download or copy the production compose file:
   ```bash
   cd docker/prod
   ```

2. Create a `.env` file with your configuration:
   ```env
   # Database
   POSTGRES_USER=bytesend
   POSTGRES_PASSWORD=<secure-password>
   POSTGRES_DB=bytesend
   DATABASE_URL=postgresql://bytesend:<password>@postgres:5432/bytesend

   # Redis
   REDIS_URL=redis://redis:6379

   # NextAuth
   NEXTAUTH_URL=https://bytesend.cloud
   NEXTAUTH_SECRET=<secure-secret>

   # AWS/SES
   AWS_ACCESS_KEY=<your-key>
   AWS_SECRET_KEY=<your-secret>
   AWS_DEFAULT_REGION=us-east-1

   # GitHub OAuth
   GITHUB_ID=<your-github-id>
   GITHUB_SECRET=<your-github-secret>

   # SMTP Configuration
   BYTESEND_BASE_URL=http://web:3000
   SMTP_AUTH_USERNAME=bytesend
   ```

3. Start the services:
   ```bash
   docker-compose --env-file ./.env up -d
   ```

This starts a production-ready setup with separate web and SMTP containers.

## Option 3: Standalone Web Container

To run just the web application:

```bash
docker pull bytesend/bytesend:latest

docker run -d \
  -p 3000:3000 \
  -e NEXTAUTH_URL="https://your-domain.com" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e DATABASE_URL="your-database-url" \
  -e REDIS_URL="your-redis-url" \
  -e AWS_ACCESS_KEY="your-key" \
  -e AWS_SECRET_KEY="your-secret" \
  -e AWS_DEFAULT_REGION="us-east-1" \
  -e GITHUB_ID="your-github-id" \
  -e GITHUB_SECRET="your-github-secret" \
  bytesend/bytesend:latest
```

## Option 4: Standalone SMTP Server

To run just the SMTP server:

```bash
docker pull bytesend/smtp-proxy:latest

docker run -d \
  -p 25:25 \
  -p 465:465 \
  -p 587:587 \
  -p 2465:2465 \
  -p 2587:2587 \
  -e BYTESEND_BASE_URL="http://your-web-server:3000" \
  -e SMTP_AUTH_USERNAME="bytesend" \
  bytesend/smtp-proxy:latest
```

## SMTP Server Ports

The SMTP server exposes the following ports:

| Port | Protocol | Purpose |
|------|----------|---------|
| 25   | SMTP     | Unencrypted email submission |
| 465  | SMTPS    | Implicit SSL/TLS |
| 587  | Submission | STARTTLS |
| 2465 | SMTPS    | Alternative implicit SSL/TLS |
| 2587 | Submission | Alternative STARTTLS |

## Workspace Respect

Both Dockerfiles respect the pnpm monorepo structure by:

1. Using `pnpm turbo prune` to optimize build layers
2. Installing all workspace dependencies from `packages/*`
3. Building only the necessary app while maintaining symlinks to shared packages
4. Sharing a common base image layer for efficiency

## Troubleshooting

**SMTP server can't reach the web server:**
- Ensure the `BYTESEND_BASE_URL` is set to the correct service name or IP
- In Docker Compose, use `http://web:3000` for service-to-service communication
- For external deployments, use the full URL of your web server

**Database connection issues:**
- Verify `DATABASE_URL` is correctly set
- Ensure the database container is healthy before starting the web app
- Check the `depends_on` condition in compose files

## Success

You have now set up ByteSend with Docker. The web application listens on port 3000 and the SMTP server on ports 25/465/587/2465/2587. For more information, refer to the [ByteSend documentation](https://docs.bytesend.cloud).
