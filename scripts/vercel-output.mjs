/**
 * Post-build script: converts the monorepo build artifacts into Vercel Build
 * Output API v3 format (.vercel/output/), bypassing Vercel's auto-detection.
 *
 * Layout produced:
 *   .vercel/output/
 *   ├── config.json                  ← routing rules
 *   ├── static/                      ← served directly from CDN
 *   │   ├── index.html
 *   │   └── assets/…
 *   └── functions/
 *       └── index.func/              ← Express API handler (serverless)
 *           ├── .vc-config.json
 *           └── index.js
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, writeFile, rm } from "node:fs/promises";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out  = path.join(root, ".vercel", "output");

// ── 1. Clean & scaffold ────────────────────────────────────────────────────
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "static"),                   { recursive: true });
await mkdir(path.join(out, "functions", "index.func"),  { recursive: true });

// ── 2. Copy Vite frontend to CDN-served static/ ───────────────────────────
await cp(
  path.join(root, "artifacts", "gsm-africa", "dist", "public"),
  path.join(out, "static"),
  { recursive: true },
);
console.log("✓ Static files copied");

// ── 3. Bundle Express handler as a CJS Lambda function ────────────────────
const externalList = [
  "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas",
  "bcrypt", "argon2", "fsevents", "re2", "farmhash", "xxhash-addon",
  "bufferutil", "utf-8-validate", "ssh2", "cpu-features",
  "dtrace-provider", "isolated-vm", "lightningcss", "pg-native",
  "oracledb", "mongodb-client-encryption",
  "knex", "typeorm", "protobufjs", "onnxruntime-node",
  "@tensorflow/*", "@prisma/client", "@mikro-orm/*", "@grpc/*",
  "@swc/*", "@aws-sdk/*", "@azure/*", "@opentelemetry/*",
  "@google-cloud/*", "@google/*", "googleapis", "firebase-admin",
  "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*",
  "aws-sdk", "classic-level", "dd-trace", "ffi-napi", "grpc",
  "hiredis", "kerberos", "leveldown", "miniflare", "mysql2",
  "newrelic", "odbc", "piscina", "realm", "ref-napi", "rocksdb",
  "sass-embedded", "sequelize", "serialport", "snappy", "tinypool",
  "usb", "workerd", "wrangler", "zeromq", "zeromq-prebuilt",
  "playwright", "puppeteer", "puppeteer-core", "electron",
];

await esbuild({
  entryPoints: {
    index: path.join(root, "artifacts", "api-server", "src", "handler.ts"),
  },
  platform: "node",
  bundle: true,
  format: "cjs",
  target: "node20",
  outdir: path.join(out, "functions", "index.func"),
  external: externalList,
  sourcemap: false,
  logLevel: "info",
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  banner: {
    js: [
      "const { createRequire: __cr } = require('module');",
      "globalThis.require = __cr(__filename);",
    ].join("\n"),
  },
});
console.log("✓ API function bundled");

// ── 4. Function runtime config ─────────────────────────────────────────────
await writeFile(
  path.join(out, "functions", "index.func", ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs20.x", handler: "index.js", launcherType: "Nodejs" }, null, 2),
);

// ── 5. Vercel routing config ───────────────────────────────────────────────
//    Order matters:
//      a) /api/** → Express Lambda
//      b) serve static files (CDN)
//      c) everything else → index.html (SPA fallback)
await writeFile(
  path.join(out, "config.json"),
  JSON.stringify({
    version: 3,
    routes: [
      { src: "^/api(/.*)?$", dest: "/index" },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/index.html" },
    ],
  }, null, 2),
);

console.log("✓ Vercel output ready at .vercel/output/");
