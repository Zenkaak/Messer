import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getCachedSystemPrompt } from "./routes/chat";

// Idempotent startup migrations — safe to run on every deploy
async function runStartupMigrations() {
  try {
    await db.execute(sql`
      ALTER TABLE order_messages
        ADD COLUMN IF NOT EXISTS file_url TEXT;
    `);
    await db.execute(sql`
      ALTER TABLE live_chat_sessions
        ADD COLUMN IF NOT EXISTS visitor_email TEXT;
    `);
    await db.execute(sql`
      ALTER TABLE live_chat_messages
        ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
    `);
    await db.execute(sql`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS order_code TEXT;
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_unique
        ON orders (order_code)
        WHERE order_code IS NOT NULL;
    `);
    logger.info("Startup migrations OK");
  } catch (err) {
    logger.warn({ err }, "Startup migration warning (non-fatal)");
  }
}

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

runStartupMigrations().then(() => {
  // Pre-warm the system prompt cache so the first chat user never waits
  getCachedSystemPrompt().catch((e) => logger.warn({ e }, "Prompt pre-warm failed (non-fatal)"));

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
});
