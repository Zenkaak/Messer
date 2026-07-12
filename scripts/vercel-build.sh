#!/bin/bash
set -e
export MESSER_DIR=$(pwd)

# Run DB migrations (ignore if no migrate script)
pnpm --filter @workspace/db run migrate || true

# Build libs first (generates type declarations)
pnpm run typecheck:libs || true

# Build gsm-world frontend (requires PORT + BASE_PATH)
PORT=24115 BASE_PATH=/ pnpm --filter "./artifacts/gsm-world" run build

# Bundle API + assemble Vercel output
node scripts/build-vercel-handler.mjs
