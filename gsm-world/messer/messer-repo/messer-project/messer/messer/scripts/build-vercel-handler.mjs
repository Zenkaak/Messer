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
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, cp, writeFile, rm } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);
const apiServerDir = path.join(rootDir, "artifacts", "api-server");

// Load esbuild and esbuild-plugin-pino from the api-server's own node_modules
// so we don't need to duplicate them in scripts/package.json.
globalThis.require = createRequire(path.join(apiServerDir, "package.json"));
const esbuild = globalThis.require("esbuild");
const _pinoPlugin = globalThis.require("esbuild-plugin-pino");
const esbuildPluginPino = _pinoPlugin.default ?? _pinoPlugin;

// Vercel Build Output API v3 directories
const vercelOutput = path.join(rootDir, ".vercel", "output");
const funcDir = path.join(vercelOutput, "functions", "api", "index.func");
const staticDir = path.join(vercelOutput, "static");

// Clean and recreate
await rm(vercelOutput, { recursive: true, force: true });
await mkdir(funcDir, { recursive: true });
await mkdir(staticDir, { recursive: true });

// 1. Copy frontend static files
const frontendDist = path.join(
  rootDir,
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
        // Route all /api and /api/* requests to the Express handler.
        // The function receives the original request URL so Express can route internally.
        { src: "^/api(/.*)?$", dest: "/api/index" },
        // Serve static assets from .vercel/output/static/
        { handle: "filesystem" },
        // SPA fallback — everything else serves index.html
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2
  )
);
console.log("✅  Build Output config written to .vercel/output/config.json");
console.log("    Routes: /api/* → Express handler | /* → SPA");
