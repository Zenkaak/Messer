import app from "./app";
import { logger } from "./lib/logger";
import { shouldRunDailyMarketing, runDailyMarketingEmail } from "./lib/daily-marketing";
// Note: migrations are now called in app.ts so they run in both dev and Vercel serverless.

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

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
  // Vercel cron handles this on Vercel deployments (vercel.json schedule).
  // This ticker covers self-hosted / persistent-server mode.
  setInterval(async () => {
    if (!shouldRunDailyMarketing()) return;
    logger.info("Daily marketing ticker: 3:50 AM EAT — starting broadcast");
    try {
      const result = await runDailyMarketingEmail();
      logger.info(result, "Daily marketing ticker: broadcast complete");
    } catch (err) {
      logger.error({ err }, "Daily marketing ticker: broadcast failed");
    }
  }, 60 * 1000); // check every minute
});
