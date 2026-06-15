import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
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
  giftCardDeliveryEmail,
  appUrl,
} from "../lib/email";
import { checkAdminPassword, getBinancePayId, getUsdtManualAddress, getUsdtManualNetwork } from "../lib/admin-settings";
import { initiateSTKPush } from "../lib/mpesa";
import { notifyOrderUpdate } from "../lib/ws";
import { randomBytes } from "node:crypto";

function generateGiftCardCode(): string {
  return randomBytes(8).toString("hex").toUpperCase().replace(/(.{4})/g, "$1-").slice(0, 19);
}

function isGiftCardItem(productName: string): boolean {
  const n = productName.toLowerCase();
  return n.includes("gift card") || n.includes("steam") || n.includes("google play") ||
    n.includes("itunes") || n.includes("amazon gift") || n.includes("netflix") ||
    n.includes("playstation") || n.includes("xbox") || n.includes("razer gold") ||
    n.includes("apple gift") || n.includes("ebay gift") || n.includes("gift voucher");
}

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

// ── Public payment configuration (binance Pay ID, USDT address) ────────────
router.get("/payment-config", async (req, res) => {
  try {
    const [binancePayId, usdtAddress, usdtNetwork] = await Promise.all([
      getBinancePayId(),
      getUsdtManualAddress(),
      getUsdtManualNetwork(),
    ]);
    res.json({ binancePayId, usdtAddress, usdtNetwork });
  } catch (err) {
    req.log.error({ err }, "payment-config error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    // Match by userId OR customerEmail (handles guest orders & mixed-case email)
    const orders = await db
      .select()
      .from(ordersTable)
      .where(
        or(
          eq(ordersTable.userId, user.userId),
          eq(ordersTable.customerEmail, user.email.toLowerCase()),
        )
      )
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
    const isAdmin = adminPwd ? await checkAdminPassword(adminPwd) : false;

    if (!user && !isAdmin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (user && !isAdmin) {
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
    const isAdmin = adminPwd ? await checkAdminPassword(adminPwd) : false;

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
          customerEmail: order.customerEmail,
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

    // Push new message live to the order's WS subscribers
    notifyOrderUpdate(orderId, { type: "new_message", message: msg });

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
    const user = getUserFromToken(req.headers.authorization);
    const adminPwd =
      (req.headers["x-admin-password"] as string | undefined) ||
      (req.query.adminPassword as string | undefined);
    const isAdmin = adminPwd ? await checkAdminPassword(adminPwd) : false;

    const conditions = [];

    // session_id filter: usable by anyone (random UUID — acts as a capability token for guest sessions)
    if (req.query.session_id) {
      conditions.push(eq(ordersTable.sessionId, String(req.query.session_id)));
    }

    // payment_status filter: admin-only (exposes order volumes / business data)
    if (req.query.payment_status) {
      if (!isAdmin) {
        res.status(401).json({ error: "Admin authentication required to filter by payment_status" });
        return;
      }
      conditions.push(eq(ordersTable.paymentStatus, String(req.query.payment_status)));
    }

    // customerEmail filter: require JWT whose email matches, or admin
    if (req.query.customerEmail) {
      const requestedEmail = String(req.query.customerEmail).toLowerCase();
      if (!isAdmin) {
        if (!user) {
          res.status(401).json({ error: "Authentication required to filter by customerEmail" });
          return;
        }
        if (user.email.toLowerCase() !== requestedEmail) {
          res.status(403).json({ error: "Access denied: email does not match authenticated user" });
          return;
        }
      }
      conditions.push(eq(ordersTable.customerEmail, requestedEmail));
    }

    // resellerSlug filter: admin-only
    if (req.query.resellerSlug) {
      if (!isAdmin) {
        res.status(401).json({ error: "Admin authentication required to filter by resellerSlug" });
        return;
      }
      conditions.push(eq(ordersTable.resellerSlug, String(req.query.resellerSlug)));
    }

    if (conditions.length === 0) {
      // Unfiltered dump of all orders requires admin authentication.
      if (!isAdmin) {
        res.status(400).json({ error: "At least one filter parameter is required (session_id, customerEmail, payment_status, resellerSlug)" });
        return;
      }
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
    orderData.customerEmail = orderData.customerEmail.toLowerCase();

    if (orderData.paymentMethod === "wallet") {
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
      const amount = parseFloat(orderData.total);
      // Atomic deduction: only deduct if wallet_balance >= amount (prevents race conditions)
      const deducted = await db.update(usersTable)
        .set({ walletBalance: sql`wallet_balance - ${amount.toFixed(2)}` })
        .where(and(eq(usersTable.id, user.userId), sql`wallet_balance >= ${amount.toFixed(2)}`))
        .returning({ id: usersTable.id });
      if (deducted.length === 0) {
        // Fetch balance to return an informative error message
        const [row] = await db.select({ walletBalance: usersTable.walletBalance })
          .from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
        const balance = parseFloat(row?.walletBalance ?? "0");
        res.status(402).json({ error: `Insufficient wallet balance. Have ${balance.toFixed(2)}, need ${amount.toFixed(2)}.` });
        return;
      }
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
        customerEmail: order.customerEmail,
        items: orderItems.map((i) => ({ productName: i.productName, quantity: i.quantity, price: i.price })),
        total: order.total,
        paymentMethod: order.paymentMethod,
      }),
    }).catch((err) => req.log.error({ err }, "Failed to send order confirmation email"));

    // For wallet orders (immediately paid), auto-send gift card codes right away
    if (order.paymentStatus === "paid" && orderData.paymentMethod === "wallet") {
      const giftCardItems = orderItems.filter(i => isGiftCardItem(i.productName));
      if (giftCardItems.length > 0) {
        const orderUrl = appUrl(`/orders/${order.id}`);
        for (const item of giftCardItems) {
          const qty = item.quantity ?? 1;
          for (let q = 0; q < qty; q++) {
            const code = generateGiftCardCode();
            const denomination = `$${parseFloat(item.price).toFixed(2)}`;
            sendEmail({
              to: order.customerEmail,
              ...giftCardDeliveryEmail({
                orderId: order.id,
                customerName: order.customerName,
                productName: item.productName,
                giftCardCode: code,
                denomination,
                orderUrl,
              }),
            }).catch((err) => req.log.error({ err }, "Failed to send wallet gift card email"));
          }
        }
      }
    }

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
    const user = getUserFromToken(req.headers.authorization);
    const adminPwd =
      (req.headers["x-admin-password"] as string | undefined) ||
      (req.query.adminPassword as string | undefined);
    const isAdmin = adminPwd ? await checkAdminPassword(adminPwd) : false;
    // Guest access: allow if ?email= matches customerEmail (same pattern as /orders/cancel)
    const emailParam = (req.query.email as string | undefined)?.toLowerCase().trim();

    if (!user && !isAdmin && !emailParam) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (!isAdmin) {
      if (user) {
        const emailMatch = order.customerEmail.toLowerCase() === user.email.toLowerCase();
        const userIdMatch = order.userId != null && order.userId === user.userId;
        if (!emailMatch && !userIdMatch) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      } else if (emailParam) {
        if (order.customerEmail.toLowerCase() !== emailParam) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      }
    }

    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    res.json({ ...order, items });
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/orders/:id", async (req, res) => {
  // Require admin password — this endpoint can change paymentStatus and trigger emails.
  const adminPassword =
    (req.headers["x-admin-password"] as string | undefined) ||
    (req.body as Record<string, unknown>)?.adminPassword as string | undefined;
  if (!adminPassword) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  if (!(await checkAdminPassword(adminPassword))) {
    res.status(403).json({ error: "Invalid admin password" });
    return;
  }
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

    // Push real-time status update to any connected WS clients
    if (parsed.data.paymentStatus) {
      notifyOrderUpdate(id, { type: "status_update", paymentStatus: parsed.data.paymentStatus });
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
        rejected:    { title: `Order #${id} Rejected`, message: "Unfortunately your order has been rejected. Please contact support for more information.", type: "error" },
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
          ...orderCompletedEmail({ orderId: id, customerName: order.customerName, customerEmail: order.customerEmail, items, total: order.total, notes: notesForEmail }),
        }).catch((err) => req.log.error({ err }, "Failed to send order completed email"));
      } else if (newStatus === "paid") {
        sendEmail({
          to: order.customerEmail,
          ...paymentConfirmedEmail({
            orderId: id,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            amount: order.total,
            paymentMethod: order.paymentMethod,
          }),
        }).catch((err) => req.log.error({ err }, "Failed to send payment confirmed email"));

        // Auto-generate and email gift card codes within 3 minutes
        const giftItems = await db
          .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, id));
        const giftCardItems = giftItems.filter(i => isGiftCardItem(i.productName));
        if (giftCardItems.length > 0) {
          const orderUrl = appUrl(`/orders/${id}`);
          for (const item of giftCardItems) {
            const qty = item.quantity ?? 1;
            for (let q = 0; q < qty; q++) {
              const code = generateGiftCardCode();
              const denomination = `$${parseFloat(item.price).toFixed(2)}`;
              sendEmail({
                to: order.customerEmail,
                ...giftCardDeliveryEmail({
                  orderId: id,
                  customerName: order.customerName,
                  productName: item.productName,
                  giftCardCode: code,
                  denomination,
                  orderUrl,
                }),
              }).catch((err) => req.log.error({ err }, "Failed to send gift card email"));
            }
          }
        }
      } else if (["processing", "active", "paused", "closed", "failed", "refunded", "pending_payment_confirmation", "cancelled", "rejected"].includes(newStatus)) {
        sendEmail({
          to: order.customerEmail,
          ...orderStatusUpdateEmail({ orderId: id, customerName: order.customerName, customerEmail: order.customerEmail, status: newStatus, notes: notesForEmail }),
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
      ...orderStatusUpdateEmail({ orderId: id, customerName: order.customerName, customerEmail: order.customerEmail, status: "cancelled", notes: "You cancelled this order within the 30-minute window." }),
    }).catch((err) => req.log.error({ err }, "Failed to send cancel email"));

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Pay pending order from wallet ─────────────────────────────────────────────
router.post("/orders/:id/pay-wallet", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid order id" }); return; }
  const user = getUserFromToken(req.headers.authorization);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    const emailMatch = order.customerEmail && order.customerEmail.toLowerCase() === user.email.toLowerCase();
    if (order.userId !== user.userId && !emailMatch) { res.status(403).json({ error: "Access denied" }); return; }
    if (order.paymentStatus !== "pending") { res.status(400).json({ error: "Order is not awaiting payment" }); return; }
    if (order.paymentMethod !== "wallet") { res.status(400).json({ error: "This order does not use wallet payment" }); return; }

    const total = parseFloat(order.total);
    // Atomic deduction: only update if wallet_balance >= total (prevents double-spend race)
    const deducted = await db.update(usersTable)
      .set({ walletBalance: sql`wallet_balance - ${total.toFixed(2)}` })
      .where(and(eq(usersTable.id, user.userId), sql`wallet_balance >= ${total.toFixed(2)}`))
      .returning({ id: usersTable.id });
    if (deducted.length === 0) {
      const [userRow] = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
      const bal = parseFloat(userRow?.walletBalance ?? "0");
      res.status(400).json({ error: `Insufficient wallet balance ($${bal.toFixed(2)}). Need $${total.toFixed(2)}` });
      return;
    }

    const [updated] = await db.update(ordersTable)
      .set({ paymentStatus: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();

    sendEmail({
      to: user.email,
      ...paymentConfirmedEmail({ orderId: id, orderCode: order.orderCode, customerName: order.customerName, customerEmail: user.email, amount: order.total, paymentMethod: "wallet" }),
    }).catch(() => {});

    res.json({ success: true, message: "Payment successful!", order: updated });
  } catch (err) {
    req.log.error({ err }, "pay-wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Generate NOWPayments address for existing pending order ──────────────────
router.post("/orders/:id/nowpayments/generate", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid order id" }); return; }
  const user = getUserFromToken(req.headers.authorization);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    const emailMatch = order.customerEmail && order.customerEmail.toLowerCase() === user.email.toLowerCase();
    if (order.userId !== user.userId && !emailMatch) { res.status(403).json({ error: "Access denied" }); return; }
    if (order.paymentStatus !== "pending") { res.status(400).json({ error: "Order is not awaiting payment" }); return; }

    const { createPayment } = await import("../lib/nowpayments");
    const payment = await createPayment({
      priceAmount: parseFloat(order.total),
      priceCurrency: "usd",
      payCurrency: "usdttrc20",
      orderId: id,
      orderDescription: `Order #${order.orderCode || id}`,
    });
    res.json({
      payAddress: payment.pay_address,
      payAmount: payment.pay_amount,
      payCurrency: payment.pay_currency,
      paymentId: payment.payment_id,
    });
  } catch (err) {
    req.log.error({ err }, "nowpayments generate error");
    res.status(500).json({ error: "Failed to generate payment address" });
  }
});

// ── Trigger M-Pesa STK push for an existing pending order ─────────────────
router.post("/orders/:id/mpesa/trigger", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid order id" }); return; }
  const user = getUserFromToken(req.headers.authorization);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  const { phone } = req.body || {};
  if (!phone) { res.status(400).json({ error: "phone is required" }); return; }
  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    const userIdMatch = order.userId != null && order.userId === user.userId;
    const emailMatch = order.customerEmail.toLowerCase() === user.email.toLowerCase();
    if (!userIdMatch && !emailMatch) { res.status(403).json({ error: "Access denied" }); return; }
    if (order.paymentStatus !== "pending") { res.status(400).json({ error: "Order is not awaiting payment" }); return; }
    const amountKes = Math.ceil(parseFloat(order.total));
    const stk = await initiateSTKPush({
      phone: String(phone),
      amount: amountKes,
      orderId: id,
      description: `Order #${order.orderCode || id}`,
    });
    res.json({ success: true, checkoutRequestId: stk.CheckoutRequestID, message: `STK push sent. Enter your M-Pesa PIN.` });
  } catch (err) {
    req.log.error({ err }, "mpesa order trigger error");
    res.status(500).json({ error: "Failed to initiate M-Pesa payment" });
  }
});

export default router;

