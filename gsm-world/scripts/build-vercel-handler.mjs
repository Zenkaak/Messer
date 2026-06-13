/**
 * Builds the Express API handler and produces a Vercel Build Output API v3
 * package at .vercel/output/:
 *
 *   .vercel/output/config.json               ← routes
 *   .vercel/output/static/                   ← frontend static files
 *   .vercel/output/functions/api/index.func/ ← Express serverless function
 *       .vc-config.json
 *       index.js  (+ pino worker files)
 *
 * Vercel detects the .vercel/output directory and uses it as the deployment
 * package directly, bypassing all zero-config heuristics.
 *
 * IMPORTANT: This script must be called with cwd = repo root so that
 * .vercel/output/ is created at the repo root where Vercel expects it.
 * Set MESSER_DIR to the absolute path of the messer/ subfolder so the
 * script can locate artifacts and node_modules within it.
 *
 * buildCommand:
 *   cd messer && pnpm --filter @workspace/gsm-africa run build &&
 *   cd .. && MESSER_DIR=$OLDPWD node messer/scripts/build-vercel-handler.mjs
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, cp, writeFile, rm } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// messerDir: where artifacts/ and scripts/ live (the messer/ subfolder)
// Falls back to parent of this script's directory if MESSER_DIR not set.
const messerDir = process.env.MESSER_DIR
  ? path.resolve(process.env.MESSER_DIR)
  : path.dirname(__dirname);

// repoRoot: where Vercel expects .vercel/output/ to appear.
// When called correctly (cwd = repo root), process.cwd() gives the repo root.
// Falls back to messerDir for local runs where messer/ is the root.
const repoRoot = process.env.MESSER_DIR
  ? process.cwd()
  : messerDir;

const apiServerDir = path.join(messerDir, "artifacts", "api-server");

console.log(`messerDir : ${messerDir}`);
console.log(`repoRoot  : ${repoRoot}`);
console.log(`apiServer : ${apiServerDir}`);

// Load esbuild and esbuild-plugin-pino from the api-server's own node_modules
// so we don't need to duplicate them in scripts/package.json.
globalThis.require = createRequire(path.join(apiServerDir, "package.json"));
const esbuild = globalThis.require("esbuild");
const _pinoPlugin = globalThis.require("esbuild-plugin-pino");
const esbuildPluginPino = _pinoPlugin.default ?? _pinoPlugin;

// Vercel Build Output API v3 directories — always at repo root
const vercelOutput = path.join(repoRoot, ".vercel", "output");
const funcDir = path.join(vercelOutput, "functions", "api", "index.func");
const staticDir = path.join(vercelOutput, "static");

// Clean and recreate
await rm(vercelOutput, { recursive: true, force: true });
await mkdir(funcDir, { recursive: true });
await mkdir(staticDir, { recursive: true });

// 1. Copy frontend static files
const frontendDist = path.join(
  messerDir,
  "artifacts",
  "gsm-africa",
  "dist",
  "public"
);
await cp(frontendDist, staticDir, { recursive: true });
console.log("✅  Static files copied to .vercel/output/static/");

// 2. Bundle the Express app into the function directory
console.log("Building Vercel serverless handler…");
const result = await esbuild.build({
  entryPoints: {
    index: path.join(apiServerDir, "src", "handler.ts"),
  },
  platform: "node",
  bundle: true,
  format: "cjs",
  outdir: funcDir,
  logLevel: "info",
  // Only truly un-bundleable native addons are external.
  external: [
    "*.node",
    "pg-native",
    "bufferutil",
    "utf-8-validate",
    "cpu-features",
    "ssh2",
    "dtrace-provider",
    "isolated-vm",
  ],
  // pino uses worker_threads internally; this plugin rewrites those dynamic
  // imports so esbuild can bundle the workers correctly.
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  // CJS shims — some bundled packages rely on __filename / __dirname / require
  banner: {
    js: [
      "const { createRequire: __crReq } = require('module');",
      "const __bannerPath = require('path');",
      "globalThis.require = __crReq(__filename);",
      "globalThis.__dirname = __bannerPath.dirname(__filename);",
    ].join("\n"),
  },
  sourcemap: "linked",
});

if (result.errors.length > 0) {
  console.error("esbuild errors:", result.errors);
  process.exit(1);
}

// 3. Write the Vercel function configuration
await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.js",
      launcherType: "Nodejs",
      shouldAddHelpers: true,
      supportsResponseStreaming: true,
      maxDuration: 60,
    },
    null,
    2
  )
);
console.log("✅  Vercel serverless handler written to .vercel/output/functions/api/index.func/");

// 4. Write the Vercel Build Output API v3 config with explicit routes
await writeFile(
  path.join(vercelOutput, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/api(/.*)?$", dest: "/api/index" },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2
  )
);
console.log("✅  Build Output config written to .vercel/output/config.json");
console.log("    Routes: /api/* → Express handler | /* → SPA");
