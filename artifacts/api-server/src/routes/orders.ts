import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, orderMessagesTable, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import jwt from "jsonwebtoken";
import {
  sendEmail,
  orderCompletedEmail,
  orderStatusUpdateEmail,
  paymentConfirmedEmail,
  moreInfoNeededEmail,
} from "../lib/email";

const router: IRouter = Router();
const _jwtSecret = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

function getUserFromToken(authHeader: string | undefined): { userId: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number; email: string };
    return decoded;
  } catch {
    return null;
  }
}

// Guest order lookup — email + orderId, no auth required
router.get("/orders/lookup", async (req, res) => {
  try {
    const parsed = z.object({
      email: z.string().email(),
      orderId: z.coerce.number().int().positive(),
    }).safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: "Valid email and orderId are required" });
      return;
    }

    const { email, orderId } = parsed.data;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.id, orderId),
          eq(ordersTable.customerEmail, email.toLowerCase()),
        )
      )
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "No order found matching that email and order ID." });
      return;
    }

    const items = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));

    res.json({ ...order, items });
  } catch (err) {
    req.log.error({ err }, "Failed to lookup order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// My orders — requires Bearer JWT
router.get("/orders/my", async (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.customerEmail, user.email))
      .orderBy(desc(ordersTable.createdAt))
      .limit(50);
    const result = await Promise.all(
      orders.map(async (order) => {
        const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
        return { ...order, items };
      })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get my orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get messages for an order (user must own it or be admin)
router.get("/orders/:id/messages", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const user = getUserFromToken(req.headers.authorization);
    const adminPwd = req.headers["x-admin-password"] as string | undefined;
    const correctPwd = process.env.ADMIN_PASSWORD || "098098pp";

    if (!user && adminPwd !== correctPwd) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (user && adminPwd !== correctPwd) {
      const [order] = await db.select({ customerEmail: ordersTable.customerEmail })
        .from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
      if (!order || order.customerEmail !== user.email) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const messages = await db
      .select()
      .from(orderMessagesTable)
      .where(eq(orderMessagesTable.orderId, orderId))
      .orderBy(orderMessagesTable.createdAt);

    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to get order messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Post a message to an order
router.post("/orders/:id/messages", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const user = getUserFromToken(req.headers.authorization);
    const adminPwd = req.headers["x-admin-password"] as string | undefined;
    const correctPwd = process.env.ADMIN_PASSWORD || "098098pp";
    const isAdmin = adminPwd === correctPwd;

    if (!user && !isAdmin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = z.object({ message: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (!isAdmin && user && order.customerEmail !== user.email) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const senderType = isAdmin ? "admin" : "user";
    const senderEmail = isAdmin ? "admin@gsmworld.com" : (user?.email ?? "user");

    const [msg] = await db.insert(orderMessagesTable).values({
      orderId,
      senderType,
      senderEmail,
      message: parsed.data.message,
    }).returning();

    // When admin sends a message → email the customer "more info needed"
    if (isAdmin && order.customerEmail) {
      sendEmail({
        to: order.customerEmail,
        ...moreInfoNeededEmail({
          orderId,
          customerName: order.customerName,
          message: parsed.data.message,
        }),
      }).catch((err) => req.log.error({ err }, "Failed to send more-info-needed email"));
    }

    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "Failed to post order message");
    res.status(500).json({ error: "Internal server error" });
  }
});

const orderItemInputSchema = z.object({
  productId: z.number().int(),
  productName: z.string(),
  price: z.string(),
  quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
  sessionId: z.string(),
  customerEmail: z.string().email(),
  customerPhone: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  paymentMethod: z.string(),
  paymentStatus: z.string().optional(),
  total: z.string(),
  currency: z.string().optional(),
  notes: z.string().nullable().optional(),
  deviceIdentifier: z.string().nullable().optional(),
  orderType: z.string().optional(),
  items: z.array(orderItemInputSchema).min(1),
});

router.get("/orders", async (req, res) => {
  try {
    const conditions = [];
    if (req.query.session_id) {
      conditions.push(eq(ordersTable.sessionId, String(req.query.session_id)));
    }
    if (req.query.payment_status) {
      conditions.push(eq(ordersTable.paymentStatus, String(req.query.payment_status)));
    }
    const orders = conditions.length
      ? await db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt))
      : await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
    res.json(orders);
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders", async (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { items, ...orderData } = parsed.data;

    if (orderData.paymentMethod === "wallet") {
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
      const amount = parseFloat(orderData.total);
      const [row] = await db.select({ walletBalance: usersTable.walletBalance })
        .from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
      const balance = parseFloat(row?.walletBalance ?? "0");
      if (balance < amount) {
        res.status(402).json({ error: `Insufficient wallet balance. Have ${balance.toFixed(2)}, need ${amount.toFixed(2)}.` });
        return;
      }
      await db.update(usersTable)
        .set({ walletBalance: sql`wallet_balance - ${amount.toFixed(2)}` })
        .where(eq(usersTable.id, user.userId));
      orderData.paymentStatus = "paid";
    }

    const [order] = await db.insert(ordersTable).values(orderData).returning();
    const orderItems = await db
      .insert(orderItemsTable)
      .values(items.map((item) => ({ ...item, orderId: order.id })))
      .returning();
    res.status(201).json({ ...order, items: orderItems });
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    res.json({ ...order, items });
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = z
      .object({
        paymentStatus: z.string().optional(),
        notes: z.string().nullable().optional(),
        customerName: z.string().nullable().optional(),
        customerPhone: z.string().nullable().optional(),
        paidAt: z.string().nullable().optional(),
        deviceIdentifier: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const updateData: Record<string, unknown> = {};
    if (parsed.data.paymentStatus !== undefined) updateData.paymentStatus = parsed.data.paymentStatus;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.customerName !== undefined) updateData.customerName = parsed.data.customerName;
    if (parsed.data.customerPhone !== undefined) updateData.customerPhone = parsed.data.customerPhone;
    if (parsed.data.deviceIdentifier !== undefined) updateData.deviceIdentifier = parsed.data.deviceIdentifier;
    if (parsed.data.paidAt !== undefined) {
      updateData.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : null;
    }
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, id)).returning();
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Send email notification when status is updated
    if (parsed.data.paymentStatus && order.customerEmail) {
      const newStatus = parsed.data.paymentStatus;
      const notesForEmail = typeof parsed.data.notes === "string" ? parsed.data.notes : order.notes;

      if (newStatus === "completed") {
        const items = await db
          .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, id));
        sendEmail({
          to: order.customerEmail,
          ...orderCompletedEmail({ orderId: id, customerName: order.customerName, items, total: order.total, notes: notesForEmail }),
        }).catch((err) => req.log.error({ err }, "Failed to send order completed email"));
      } else if (newStatus === "paid") {
        sendEmail({
          to: order.customerEmail,
          ...paymentConfirmedEmail({
            orderId: id,
            customerName: order.customerName,
            amount: order.total,
            paymentMethod: order.paymentMethod,
          }),
        }).catch((err) => req.log.error({ err }, "Failed to send payment confirmed email"));
      } else if (["processing", "failed", "refunded", "pending_payment_confirmation"].includes(newStatus)) {
        sendEmail({
          to: order.customerEmail,
          ...orderStatusUpdateEmail({ orderId: id, customerName: order.customerName, status: newStatus, notes: notesForEmail }),
        }).catch((err) => req.log.error({ err }, "Failed to send status update email"));
      }
    }

    res.json(order);
  } catch (err) {
    req.log.error({ err }, 'Failed to update order');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
