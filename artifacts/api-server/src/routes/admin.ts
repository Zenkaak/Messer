import { Router, type IRouter } from "express";
import { eq, and, sql, count, sum, ilike, or, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import {
  db,
  adminSettingsTable,
  toolActivationsTable,
  insertToolActivationSchema,
  usersTable,
  ordersTable,
  orderItemsTable,
  orderMessagesTable,
  notificationsTable,
  imeiLookupsTable,
  walletTransactionsTable,
  liveChatSessionsTable,
  liveChatMessagesTable,
} from "@workspace/db";
import { productsTable, categoriesTable, resellerApplicationsTable, resellerWithdrawalsTable } from "@workspace/db";
import { z } from "zod";
import { getAllSettings, updateSettings, getAdminPassword, hasAdminPasswordBeenSet, getOpenAiKey, getOpenAiBaseUrl, getWorkingCascade, setWorkingCascade, getCascadeStatus } from "../lib/admin-settings";
import {
  sendEmail,
  otpEmail,
  loginNotificationEmail,
  orderSubmittedEmail,
  paymentConfirmedEmail,
  orderStatusUpdateEmail,
  moreInfoNeededEmail,
  orderCompletedEmail,
  pendingManualPaymentEmail,
  announcementEmail,
  appUrl,
} from "../lib/email";

const router: IRouter = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      // Still run timingSafeEqual against equal-length buffers to avoid
      // leaking length information via timing, then return false.
      timingSafeEqual(ba, ba);
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function checkAdminAuth(req: import("express").Request, res: import("express").Response): Promise<boolean> {
  const pwd = req.headers["x-admin-password"] as string | undefined;
  const correct = await getAdminPassword();
  if (!pwd || !safeEqual(pwd, correct)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ─── rate limiter for admin login ─────────────────────────────────────────────
// In-memory store: IP → { attempts, resetAt }
const adminLoginAttempts = new Map<string, { attempts: number; resetAt: number }>();
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkAdminLoginRateLimit(ip: string): { blocked: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = adminLoginAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    adminLoginAttempts.set(ip, { attempts: 0, resetAt: now + ADMIN_LOGIN_WINDOW_MS });
    return { blocked: false };
  }
  if (entry.attempts >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    return { blocked: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { blocked: false };
}

function recordAdminLoginAttempt(ip: string) {
  const now = Date.now();
  const entry = adminLoginAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    adminLoginAttempts.set(ip, { attempts: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS });
  } else {
    entry.attempts += 1;
  }
}

function clearAdminLoginAttempts(ip: string) {
  adminLoginAttempts.delete(ip);
}

// ─── auth ──────────────────────────────────────────────────────────────────────
router.post("/admin/login", async (req, res) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const rateLimit = checkAdminLoginRateLimit(ip);
  if (rateLimit.blocked) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSec));
    res.status(429).json({
      error: `Too many login attempts. Please try again in ${Math.ceil((rateLimit.retryAfterSec ?? 900) / 60)} minute(s).`,
    });
    return;
  }

  try {
    const { password } = req.body ?? {};
    if (!password) {
      res.status(400).json({ error: "Password required" });
      return;
    }
    const correct = await getAdminPassword();
    if (!safeEqual(String(password), correct)) {
      recordAdminLoginAttempt(ip);
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    clearAdminLoginAttempts(ip);
    const isDefaultPassword = !(await hasAdminPasswordBeenSet());
    res.json({ ok: true, isDefaultPassword });
  } catch (err) {
    req.log.error({ err }, "Admin login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/change-password", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const { newPassword } = req.body ?? {};
    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    await db
      .insert(adminSettingsTable)
      .values({ key: "admin_password", value: String(newPassword) })
      .onConflictDoUpdate({
        target: adminSettingsTable.key,
        set: { value: String(newPassword), updatedAt: new Date() },
      });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin change-password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/settings", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const settings = await getAllSettings();
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Failed to get admin settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/settings", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const parsed = z.object({ key: z.string(), value: z.string().nullable().optional() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [setting] = await db
      .insert(adminSettingsTable)
      .values({ key: parsed.data.key, value: parsed.data.value ?? null })
      .onConflictDoUpdate({
        target: adminSettingsTable.key,
        set: { value: parsed.data.value ?? null, updatedAt: new Date() },
      })
      .returning();
    res.json(setting);
  } catch (err) {
    req.log.error({ err }, "Failed to upsert admin setting");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/settings/all", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const settings = await getAllSettings();
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Failed to get all admin settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/settings/update", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const updated = await updateSettings(req.body || {});
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update admin settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/settings", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const updated = await updateSettings(req.body || {});
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update admin settings (PUT)");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/stats", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const [orderStats] = await db.select({ total: count() }).from(ordersTable);
    const [paidStats] = await db
      .select({ count: count(), revenue: sum(ordersTable.total) })
      .from(ordersTable)
      .where(eq(ordersTable.paymentStatus, "paid"));
    const [pendingStats] = await db
      .select({ count: count() })
      .from(ordersTable)
      .where(eq(ordersTable.paymentStatus, "pending"));
    const [failedStats] = await db
      .select({ count: count() })
      .from(ordersTable)
      .where(eq(ordersTable.paymentStatus, "failed"));
    const [userCount] = await db.select({ total: count() }).from(usersTable);
    const [productCount] = await db.select({ total: count() }).from(productsTable);
    const recentOrders = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt))
      .limit(5);
    res.json({
      orders: { total: orderStats.total },
      paidOrders: {
        count: paidStats.count,
        revenue: parseFloat(String(paidStats.revenue ?? "0")),
      },
      pendingOrders: { count: pendingStats.count },
      failedOrders: { count: failedStats.count },
      users: userCount.total,
      products: productCount.total,
      recentOrders,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/users", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const search = req.query.search as string | undefined;

    const baseSelect = {
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      username: usersTable.username,
      walletBalance: usersTable.walletBalance,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
      registrationIp: usersTable.registrationIp,
    };

    let users;
    if (search) {
      const pattern = `%${search}%`;
      users = await db
        .select(baseSelect)
        .from(usersTable)
        .where(or(ilike(usersTable.email, pattern), ilike(usersTable.name, pattern)))
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      users = await db
        .select(baseSelect)
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset);
    }

    const [{ total }] = await db.select({ total: count() }).from(usersTable);
    res.json({ users, total });
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const id = Number(req.params.id);
    const parsed = z
      .object({
        status: z.string().optional(),
        name: z.string().nullable().optional(),
        walletBalance: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set(parsed.data)
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        walletBalance: usersTable.walletBalance,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
      });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/users/:id", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const id = Number(req.params.id);
    if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

    // Fetch email first (needed for notifications cleanup).
    const [userRow] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!userRow) { res.status(404).json({ error: "User not found" }); return; }

    // Delete in FK-safe order so Postgres never rejects the final user delete.
    // 1. Reseller withdrawals → reseller applications → then the user row.
    const resellerApps = await db
      .select({ id: resellerApplicationsTable.id })
      .from(resellerApplicationsTable)
      .where(eq(resellerApplicationsTable.userId, id));
    for (const app of resellerApps) {
      await db.delete(resellerWithdrawalsTable)
        .where(eq(resellerWithdrawalsTable.resellerId, app.id));
    }
    await db.delete(resellerApplicationsTable).where(eq(resellerApplicationsTable.userId, id));

    // 2. Wallet transactions (FK → usersTable.id)
    await db.delete(walletTransactionsTable).where(eq(walletTransactionsTable.userId, id));

    // 3. Tool activations (FK → usersTable.id)
    await db.delete(toolActivationsTable).where(eq(toolActivationsTable.userId, id));

    // 4. Notifications (keyed by email — no FK but cleanup)
    await db.delete(notificationsTable).where(eq(notificationsTable.userEmail, userRow.email));

    // 5. Finally delete the user.
    await db.delete(usersTable).where(eq(usersTable.id, id));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Delete failed. The account may have linked data that could not be removed." });
  }
});

