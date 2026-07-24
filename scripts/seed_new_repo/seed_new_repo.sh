#!/usr/bin/env bash
# Seed a new PrivacyReady repository with ~6 months of versioned commit history.
#
# Usage:
#   ./scripts/seed_new_repo/seed_new_repo.sh /path/to/new-repo
#   ./scripts/seed_new_repo/seed_new_repo.sh /path/to/new-repo --bundle /tmp/privacyready-history.bundle
#   ./scripts/seed_new_repo/seed_new_repo.sh --target /path/to/new-repo --force
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <target-dir> [--bundle PATH] [--force] [--source PATH]" >&2
  echo "   or: $0 --target <target-dir> ..." >&2
  exit 1
fi

ARGS=()
if [[ "${1:-}" != --* ]]; then
  ARGS+=(--target "$1")
  shift
fi
ARGS+=("$@")

exec python3 "${SCRIPT_DIR}/generate.py" "${ARGS[@]}"
