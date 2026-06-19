#!/bin/bash
set -e
cp -r artifacts/gsm-africa/src gsm-world/artifacts/gsm-africa/
cp -r artifacts/api-server/src gsm-world/artifacts/api-server/
export MESSER_DIR=$(pwd)/gsm-world
cd gsm-world
pnpm --filter @workspace/db run migrate || true
pnpm --filter @workspace/gsm-africa run build
cd ..
node gsm-world/scripts/build-vercel-handler.mjs
