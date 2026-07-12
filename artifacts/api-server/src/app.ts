import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrations";
import { checkAndRecordSync } from "./lib/rate-limit";

// Run DB migrations on every cold start. Fire-and-forget.
runMigrations().catch((err) => logger.warn({ err }, "Migration on cold-start failed"));

const app: Express = express();

// ── Gzip compression (built-in Node.js zlib — no extra package) ───────────────
// Reduces JSON/text payload size 60-80%; essential for high-concurrency.
import zlib from "node:zlib";
const COMPRESSIBLE_RE = /json|text|javascript|xml|svg/i;
app.use((req: Request, res: Response, next: NextFunction) => {
  const ae = String(req.headers["accept-encoding"] ?? "");
  const enc = ae.includes("br") ? "br" : ae.includes("gzip") ? "gzip" : null;
  if (!enc) { next(); return; }

  const origJson = res.json.bind(res);
  const origSend = res.send.bind(res);

  const compress = (buf: Buffer, cb: (out: Buffer) => void) => {
    const fn = enc === "br" ? zlib.brotliCompress : zlib.gzip;
    fn(buf, enc === "br"
      ? { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }
      : {},
      (err, out) => { if (err || !out) { cb(buf); } else { cb(out); } });
  };

  const wrapSend = (body: unknown): Response => {
    const ct = String(res.getHeader("Content-Type") ?? "");
    if (!COMPRESSIBLE_RE.test(ct)) return origSend(body as Buffer);
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    compress(raw, (out) => {
      res.setHeader("Content-Encoding", enc);
      res.setHeader("Vary", "Accept-Encoding");
      res.removeHeader("Content-Length");
      res.setHeader("Content-Length", out.length);
      origSend(out);
    });
    return res;
  };

  (res as unknown as { json: typeof origJson }).json = (body: unknown) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return wrapSend(JSON.stringify(body));
  };
  (res as unknown as { send: typeof origSend }).send = (body: unknown) => wrapSend(body);

  next();
});

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/api/healthz",
    },
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { callback(null, true); return; }
    if (/\.(vercel\.app|replit\.app|replit\.dev|repl\.co)$/.test(origin)) { callback(null, true); return; }
    const allowed = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
    if (allowed.some(d => origin === `https://${d}` || origin === `http://${d}`)) { callback(null, true); return; }
    callback(new Error("CORS not allowed"), false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Request timeout (30 s) ────────────────────────────────────────────────────
// Any request that hasn't finished in 30 s gets a 503. Prevents slow requests
// from piling up and exhausting the event loop under high concurrency.
app.use((_req: Request, res: Response, next: NextFunction) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timed out. Please try again." });
    }
  }, 30_000);
  res.on("finish", () => clearTimeout(timer));
  res.on("close",  () => clearTimeout(timer));
  next();
});

// ── Bot endpoint rate limiter ─────────────────────────────────────────────────
// 20 requests per minute per IP on /api/chat/bot.
// Uses the in-memory sliding-window limiter — zero DB queries.
const BOT_RL_MAX = 20;
const BOT_RL_WINDOW = 60_000;
app.use("/api/chat/bot", (req: Request, res: Response, next: NextFunction) => {
  const ip = String(
    req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown"
  ).split(",")[0].trim();
  const result = checkAndRecordSync(`bot:${ip}`, BOT_RL_MAX, BOT_RL_WINDOW);
  if (result.blocked) {
    res.setHeader("Retry-After", String(result.retryAfterSec ?? 60));
    res.status(429).json({
      error: `Too many requests. Please wait ${result.retryAfterSec ?? 60} seconds before trying again.`,
    });
    return;
  }
  next();
});

// ── General API rate limiter ──────────────────────────────────────────────────
// 200 requests per minute per IP across all /api/* routes.
// Protects DB-read endpoints (products, categories, orders) from scrapers.
const API_RL_MAX = 200;
const API_RL_WINDOW = 60_000;
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const ip = String(
    req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown"
  ).split(",")[0].trim();
  const result = checkAndRecordSync(`api:${ip}`, API_RL_MAX, API_RL_WINDOW);
  if (result.blocked) {
    res.setHeader("Retry-After", String(result.retryAfterSec ?? 60));
    res.status(429).json({
      error: "Too many requests. Please slow down.",
    });
    return;
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

// SPA fallback
app.get("/{*path}", (_req, res) => {
  const indexHtml = path.resolve(__dirname, "index.html");
  res.sendFile(indexHtml);
});

export default app;
