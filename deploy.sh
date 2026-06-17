#!/usr/bin/env bash
set -euo pipefail

# Deploy directory on the server. Adjust if your checkout lives elsewhere.
cd /home/ubuntu/unitmetal-api

git pull origin main
bun install

# Generate any pending Drizzle migrations from schema changes.
# Ideally these are generated locally and committed before deploy — this is just
# a safety net. drizzle-kit may prompt for rename/delete disambiguation on
# ambiguous changes, and that prompt has no TTY here. If it fails, regenerate
# locally and commit.
bun --env-file=.env.production run db:generate

# Apply pending migrations against the production SQLite DB. The runner uses
# bun:sqlite (works inside the compiled binary; drizzle-kit migrate would not).
bun --env-file=.env.production run db:migrate

# Compile the server into a single binary at ./build/unitmetal-api (gitignored).
# Flags live in package.json's "build" script — single source of truth.
bun run build

# Restart and show status.
sudo systemctl restart unitmetal-api.service
sudo systemctl status unitmetal-api.service --no-pager
