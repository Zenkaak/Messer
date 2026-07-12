/**
 * Builds the Express API handler and produces a Vercel Build Output API v3
 * package at .vercel/output/:
 *
 *   .vercel/output/config.json
 *   .vercel/output/static/
 *   .vercel/output/functions/api/index.func/
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, cp, writeFile, rm } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const messerDir = process.env.MESSER_DIR
  ? path.resolve(process.env.MESSER_DIR)
  : path.dirname(__dirname);

const repoRoot = process.env.MESSER_DIR ? process.cwd() : messerDir;
const apiServerDir = path.join(messerDir, "artifacts", "api-server");

console.log(`messerDir : ${messerDir}`);
console.log(`repoRoot  : ${repoRoot}`);
console.log(`apiServer : ${apiServerDir}`);

globalThis.require = createRequire(path.join(apiServerDir, "package.json"));
const esbuild = globalThis.require("esbuild");
const _pinoPlugin = globalThis.require("esbuild-plugin-pino");
const esbuildPluginPino = _pinoPlugin.default ?? _pinoPlugin;

const vercelOutput = path.join(repoRoot, ".vercel", "output");
const funcDir = path.join(vercelOutput, "functions", "api", "index.func");
const staticDir = path.join(vercelOutput, "static");

await rm(vercelOutput, { recursive: true, force: true });
await mkdir(funcDir, { recursive: true });
await mkdir(staticDir, { recursive: true });

// Copy gsm-world frontend static files
const frontendDist = path.join(messerDir, "artifacts", "gsm-world", "dist", "public");
await cp(frontendDist, staticDir, { recursive: true });
console.log("✅  Static files copied from gsm-world to .vercel/output/static/");

console.log("Building Vercel serverless handler…");
const result = await esbuild.build({
  entryPoints: { index: path.join(apiServerDir, "src", "handler.ts") },
  platform: "node",
  target: "node22",
  bundle: true,
  format: "cjs",
  outdir: funcDir,
  logLevel: "info",
  external: ["*.node", "pg-native", "bufferutil", "utf-8-validate", "cpu-features", "ssh2", "dtrace-provider", "isolated-vm"],
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
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

await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.js", launcherType: "Nodejs", shouldAddHelpers: true, supportsResponseStreaming: true, maxDuration: 60 }, null, 2)
);
console.log("✅  Vercel serverless handler built");

await writeFile(
  path.join(vercelOutput, "config.json"),
  JSON.stringify({
    version: 3,
    routes: [
      { src: "^/api(/.*)?$", dest: "/api/index" },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/index.html" },
    ],
  }, null, 2)
);
console.log("✅  Build Output config written");
