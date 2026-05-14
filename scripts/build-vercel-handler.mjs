/**
 * Bundles the Express app → api/index.js (CJS) for Vercel.
 *
 * @vercel/node strips the /api path prefix before passing the request to the
 * function, so req.url arrives as "/products" instead of "/api/products".
 * The inline wrapper below restores the prefix so Express routing works.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

globalThis.require = createRequire(import.meta.url);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appEntry = path.resolve(root, "artifacts/api-server/src/app.ts")
  .replace(/\\/g, "/");

await build({
  stdin: {
    contents: `
import app from "${appEntry}";

module.exports = function handler(req, res) {
  // @vercel/node strips the /api prefix when routing to api/index.js.
  // Restore it so Express can match app.use("/api", router).
  if (req.url && !req.url.startsWith("/api")) {
    req.url = "/api" + req.url;
  }
  return app(req, res);
};
`,
    resolveDir: root,
    loader: "ts",
  },
  platform: "node",
  bundle: true,
  format: "cjs",
  outfile: path.resolve(root, "api/index.js"),
  target: "node20",
  logLevel: "info",
  external: ["*.node"],
  sourcemap: false,
});

console.log("✓ Vercel handler bundled → api/index.js");
