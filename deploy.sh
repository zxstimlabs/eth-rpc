#!/usr/bin/env bash
set -euo pipefail

# Deploy directory on the server. Adjust if your checkout lives elsewhere.
cd /home/ubuntu/zxstim-rpc

git pull origin main
bun install

# Compile the server into a single binary at ./build/zxstim-rpc (gitignored).
# Flags live in package.json's "build" script — single source of truth.
bun run build

# Restart and show status.
sudo systemctl restart zxstim-rpc.service
sudo systemctl status zxstim-rpc.service --no-pager
