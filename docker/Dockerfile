FROM node:20.19-alpine3.20 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV SKIP_ENV_VALIDATION="true"
ENV DOCKER_OUTPUT=1
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable
RUN corepack prepare pnpm@latest --activate

FROM base AS builder
RUN apk add --no-cache libc6-compat
RUN apk update
# Set working directory
WORKDIR /app
# Copy monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY ./apps/web ./apps/web
COPY ./packages ./packages
RUN pnpm add turbo@^2.5.2 -g

# Prune dependencies for web app to optimize layer caching
RUN pnpm turbo prune web --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY .pnpmfile.cjs .pnpmfile.cjs
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install

# Build arguments — placed after install to preserve dep cache when these change
ARG APP_VERSION=unknown
ARG GIT_SHA=unknown
# NEXT_PUBLIC_ vars must be baked at build time; default false for self-hosted images
ARG NEXT_PUBLIC_IS_CLOUD=false

ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_IS_CLOUD=$NEXT_PUBLIC_IS_CLOUD

# Build the project
COPY --from=builder /app/out/full/ .

RUN pnpm turbo run build --filter=web...

FROM base AS runner
WORKDIR /app

COPY --from=installer /app/apps/web/next.config.js .
COPY --from=installer /app/apps/web/package.json .
COPY --from=installer /app/pnpm-lock.yaml .


# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=installer  /app/apps/web/.next/standalone ./
COPY --from=installer  /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer  /app/apps/web/public ./apps/web/public

# Copy prisma files
COPY --from=installer  /app/apps/web/prisma/schema.prisma ./apps/web/prisma/schema.prisma
COPY --from=installer  /app/apps/web/prisma/migrations ./apps/web/prisma/migrations
COPY --from=installer  /app/apps/web/node_modules/prisma ./node_modules/prisma
COPY --from=installer  /app/apps/web/node_modules/@prisma ./node_modules/@prisma

# Symlink the prisma binary
RUN mkdir node_modules/.bin
RUN ln -s /app/node_modules/prisma/build/index.js ./node_modules/.bin/prisma

# set this so it throws error where starting server
ENV SKIP_ENV_VALIDATION="false"

COPY  ./docker/start.sh ./start.sh

CMD ["sh", "start.sh"]
