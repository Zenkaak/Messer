#!/bin/bash
set -e
export MESSER_DIR=$(pwd)

# Run DB migrations (ignore if no migrate script)
pnpm --filter @workspace/db run migrate || true

# Build libs (type declarations for api-server)
pnpm run typecheck:libs || true

# Build gsm-world frontend directly (vite requires PORT + BASE_PATH)
cd artifacts/gsm-world
PORT=24115 BASE_PATH=/ pnpm run build
cd ../..

# Bundle API + assemble Vercel output
node scripts/build-vercel-handler.mjs
