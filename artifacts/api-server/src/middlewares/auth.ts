import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "crypto";
import { getAdminPassword } from "../lib/admin-settings";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn("[WARN] JWT_SECRET env var is not set. Using an insecure default — set it in production.");
}
const _jwtSecret = JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

export interface AuthUser {
  userId: number;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      timingSafeEqual(ba, ba);
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminPassword =
    (req.headers["x-admin-password"] as string | undefined) ||
    (req.body as Record<string, unknown>)?.adminPassword as string | undefined;

  if (!adminPassword) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  try {
    const expected = await getAdminPassword();
    if (!safeEqual(adminPassword, expected)) {
      res.status(403).json({ error: "Invalid admin password" });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}
