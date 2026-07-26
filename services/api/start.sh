#!/bin/sh
set -e

# Fail fast if required secrets are missing rather than silently
# connecting with an empty password or unset host.
: "${DB_PASSWORD:?DB_PASSWORD environment variable is required}"
: "${DB_HOST:?DB_HOST environment variable is required}"

# Construct DATABASE_URL dynamically from ECS environment variables
export DATABASE_URL="postgresql://${DB_USER:-privacyready_admin}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME:-privacyready}"

echo "Database Host: $DB_HOST"
echo "Applying schema..."
# NOTE: there is no prisma/migrations history in this repo (checked:
# no migration_lock.toml exists), so 'prisma migrate deploy' would
# have nothing to apply and would silently no-op on a fresh database
# -- worse than the destructive-push issue this was meant to fix,
# since tables would simply never get created. Using db push without
# --accept-data-loss instead: it still applies schema changes
# automatically, but refuses and fails loudly if a change would be
# destructive, instead of either applying it blindly or doing nothing.
#
# For real migration history (recommended before this gets much
# bigger), run `npx prisma migrate dev --name init` against a dev
# database to generate prisma/migrations/, commit that, then switch
# this back to `prisma migrate deploy`.
npx prisma db push

echo "Starting Fastify server..."
exec node dist/main.js
