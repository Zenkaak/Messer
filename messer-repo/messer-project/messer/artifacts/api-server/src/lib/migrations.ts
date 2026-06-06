import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  try {
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

    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS reseller_slug TEXT`);

    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS store_name TEXT`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS total_orders INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS fee_payment_method TEXT`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE reseller_applications ADD COLUMN IF NOT EXISTS owner_name TEXT`);
  } catch (err) {
    console.error("Migration error:", err);
  }
}
