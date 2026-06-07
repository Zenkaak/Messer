import { Router, type IRouter } from "express";
import { and, isNull, lt, eq, sql } from "drizzle-orm";
import { db, cartItemsTable, productsTable, usersTable } from "@workspace/db";
import { sendEmail, abandonedCartEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function verifyCronSecret(req: import("express").Request, res: import("express").Response): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured — allow (useful in dev)
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/cron/abandoned-carts
// Triggered by Vercel cron daily at 09:00 UTC (see /vercel.json).
// Finds every logged-in user who has cart items sitting >24 h without checkout
// and has not yet received a recovery email, then sends one and marks the items.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/cron/abandoned-carts", async (req, res) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Distinct user sessions with ≥1 item older than 24 h and no reminder sent yet
    const sessions = await db
      .selectDistinct({ sessionId: cartItemsTable.sessionId })
      .from(cartItemsTable)
      .where(
        and(
          sql`${cartItemsTable.sessionId} LIKE 'user:%'`,
          lt(cartItemsTable.addedAt, cutoff),
          isNull(cartItemsTable.reminderSentAt)
        )
      );

    let sent = 0;
    for (const { sessionId } of sessions) {
      const userId = parseInt(sessionId.replace("user:", ""), 10);
      if (isNaN(userId)) continue;

      const [user] = await db
        .select({ email: usersTable.email, name: usersTable.name, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!user?.email || user.status !== "active") continue;

      const cartRows = await db
        .select({ cartItem: cartItemsTable, product: productsTable })
        .from(cartItemsTable)
        .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
        .where(eq(cartItemsTable.sessionId, sessionId));

      if (cartRows.length === 0) continue;

      const items = cartRows.map(r => ({
        productName: r.product.name,
        quantity: r.cartItem.quantity,
        price: r.cartItem.priceAtAdd,
        imageUrl: r.product.imageUrl,
      }));
      const total = items.reduce((acc, i) => acc + parseFloat(i.price) * i.quantity, 0);

      try {
        await sendEmail({
          to: user.email,
          ...abandonedCartEmail({ customerName: user.name, items, total }),
        });
        // Mark all items in this session so they won't be emailed again
        await db
          .update(cartItemsTable)
          .set({ reminderSentAt: new Date() })
          .where(eq(cartItemsTable.sessionId, sessionId));
        sent++;
      } catch (err) {
        logger.warn({ err, userId }, "Abandoned-cart email failed — skipping user");
      }
    }

    logger.info({ sessions: sessions.length, sent }, "Abandoned cart cron complete");
    res.json({ ok: true, sessions: sessions.length, sent });
  } catch (err) {
    logger.error({ err }, "Abandoned cart cron failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
