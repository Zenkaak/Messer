import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getGoogleCredentials } from "../lib/admin-settings";
import { checkRateLimit, recordRateLimitAttempt, clearRateLimit } from "../lib/rate-limit";
import { sendEmail, otpEmail } from "../lib/email";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.warn("JWT_SECRET is not set — using insecure default. Set it in production.");
}
const _jwtSecret = JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

const NEON_AUTH_URL =
  process.env.NEON_AUTH_URL ||
  "https://ep-young-frost-am13gy4v.neonauth.c-5.us-east-1.aws.neon.tech/neondb/auth";

// ─── DB-backed OTP store (survives restarts) ──────────────────────────────────
async function setOtp(key: string, code: string, ttlMs: number) {
  const val = JSON.stringify({ code, expiresAt: Date.now() + ttlMs });
  await db.insert(adminSettingsTable)
    .values({ key: `otp:${key}`, value: val })
    .onConflictDoUpdate({ target: adminSettingsTable.key, set: { value: val, updatedAt: new Date() } });
}

async function getOtp(key: string): Promise<{ code: string; expiresAt: number } | null> {
  const rows = await db.select({ value: adminSettingsTable.value })
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, `otp:${key}`))
    .limit(1);
  if (!rows.length || !rows[0].value) return null;
  try { return JSON.parse(rows[0].value) as { code: string; expiresAt: number }; }
  catch { return null; }
}

async function deleteOtp(key: string) {
  await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, `otp:${key}`));
}

const OTP_MAX_ATTEMPTS = 10;
const OTP_LOCK_MS = 15 * 60 * 1000; // 15 minutes

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const OTP_SEND_MAX = 5;
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REGISTER_MAX = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function recordOtpAttempt(email: string): Promise<{ locked: boolean; attemptsLeft: number }> {
  const key = `otp_attempts:${email.toLowerCase()}`;
  const rows = await db.select({ value: adminSettingsTable.value })
    .from(adminSettingsTable).where(eq(adminSettingsTable.key, key)).limit(1);
  let count = 0;
  let lockedUntil = 0;
  if (rows.length && rows[0].value) {
    try {
      const parsed = JSON.parse(rows[0].value) as { count: number; lockedUntil?: number };
      count = parsed.count ?? 0;
      lockedUntil = parsed.lockedUntil ?? 0;
    } catch { /* ignore corrupt entry */ }
  }
  if (lockedUntil && Date.now() < lockedUntil) {
    return { locked: true, attemptsLeft: 0 };
  }
  count += 1;
  const newLockedUntil = count >= OTP_MAX_ATTEMPTS ? Date.now() + OTP_LOCK_MS : 0;
  const val = JSON.stringify({ count, lockedUntil: newLockedUntil });
  await db.insert(adminSettingsTable).values({ key, value: val })
    .onConflictDoUpdate({ target: adminSettingsTable.key, set: { value: val, updatedAt: new Date() } });
  if (newLockedUntil) return { locked: true, attemptsLeft: 0 };
  return { locked: false, attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - count) };
}

async function clearOtpAttempts(email: string) {
  const key = `otp_attempts:${email.toLowerCase()}`;
  await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, key));
}

function makeToken(userId: number, email: string) {
  return jwt.sign({ userId, email }, _jwtSecret, { expiresIn: "30d" });
}

function isBlocked(status: string | null) {
  return status === "disabled" || status === "banned";
}

function getAppOrigin(req: import("express").Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) || "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ||
    (req.headers.host as string | undefined) ||
    "gsmworld.vercel.app";
  return `${proto}://${host}`;
}

