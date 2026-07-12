#!/bin/bash
set -e
export MESSER_DIR=$(pwd)
pnpm --filter @workspace/db run migrate || true
pnpm --filter @workspace/gsm-world run build
node scripts/build-vercel-handler.mjs
