import { db, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ blocked: boolean; retryAfterSec?: number }> {
  const rows = await db
    .select({ value: adminSettingsTable.value })
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, key))
    .limit(1);
  if (!rows.length || !rows[0].value) return { blocked: false };
  try {
    const entry = JSON.parse(rows[0].value) as RateLimitEntry;
    const now = Date.now();
    if (now >= entry.resetAt) return { blocked: false };
    if (entry.count >= max) {
      return { blocked: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

export async function recordRateLimitAttempt(
  key: string,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const rows = await db
    .select({ value: adminSettingsTable.value })
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, key))
    .limit(1);

  let entry: RateLimitEntry = { count: 0, resetAt: now + windowMs };
  if (rows.length && rows[0].value) {
    try {
      const existing = JSON.parse(rows[0].value) as RateLimitEntry;
      if (now < existing.resetAt) entry = existing;
    } catch { /* ignore parse error, use fresh entry */ }
  }
  entry.count += 1;
  const val = JSON.stringify(entry);

  await db
    .insert(adminSettingsTable)
    .values({ key, value: val })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: { value: val, updatedAt: new Date() },
    });
}

export async function clearRateLimit(key: string): Promise<void> {
  await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, key));
}
