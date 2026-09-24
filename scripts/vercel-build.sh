#!/bin/bash
set -e
export MESSER_DIR=$(pwd)

# Run DB migrations (ignore if script absent or no migrations dir)
pnpm --filter @workspace/db run migrate || true

# Build gsm-africa frontend
# PORT and BASE_PATH are injected via vercel.json env section
pnpm --filter @workspace/gsm-africa run build

# Bundle API + assemble Vercel output
node scripts/build-vercel-handler.mjs