router.post("/auth/register", async (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  try {
    const { blocked, retryAfterSec } = await checkRateLimit(`rl:register:${ip}`, REGISTER_MAX, REGISTER_WINDOW_MS);
    if (blocked) {
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: `Too many registration attempts. Try again in ${Math.ceil((retryAfterSec ?? 3600) / 60)} minute(s).` });
      return;
    }
    const { email, password, name } = req.body || {};
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const registrationIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      registrationIp,
    }).returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name, createdAt: usersTable.createdAt });

    // Auto-generate username
    const base = (name || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14) || "user";
    let username = `${base}${String(Math.floor(1000 + Math.random() * 9000))}`;
    const existing2 = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existing2.length > 0) {
      username = `${base}${String(Math.floor(1000 + Math.random() * 9000))}`;
    }
    await db.update(usersTable).set({ username }).where(eq(usersTable.id, user.id));

    const token = makeToken(user.id, user.email);
    logger.info({ userId: user.id, username }, "User registered");
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await setOtp(user.email, otp, 10 * 60 * 1000);
    const emailResult = await sendEmail({ to: user.email, ...otpEmail(otp) });
    if (!emailResult.sent) {
      logger.error({ reason: emailResult.reason, to: user.email }, "Failed to send signup verification email");
    }
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name }, emailSent: emailResult.sent });
  } catch (err) {
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) { res.status(400).json({ error: "Email and code are required" }); return; }
    const attempt = await recordOtpAttempt(email);
    if (attempt.locked) { res.status(429).json({ error: "Too many incorrect attempts. Please wait 15 minutes before trying again." }); return; }
    const entry = await getOtp(email.toLowerCase());
    if (!entry || entry.code !== String(code)) {
      res.status(400).json({ error: `Invalid or expired code.${attempt.attemptsLeft > 0 ? ` ${attempt.attemptsLeft} attempt(s) remaining.` : ""}` });
      return;
    }
    if (Date.now() > entry.expiresAt) {
      await deleteOtp(email.toLowerCase());
      res.status(400).json({ error: "Code has expired. Please request a new one." });
      return;
    }
    await deleteOtp(email.toLowerCase());
    await clearOtpAttempts(email);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "OTP verification failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  try {
    const { blocked, retryAfterSec } = await checkRateLimit(`rl:login:${ip}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
    if (blocked) {
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: `Too many login attempts. Please try again in ${Math.ceil((retryAfterSec ?? 900) / 60)} minute(s).`,
      });
      return;
    }
    const { email, password } = req.body || {};
    if (!email || !password) { res.status(400).json({ error: "Email and password are required" }); return; }
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (rows.length === 0) {
      await recordRateLimitAttempt(`rl:login:${ip}`, LOGIN_WINDOW_MS);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const user = rows[0];
    if (isBlocked(user.status)) {
      res.status(403).json({ error: "You are not allowed to perform this action. Contact support." });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await recordRateLimitAttempt(`rl:login:${ip}`, LOGIN_WINDOW_MS);
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    await clearRateLimit(`rl:login:${ip}`);
    const token = makeToken(user.id, user.email);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number; email: string };
    const rows = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, username: usersTable.username, avatarUrl: usersTable.avatarUrl, walletBalance: usersTable.walletBalance, status: usersTable.status, createdAt: usersTable.createdAt })
      .from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (rows.length === 0) { res.status(401).json({ error: "User not found" }); return; }
    const u = rows[0];
    if (isBlocked(u.status)) {
      res.status(403).json({ error: "You are not allowed to perform this action. Contact support." });
      return;
    }
    res.json({ user: { ...u, walletBalance: parseFloat(u.walletBalance ?? "0") } });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

router.patch("/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number; email: string };

    const { name, avatarUrl } = req.body as { name?: string; avatarUrl?: string | null };

    const updates: Partial<{ name: string | null; avatarUrl: string | null }> = {};

    if (name !== undefined) {
      if (typeof name !== "string") { res.status(400).json({ error: "name must be a string" }); return; }
      updates.name = name.trim() || null;
    }

    if (avatarUrl !== undefined) {
      if (avatarUrl === null) {
        updates.avatarUrl = null;
      } else {
        if (typeof avatarUrl !== "string") { res.status(400).json({ error: "avatarUrl must be a string" }); return; }
        if (!avatarUrl.startsWith("data:image/")) { res.status(400).json({ error: "avatarUrl must be an image data URL" }); return; }
        if (avatarUrl.length > 1_500_000) { res.status(413).json({ error: "Avatar too large (max ~1MB)" }); return; }
        updates.avatarUrl = avatarUrl;
      }
    }

    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, payload.userId))
      .returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name, username: usersTable.username, avatarUrl: usersTable.avatarUrl });

    if (!updated) { res.status(404).json({ error: "User not found" }); return; }

    res.json({ user: updated });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Resend signup OTP (uses the same key as registration — NOT the login: prefix)
router.post("/auth/resend-signup-otp", async (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  try {
    const { blocked, retryAfterSec } = await checkRateLimit(`rl:otp_send:${ip}`, OTP_SEND_MAX, OTP_SEND_WINDOW_MS);
    if (blocked) {
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: `Too many OTP requests. Try again in ${Math.ceil((retryAfterSec ?? 3600) / 60)} minute(s).` });
      return;
    }
    await recordRateLimitAttempt(`rl:otp_send:${ip}`, OTP_SEND_WINDOW_MS);
    const { email } = req.body || {};
    if (!email || typeof email !== "string") { res.status(400).json({ error: "Email is required" }); return; }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await setOtp(email.toLowerCase(), otp, 10 * 60 * 1000);
    const emailResult = await sendEmail({ to: email.toLowerCase(), ...otpEmail(otp) });
    if (!emailResult.sent) {
      logger.error({ reason: emailResult.reason, to: email }, "Failed to resend signup OTP email");
      res.status(500).json({ error: `Email delivery failed: ${emailResult.reason ?? "unknown error"}. Check your SMTP settings in Admin.` });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Resend signup OTP failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/otp-login/send", async (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  try {
    const { blocked, retryAfterSec } = await checkRateLimit(`rl:otp_send:${ip}`, OTP_SEND_MAX, OTP_SEND_WINDOW_MS);
    if (blocked) {
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: `Too many OTP requests. Try again in ${Math.ceil((retryAfterSec ?? 3600) / 60)} minute(s).` });
      return;
    }
    await recordRateLimitAttempt(`rl:otp_send:${ip}`, OTP_SEND_WINDOW_MS);
    const { email } = req.body || {};
    if (!email || typeof email !== "string") { res.status(400).json({ error: "Email is required" }); return; }
    const rows = await db
      .select({ id: usersTable.id, email: usersTable.email, status: usersTable.status })
      .from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!rows.length) { res.json({ success: true }); return; }
    if (isBlocked(rows[0].status)) {
      res.status(403).json({ error: "You are not allowed to perform this action. Contact support." });
      return;
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await setOtp(`login:${email.toLowerCase()}`, otp, 10 * 60 * 1000);
    const emailResult = await sendEmail({ to: email.toLowerCase(), ...otpEmail(otp) });
    if (!emailResult.sent) {
      logger.error({ reason: emailResult.reason, to: email }, "OTP login email delivery failed");
      res.status(500).json({ error: `Could not send verification code: ${emailResult.reason ?? "email delivery failed"}. Please check Admin email settings or try again.` });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "OTP login send failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/otp-login/verify", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) { res.status(400).json({ error: "Email and code are required" }); return; }
    const attempt = await recordOtpAttempt(`login:${email}`);
    if (attempt.locked) { res.status(429).json({ error: "Too many incorrect attempts. Please wait 15 minutes before trying again." }); return; }
    const key = `login:${email.toLowerCase()}`;
    const entry = await getOtp(key);
    if (!entry || entry.code !== String(code)) {
      res.status(400).json({ error: `Invalid or expired code.${attempt.attemptsLeft > 0 ? ` ${attempt.attemptsLeft} attempt(s) remaining.` : ""}` });
      return;
    }
    if (Date.now() > entry.expiresAt) {
      await deleteOtp(key);
      res.status(400).json({ error: "Code has expired. Please request a new one." });
      return;
    }
    await deleteOtp(key);
    await clearOtpAttempts(`login:${email}`);
    const rows = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, status: usersTable.status })
      .from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = rows[0];
    if (isBlocked(user.status)) {
      res.status(403).json({ error: "You are not allowed to perform this action. Contact support." });
      return;
    }
    const token = makeToken(user.id, user.email);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    req.log.error({ err }, "OTP login verify failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Password reset via OTP ───────────────────────────────────────────────────
const RESET_SEND_MAX = 5;
const RESET_SEND_WINDOW_MS = 60 * 60 * 1000; // 5 attempts per hour per IP

router.post("/auth/password-reset/send", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
    const { blocked, retryAfterSec } = await checkRateLimit(`rl:reset_send:${ip}`, RESET_SEND_MAX, RESET_SEND_WINDOW_MS);
    if (blocked) {
      res.setHeader("Retry-After", String(retryAfterSec ?? 3600));
      res.status(429).json({ error: `Too many reset requests. Try again in ${Math.ceil((retryAfterSec ?? 3600) / 60)} minute(s).` });
      return;
    }
    await recordRateLimitAttempt(`rl:reset_send:${ip}`, RESET_SEND_WINDOW_MS);

    const { email } = req.body || {};
    if (!email || typeof email !== "string") { res.status(400).json({ error: "Email is required" }); return; }
    const rows = await db.select({ id: usersTable.id, status: usersTable.status })
      .from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!rows.length) { res.json({ success: true }); return; }
    if (isBlocked(rows[0].status)) { res.status(403).json({ error: "Account disabled. Contact support." }); return; }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await setOtp(`reset:${email.toLowerCase()}`, otp, 10 * 60 * 1000);
    const emailResult = await sendEmail({ to: email.toLowerCase(), ...otpEmail(otp) });
    if (!emailResult.sent) {
      res.status(500).json({ error: `Could not send reset code: ${emailResult.reason ?? "email delivery failed"}` });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Password reset send failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/password-reset/reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) { res.status(400).json({ error: "Email, code, and new password are required" }); return; }
    if (typeof newPassword !== "string" || newPassword.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
    const attempt = await recordOtpAttempt(`reset:${email}`);
    if (attempt.locked) { res.status(429).json({ error: "Too many incorrect attempts. Please wait 15 minutes before trying again." }); return; }
    const key = `reset:${email.toLowerCase()}`;
    const entry = await getOtp(key);
    if (!entry || entry.code !== String(code)) {
      res.status(400).json({ error: `Invalid or expired code.${attempt.attemptsLeft > 0 ? ` ${attempt.attemptsLeft} attempt(s) remaining.` : ""}` });
      return;
    }
    if (Date.now() > entry.expiresAt) { await deleteOtp(key); res.status(400).json({ error: "Code has expired. Request a new one." }); return; }
    await deleteOtp(key);
    await clearOtpAttempts(`reset:${email}`);
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.email, email.toLowerCase()));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Password reset failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Google / Neon Auth sign-in
router.post("/auth/google", async (req, res) => {
  try {
    const { token: neonToken } = req.body || {};
    if (!neonToken || typeof neonToken !== "string") {
      res.status(400).json({ error: "Neon Auth session token required" });
      return;
    }
    const sessionRes = await fetch(`${NEON_AUTH_URL}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${neonToken}` },
    });
    if (!sessionRes.ok) {
      res.status(401).json({ error: "Invalid or expired Google session. Please sign in again." });
      return;
    }
    const sessionData = await sessionRes.json() as { user?: { email?: string; name?: string; displayName?: string } };
    const email = sessionData?.user?.email;
    const name = sessionData?.user?.name || sessionData?.user?.displayName;
    if (!email) {
      res.status(401).json({ error: "Could not retrieve email from Google account." });
      return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    let userId: number;
    let userEmail: string;
    let userName: string | null;
    if (existing.length > 0) {
      const user = existing[0];
      if (isBlocked(user.status)) {
        res.status(403).json({ error: "You are not allowed to perform this action. Contact support." });
        return;
      }
      userId = user.id;
      userEmail = user.email;
      userName = user.name;
    } else {
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase(),
        passwordHash: "",
        name: name || null,
      }).returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name });
      userId = newUser.id;
      userEmail = newUser.email;
      userName = newUser.name;
      logger.info({ userId }, "User created via Google OAuth");
    }
    const jwtToken = makeToken(userId, userEmail);
    res.json({ token: jwtToken, user: { id: userId, email: userEmail, name: userName } });
  } catch (err) {
    req.log.error({ err }, "Google auth failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Google OAuth — backend-driven flow
router.get("/auth/google/redirect", async (req, res) => {
  const { clientId } = await getGoogleCredentials();
  if (!clientId) {
    const origin = getAppOrigin(req);
    res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent("Google OAuth not configured. Please contact support.")}`);
    return;
  }
  const origin = getAppOrigin(req);
  const redirectUri = encodeURIComponent(`${origin}/api/auth/google/callback`);
  const scope = encodeURIComponent("openid email profile");
  // Detect Android WebView app by user-agent; encode isApp flag + sessionId in state
  // so the callback can (a) redirect via deep link and (b) store token for polling fallback.
  const ua = (req.headers["user-agent"] || "") as string;
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  // Detect Android app: either by our custom UA string, OR by the presence of a sessionId
  // (which is only passed by the Android WebView's login.tsx — the web browser path never adds it).
  // Chrome's UA won't contain "GSMWorldApp", so the sessionId check is the reliable signal.
  const isAndroidApp = ua.includes("GSMWorldApp") || !!sessionId;
  const statePayload = {
    ts: Date.now(),
    ...(isAndroidApp ? { isApp: true } : {}),
    ...(sessionId ? { sessionId } : {}),
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");
  // No &prompt= parameter: if the user already has an active Google session in
  // this browser the account picker is skipped automatically.  Only adding
  // prompt=select_account would force re-selection on every visit, which is
  // exactly the complaint ("browser still prompts for Google account").
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline`;

  // Return an HTML page that navigates via JavaScript instead of a server-side 302.
  // Android WebViews call shouldOverrideUrlLoading for JS-initiated navigations but NOT
  // for server-side (HTTP 3xx) redirects, so using res.redirect() would silently load
  // Google inside the WebView where Google blocks OAuth. The JS redirect lets the old APK
  // intercept the Google URL and open it in Chrome.
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting...</title>
<style>body{background:#0d1828;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.s{width:36px;height:36px;border:3px solid rgba(59,130,246,.25);border-top-color:#3b82f6;border-radius:50%;animation:r .7s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}</style></head>
<body><div class="s"></div>
<script>window.location.href=${JSON.stringify(url)};</script>
</body></html>`);
});

