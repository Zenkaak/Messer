import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrations";

// Run DB migrations on every cold start (covers both dev and Vercel serverless).
// Fire-and-forget — never blocks request handling.
runMigrations().catch((err) => logger.warn({ err }, "Migration on cold-start failed"));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / mobile-app requests with no Origin header
    if (!origin) { callback(null, true); return; }
    // Allow localhost in development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { callback(null, true); return; }
    // Allow any Vercel, Replit, or Neon preview domain
    if (/\.(vercel\.app|replit\.app|replit\.dev|repl\.co)$/.test(origin)) { callback(null, true); return; }
    // Allow explicitly configured production domain(s) from REPLIT_DOMAINS
    const allowed = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
    if (allowed.some(d => origin === `https://${d}` || origin === `http://${d}`)) { callback(null, true); return; }
    // Reject everything else
    callback(new Error("CORS not allowed"), false);
  },
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/api", router);

// SPA fallback — serve the Vite-built index.html for all non-API routes.
// In production (Vercel Lambda), index.html is copied next to index.js by
// scripts/vercel-output.mjs. In local dev this route is never reached because
// Vite serves the frontend directly.
app.get("/{*path}", (_req, res) => {
  const indexHtml = path.resolve(__dirname, "index.html");
  res.sendFile(indexHtml);
});

export default app;
