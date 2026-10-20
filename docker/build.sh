#!/usr/bin/env bash

command -v docker >/dev/null 2>&1 || {
    echo "Docker is not running. Please start Docker and try again."
    exit 1
}

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"

APP_VERSION="$(git name-rev --tags --name-only $(git rev-parse HEAD) | head -n 1 | sed 's/\^0//')"
GIT_SHA="$(git rev-parse HEAD)"

echo "Building docker images for monorepo at $MONOREPO_ROOT"
echo "App version: $APP_VERSION"
echo "Git SHA: $GIT_SHA"

# Build web app image
echo ""
echo "===== Building ByteSend Web App ====="
docker build -f "$SCRIPT_DIR/Dockerfile" \
    --progress=plain \
    --build-arg APP_VERSION="$APP_VERSION" \
    --build-arg GIT_SHA="$GIT_SHA" \
    --build-arg NEXT_PUBLIC_IS_CLOUD=false \
    -t "bytesend/bytesend:latest" \
    -t "bytesend/bytesend:$GIT_SHA" \
    -t "bytesend/bytesend:$APP_VERSION" \
    -t "ghcr.io/nodebyte/web:latest" \
    -t "ghcr.io/nodebyte/web:$GIT_SHA" \
    -t "ghcr.io/nodebyte/web:$APP_VERSION" \
    "$MONOREPO_ROOT"

# Build SMTP server image
echo ""
echo "===== Building ByteSend SMTP Server ====="
docker build -f "$SCRIPT_DIR/Dockerfile.smtp" \
    --progress=plain \
    -t "bytesend/smtp-proxy:latest" \
    -t "bytesend/smtp-proxy:$GIT_SHA" \
    -t "bytesend/smtp-proxy:$APP_VERSION" \
    -t "ghcr.io/nodebyte/smtp:latest" \
    -t "ghcr.io/nodebyte/smtp:$GIT_SHA" \
    -t "ghcr.io/nodebyte/smtp:$APP_VERSION" \
    "$MONOREPO_ROOT"

echo ""
echo "===== Build Complete ====="
echo "Web images: bytesend/bytesend:latest (and tagged with $GIT_SHA and $APP_VERSION)"
echo "SMTP images: bytesend/smtp-proxy:latest (and tagged with $GIT_SHA and $APP_VERSION)"