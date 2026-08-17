#!/usr/bin/env bash
set -Eeuo pipefail

readonly POSTGRES_IMAGE="${POSTGRES_TEST_IMAGE:-docker.io/library/postgres:16}"
readonly CONTAINER_NAME="privacyready-postgres-test-${$}"
ENGINE=""

cleanup() {
  if [[ -n "$ENGINE" && "$CONTAINER_NAME" == privacyready-postgres-test-* ]]; then
    "$ENGINE" rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM HUP

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  ENGINE=docker
elif command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1; then
  ENGINE=podman
else
  printf 'ERROR: disposable PostgreSQL tests were not run. Start Docker or install/configure Podman, then rerun npm run test:integration.\n' >&2
  exit 2
fi

printf '[POSTGRES] Container engine: %s; image: %s\n' "$ENGINE" "$POSTGRES_IMAGE"
TEST_PASSWORD="$(openssl rand -hex 24)"
"$ENGINE" run --detach --name "$CONTAINER_NAME" \
  --env POSTGRES_USER=privacyready_test \
  --env POSTGRES_PASSWORD="$TEST_PASSWORD" \
  --env POSTGRES_DB=privacyready_test \
  --health-cmd='pg_isready -U privacyready_test -d privacyready_test' \
  --health-interval=1s --health-timeout=3s --health-retries=30 \
  --publish 127.0.0.1::5432 "$POSTGRES_IMAGE" >/dev/null

for attempt in $(seq 1 60); do
  status="$($ENGINE inspect --format '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  [[ "$status" == healthy ]] && break
  [[ "$status" == unhealthy ]] && { printf 'ERROR: PostgreSQL container became unhealthy.\n' >&2; exit 1; }
  [[ "$attempt" == 60 ]] && { printf 'ERROR: PostgreSQL did not become healthy within 60 seconds.\n' >&2; exit 1; }
  sleep 1
done

host_port="$($ENGINE port "$CONTAINER_NAME" 5432/tcp | sed -n '1s/.*://p')"
[[ "$host_port" =~ ^[0-9]+$ ]] || { printf 'ERROR: could not determine the disposable PostgreSQL port.\n' >&2; exit 1; }
DATABASE_URL="postgresql://privacyready_test:${TEST_PASSWORD}@127.0.0.1:${host_port}/privacyready_test?schema=public"

printf '[POSTGRES] Applying committed migrations to a new empty database.\n'
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
printf '[POSTGRES] Running real Prisma integration tests.\n'
DATABASE_URL="$DATABASE_URL" RUN_POSTGRES_INTEGRATION=true SCANNER_API_KEY=synthetic-local-integration-scanner-key npm run test:integration:run
printf '[POSTGRES] Integration suite passed; disposable database will be removed.\n'
