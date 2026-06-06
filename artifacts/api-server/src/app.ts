import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { runStartupMigrations } from "./lib/migrations";

const app: Express = express();

// Run migrations once per Lambda cold-start (module-level — runs on first import).
// Uses a shared Promise so concurrent requests wait for the same run.
const _migrationsReady: Promise<void> = runStartupMigrations();

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
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure migrations have finished before handling any API request.
// On a warm Lambda this resolves immediately; on cold-start it waits once.
app.use("/api", async (_req, _res, next) => {
  await _migrationsReady;
  next();
});

app.use("/api", router);

// SPA fallback — serve the Vite-built index.html for all non-API routes.
// In production (Vercel Lambda), index.html is copied next to index.js by
// scripts/build-vercel-handler.mjs. In local dev this route is never reached
// because Vite serves the frontend directly.
app.get("/{*path}", (_req, res) => {
  const indexHtml = path.resolve(__dirname, "index.html");
  res.sendFile(indexHtml);
});

export default app;