function decodeOAuthState(raw: unknown): { isApp?: boolean; sessionId?: string } {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { isApp?: boolean; sessionId?: string };
  } catch {
    return {};
  }
}

// Poll endpoint — frontend checks this after returning from Chrome OAuth
router.get("/auth/google/poll", async (req, res) => {
  const session = req.query.session;
  if (typeof session !== "string" || !session) {
    res.status(400).json({ error: "Missing session" });
    return;
  }
  const key = `oauth_session:${session}`;
  try {
    const rows = await db.select({ value: adminSettingsTable.value })
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, key))
      .limit(1);
    if (!rows.length || !rows[0].value) {
      res.json({ status: "pending" });
      return;
    }
    const data = JSON.parse(rows[0].value) as { params: string; expiresAt: number };
    if (Date.now() > data.expiresAt) {
      await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, key));
      res.json({ status: "expired" });
      return;
    }
    // One-time use — consume it
    await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, key));
    const urlParams = new URLSearchParams(data.params);
    const token = urlParams.get("token");
    const email = urlParams.get("email");
    const name = urlParams.get("name");
    const error = urlParams.get("error");
    if (error) { res.json({ status: "error", error }); return; }
    res.json({ status: "done", token, email, name });
  } catch (err) {
    req.log.error({ err }, "OAuth poll error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/google/callback", async (req, res) => {
  const origin = getAppOrigin(req);
  const stateData = decodeOAuthState(req.query.state);
  const isAppRedirect = stateData.isApp === true;
  const sessionId = stateData.sessionId;

  // For web browser: standard redirect
  function webRedirect(params: string) {
    res.redirect(`${origin}/auth/google-callback?${params}`);
  }

  // For Android app: store token for polling AND send HTML page that tries the deep link
  async function appRedirect(params: string) {
    const deepLink = `gsmworld://auth/callback?${params}`;
    if (sessionId) {
      const val = JSON.stringify({ params, expiresAt: Date.now() + 10 * 60 * 1000 });
      await db.insert(adminSettingsTable)
        .values({ key: `oauth_session:${sessionId}`, value: val })
        .onConflictDoUpdate({ target: adminSettingsTable.key, set: { value: val, updatedAt: new Date() } });
    }
    // Build an intent:// URL (Chrome Android handles these natively — no gesture required)
    const intentParams = params.replace(/&/g, "&amp;");
    const intentLink = `intent://auth/callback?${params}#Intent;scheme=gsmworld;package=com.gsmworld.app;S.browser_fallback_url=https%3A%2F%2Fgsmworld.vercel.app;end`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed In</title>
<style>body{font-family:-apple-system,sans-serif;background:#0d1828;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}
.card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px 24px;max-width:320px;width:100%}
.check{font-size:48px;margin:0 0 16px}
h2{margin:0 0 8px;font-size:22px;color:#f8fafc}
.sub{color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px}
.hint{color:#475569;font-size:12px;margin:16px 0 0}
.btn{display:block;background:linear-gradient(135deg,#1e40af,#1e3a5f);border:1px solid rgba(59,130,246,.5);color:#93c5fd;padding:14px 24px;border-radius:14px;text-decoration:none;font-size:15px;font-weight:700;transition:opacity .2s}
.btn:hover{opacity:.85}
</style></head>
<body>
<div class="card">
  <div class="check">✅</div>
  <h2>Sign-in complete!</h2>
  <p class="sub">Tap the button below to return to GSM World.<br>Your account will be ready immediately.</p>
  <a id="openBtn" href="${intentLink}" class="btn">Open GSM World</a>
  <p class="hint">Or press Back on your browser to return.</p>
</div>
<script>
// Auto-click the button immediately — treated as a user gesture in Chrome Android
// which allows the intent:// URI to open the app without manual interaction.
window.addEventListener('load', function() {
  var btn = document.getElementById('openBtn');
  // Short timeout so Chrome registers the page as loaded first
  setTimeout(function() {
    btn.click();
    // After opening the app, attempt to close this browser tab so the user
    // is not left stuck on the Google account-picker or callback page.
    setTimeout(function() {
      try { window.close(); } catch(e) {}
      // Fallback: navigate away so the page isn't lingering
      try { window.location.replace('about:blank'); } catch(e) {}
    }, 1200);
  }, 300);
});
</script>
</body></html>`);
  }

  try {
    const { code, error: authError } = req.query;
    if (authError || !code) {
      const params = `error=${encodeURIComponent(String(authError || "Google sign-in was cancelled"))}`;
      if (isAppRedirect) { await appRedirect(params); } else { webRedirect(params); }
      return;
    }
    const { clientId, clientSecret } = await getGoogleCredentials();
    if (!clientId || !clientSecret) {
      const params = `error=${encodeURIComponent("Google OAuth not configured")}`;
      if (isAppRedirect) { await appRedirect(params); } else { webRedirect(params); }
      return;
    }
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      req.log.error({ errText }, "Google token exchange failed");
      const params = `error=${encodeURIComponent("Failed to complete Google sign-in")}`;
      if (isAppRedirect) { await appRedirect(params); } else { webRedirect(params); }
      return;
    }
    const { access_token } = await tokenRes.json() as { access_token: string };
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) {
      const params = `error=${encodeURIComponent("Failed to get profile from Google")}`;
      if (isAppRedirect) { await appRedirect(params); } else { webRedirect(params); }
      return;
    }
    const googleUser = await userRes.json() as { email?: string; name?: string };
    const email = googleUser.email;
    const name = googleUser.name;
    if (!email) {
      const params = `error=${encodeURIComponent("No email returned from Google")}`;
      if (isAppRedirect) { await appRedirect(params); } else { webRedirect(params); }
      return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    let userId: number, userEmail: string, userName: string | null;
    if (existing.length > 0) {
      const user = existing[0];
      if (isBlocked(user.status)) {
        const params = `error=${encodeURIComponent("Account disabled. Contact support.")}`;
        if (isAppRedirect) { await appRedirect(params); } else { webRedirect(params); }
        return;
      }
      userId = user.id;
      userEmail = user.email;
      userName = user.name;
    } else {
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase(),
        passwordHash: "",
        name: name || null,
      }).returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name });
      userId = newUser.id;
      userEmail = newUser.email;
      userName = newUser.name;
      req.log.info({ userId }, "User created via Google OAuth");
    }
    const jwtToken = makeToken(userId, userEmail);
    const successParams = `token=${encodeURIComponent(jwtToken)}&email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName || "")}`;
    if (isAppRedirect) { await appRedirect(successParams); } else { webRedirect(successParams); }
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback failed");
    appRedirect(`error=${encodeURIComponent("Authentication failed. Please try again.")}`);
  }
});

router.get("/admin/check", (_req, res) => {
  res.json({ configured: !!process.env.ADMIN_PASSWORD });
});

// ── User WebAuthn / fingerprint endpoints ────────────────────────────────────
// Credentials are stored per-user in adminSettingsTable with key
// `webauthn_user_cred:{userId}` and challenges with
// `webauthn_user_challenge_{kind}:{userId}`.

const WA_USER_CHALLENGE_TTL = 5 * 60 * 1000; // 5 min

async function getUserWebauthnCredential(userId: number): Promise<string | null> {
  try {
    const rows = await db.select().from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, `webauthn_user_cred:${userId}`)).limit(1);
    return rows[0]?.value ?? null;
  } catch { return null; }
}

async function setUserWebauthnCredential(userId: number, json: string): Promise<void> {
  const key = `webauthn_user_cred:${userId}`;
  await db.insert(adminSettingsTable).values({ key, value: json })
    .onConflictDoUpdate({ target: adminSettingsTable.key, set: { value: json, updatedAt: new Date() } });
}

async function deleteUserWebauthnCredential(userId: number): Promise<void> {
  await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, `webauthn_user_cred:${userId}`));
}

async function setUserWebauthnChallenge(userId: number, kind: "register" | "auth", payload: { challenge: string; origin: string; rpID: string; ts: number }): Promise<void> {
  const key = `webauthn_user_challenge_${kind}:${userId}`;
  await db.insert(adminSettingsTable).values({ key, value: JSON.stringify(payload) })
    .onConflictDoUpdate({ target: adminSettingsTable.key, set: { value: JSON.stringify(payload), updatedAt: new Date() } });
}

async function getUserWebauthnChallenge(userId: number, kind: "register" | "auth"): Promise<{ challenge: string; origin: string; rpID: string; ts: number } | null> {
  const key = `webauthn_user_challenge_${kind}:${userId}`;
  try {
    const rows = await db.select().from(adminSettingsTable).where(eq(adminSettingsTable.key, key)).limit(1);
    if (!rows[0]?.value) return null;
    return JSON.parse(rows[0].value) as { challenge: string; origin: string; rpID: string; ts: number };
  } catch { return null; }
}

async function deleteUserWebauthnChallenge(userId: number, kind: "register" | "auth"): Promise<void> {
  await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, `webauthn_user_challenge_${kind}:${userId}`));
}

// GET /auth/webauthn/status — check if current user has a fingerprint registered
router.get("/auth/webauthn/status", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number };
    const cred = await getUserWebauthnCredential(payload.userId);
    res.json({ registered: Boolean(cred) });
  } catch { res.status(401).json({ error: "Invalid token" }); }
});

// POST /auth/webauthn/register-challenge — start fingerprint registration (must be logged in)
router.post("/auth/webauthn/register-challenge", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number; email: string };

    const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string | undefined) || req.get("host") || "localhost";
    const origin = req.get("origin") ?? `${proto}://${host}`;
    const rpID = (() => { try { return new URL(origin).hostname; } catch { return req.hostname; } })();

    const isNativeApp = /GSMWorldApp|GSMAdminApp/.test(req.headers["user-agent"] ?? "");
    const options = await generateRegistrationOptions({
      rpName: "GSM World",
      rpID,
      userID: new TextEncoder().encode(String(payload.userId)),
      userName: payload.email,
      userDisplayName: payload.email,
      attestationType: "none",
      authenticatorSelection: {
        ...(isNativeApp ? {} : { authenticatorAttachment: "platform" as const }),
        userVerification: "preferred",
        residentKey: "preferred",
      },
    });
    await setUserWebauthnChallenge(payload.userId, "register", { challenge: options.challenge, origin, rpID, ts: Date.now() });
    res.json(options);
  } catch (err) {
    req.log.error({ err }, "user webauthn register-challenge error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/webauthn/register — complete fingerprint registration
router.post("/auth/webauthn/register", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number };

    const stored = await getUserWebauthnChallenge(payload.userId, "register");
    if (!stored || Date.now() - stored.ts > WA_USER_CHALLENGE_TTL) {
      res.status(400).json({ error: "Challenge expired — please try again." }); return;
    }
    await deleteUserWebauthnChallenge(payload.userId, "register");

    const expectedOrigins = [stored.origin];
    const replitDomains = (process.env.REPLIT_DOMAINS || "").split(",").filter(Boolean);
    for (const d of replitDomains) {
      const t = d.trim();
      if (t && !expectedOrigins.includes(`https://${t}`)) expectedOrigins.push(`https://${t}`);
    }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: stored.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: stored.rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Fingerprint registration failed." }); return;
    }
    const { credential } = verification.registrationInfo;
    const credId = typeof credential.id === "string"
      ? credential.id
      : Buffer.from(credential.id as Uint8Array).toString("base64url");
    const credPublicKey = Buffer.from(credential.publicKey as Uint8Array).toString("base64url");
    await setUserWebauthnCredential(payload.userId, JSON.stringify({
      credentialID: credId,
      credentialPublicKey: credPublicKey,
      counter: credential.counter,
      rpID: stored.rpID,
    }));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "user webauthn register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/webauthn/auth-challenge — start fingerprint login (public, requires email)
router.post("/auth/webauthn/auth-challenge", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== "string") { res.status(400).json({ error: "email is required" }); return; }
    const rows = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!rows.length) { res.status(404).json({ error: "No fingerprint registered for this account." }); return; }
    const userId = rows[0].id;
    const credStr = await getUserWebauthnCredential(userId);
    if (!credStr) { res.status(404).json({ error: "No fingerprint registered for this account." }); return; }
    const cred = JSON.parse(credStr) as { credentialID: string; rpID: string };

    const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string | undefined) || req.get("host") || "localhost";
    const origin = req.get("origin") ?? `${proto}://${host}`;

    const options = await generateAuthenticationOptions({
      rpID: cred.rpID,
      allowCredentials: [{ id: cred.credentialID }],
      userVerification: "required",
    });
    await setUserWebauthnChallenge(userId, "auth", { challenge: options.challenge, origin, rpID: cred.rpID, ts: Date.now() });
    res.json({ ...options, _userId: userId });
  } catch (err) {
    req.log.error({ err }, "user webauthn auth-challenge error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/webauthn/auth — verify fingerprint and return JWT
router.post("/auth/webauthn/auth", async (req, res) => {
  try {
    const { _userId: rawUserId, ...assertionBody } = req.body as { _userId?: number; [k: string]: unknown };
    const userId = Number(rawUserId);
    if (!userId) { res.status(400).json({ error: "_userId is required" }); return; }

    const stored = await getUserWebauthnChallenge(userId, "auth");
    if (!stored || Date.now() - stored.ts > WA_USER_CHALLENGE_TTL) {
      res.status(400).json({ error: "Challenge expired — please try again." }); return;
    }
    await deleteUserWebauthnChallenge(userId, "auth");

    const credStr = await getUserWebauthnCredential(userId);
    if (!credStr) { res.status(404).json({ error: "No fingerprint registered." }); return; }
    const cred = JSON.parse(credStr) as { credentialID: string; credentialPublicKey: string; counter: number; rpID: string };

    const expectedOrigins = [stored.origin];
    const replitDomains = (process.env.REPLIT_DOMAINS || "").split(",").filter(Boolean);
    for (const d of replitDomains) {
      const t = d.trim();
      if (t && !expectedOrigins.includes(`https://${t}`)) expectedOrigins.push(`https://${t}`);
    }

    const verification = await verifyAuthenticationResponse({
      response: assertionBody as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: stored.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: stored.rpID,
      credential: {
        id: cred.credentialID,
        publicKey: Buffer.from(cred.credentialPublicKey, "base64url"),
        counter: cred.counter,
      },
    });
    if (!verification.verified) { res.status(401).json({ error: "Fingerprint verification failed." }); return; }

    await setUserWebauthnCredential(userId, JSON.stringify({ ...cred, counter: verification.authenticationInfo.newCounter }));

    const rows = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, status: usersTable.status })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = rows[0];
    if (user.status === "disabled" || user.status === "banned") {
      res.status(403).json({ error: "Account disabled. Contact support." }); return;
    }
    const token = makeToken(user.id, user.email);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    req.log.error({ err }, "user webauthn auth error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /auth/webauthn/credential — remove the user's fingerprint credential
router.delete("/auth/webauthn/credential", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number };
    await deleteUserWebauthnCredential(payload.userId);
    res.json({ success: true });
  } catch { res.status(401).json({ error: "Invalid token" }); }
});

export default router;
