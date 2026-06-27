import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export async function runMigrations(): Promise<void> {
  try {
    // ── orders table ─────────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS reseller_slug TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_identifier TEXT`);
    // order_type: Drizzle includes this in every INSERT (notNull + default).
    // Must exist in production DB or every checkout INSERT will fail.
    await db.execute(sql`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'product'
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_unique
        ON orders (order_code)
        WHERE order_code IS NOT NULL
    `);

    // ── payment_transactions table (may not exist if drizzle push never ran) ─
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id            SERIAL PRIMARY KEY,
        order_id      INTEGER NOT NULL REFERENCES orders(id),
        provider      TEXT NOT NULL,
        provider_reference TEXT,
        amount        NUMERIC NOT NULL,
        currency      TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'pending',
        raw_response  JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── users table ───────────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (lower(username)) WHERE username IS NOT NULL`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);

    // ── imei_lookups table (may be missing in production) ─────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS imei_lookups (
        id            SERIAL PRIMARY KEY,
        imei          TEXT NOT NULL,
        brand         TEXT,
        model         TEXT,
        marketing_name TEXT,
        sim_lock      TEXT,
        carrier       TEXT,
        blacklist     TEXT,
        enhanced      BOOLEAN NOT NULL DEFAULT FALSE,
        source        TEXT,
        checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── announcements table ───────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id              SERIAL PRIMARY KEY,
        subject         TEXT NOT NULL,
        body            TEXT NOT NULL,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── order_messages ────────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE order_messages ADD COLUMN IF NOT EXISTS file_url TEXT`);

    // ── live_chat tables ─────────────────────────────────────────────────────
    await db.execute(sql`ALTER TABLE live_chat_sessions ADD COLUMN IF NOT EXISTS visitor_email TEXT`);
    await db.execute(sql`ALTER TABLE live_chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`);

    // ── reseller tables ───────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reseller_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        store_slug TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
        fee_tx_id TEXT,
        commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
        total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        available_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reseller_withdrawals (
        id SERIAL PRIMARY KEY,
        reseller_id INTEGER NOT NULL REFERENCES reseller_applications(id),
        amount NUMERIC(12,2) NOT NULL,
        method TEXT NOT NULL,
        destination TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS store_name TEXT`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS total_orders INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS fee_payment_method TEXT`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS owner_name TEXT`);

    logger.info("Startup migrations OK");
  } catch (err) {
    logger.warn({ err }, "Startup migration warning (non-fatal)");
  }
}
