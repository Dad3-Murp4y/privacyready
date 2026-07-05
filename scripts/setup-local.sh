#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  docker compose -f docker-compose.dev.yml up -d
else
  docker-compose -f docker-compose.dev.yml up -d
fi

echo "Local services started."
