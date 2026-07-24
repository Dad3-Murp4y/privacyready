#!/usr/bin/env bash
# Seed a new PrivacyReady repository with ~6 months of versioned commit history.
#
# Usage:
#   ./scripts/seed_new_repo/seed_new_repo.sh /path/to/new-repo
#   ./scripts/seed_new_repo/seed_new_repo.sh /path/to/new-repo --bundle /tmp/privacyready-history.bundle
#   ./scripts/seed_new_repo/seed_new_repo.sh /path/to/new-repo --force
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "${SCRIPT_DIR}/generate.py" "$@"
