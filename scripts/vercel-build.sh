#!/bin/bash
set -e
export MESSER_DIR=$(pwd)

# Run DB migrations (ignore if script absent)
pnpm --filter @workspace/db run migrate || true

# Build gsm-world frontend using pnpm -C (runs the package's own script, not workspace root)
# PORT and BASE_PATH are injected via vercel.json env section
pnpm -C artifacts/gsm-world run build

# Bundle API + assemble Vercel output
node scripts/build-vercel-handler.mjs
