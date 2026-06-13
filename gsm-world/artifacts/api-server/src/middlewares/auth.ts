import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { checkAdminPassword } from "../lib/admin-settings";

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

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminPassword =
    (req.headers["x-admin-password"] as string | undefined) ||
    (req.body as Record<string, unknown>)?.adminPassword as string | undefined;

  if (!adminPassword) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  try {
    if (!(await checkAdminPassword(adminPassword))) {
      res.status(403).json({ error: "Invalid admin password" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
