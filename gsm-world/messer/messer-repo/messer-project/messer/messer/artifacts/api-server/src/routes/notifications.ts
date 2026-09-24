import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

function getUserFromToken(authHeader: string | undefined): { userId: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

router.get("/notifications", async (req, res) => {
  const user = getUserFromToken(req.headers.authorization);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const notifs = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userEmail, user.email))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(notifs);
  } catch (err) {
    req.log.error({ err }, "Failed to get notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/notifications/mark-all-read", async (req, res) => {
  const user = getUserFromToken(req.headers.authorization);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userEmail, user.email));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark all read");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  const user = getUserFromToken(req.headers.authorization);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const id = Number(req.params.id);
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark read");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/notifications", async (req, res) => {
  const user = getUserFromToken(req.headers.authorization);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db
      .delete(notificationsTable)
      .where(eq(notificationsTable.userEmail, user.email));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to clear notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
