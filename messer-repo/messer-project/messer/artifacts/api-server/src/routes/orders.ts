import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, orderMessagesTable, usersTable, notificationsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import jwt from "jsonwebtoken";
import {
  sendEmail,
  orderCompletedEmail,
  orderStatusUpdateEmail,
  paymentConfirmedEmail,
  moreInfoNeededEmail,
  orderSubmittedEmail,
} from "../lib/email";
import { getAdminPassword } from "../lib/admin-settings";

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
    const correctPwd = await getAdminPassword();

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
    const correctPwd = await getAdminPassword();
    const isAdmin = adminPwd === correctPwd;

    if (!user && !isAdmin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = z.object({
      message: z.string().max(2000).optional().default(""),
      fileUrl: z.string().url().optional().nullable(),
    }).refine(d => (d.message && d.message.trim().length > 0) || d.fileUrl, {
      message: "Either a message or a file attachment is required",
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Message or file attachment is required" });
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
    const messageText = parsed.data.message?.trim() || (parsed.data.fileUrl ? "[File attachment]" : "");

    const [msg] = await db.insert(orderMessagesTable).values({
      orderId,
      senderType,
      senderEmail,
      message: messageText,
      fileUrl: parsed.data.fileUrl ?? null,
    }).returning();

    // When admin sends a message → email + in-app notification for the customer
    if (isAdmin && order.customerEmail) {
      sendEmail({
        to: order.customerEmail,
        ...moreInfoNeededEmail({
          orderId,
          customerName: order.customerName,
          message: parsed.data.message,
        }),
      }).catch((err) => req.log.error({ err }, "Failed to send more-info-needed email"));

      db.insert(notificationsTable).values({
        userEmail: order.customerEmail,
        title: `Order #${orderId} — Action Required`,
        message: parsed.data.message.length > 120 ? parsed.data.message.slice(0, 120) + "…" : parsed.data.message,
        type: "warning",
        orderId,
        read: false,
      }).catch((err) => req.log.error({ err }, "Failed to insert notification"));
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

    const firstItem = orderItems[0] as { productName: string } | undefined;
    const itemLabel = firstItem
      ? `${firstItem.productName}${orderItems.length > 1 ? ` +${orderItems.length - 1} more` : ""}`
      : "items";

    // Send email BEFORE responding — Vercel terminates the Lambda as soon as res is sent
    await sendEmail({
      to: order.customerEmail,
      ...orderSubmittedEmail({
        orderId: order.id,
        customerName: order.customerName,
        items: orderItems.map((i) => ({ productName: i.productName, quantity: i.quantity, price: i.price })),
        total: order.total,
        paymentMethod: order.paymentMethod,
      }),
    }).catch((err) => req.log.error({ err }, "Failed to send order confirmation email"));

    // Fire-and-forget DB write is fine (non-critical)
    db.insert(notificationsTable).values({
      userEmail: order.customerEmail,
      title: `Order #${order.id} Received`,
      message: `Your order for ${itemLabel} has been received and is under review.`,
      type: "success",
      orderId: order.id,
      read: false,
    }).catch((err) => req.log.error({ err }, "Failed to insert order notification"));

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

    // Send email + in-app notification when status is updated
    if (parsed.data.paymentStatus && order.customerEmail) {
      const newStatus = parsed.data.paymentStatus;
      const notesForEmail = typeof parsed.data.notes === "string" ? parsed.data.notes : order.notes;

      const statusNotifMap: Record<string, { title: string; message: string; type: string }> = {
        completed:   { title: `Order #${id} Completed`, message: "Your order has been completed. Check your email for details.", type: "success" },
        paid:        { title: `Payment Confirmed — Order #${id}`, message: "Your payment has been verified and your order is being processed.", type: "success" },
        active:      { title: `Order #${id} Active`, message: "Your order is now active and being worked on.", type: "success" },
        processing:  { title: `Order #${id} In Progress`, message: "Your order is now being actively processed.", type: "info" },
        paused:      { title: `Order #${id} Paused`, message: "Your order has been temporarily paused. We will update you shortly.", type: "warning" },
        closed:      { title: `Order #${id} Closed`, message: "Your order has been closed.", type: "info" },
        failed:      { title: `Order #${id} Failed`, message: "Unfortunately your order could not be completed. Contact support for help.", type: "error" },
        refunded:    { title: `Order #${id} Refunded`, message: "A refund has been issued for your order.", type: "info" },
        pending_payment_confirmation: { title: `Order #${id} — Payment Pending`, message: "We are awaiting payment verification for your order.", type: "warning" },
        cancelled:   { title: `Order #${id} Cancelled`, message: "Your order has been cancelled. Contact support if you have questions.", type: "error" },
      };

      const notifData = statusNotifMap[newStatus];
      if (notifData) {
        db.insert(notificationsTable).values({
          userEmail: order.customerEmail,
          title: notifData.title,
          message: notifData.message,
          type: notifData.type,
          orderId: id,
          read: false,
        }).catch((err) => req.log.error({ err }, "Failed to insert status notification"));
      }

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
      } else if (["processing", "active", "paused", "closed", "failed", "refunded", "pending_payment_confirmation", "cancelled"].includes(newStatus)) {
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

// Cancel order within 30 minutes (customer self-service)
router.post("/orders/:id/cancel", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid order id" }); return; }

  const user = getUserFromToken(req.headers.authorization);

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    // Must be the order owner (logged-in match by userId OR email, or guest — verified by email in query param)
    if (user) {
      const emailMatch = order.customerEmail.toLowerCase() === user.email.toLowerCase();
      const userIdMatch = order.userId != null && order.userId === user.userId;
      if (!emailMatch && !userIdMatch) { res.status(403).json({ error: "Access denied" }); return; }
    } else {
      const email = (req.query.email as string | undefined)?.toLowerCase();
      if (!email || order.customerEmail.toLowerCase() !== email) {
        res.status(403).json({ error: "Access denied" }); return;
      }
    }

    // Only cancellable if still pending
    if (!["pending", "pending_payment_confirmation"].includes(order.paymentStatus)) {
      res.status(400).json({ error: "Order cannot be cancelled at this stage" }); return;
    }

    // Must be within 30 minutes of creation
    const ageMs = Date.now() - new Date(order.createdAt).getTime();
    if (ageMs > 30 * 60 * 1000) {
      res.status(400).json({ error: "Cancellation window has expired (30 minutes)" }); return;
    }

    const [updated] = await db
      .update(ordersTable)
      .set({ paymentStatus: "cancelled", updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();

    // Insert in-app notification
    if (order.customerEmail) {
      await db.insert(notificationsTable).values({
        userEmail: order.customerEmail,
        title: "Order Cancelled",
        message: `Your order #${id} has been cancelled as requested.`,
        type: "info",
        orderId: id,
        read: false,
      }).catch((err: unknown) => req.log.error({ err }, "Failed to insert cancel notification"));
    }

    // Send email
    sendEmail({
      to: order.customerEmail,
      ...orderStatusUpdateEmail({ orderId: id, customerName: order.customerName, status: "cancelled", notes: "You cancelled this order within the 30-minute window." }),
    }).catch((err) => req.log.error({ err }, "Failed to send cancel email"));

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