router.post("/admin/users", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
      walletBalance: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, parsed.data.email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [user] = await db.insert(usersTable).values({
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      name: parsed.data.name || null,
      walletBalance: parsed.data.walletBalance ?? "0",
      status: "active",
    }).returning({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      walletBalance: usersTable.walletBalance,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    });
    res.status(201).json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to create user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── admin direct chat with user ─────────────────────────────────────────────

// GET — fetch chat history between admin and a specific user
router.get("/admin/users/:id/messages", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const userId = Number(req.params.id);
    const visitorId = `direct:${userId}`;

    const sessions = await db.select({ id: liveChatSessionsTable.id })
      .from(liveChatSessionsTable)
      .where(eq(liveChatSessionsTable.visitorId, visitorId))
      .limit(1);

    if (!sessions.length) {
      res.json({ messages: [] });
      return;
    }

    const messages = await db.select()
      .from(liveChatMessagesTable)
      .where(eq(liveChatMessagesTable.sessionId, sessions[0].id))
      .orderBy(liveChatMessagesTable.createdAt);

    res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "Failed to get user messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST — admin sends message to user; stores in live-chat, notifies in-app + email
router.post("/admin/users/:id/message", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const userId = Number(req.params.id);
    const parsed = z.object({
      message: z.string().min(1),
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const visitorId = `direct:${userId}`;

    // Find or create a direct-message session for this user
    let sessionRows = await db.select()
      .from(liveChatSessionsTable)
      .where(eq(liveChatSessionsTable.visitorId, visitorId))
      .limit(1);

    let session = sessionRows[0];
    if (!session) {
      [session] = await db.insert(liveChatSessionsTable).values({
        visitorId,
        visitorName: user.name || user.email,
        visitorEmail: user.email,
        status: "active",
        lastMessage: parsed.data.message,
      }).returning();
    }

    // Insert admin message
    const [msg] = await db.insert(liveChatMessagesTable).values({
      sessionId: session.id,
      senderType: "admin",
      message: parsed.data.message,
    }).returning();

    // Update session last-message + timestamp
    await db.update(liveChatSessionsTable)
      .set({ lastMessage: parsed.data.message, updatedAt: new Date() })
      .where(eq(liveChatSessionsTable.id, session.id));

    // In-app notification for user
    await db.insert(notificationsTable).values({
      userEmail: user.email,
      title: "Message from GSM World Support",
      message: parsed.data.message.length > 100
        ? parsed.data.message.slice(0, 100) + "…"
        : parsed.data.message,
      type: "info",
    });

    // Email notification (fire-and-forget)
    import("../lib/email").then(({ sendEmail, adminDirectMessageEmail }) => {
      sendEmail({
        to: user.email,
        ...adminDirectMessageEmail({ customerName: user.name, message: parsed.data.message }),
      }).catch(() => {});
    }).catch(() => {});

    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "Failed to send direct message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/users/:id/wallet", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const id = Number(req.params.id);
    const parsed = z
      .object({
        action: z.enum(["add", "deduct"]),
        amount: z.number().positive(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { action, amount } = parsed.data;

    const userRows = await db
      .select({ walletBalance: usersTable.walletBalance })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!userRows.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (action === "deduct") {
      const current = parseFloat(userRows[0].walletBalance ?? "0");
      if (current < amount) {
        res.status(400).json({
          error: `Insufficient balance. User has $${current.toFixed(2)}, cannot deduct $${amount.toFixed(2)}.`,
        });
        return;
      }
    }

    const delta = action === "add" ? amount : -amount;
    const [updated] = await db
      .update(usersTable)
      .set({ walletBalance: sql`wallet_balance + ${delta.toFixed(2)}` })
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        walletBalance: usersTable.walletBalance,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
      });

    res.json({ success: true, action, amount, walletBalance: updated.walletBalance, user: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── orders (paginated, with items) ──────────────────────────────────────────
router.get("/admin/orders", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const status = req.query.status as string | undefined;
    const orderType = req.query.orderType as string | undefined;

    const conditions = [];
    if (status) conditions.push(eq(ordersTable.paymentStatus, status));
    if (orderType) conditions.push(eq(ordersTable.orderType, orderType));

    const baseOrders = await db
      .select().from(ordersTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit).offset(offset);

    const [{ total }] = await db
      .select({ total: count() }).from(ordersTable)
      .where(conditions.length ? and(...conditions) : undefined);
    res.json({ orders: baseOrders, total });
  } catch (err) {
    req.log.error({ err }, "Failed to list admin orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── single order with items (admin) ─────────────────────────────────────────
router.get("/admin/orders/:id", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const id = Number(req.params.id);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    const messages = await db.select().from(orderMessagesTable).where(eq(orderMessagesTable.orderId, id)).orderBy(orderMessagesTable.createdAt);
    res.json({ ...order, items, messages });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/orders/:id", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const id = Number(req.params.id);
    const parsed = z
      .object({
        paymentStatus: z.string().optional(),
        notes: z.string().nullable().optional(),
        paidAt: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const updateData: Record<string, unknown> = {};
    if (parsed.data.paymentStatus !== undefined) {
      updateData.paymentStatus = parsed.data.paymentStatus;
      if (parsed.data.paymentStatus === "paid") updateData.paidAt = new Date();
    }
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
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

    // Send email BEFORE responding — Vercel terminates the Lambda as soon as res is sent
    if (parsed.data.paymentStatus && order.customerEmail) {
      const newStatus = parsed.data.paymentStatus;
      const notesForEmail = typeof parsed.data.notes === "string" ? parsed.data.notes : order.notes;

      const statusNotifMap: Record<string, { title: string; message: string; type: string }> = {
        completed:   { title: `Order #${id} Completed`, message: "Your order has been completed. Check your email for details.", type: "success" },
        paid:        { title: `Payment Confirmed — Order #${id}`, message: "Your payment has been verified and your order is being processed.", type: "success" },
        processing:  { title: `Order #${id} In Progress`, message: "Your order is now being actively processed.", type: "info" },
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
        }).catch((err) => req.log.error({ err }, "Failed to insert admin status notification"));
      }

      if (newStatus === "completed") {
        const items = await db
          .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, id));
        await sendEmail({
          to: order.customerEmail,
          ...orderCompletedEmail({ orderId: id, customerName: order.customerName, items, total: order.total, notes: notesForEmail }),
        }).catch((err) => req.log.error({ err }, "Failed to send admin order completed email"));
      } else if (newStatus === "paid") {
        const paidItems = await db
          .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, id));
        await sendEmail({
          to: order.customerEmail,
          ...paymentConfirmedEmail({
            orderId: id,
            customerName: order.customerName,
            amount: order.total,
            paymentMethod: order.paymentMethod,
            items: paidItems,
          }),
        }).catch((err) => req.log.error({ err }, "Failed to send admin payment confirmed email"));
      } else if (["processing", "failed", "refunded", "pending_payment_confirmation", "cancelled"].includes(newStatus)) {
        await sendEmail({
          to: order.customerEmail,
          ...orderStatusUpdateEmail({ orderId: id, customerName: order.customerName, status: newStatus, notes: notesForEmail }),
        }).catch((err) => req.log.error({ err }, "Failed to send admin status update email"));
      }
    }

    res.json(order);
  } catch (err) {
    req.log.error({ err }, "Failed to update admin order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/tool-activations", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const conditions = [];
    if (req.query.status) {
      conditions.push(eq(toolActivationsTable.status, String(req.query.status)));
    }
    if (req.query.user_id) {
      conditions.push(eq(toolActivationsTable.userId, Number(req.query.user_id)));
    }
    const activations = conditions.length
      ? await db.select().from(toolActivationsTable).where(and(...conditions)).orderBy(desc(toolActivationsTable.createdAt))
      : await db.select().from(toolActivationsTable).orderBy(desc(toolActivationsTable.createdAt));
    res.json(activations);
  } catch (err) {
    req.log.error({ err }, "Failed to list tool activations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/tool-activations", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const parsed = insertToolActivationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [activation] = await db.insert(toolActivationsTable).values(parsed.data).returning();
    res.status(201).json(activation);
  } catch (err) {
    req.log.error({ err }, "Failed to create tool activation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/tool-activations/:id", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const id = Number(req.params.id);
    const parsed = z
      .object({
        status: z.string().optional(),
        activationCode: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [activation] = await db
      .update(toolActivationsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(toolActivationsTable.id, id))
      .returning();
    if (!activation) {
      res.status(404).json({ error: "Tool activation not found" });
      return;
    }
    res.json(activation);
  } catch (err) {
    req.log.error({ err }, "Failed to update tool activation");
    res.status(500).json({ error: "Internal server error" });
  }
});


// ─── products ─────────────────────────────────────────────────────────────────
router.get("/admin/products", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const search = req.query.search as string | undefined;
    const conditions: import("drizzle-orm").SQL[] = [];
    if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        description: productsTable.description,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        imageUrl: productsTable.imageUrl,
        categoryName: categoriesTable.name,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(productsTable.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(productsTable);
    res.json({ products, total });
  } catch (err) {
    req.log.error({ err }, "Failed to list admin products");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/products/:id", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const id = Number(req.params.id);
    const parsed = z
      .object({
        price: z.union([z.number(), z.string()]).optional(),
        inStock: z.boolean().optional(),
        featured: z.boolean().optional(),
        name: z.string().optional(),
        imageUrl: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        originalPrice: z.union([z.number(), z.string()]).nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const updateData: Record<string, unknown> = {};
    if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
    if (parsed.data.inStock !== undefined) updateData.inStock = parsed.data.inStock;
    if (parsed.data.featured !== undefined) updateData.featured = parsed.data.featured;
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl ?? "";
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description ?? "";
    if (parsed.data.originalPrice !== undefined) updateData.originalPrice = parsed.data.originalPrice ? String(parsed.data.originalPrice) : null;
    if (Object.keys(updateData).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(product);
  } catch (err) {
    req.log.error({ err }, "Failed to update product");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/products/:id", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid product id" }); return; }
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete product");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── test email ───────────────────────────────────────────────────────────────
router.post("/admin/test-email", async (req, res) => {
  try {
    if (!(await checkAdminAuth(req, res))) return;

    const parsed = z.object({
      to: z.string().email(),
      type: z.enum([
        "otp",
        "login",
        "order_submitted",
        "payment_confirmed",
        "order_status",
        "more_info",
        "order_completed",
        "pending_manual",
      ]).default("order_submitted"),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { to, type } = parsed.data;

    const SAMPLE_ITEMS = [
      { productName: "iPhone Unlock T-Mobile USA — Standard", quantity: 1, price: "25.00" },
      { productName: "Samsung FRP Remove — Express", quantity: 2, price: "12.00" },
    ];
    const SAMPLE_TOTAL = "49.00";
    const SAMPLE_ORDER_ID = 1001;
    const SAMPLE_NAME = "John Doe";

    let emailPayload;

    switch (type) {
      case "otp":
        emailPayload = otpEmail("847291");
        break;
      case "login":
        emailPayload = loginNotificationEmail(SAMPLE_NAME, { ip: "41.90.65.12", device: "Chrome on Windows 11" });
        break;
      case "order_submitted":
        emailPayload = orderSubmittedEmail({
          orderId: SAMPLE_ORDER_ID,
          customerName: SAMPLE_NAME,
          items: SAMPLE_ITEMS,
          total: SAMPLE_TOTAL,
          paymentMethod: "binance_pay",
        });
        break;
      case "payment_confirmed":
        emailPayload = paymentConfirmedEmail({
          orderId: SAMPLE_ORDER_ID,
          customerName: SAMPLE_NAME,
          amount: SAMPLE_TOTAL,
          paymentMethod: "binance_pay",
          transactionRef: "BNB-TXN-8472916",
          items: SAMPLE_ITEMS,
        });
        break;
      case "order_status":
        emailPayload = orderStatusUpdateEmail({
          orderId: SAMPLE_ORDER_ID,
          customerName: SAMPLE_NAME,
          status: "processing",
          notes: "Your IMEI has been submitted to the carrier network. Expected turnaround: 24–48 hours.",
        });
        break;
      case "more_info":
        emailPayload = moreInfoNeededEmail({
          orderId: SAMPLE_ORDER_ID,
          customerName: SAMPLE_NAME,
          message: "Hi! To process your unlock we need a clear screenshot of your device's IMEI screen (dial *#06# to see it). Please upload it via your order page. Also confirm the exact model number of your device.",
        });
        break;
      case "order_completed":
        emailPayload = orderCompletedEmail({
          orderId: SAMPLE_ORDER_ID,
          customerName: SAMPLE_NAME,
          items: SAMPLE_ITEMS,
          total: SAMPLE_TOTAL,
          notes: "✅ Unlock successful!\n\nNetwork: T-Mobile USA\nIMEI: 35xxxxxx1234567\nStatus: UNLOCKED\n\nYour device is now permanently unlocked and can be used on any compatible network worldwide.",
        });
        break;
      case "pending_manual":
        emailPayload = pendingManualPaymentEmail({
          orderId: SAMPLE_ORDER_ID,
          customerName: SAMPLE_NAME,
          paymentMethod: "binance_pay",
          total: SAMPLE_TOTAL,
          binanceId: "490759406",
          usdtAddress: "TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5",
        });
        break;
      default:
        res.status(400).json({ error: "Unknown email type" });
        return;
    }

    const result = await sendEmail({ to, ...emailPayload });

    if (!result.sent) {
      res.status(503).json({ error: "Email not sent — SMTP is not configured. Check Settings > SMTP in the admin panel.", reason: (result as { reason?: string }).reason });
      return;
    }

    res.json({ success: true, to, type, subject: emailPayload.subject });
  } catch (err) {
    req.log.error({ err }, "Failed to send test email");
    res.status(500).json({ error: "Internal server error", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ── Announcements ─────────────────────────────────────────────────────────────
router.post("/admin/announcements/ai-generate", async (req, res) => {
  if (!await checkAdminAuth(req, res)) return;
  const { prompt } = req.body || {};
  if (!prompt?.trim()) { res.status(400).json({ error: "Prompt is required" }); return; }
  try {
    const [apiKey, openaiBase] = await Promise.all([getOpenAiKey(), getOpenAiBaseUrl()]);
    if (!apiKey) { res.status(503).json({ error: "OpenAI API key not configured. Add it in Admin → Settings." }); return; }
    const isOpenRouter = openaiBase.toLowerCase().includes("openrouter");
    const baseURL = openaiBase.endsWith("/v1") ? openaiBase : `${openaiBase}/v1`;
    const systemMsg = isOpenRouter
      ? "You are an email marketing expert for GSM World Store, a phone unlocking and mobile tool business. Generate a professional announcement email. You MUST respond with valid JSON only — no markdown, no code fences. The JSON must have exactly two keys: 'subject' (email subject line with emoji) and 'body' (plain text, 2-4 paragraphs, newlines between paragraphs, no HTML)."
      : "You are an email marketing expert for GSM World Store, a phone unlocking and mobile tool business. Generate a professional, engaging announcement email. Return JSON with 'subject' (concise email subject line with emoji) and 'body' (plain text paragraphs separated by newlines, no HTML tags). Keep the body to 2-4 paragraphs.";
    const userContent = `Create a professional announcement email for GSM World Store about: ${prompt}`;

    // On OpenRouter, try multiple free models in cascade — skip on 429/402/404 rate-limit
    const modelCascade = isOpenRouter ? await getWorkingCascade() : ["gpt-4o-mini"];

    let lastStatus = 0;
    let resultSubject = "";
    let resultBody = "";
    let succeeded = false;

    for (const model of modelCascade) {
      const reqBody: Record<string, unknown> = {
        model,
        stream: false,
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userContent },
        ],
      };
      if (!isOpenRouter) reqBody.response_format = { type: "json_object" };

      let r: Response;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        r = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://gsmworld.vercel.app",
            "X-Title": "GSMWorld Admin",
          },
          body: JSON.stringify(reqBody),
        });
        clearTimeout(timer);
      } catch (fetchErr) {
        req.log.warn({ model, err: String(fetchErr) }, "Announcement AI fetch error, trying next");
        continue;
      }

      lastStatus = r.status;
      if (r.status === 429 || r.status === 402 || r.status === 404 || r.status === 400) {
        const errSnippet = await r.text().catch(() => "");
        req.log.warn({ model, status: r.status, err: errSnippet.slice(0, 100) }, "AI model error, trying next");
        continue;
      }
      if (!r.ok) {
        req.log.warn({ model, status: r.status }, "AI model non-ok, trying next");
        continue;
      }

      const aiData = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
      const raw = aiData.choices?.[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        req.log.warn({ model }, "AI model returned empty content, trying next");
        continue;
      }

      // Strip markdown code fences if the model wrapped output in ```json ... ```
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      try {
        const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };
        resultSubject = parsed.subject ?? "";
        resultBody = parsed.body ?? "";
        succeeded = true;
        break;
      } catch {
        req.log.warn({ model, raw: raw.slice(0, 100) }, "AI model returned invalid JSON, trying next");
        continue;
      }
    }

    if (!succeeded) {
      res.status(500).json({ error: `AI generation failed — all models unavailable. Try again in a moment.` });
      return;
    }
    res.json({ subject: resultSubject, body: resultBody });
  } catch (err) {
    req.log.error({ err }, "AI announcement generation failed");
    res.status(500).json({ error: "AI generation failed" });
  }
});

router.post("/admin/announcements/send", async (req, res) => {
  if (!await checkAdminAuth(req, res)) return;
  const { subject, body, productIds } = req.body || {};
  if (!subject?.trim() || !body?.trim()) { res.status(400).json({ error: "Subject and body are required" }); return; }
  try {
    // Fetch featured products if any IDs were supplied
    let featuredProducts: Array<{ id: number; name: string; price: string; imageUrl: string | null; originalPrice: string | null }> = [];
    if (Array.isArray(productIds) && productIds.length > 0) {
      const ids = productIds.slice(0, 6).map(Number).filter(n => !isNaN(n));
      if (ids.length > 0) {
        const rows = await db
          .select({ id: productsTable.id, name: productsTable.name, price: productsTable.price, imageUrl: productsTable.imageUrl, originalPrice: productsTable.originalPrice })
          .from(productsTable)
          .where(sql`${productsTable.id} = ANY(${sql.raw("'{" + ids.join(",") + "}'::int[]")})`);
        // preserve caller order
        const map = new Map(rows.map(r => [r.id, r]));
        featuredProducts = ids.flatMap(id => (map.has(id) ? [map.get(id)!] : []));
      }
    }

    const allUsers = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.status, "active"));

    let sent = 0;
    for (const u of allUsers) {
      try {
        await sendEmail({
          to: u.email,
          subject,
          text: body,
          html: announcementEmail({ subject, body, featuredProducts: featuredProducts.length > 0 ? featuredProducts : undefined }),
        });
        sent++;
      } catch { /* skip failed recipients */ }
    }
    req.log.info({ sent, subject, featuredProducts: featuredProducts.length }, "Announcement broadcast sent");
    res.json({ ok: true, recipientCount: sent });
  } catch (err) {
    req.log.error({ err }, "Announcement broadcast failed");
    res.status(500).json({ error: "Failed to send announcement" });
  }
});

// ── IMEI Lookup Log ───────────────────────────────────────────────────────────
router.get("/admin/imei-logs", async (req, res) => {
  if (!await checkAdminAuth(req, res)) return;
  try {
    const logs = await db
      .select()
      .from(imeiLookupsTable)
      .orderBy(desc(imeiLookupsTable.checkedAt))
      .limit(500);
    res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch IMEI logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Order Wallet Refund ───────────────────────────────────────────────────────
// POST /admin/orders/:id/refund
// Credits the order amount (or a custom amount) to the customer's GSM Wallet.
// Refunds go to gsmwallet within 3-5 business days (manual schedule window).
router.post("/admin/orders/:id/refund", async (req, res) => {
  if (!(await checkAdminAuth(req, res))) return;

  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const { amount, reason, correctionNote } = req.body || {};
  const refundAmount = parseFloat(amount);
  if (!refundAmount || refundAmount <= 0) {
    res.status(400).json({ error: "Refund amount must be greater than 0" });
    return;
  }

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    if (!order.customerEmail) {
      res.status(422).json({ error: "Order has no customer email — cannot process wallet refund." });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, walletBalance: usersTable.walletBalance })
      .from(usersTable)
      .where(eq(usersTable.email, order.customerEmail))
      .limit(1);

    if (!user) {
      res.status(422).json({
        error: `No GSM World account found for ${order.customerEmail}. Wallet refund requires an account.`,
        customerEmail: order.customerEmail,
      });
      return;
    }

    // Credit wallet
    await db.update(usersTable)
      .set({ walletBalance: sql`wallet_balance + ${refundAmount.toFixed(2)}` })
      .where(eq(usersTable.id, user.id));

    // Wallet transaction log
    await db.insert(walletTransactionsTable).values({
      userId: user.id,
      type: "refund",
      amount: refundAmount.toFixed(2),
      fee: "0.00",
      counterpartyUsername: null,
      note: `Refund for order #${orderId}${reason ? ` — ${reason}` : ""}`,
    });

    // Mark order as refunded + save correction note
    const correctionNoteText = correctionNote ? String(correctionNote).trim() : null;
    await db.update(ordersTable)
      .set({
        paymentStatus: "refunded",
        updatedAt: new Date(),
        ...(correctionNoteText ? { correctionNote: correctionNoteText } : {}),
      })
      .where(eq(ordersTable.id, orderId));

    // Notify customer via email
    const reasonText = reason ? String(reason).trim() : "Order correction";
    await sendEmail({
      to: user.email,
      subject: `Refund processed — Order #${orderId} · GSM World`,
      text: [
        `Hi ${user.name || "there"},`,
        ``,
        `We have processed a refund of $${refundAmount.toFixed(2)} USD for order #${orderId}.`,
        ``,
        `Reason: ${reasonText}`,
        ``,
        `The amount will appear in your GSM World wallet within 3–5 business days.`,
        `You can check your wallet balance at: ${appUrl("/account")}`,
        ``,
        `If you have any questions, reply to this email or contact support.`,
        ``,
        `— GSM World Team`,
      ].join("\n"),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#0f172a;margin-bottom:8px">Refund Processed ✅</h2>
          <p>Hi <strong>${user.name || "there"}</strong>,</p>
          <p>We have processed a refund for your order.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Order</td><td style="text-align:right;font-weight:700">#${orderId}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Refund Amount</td><td style="text-align:right;font-weight:700;color:#059669">$${refundAmount.toFixed(2)} USD</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Reason</td><td style="text-align:right">${reasonText}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Credit Timeline</td><td style="text-align:right">3–5 business days</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Credited To</td><td style="text-align:right">GSM World Wallet</td></tr>
          </table>
          <p style="font-size:13px;color:#64748b">Thank you for your patience. Your wallet balance will be updated within 3–5 business days.</p>
          <a href="${appUrl("/account")}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-size:13px">Check My Wallet</a>
        </div>
      `,
    }).catch((e) => req.log.warn({ e }, "Refund email failed"));

    req.log.info({ orderId, userId: user.id, refundAmount, reason: reasonText }, "Order wallet refund issued");

    res.json({
      success: true,
      orderId,
      userId: user.id,
      userEmail: user.email,
      refundAmount,
      message: `$${refundAmount.toFixed(2)} queued for ${user.email}'s GSM Wallet (3–5 business days).`,
    });
  } catch (err) {
    req.log.error({ err }, "Order refund failed");
    res.status(500).json({ error: "Refund failed. Please try again." });
  }
});

// ── AI Model Health: candidate pool tested during refresh ────────────────────
const CANDIDATE_MODELS = [
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-235b-a22b:free",
  "qwen/qwen3-30b-a3b:free",
  "deepseek/deepseek-r1-0528:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "microsoft/phi-4:free",
];

async function probeModel(apiKey: string, baseURL: string, model: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gsmworld.vercel.app",
        "X-Title": "GSMWorld Model Probe",
      },
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 5,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    clearTimeout(timer);
    if (!r.ok) return false;
    const data = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
    return !!(data.choices?.[0]?.message?.content?.trim());
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function runModelRefresh(apiKey: string, baseURL: string, log: typeof router): Promise<{ working: string[]; tested: number }> {
  const probes = await Promise.allSettled(
    CANDIDATE_MODELS.map(async (model) => ({ model, ok: await probeModel(apiKey, baseURL, model) }))
  );
  const working = probes
    .filter((r): r is PromiseFulfilledResult<{ model: string; ok: boolean }> => r.status === "fulfilled" && r.value.ok)
    .map((r) => r.value.model);
  if (working.length > 0) await setWorkingCascade(working);
  return { working, tested: CANDIDATE_MODELS.length };
}

// GET /admin/cascade/status — current working models + last refresh time
router.get("/admin/cascade/status", async (req, res) => {
  if (!await checkAdminAuth(req, res)) return;
  try {
    const status = await getCascadeStatus();
    res.json(status);
  } catch (err) {
    req.log.error({ err }, "Failed to get cascade status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/cascade/refresh — manually trigger model health refresh (admin auth)
router.post("/admin/cascade/refresh", async (req, res) => {
  if (!await checkAdminAuth(req, res)) return;
  try {
    const [apiKey, openaiBase] = await Promise.all([getOpenAiKey(), getOpenAiBaseUrl()]);
    if (!apiKey) { res.status(503).json({ error: "OpenAI API key not configured" }); return; }
    const isOpenRouter = openaiBase.toLowerCase().includes("openrouter");
    if (!isOpenRouter) { res.status(400).json({ error: "Model refresh only applies to OpenRouter keys" }); return; }
    const baseURL = openaiBase.endsWith("/v1") ? openaiBase : `${openaiBase}/v1`;
    const result = await runModelRefresh(apiKey, baseURL, router as unknown as typeof router);
    req.log.info(result, "Manual model cascade refresh complete");
    res.json({ ...result, candidates: CANDIDATE_MODELS });
  } catch (err) {
    req.log.error({ err }, "Model cascade refresh failed");
    res.status(500).json({ error: "Refresh failed" });
  }
});

// POST /admin/cron/daily-marketing — called daily at 3:50 AM EAT by Vercel cron
// Also triggered by the self-hosted minute-ticker in index.ts.
router.post("/admin/cron/daily-marketing", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { runDailyMarketingEmail } = await import("../lib/daily-marketing");
    const result = await runDailyMarketingEmail();
    req.log.info(result, "Daily marketing cron complete");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Daily marketing cron failed");
    res.status(500).json({ error: "Daily marketing failed" });
  }
});

// POST /admin/notify-all
// Inserts an in-app notification row for every active user.
// Users see it immediately in their notification bell — no email needed.
router.post("/admin/notify-all", async (req, res) => {
  if (!(await checkAdminAuth(req, res))) return;
  const { title, message, type } = req.body ?? {};
  if (!String(title ?? "").trim() || !String(message ?? "").trim()) {
    res.status(400).json({ error: "Title and message are required" });
    return;
  }
  const notifType = ["info", "success", "warning", "error"].includes(type) ? type : "info";
  try {
    const allUsers = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.status, "active"));

    if (allUsers.length === 0) {
      res.json({ ok: true, count: 0 });
      return;
    }

    await db.insert(notificationsTable).values(
      allUsers.map((u) => ({
        userEmail: u.email,
        title: String(title).trim(),
        message: String(message).trim(),
        type: notifType,
        read: false,
      })),
    );

    req.log.info({ count: allUsers.length, title, type: notifType }, "Broadcast in-app notification sent");
    res.json({ ok: true, count: allUsers.length });
  } catch (err) {
    req.log.error({ err }, "Failed to send broadcast notification");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/cron/refresh-models — called weekly by Vercel cron (CRON_SECRET auth)
router.post("/admin/cron/refresh-models", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [apiKey, openaiBase] = await Promise.all([getOpenAiKey(), getOpenAiBaseUrl()]);
    if (!apiKey) { res.status(503).json({ error: "OpenAI API key not configured" }); return; }
    const isOpenRouter = openaiBase.toLowerCase().includes("openrouter");
    if (!isOpenRouter) { res.json({ skipped: true, reason: "Not OpenRouter — no cascade needed" }); return; }
    const baseURL = openaiBase.endsWith("/v1") ? openaiBase : `${openaiBase}/v1`;
    const result = await runModelRefresh(apiKey, baseURL, router as unknown as typeof router);
    req.log.info(result, "Cron model cascade refresh complete");
    res.json({ ok: true, ...result, candidates: CANDIDATE_MODELS });
  } catch (err) {
    req.log.error({ err }, "Cron model cascade refresh failed");
    res.status(500).json({ error: "Refresh failed" });
  }
});

export default router;
