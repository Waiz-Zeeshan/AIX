#!/bin/sh
# Production entrypoint: apply pending Prisma migrations, then exec the CMD.
# Migrations are idempotent — safe to run on every container start.
set -e

echo "[entrypoint] running prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting app: $*"
exec "$@"
