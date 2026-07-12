#!/bin/bash
set -e
export MESSER_DIR=$(pwd)

# Run DB migrations (ignore if script absent)
pnpm --filter @workspace/db run migrate || true

# Build gsm-world frontend — pnpm exec runs the binary without workspace root escalation
cd artifacts/gsm-world
PORT=24115 BASE_PATH=/ pnpm exec vite build --config vite.config.ts
cd ../..

# Bundle API + assemble Vercel output
node scripts/build-vercel-handler.mjs
