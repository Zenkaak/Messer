#!/bin/bash
set -e
export MESSER_DIR=$(pwd)

# Run DB migrations (ignore if script absent)
pnpm --filter @workspace/db run migrate || true

# Build gsm-world frontend — use local vite binary directly (avoids pnpm workspace escalation)
cd artifacts/gsm-world
PORT=24115 BASE_PATH=/ ./node_modules/.bin/vite build --config vite.config.ts
cd ../..

# Bundle API + assemble Vercel output
node scripts/build-vercel-handler.mjs
