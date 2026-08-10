#!/usr/bin/env bash
# Build a linux/amd64 production image for NAS/Unraid (or any host that
# cannot reliably `docker compose build` on-device).
#
# Usage:
#   ./scripts/build-image.sh
#   ./scripts/build-image.sh my-registry/guitar-tracker:1.0.0
#   LOAD_HOST=user@your-server ./scripts/build-image.sh
#
# Defaults:
#   IMAGE=guitar-tracker:prod
#   PLATFORM=linux/amd64
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IMAGE="${1:-guitar-tracker:prod}"
PLATFORM="${PLATFORM:-linux/amd64}"
LOAD_HOST="${LOAD_HOST:-}"

echo "Building $IMAGE for $PLATFORM …"
docker buildx build \
  --platform "$PLATFORM" \
  -t "$IMAGE" \
  --load \
  .

echo "Image ready: $IMAGE"
docker image inspect "$IMAGE" --format 'Id={{.Id}} Size={{.Size}} Created={{.Created}}'

if [[ -n "$LOAD_HOST" ]]; then
  echo "Streaming image to $LOAD_HOST …"
  docker save "$IMAGE" | gzip | ssh "$LOAD_HOST" 'gunzip | docker load'
  echo "Loaded on $LOAD_HOST"
  echo "On the host, point compose at: image: $IMAGE  (and remove build: .)"
fi

echo "Done."
