import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getGoogleCredentials } from "../lib/admin-settings";
import { sendEmail, otpEmail } from "../lib/email";

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
  try {
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
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
    }).returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name, createdAt: usersTable.createdAt });
    const token = makeToken(user.id, user.email);
    logger.info({ userId: user.id }, "User registered");
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
    const entry = await getOtp(email.toLowerCase());
    if (!entry || entry.code !== String(code)) { res.status(400).json({ error: "Invalid or expired code" }); return; }
    if (Date.now() > entry.expiresAt) {
      await deleteOtp(email.toLowerCase());
      res.status(400).json({ error: "Code has expired. Please request a new one." });
      return;
    }
    await deleteOtp(email.toLowerCase());
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "OTP verification failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) { res.status(400).json({ error: "Email and password are required" }); return; }
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (rows.length === 0) { res.status(401).json({ error: "Invalid email or password" }); return; }
    const user = rows[0];
    if (isBlocked(user.status)) {
      res.status(403).json({ error: "You are not allowed to perform this action. Contact support." });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }
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
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, walletBalance: usersTable.walletBalance, status: usersTable.status, createdAt: usersTable.createdAt })
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

// Resend signup OTP (uses the same key as registration — NOT the login: prefix)
router.post("/auth/resend-signup-otp", async (req, res) => {
  try {
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
  try {
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
    const key = `login:${email.toLowerCase()}`;
    const entry = await getOtp(key);
    if (!entry || entry.code !== String(code)) { res.status(400).json({ error: "Invalid or expired code" }); return; }
    if (Date.now() > entry.expiresAt) {
      await deleteOtp(key);
      res.status(400).json({ error: "Code has expired. Please request a new one." });
      return;
    }
    await deleteOtp(key);
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
  const state = Buffer.from(String(Date.now())).toString("base64url");
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;
  res.redirect(url);
});

router.get("/auth/google/callback", async (req, res) => {
  const origin = getAppOrigin(req);
  try {
    const { code, error: authError } = req.query;
    if (authError || !code) {
      res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent(String(authError || "Google sign-in was cancelled"))}`);
      return;
    }
    const { clientId, clientSecret } = await getGoogleCredentials();
    if (!clientId || !clientSecret) {
      res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent("Google OAuth not configured")}`);
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
      res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent("Failed to complete Google sign-in")}`);
      return;
    }
    const { access_token } = await tokenRes.json() as { access_token: string };
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) {
      res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent("Failed to get profile from Google")}`);
      return;
    }
    const googleUser = await userRes.json() as { email?: string; name?: string };
    const email = googleUser.email;
    const name = googleUser.name;
    if (!email) {
      res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent("No email returned from Google")}`);
      return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    let userId: number, userEmail: string, userName: string | null;
    if (existing.length > 0) {
      const user = existing[0];
      if (isBlocked(user.status)) {
        res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent("Account disabled. Contact support.")}`);
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
    res.redirect(
      `${origin}/auth/google-callback?token=${encodeURIComponent(jwtToken)}&email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName || "")}`
    );
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback failed");
    res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent("Authentication failed. Please try again.")}`);
  }
});

router.get("/admin/check", (_req, res) => {
  res.json({ configured: !!process.env.ADMIN_PASSWORD });
});

export default router;
