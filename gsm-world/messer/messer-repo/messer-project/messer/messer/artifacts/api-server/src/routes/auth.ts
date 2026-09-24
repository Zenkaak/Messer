import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getGoogleCredentials } from "../lib/admin-settings";
import { sendEmail, otpEmail, signInNotificationEmail } from "../lib/email";

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.warn("JWT_SECRET is not set — using insecure default. Set it in production.");
}
const _jwtSecret = JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

const NEON_AUTH_URL =
  process.env.NEON_AUTH_URL ||
  "https://ep-young-frost-am13gy4v.neonauth.c-5.us-east-1.aws.neon.tech/neondb/auth";

const otpStore = new Map<string, { code: string; expiresAt: number }>();

function makeToken(userId: number, email: string) {
  return jwt.sign({ userId, email }, _jwtSecret, { expiresIn: "30d" });
}

function isBlocked(status: string | null) {
  return status === "disabled" || status === "banned";
}

function getAppOrigin(req: import("express").Request): string {
  // 1. Explicitly configured URL wins (e.g. custom domain)
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // 2. Replit sets REPLIT_DOMAINS for deployed apps — always correct
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  }
  // 3. Frontend can pass its own origin as a query param — use it if present and valid
  const qOrigin = (req.query?.origin as string | undefined);
  if (qOrigin && /^https?:\/\/.+/.test(qOrigin)) return qOrigin.replace(/\/$/, "");
  // 4. Reconstruct from proxy headers (unreliable behind Replit internal proxy)
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) || "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ||
    (req.headers.host as string | undefined) ||
    "localhost:3000";
  // Reject obviously-wrong internal service names (single word, no dot, no port)
  if (/^[a-z]+$/i.test(host)) return `${proto}://localhost:3000`;
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
    otpStore.set(user.email, { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 });
    sendEmail({ to: user.email, ...otpEmail(otp) }).catch((err) => {
      logger.error({ err }, "Failed to send welcome OTP email");
    });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) { res.status(400).json({ error: "Email and code are required" }); return; }
    const entry = otpStore.get(email.toLowerCase());
    if (!entry || entry.code !== String(code)) { res.status(400).json({ error: "Invalid or expired code" }); return; }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email.toLowerCase());
      res.status(400).json({ error: "Code has expired. Please request a new one." });
      return;
    }
    otpStore.delete(email.toLowerCase());
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
    const now = new Date().toUTCString();
    const ipHint = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.socket.remoteAddress || undefined;
    sendEmail({ to: user.email, ...signInNotificationEmail({ name: user.name, email: user.email, time: now, ipHint }) })
      .catch((e) => logger.error({ e }, "Sign-in notification email failed"));
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
    otpStore.set(`login:${email.toLowerCase()}`, { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 });
    sendEmail({
      to: email.toLowerCase(),
      subject: "Your GSM World Login Code",
      text: `Your login code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    }).catch((err) => logger.error({ err }, "Failed to send OTP login email"));
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
    const entry = otpStore.get(key);
    if (!entry || entry.code !== String(code)) { res.status(400).json({ error: "Invalid or expired code" }); return; }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(key);
      res.status(400).json({ error: "Code has expired. Please request a new one." });
      return;
    }
    otpStore.delete(key);
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
    const now = new Date().toUTCString();
    sendEmail({ to: user.email, ...signInNotificationEmail({ name: user.name, email: user.email, time: now }) })
      .catch((e) => logger.error({ e }, "OTP sign-in notification email failed"));
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    req.log.error({ err }, "OTP login verify failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Google / Neon Auth sign-in — verifies session token with Neon Auth server-side, then issues our JWT
router.post("/auth/google", async (req, res) => {
  try {
    const { token: neonToken } = req.body || {};
    if (!neonToken || typeof neonToken !== "string") {
      res.status(400).json({ error: "Neon Auth session token required" });
      return;
    }
    // Verify Better Auth session token via Neon Auth get-session endpoint
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

// Google OAuth — backend-driven flow (avoids cross-domain cookie issues)
// Step 1: redirect browser to Google
router.get("/auth/google/redirect", async (req, res) => {
  const origin = getAppOrigin(req);
  const { clientId } = await getGoogleCredentials();
  if (!clientId) {
    res.redirect(`${origin}/auth/google-callback?error=${encodeURIComponent("Google OAuth not configured. Please contact support.")}`);
    return;
  }
  const redirectUri = encodeURIComponent(`${origin}/api/auth/google/callback`);
  const scope = encodeURIComponent("openid email profile");
  // Encode origin in state so callback can use the same origin for redirect
  const state = Buffer.from(JSON.stringify({ ts: Date.now(), origin })).toString("base64url");
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;
  res.redirect(url);
});

// Step 2: Google redirects here with ?code=, exchange for JWT, send to frontend via URL param
router.get("/auth/google/callback", async (req, res) => {
  // Recover origin from the state parameter (encoded in Step 1) — most reliable
  let origin = getAppOrigin(req);
  try {
    const rawState = req.query.state as string | undefined;
    if (rawState) {
      const parsed = JSON.parse(Buffer.from(rawState, "base64url").toString()) as { ts?: number; origin?: string };
      if (parsed.origin && /^https?:\/\/.+/.test(parsed.origin)) {
        origin = parsed.origin.replace(/\/$/, "");
      }
    }
  } catch { /* ignore malformed state — fall back to getAppOrigin */ }
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

// Cart migration: merge guest cart into user cart after login
router.post("/auth/cart-migrate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number };
    const userSessionId = `user:${payload.userId}`;

    const { guestSessionId } = req.body || {};
    if (!guestSessionId || typeof guestSessionId !== "string" || !guestSessionId.trim()) {
      res.json({ merged: 0 });
      return;
    }

    const { db, cartItemsTable, productsTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");

    const guestItems = await db
      .select({ cartItem: cartItemsTable, product: productsTable })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.sessionId, guestSessionId));

    let merged = 0;
    for (const { cartItem } of guestItems) {
      const existing = await db
        .select()
        .from(cartItemsTable)
        .where(and(eq(cartItemsTable.sessionId, userSessionId), eq(cartItemsTable.productId, cartItem.productId)));

      if (existing.length > 0) {
        await db
          .update(cartItemsTable)
          .set({ quantity: existing[0].quantity + cartItem.quantity })
          .where(and(eq(cartItemsTable.sessionId, userSessionId), eq(cartItemsTable.productId, cartItem.productId)));
      } else {
        await db.insert(cartItemsTable).values({
          sessionId: userSessionId,
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          priceAtAdd: cartItem.priceAtAdd,
        });
      }
      merged++;
    }

    if (merged > 0) {
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, guestSessionId));
    }

    res.json({ merged });
  } catch (err) {
    req.log.error({ err }, "Cart migration failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/check", (_req, res) => {
  res.json({ configured: !!process.env.ADMIN_PASSWORD });
});

export default router;
