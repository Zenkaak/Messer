#!/bin/bash
set -e
export MESSER_DIR=$(pwd)

# Run DB migrations (ignore if script absent)
pnpm --filter @workspace/db run migrate || true

# Locate vite in the pnpm virtual store (works regardless of hoisting settings)
VITE_JS=$(node -e "
const fs = require('fs'), path = require('path');
const store = 'node_modules/.pnpm';
const dirs = fs.readdirSync(store).filter(d => d.startsWith('vite@'));
if (!dirs.length) { console.error('vite not in pnpm store'); process.exit(1); }
console.log(path.join(store, dirs[0], 'node_modules/vite/bin/vite.js'));
")
echo "Using vite at: $VITE_JS"

# Build gsm-world frontend
cd artifacts/gsm-world
PORT=24115 BASE_PATH=/ node "../../$VITE_JS" build --config vite.config.ts
cd ../..

# Bundle API + assemble Vercel output
node scripts/build-vercel-handler.mjs
