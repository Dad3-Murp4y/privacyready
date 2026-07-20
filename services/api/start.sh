#!/bin/sh
set -e

# Fail fast if required secrets are missing rather than silently
# connecting with an empty password or unset host.
: "${DB_PASSWORD:?DB_PASSWORD environment variable is required}"
: "${DB_HOST:?DB_HOST environment variable is required}"

# Construct DATABASE_URL dynamically from ECS environment variables
export DATABASE_URL="postgresql://${DB_USER:-privacyready_admin}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME:-privacyready}"

echo "Database Host: $DB_HOST"
echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo "Starting Fastify server..."
exec node dist/main.js
