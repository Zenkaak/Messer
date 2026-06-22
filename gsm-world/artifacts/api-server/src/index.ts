import cluster from "node:cluster";
import os from "node:os";
import { createServer } from "http";
import app from "./app";
import { attachWss } from "./lib/ws";
import { logger } from "./lib/logger";
import { shouldRunDailyMarketing, runDailyMarketingEmail } from "./lib/daily-marketing";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Cluster mode: spawn one worker per CPU core in production ─────────────────
// Workers share the same port via the OS load balancer. Each worker is an
// independent Node.js process, so a crash in one doesn't take down others.
const WORKERS = process.env.NODE_ENV === "production"
  ? Math.min(os.cpus().length, 8)   // cap at 8 to avoid OOM on small hosts
  : 1;

if (cluster.isPrimary && WORKERS > 1) {
  logger.info({ workers: WORKERS, cpus: os.cpus().length }, "Primary: spawning worker cluster");

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn({ pid: worker.process.pid, code, signal }, "Worker died — restarting");
    cluster.fork();   // auto-restart crashed workers
  });

} else {
  // ── Single worker / dev process ───────────────────────────────────────────
  const httpServer = createServer(app);

  // Tune keep-alive: allow clients to reuse TCP connections. At 100k req/min
  // this alone can cut connection-setup overhead by 30-40%.
  httpServer.keepAliveTimeout = 65_000;     // must be > load-balancer idle timeout (60s)
  httpServer.headersTimeout   = 66_000;     // slightly above keepAliveTimeout

  // Maximum number of concurrent connections (safety valve)
  httpServer.maxConnections = 10_000;

  attachWss(httpServer);

  httpServer.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port, pid: process.pid, worker: cluster.worker?.id ?? "primary" }, "Server listening");

    // Keep-alive self-ping every 4 minutes to prevent server from sleeping
    const selfPingUrl = `http://localhost:${port}/api/healthz`;
    setInterval(async () => {
      try {
        const res = await fetch(selfPingUrl);
        logger.debug({ status: res.status }, "Keep-alive ping");
      } catch (e) {
        logger.warn({ e }, "Keep-alive ping failed");
      }
    }, 4 * 60 * 1000);

    // ── Daily marketing broadcast — fires at 3:50 AM EAT every day ──────────
    // Only run in the first/primary worker to avoid duplicate sends
    if (!cluster.worker || cluster.worker.id === 1) {
      setInterval(async () => {
        if (!shouldRunDailyMarketing()) return;
        logger.info("Daily marketing ticker: 3:50 AM EAT — starting broadcast");
        try {
          const result = await runDailyMarketingEmail();
          logger.info(result, "Daily marketing ticker: broadcast complete");
        } catch (err) {
          logger.error({ err }, "Daily marketing ticker: broadcast failed");
        }
      }, 60 * 1000);
    }
  });
}
