import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, adminSettingsTable } from "@workspace/db";

const router: IRouter = Router();

const _secret = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

export function makeUnsubToken(email: string): string {
  return crypto
    .createHmac("sha256", _secret)
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
}

export function makeUnsubUrl(email: string): string {
  const base =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "gsmworld.vercel.app"}`;
  const token = makeUnsubToken(email);
  return `${base.replace(/\/$/, "")}/api/unsubscribe?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${token}`;
}

router.get("/unsubscribe", async (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";

  const frontendBase =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "gsmworld.vercel.app"}`;
  const confirmUrl = `${frontendBase.replace(/\/$/, "")}/unsubscribe?confirmed=1`;
  const errorUrl = `${frontendBase.replace(/\/$/, "")}/unsubscribe?error=invalid`;

  if (!email || !token) {
    res.redirect(errorUrl);
    return;
  }

  const expected = makeUnsubToken(email);
  if (expected !== token) {
    res.redirect(errorUrl);
    return;
  }

  try {
    await db
      .insert(adminSettingsTable)
      .values({ key: `unsub:${email}`, value: "true" })
      .onConflictDoUpdate({
        target: adminSettingsTable.key,
        set: { value: "true", updatedAt: new Date() },
      });

    req.log.info({ email }, "User unsubscribed from emails");
  } catch (err) {
    req.log.error({ err, email }, "Failed to store unsubscribe preference");
  }

  res.redirect(confirmUrl);
});

router.post("/unsubscribe", async (req, res) => {
  const { email, token } = (req.body ?? {}) as { email?: string; token?: string };

  if (!email || !token) {
    res.status(400).json({ error: "email and token are required" });
    return;
  }

  const expected = makeUnsubToken(email.toLowerCase().trim());
  if (expected !== token) {
    res.status(400).json({ error: "Invalid unsubscribe token" });
    return;
  }

  try {
    await db
      .insert(adminSettingsTable)
      .values({ key: `unsub:${email.toLowerCase().trim()}`, value: "true" })
      .onConflictDoUpdate({
        target: adminSettingsTable.key,
        set: { value: "true", updatedAt: new Date() },
      });

    req.log.info({ email }, "User unsubscribed from emails (POST)");
    res.json({ ok: true, message: "You have been unsubscribed." });
  } catch (err) {
    req.log.error({ err, email }, "Failed to store unsubscribe preference (POST)");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
