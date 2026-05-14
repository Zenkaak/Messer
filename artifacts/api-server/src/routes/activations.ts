import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { toolActivationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendEmail, appUrl } from "../lib/email";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-change-in-prod";

function getUser(authHeader: string | undefined): { userId: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

router.get("/activations", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(toolActivationsTable)
    .where(eq(toolActivationsTable.userId, payload.userId))
    .orderBy(desc(toolActivationsTable.createdAt));

  res.json({ activations: rows });
});

router.post("/activations", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { toolName, toolCategory, username, serialKey, orderRef } = req.body || {};

  if (!toolName || !toolCategory || !username || !serialKey) {
    res.status(400).json({ error: "toolName, toolCategory, username, and serialKey are required" });
    return;
  }

  const [activation] = await db
    .insert(toolActivationsTable)
    .values({
      userId: payload.userId,
      toolName: String(toolName),
      toolCategory: String(toolCategory),
      username: String(username),
      serialKey: String(serialKey),
      orderRef: orderRef ? String(orderRef) : null,
      status: "pending",
    })
    .returning();

  logger.info({ userId: payload.userId, toolName, toolCategory }, "Activation request submitted");
  const orderLink = orderRef ? appUrl(`/orders/${orderRef}`) : appUrl("/account/activations");
  await sendEmail({
    to: payload.email,
    subject: `Activation request received: ${toolName}`,
    text: `We received your activation request for ${toolName}. Track it here: ${orderLink}`,
    html: `<p>We received your activation request for <strong>${toolName}</strong>.</p><p><a href="${orderLink}">Track your request</a></p>`,
  });
  res.json({ activation });
});

router.delete("/activations/:id", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(toolActivationsTable)
    .where(eq(toolActivationsTable.id, id))
    .limit(1);

  if (!existing || existing.userId !== payload.userId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.status !== "pending") {
    res.status(400).json({ error: "Only pending activations can be cancelled" });
    return;
  }

  await db
    .update(toolActivationsTable)
    .set({ status: "rejected", notes: "Cancelled by user", updatedAt: new Date() })
    .where(eq(toolActivationsTable.id, id));

  res.json({ success: true });
});

export default router;
