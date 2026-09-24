import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

export async function runStartupMigrations(): Promise<void> {
  try {
    // ── orders table ──────────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code TEXT`);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_unique
        ON orders (order_code) WHERE order_code IS NOT NULL
    `);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_identifier TEXT`);
    await db.execute(sql`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'product'
    `);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT`);

    // ── order_messages ────────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE order_messages ADD COLUMN IF NOT EXISTS file_url TEXT`);

    // ── live_chat_sessions ────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE live_chat_sessions ADD COLUMN IF NOT EXISTS visitor_email TEXT`);

    // ── live_chat_messages ────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`);

    // ── users ─────────────────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT '0'`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);

    // ── payment_transactions ──────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS raw_response JSONB`);

    // ── reseller_applications ─────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reseller_applications (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER NOT NULL,
        email             TEXT NOT NULL,
        store_name        TEXT NOT NULL,
        store_slug        TEXT NOT NULL UNIQUE,
        status            TEXT NOT NULL DEFAULT 'pending_payment',
        security_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
        payment_method    TEXT,
        payment_reference TEXT,
        commission_rate   NUMERIC NOT NULL DEFAULT 10.00,
        total_earned      NUMERIC NOT NULL DEFAULT 0,
        total_orders      INTEGER NOT NULL DEFAULT 0,
        rejection_reason  TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        approved_at       TIMESTAMP
      )
    `);

    // ── reseller_withdrawals ──────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reseller_withdrawals (
        id              SERIAL PRIMARY KEY,
        reseller_id     INTEGER NOT NULL,
        amount          NUMERIC NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        payment_method  TEXT NOT NULL,
        payment_address TEXT NOT NULL,
        notes           TEXT,
        admin_notes     TEXT,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at    TIMESTAMP
      )
    `);

    logger.info("Startup migrations completed");
  } catch (err) {
    logger.warn({ err }, "Startup migration warning (non-fatal)");
  }
}
