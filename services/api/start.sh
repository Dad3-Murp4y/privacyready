#!/bin/sh
set -e

# Construct DATABASE_URL dynamically from ECS environment variables
export DATABASE_URL="postgresql://${DB_USER:-privacyready_admin}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME:-privacyready}"

echo "Database Host: $DB_HOST"
echo "Running Prisma Database Push..."
npx prisma db push --accept-data-loss

echo "Starting Fastify server..."
exec node dist/main.js
