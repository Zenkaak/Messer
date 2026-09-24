import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cartItemsTable, productsTable } from "@workspace/db";
import { z } from "zod";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

const _jwtSecret = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

function getSessionId(req: import("express").Request): string {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId?: number };
      if (payload.userId) return `user:${payload.userId}`;
    }
  } catch {
    // Invalid or missing token — fall through to guest session
  }
  // Check body first (bot calls send sessionId in body), then query string (browser sends it as QS)
  const bodyId = (req.body as Record<string, unknown> | undefined)?.sessionId as string | undefined;
  if (bodyId && bodyId.trim()) return bodyId.trim();
  const qsId = req.query.sessionId as string | undefined;
  if (qsId && qsId.trim()) return qsId.trim();
  return "guest-session";
}

async function buildCartResponse(sessionId: string) {
  const rows = await db
    .select({
      cartItem: cartItemsTable,
      product: productsTable,
    })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.sessionId, sessionId));

  const items = rows.map((r) => ({
    productId: r.cartItem.productId,
    productName: r.product.name,
    price: parseFloat(r.cartItem.priceAtAdd),
    quantity: r.cartItem.quantity,
    imageUrl: r.product.imageUrl || null,
  }));

  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  return { items, total, itemCount };
}

router.get("/cart", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const cart = await buildCartResponse(sessionId);
    res.json(cart);
  } catch (err) {
    req.log.error({ err }, "Failed to get cart");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cart", async (req, res) => {
  try {
    const parsed = z
      .object({ productId: z.number().int().positive(), quantity: z.number().int().positive().default(1) })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const sessionId = getSessionId(req);
    const { productId, quantity } = parsed.data;

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const existing = await db
      .select()
      .from(cartItemsTable)
      .where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));

    if (existing.length > 0) {
      await db
        .update(cartItemsTable)
        .set({ quantity: existing[0].quantity + quantity })
        .where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));
    } else {
      await db.insert(cartItemsTable).values({
        sessionId,
        productId,
        quantity,
        priceAtAdd: product.price,
      });
    }

    const cart = await buildCartResponse(sessionId);
    res.json(cart);
  } catch (err) {
    req.log.error({ err }, "Failed to add to cart");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/cart/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const parsed = z.object({ quantity: z.number().int().positive() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const sessionId = getSessionId(req);
    const updated = await db
      .update(cartItemsTable)
      .set({ quantity: parsed.data.quantity })
      .where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "Cart item not found" });
      return;
    }

    const cart = await buildCartResponse(sessionId);
    res.json(cart);
  } catch (err) {
    req.log.error({ err }, "Failed to update cart item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cart/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const sessionId = getSessionId(req);

    await db
      .delete(cartItemsTable)
      .where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));

    const cart = await buildCartResponse(sessionId);
    res.json(cart);
  } catch (err) {
    req.log.error({ err }, "Failed to remove cart item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cart/migrate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    let userId: number;
    try {
      const payload = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId?: number };
      if (!payload.userId) throw new Error("no userId");
      userId = payload.userId;
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const parsed = z.object({ guestSessionId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "guestSessionId required" });
      return;
    }

    const guestId = parsed.data.guestSessionId;
    const userSessionId = `user:${userId}`;

    const guestItems = await db
      .select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.sessionId, guestId));

    if (guestItems.length > 0) {
      for (const item of guestItems) {
        const existing = await db
          .select()
          .from(cartItemsTable)
          .where(and(eq(cartItemsTable.sessionId, userSessionId), eq(cartItemsTable.productId, item.productId)));

        if (existing.length > 0) {
          await db
            .update(cartItemsTable)
            .set({ quantity: existing[0].quantity + item.quantity })
            .where(and(eq(cartItemsTable.sessionId, userSessionId), eq(cartItemsTable.productId, item.productId)));
        } else {
          await db.insert(cartItemsTable).values({
            sessionId: userSessionId,
            productId: item.productId,
            quantity: item.quantity,
            priceAtAdd: item.priceAtAdd,
          });
        }
      }
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, guestId));
    }

    const cart = await buildCartResponse(userSessionId);
    res.json(cart);
  } catch (err) {
    req.log.error({ err }, "Failed to migrate cart");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
