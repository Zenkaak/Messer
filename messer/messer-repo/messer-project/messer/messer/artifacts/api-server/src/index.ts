import app from "./app";
import { logger } from "./lib/logger";

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
});
