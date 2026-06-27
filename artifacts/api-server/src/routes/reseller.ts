import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, resellerApplicationsTable, resellerWithdrawalsTable, productsTable, categoriesTable, usersTable, ordersTable } from "@workspace/db";
import { requireJwt } from "../middlewares/auth";
import { getAllSettings } from "../lib/admin-settings";
import { z } from "zod";
import { initiateSTKPush } from "../lib/mpesa";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SECURITY_FEE_USD = 0;
const DEFAULT_COMMISSION = "10.00";
const MIN_WITHDRAWAL_USD = 10;

// ─── Slug helpers ──────────────────────────────────────────────────────────────
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

// ─── Admin password helper ─────────────────────────────────────────────────────
async function checkAdminPwd(pwd: string | undefined): Promise<boolean> {
  if (!pwd) return false;
  const { checkAdminPassword } = await import("../lib/admin-settings");
  return checkAdminPassword(pwd);
}

// ─── GET /api/reseller/status ─ get current user's application ─────────────
router.get("/reseller/status", requireJwt, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [app] = await db
      .select()
      .from(resellerApplicationsTable)
      .where(eq(resellerApplicationsTable.userId, userId))
      .limit(1);
    if (!app) {
      res.json({ status: "none" });
      return;
    }
    const settings = await getAllSettings();
    const paymentMethods = (settings.paymentMethods ?? []).filter((m: { enabled?: boolean }) => m.enabled !== false);

    // pending withdrawal total
    const [pendingRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(resellerWithdrawalsTable)
      .where(and(
        eq(resellerWithdrawalsTable.resellerId, app.id),
        eq(resellerWithdrawalsTable.status, "pending"),
      ));
    const pendingWithdrawals = pendingRow?.total ?? "0";

    res.json({
      status: app.status,
      storeSlug: app.storeSlug,
      storeName: app.storeName,
      commissionRate: app.commissionRate,
      totalEarned: app.totalEarned,
      totalOrders: app.totalOrders,
      rejectionReason: app.rejectionReason,
      createdAt: app.createdAt,
      approvedAt: app.approvedAt,
      paymentMethods,
      securityFeeUsd: SECURITY_FEE_USD,
      pendingWithdrawals,
      availableBalance: String(Math.max(0, parseFloat(app.totalEarned) - parseFloat(pendingWithdrawals))),
    });
  } catch (err) {
    req.log.error({ err }, "reseller/status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/reseller/orders ─ list orders attributed to this reseller ───────
router.get("/reseller/orders", requireJwt, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [app] = await db
      .select({ storeSlug: resellerApplicationsTable.storeSlug, commissionRate: resellerApplicationsTable.commissionRate, status: resellerApplicationsTable.status })
      .from(resellerApplicationsTable)
      .where(and(eq(resellerApplicationsTable.userId, userId), eq(resellerApplicationsTable.status, "approved")))
      .limit(1);
    if (!app) {
      res.status(403).json({ error: "Not an approved reseller" });
      return;
    }
    const orders = await db
      .select({
        id: ordersTable.id,
        orderCode: ordersTable.orderCode,
        total: ordersTable.total,
        paymentStatus: ordersTable.paymentStatus,
        paymentMethod: ordersTable.paymentMethod,
        customerName: ordersTable.customerName,
        createdAt: ordersTable.createdAt,
        paidAt: ordersTable.paidAt,
      })
      .from(ordersTable)
      .where(eq(ordersTable.resellerSlug, app.storeSlug))
      .orderBy(desc(ordersTable.createdAt))
      .limit(100);

    const commissionRate = parseFloat(app.commissionRate);
    const result = orders.map(o => ({
      ...o,
      commission: ((parseFloat(o.total) * commissionRate) / 100).toFixed(2),
      commissionRate,
    }));

    res.json({ orders: result });
  } catch (err) {
    req.log.error({ err }, "reseller/orders error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/reseller/apply ─ submit application ────────────────────────────
const applySchema = z.object({
  storeName: z.string().min(2).max(60),
  storeSlug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens only").optional(),
});

router.post("/reseller/apply", requireJwt, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const email = req.user!.email;

    const existing = await db
      .select({ id: resellerApplicationsTable.id, status: resellerApplicationsTable.status })
      .from(resellerApplicationsTable)
      .where(eq(resellerApplicationsTable.userId, userId))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "You already have an active application.", status: existing[0].status });
      return;
    }

    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const { storeName } = parsed.data;
    const baseSlug = parsed.data.storeSlug || slugify(storeName);

    let finalSlug = baseSlug;
    let suffix = 1;
    while (true) {
      const conflict = await db
        .select({ id: resellerApplicationsTable.id })
        .from(resellerApplicationsTable)
        .where(eq(resellerApplicationsTable.storeSlug, finalSlug))
        .limit(1);
      if (conflict.length === 0) break;
      finalSlug = `${baseSlug}-${suffix++}`;
    }

    const settings = await getAllSettings();
    const paymentMethods = (settings.paymentMethods ?? []).filter((m: { enabled?: boolean }) => m.enabled !== false);

    const [app] = await db
      .insert(resellerApplicationsTable)
      .values({
        userId,
        email,
        storeName,
        storeSlug: finalSlug,
        status: "pending_approval",
        commissionRate: DEFAULT_COMMISSION,
      })
      .returning();

    res.json({
      ok: true,
      application: {
        id: app.id,
        storeSlug: app.storeSlug,
        storeName: app.storeName,
        status: app.status,
      },
      paymentMethods,
      securityFeeUsd: 0,
    });
  } catch (err) {
    req.log.error({ err }, "reseller/apply error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Reseller M-Pesa STK push ─────────────────────────────────────────────────
const USD_TO_KES = 130;
const resellerMpesaPending = new Map<string, { userId: number; applicationId: number }>();

router.post("/reseller/mpesa/initiate", requireJwt, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { phone } = req.body ?? {};
    if (!phone) { res.status(400).json({ error: "Phone number is required" }); return; }

    const [app] = await db
      .select()
      .from(resellerApplicationsTable)
      .where(eq(resellerApplicationsTable.userId, userId))
      .limit(1);
    if (!app) { res.status(404).json({ error: "No application found" }); return; }
    if (app.status !== "pending_payment") {
      res.status(409).json({ error: "Application is not awaiting payment", status: app.status }); return;
    }

    const amountKes = Math.ceil(SECURITY_FEE_USD * USD_TO_KES);
    const stk = await initiateSTKPush({
      phone: String(phone),
      amount: amountKes,
      orderId: app.id,
      description: "GSM World Reseller Security Fee",
    });

    resellerMpesaPending.set(stk.CheckoutRequestID, { userId, applicationId: app.id });
    setTimeout(() => resellerMpesaPending.delete(stk.CheckoutRequestID), 15 * 60 * 1000);
    logger.info({ userId, applicationId: app.id, amountKes }, "Reseller M-Pesa STK sent");

    res.json({
      success: true,
      message: `STK push sent to ${phone}. Enter your M-Pesa PIN to complete.`,
      checkoutRequestId: stk.CheckoutRequestID,
      amountKes,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "M-Pesa error";
    req.log.error({ err }, "reseller/mpesa/initiate error");
    res.status(500).json({ error: msg });
  }
});

router.post("/reseller/mpesa/callback", async (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); return; }
    const checkoutRequestId: string = body.CheckoutRequestID;
    const resultCode: number = body.ResultCode;
    const pending = resellerMpesaPending.get(checkoutRequestId);
    if (pending && resultCode === 0) {
      resellerMpesaPending.delete(checkoutRequestId);
      await db
        .update(resellerApplicationsTable)
        .set({ paymentMethod: "M-Pesa", paymentReference: checkoutRequestId, status: "pending_approval", updatedAt: new Date() })
        .where(eq(resellerApplicationsTable.id, pending.applicationId));
      logger.info({ applicationId: pending.applicationId }, "Reseller security fee confirmed via M-Pesa callback");
    } else if (pending) {
      resellerMpesaPending.delete(checkoutRequestId);
      logger.info({ checkoutRequestId, resultCode }, "Reseller M-Pesa payment failed/cancelled");
    }
  } catch (err) {
    logger.error({ err }, "Reseller M-Pesa callback error");
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.post("/reseller/mpesa/query", requireJwt, async (req, res) => {
  try {
    const { checkoutRequestId } = req.body || {};
    if (!checkoutRequestId) { res.status(400).json({ error: "checkoutRequestId required" }); return; }
    const { querySTKPush } = await import("../lib/mpesa");
    const result = await querySTKPush(String(checkoutRequestId));
    if (result.ResultCode === "0") {
      const pending = resellerMpesaPending.get(checkoutRequestId);
      if (pending) {
        resellerMpesaPending.delete(checkoutRequestId);
        await db
          .update(resellerApplicationsTable)
          .set({ paymentMethod: "M-Pesa", paymentReference: checkoutRequestId, status: "pending_approval", updatedAt: new Date() })
          .where(eq(resellerApplicationsTable.id, pending.applicationId));
      }
      res.json({ status: "paid", message: "Payment confirmed! Your application is now under review." });
    } else if (result.ResultCode !== undefined) {
      resellerMpesaPending.delete(checkoutRequestId);
      res.json({ status: "failed", message: result.ResultDesc ?? "Payment failed or cancelled." });
    } else {
      res.json({ status: "pending", message: "Waiting for confirmation…" });
    }
  } catch {
    res.json({ status: "pending", message: "Checking payment status…" });
  }
});

// ─── POST /api/reseller/submit-payment ─ submit payment proof ────────────────
router.post("/reseller/submit-payment", requireJwt, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { paymentMethod, paymentReference } = req.body ?? {};
    if (!paymentMethod || !paymentReference) {
      res.status(400).json({ error: "paymentMethod and paymentReference are required" });
      return;
    }

    const [app] = await db
      .select()
      .from(resellerApplicationsTable)
      .where(eq(resellerApplicationsTable.userId, userId))
      .limit(1);
    if (!app) {
      res.status(404).json({ error: "No application found" });
      return;
    }
    if (app.status !== "pending_payment") {
      res.status(409).json({ error: "Application is not awaiting payment", status: app.status });
      return;
    }

    await db
      .update(resellerApplicationsTable)
      .set({
        paymentMethod: String(paymentMethod),
        paymentReference: String(paymentReference),
        status: "pending_approval",
        updatedAt: new Date(),
      })
      .where(eq(resellerApplicationsTable.id, app.id));

    res.json({ ok: true, status: "pending_approval" });
  } catch (err) {
    req.log.error({ err }, "reseller/submit-payment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/reseller/store/:slug ─ public store products ───────────────────
router.get("/reseller/store/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const [app] = await db
      .select()
      .from(resellerApplicationsTable)
      .where(and(
        eq(resellerApplicationsTable.storeSlug, slug),
        eq(resellerApplicationsTable.status, "approved"),
      ))
      .limit(1);
    if (!app) {
      res.status(404).json({ error: "Store not found or not yet approved" });
      return;
    }

    const [owner] = await db
      .select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, app.userId))
      .limit(1);

    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        imageUrl: productsTable.imageUrl,
        description: productsTable.description,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(eq(productsTable.inStock, true))
      .orderBy(desc(productsTable.featured));

    res.json({
      store: {
        slug: app.storeSlug,
        name: app.storeName,
        ownerName: owner?.name ?? null,
        commissionRate: app.commissionRate,
      },
      products,
    });
  } catch (err) {
    req.log.error({ err }, "reseller/store/:slug error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/reseller/withdrawal/request ─ request payout ──────────────────
const withdrawalSchema = z.object({
  amount: z.number().min(MIN_WITHDRAWAL_USD),
  paymentMethod: z.string().min(1).max(50),
  paymentAddress: z.string().min(1).max(200),
  notes: z.string().max(300).optional(),
});

router.post("/reseller/withdrawal/request", requireJwt, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const [app] = await db
      .select()
      .from(resellerApplicationsTable)
      .where(and(
        eq(resellerApplicationsTable.userId, userId),
        eq(resellerApplicationsTable.status, "approved"),
      ))
      .limit(1);
    if (!app) {
      res.status(403).json({ error: "No approved reseller account found" });
      return;
    }

    const parsed = withdrawalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }
    const { amount, paymentMethod, paymentAddress, notes } = parsed.data;

    // Calculate available balance (totalEarned - pending withdrawals)
    const [pendingRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(resellerWithdrawalsTable)
      .where(and(
        eq(resellerWithdrawalsTable.resellerId, app.id),
        eq(resellerWithdrawalsTable.status, "pending"),
      ));
    const pendingTotal = parseFloat(pendingRow?.total ?? "0");
    const available = parseFloat(app.totalEarned) - pendingTotal;

    if (amount > available) {
      res.status(400).json({ error: `Insufficient balance. Available: $${available.toFixed(2)}` });
      return;
    }

    const [withdrawal] = await db
      .insert(resellerWithdrawalsTable)
      .values({
        resellerId: app.id,
        amount: String(amount.toFixed(2)),
        status: "pending",
        paymentMethod,
        paymentAddress,
        notes: notes ?? null,
      })
      .returning();

    res.json({ ok: true, withdrawal });
  } catch (err) {
    req.log.error({ err }, "reseller/withdrawal/request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/reseller/withdrawals ─ own withdrawal history ──────────────────
router.get("/reseller/withdrawals", requireJwt, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const [app] = await db
      .select({ id: resellerApplicationsTable.id })
      .from(resellerApplicationsTable)
      .where(eq(resellerApplicationsTable.userId, userId))
      .limit(1);
    if (!app) {
      res.json({ withdrawals: [] });
      return;
    }

    const withdrawals = await db
      .select()
      .from(resellerWithdrawalsTable)
      .where(eq(resellerWithdrawalsTable.resellerId, app.id))
      .orderBy(desc(resellerWithdrawalsTable.createdAt));

    res.json({ withdrawals });
  } catch (err) {
    req.log.error({ err }, "reseller/withdrawals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: list all reseller applications ─────────────────────────────────
router.get("/admin/resellers", async (req, res) => {
  try {
    const pwd = req.headers["x-admin-password"] as string | undefined;
    if (!await checkAdminPwd(pwd)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const apps = await db
      .select({
        id: resellerApplicationsTable.id,
        userId: resellerApplicationsTable.userId,
        email: resellerApplicationsTable.email,
        storeName: resellerApplicationsTable.storeName,
        storeSlug: resellerApplicationsTable.storeSlug,
        status: resellerApplicationsTable.status,
        securityFeePaid: resellerApplicationsTable.securityFeePaid,
        paymentMethod: resellerApplicationsTable.paymentMethod,
        paymentReference: resellerApplicationsTable.paymentReference,
        commissionRate: resellerApplicationsTable.commissionRate,
        totalEarned: resellerApplicationsTable.totalEarned,
        totalOrders: resellerApplicationsTable.totalOrders,
        rejectionReason: resellerApplicationsTable.rejectionReason,
        createdAt: resellerApplicationsTable.createdAt,
        approvedAt: resellerApplicationsTable.approvedAt,
        ownerName: usersTable.name,
      })
      .from(resellerApplicationsTable)
      .leftJoin(usersTable, eq(resellerApplicationsTable.userId, usersTable.id))
      .orderBy(desc(resellerApplicationsTable.createdAt));

    res.json({ resellers: apps });
  } catch (err) {
    req.log.error({ err }, "admin/resellers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: list all withdrawal requests ─────────────────────────────────────
router.get("/admin/resellers/withdrawals", async (req, res) => {
  try {
    const pwd = req.headers["x-admin-password"] as string | undefined;
    if (!await checkAdminPwd(pwd)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const withdrawals = await db
      .select({
        id: resellerWithdrawalsTable.id,
        resellerId: resellerWithdrawalsTable.resellerId,
        amount: resellerWithdrawalsTable.amount,
        status: resellerWithdrawalsTable.status,
        paymentMethod: resellerWithdrawalsTable.paymentMethod,
        paymentAddress: resellerWithdrawalsTable.paymentAddress,
        notes: resellerWithdrawalsTable.notes,
        adminNotes: resellerWithdrawalsTable.adminNotes,
        createdAt: resellerWithdrawalsTable.createdAt,
        processedAt: resellerWithdrawalsTable.processedAt,
        storeName: resellerApplicationsTable.storeName,
        storeSlug: resellerApplicationsTable.storeSlug,
        ownerName: usersTable.name,
        ownerEmail: resellerApplicationsTable.email,
      })
      .from(resellerWithdrawalsTable)
      .leftJoin(resellerApplicationsTable, eq(resellerWithdrawalsTable.resellerId, resellerApplicationsTable.id))
      .leftJoin(usersTable, eq(resellerApplicationsTable.userId, usersTable.id))
      .orderBy(desc(resellerWithdrawalsTable.createdAt));

    res.json({ withdrawals });
  } catch (err) {
    req.log.error({ err }, "admin/resellers/withdrawals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: get single reseller detail (user info + attributed orders) ────────
router.get("/admin/resellers/:id", async (req, res) => {
  try {
    const pwd = req.headers["x-admin-password"] as string | undefined;
    if (!await checkAdminPwd(pwd)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const resellerId = parseInt(req.params.id, 10);
    if (isNaN(resellerId)) { res.status(400).json({ error: "Invalid id" }); return; }

    // Fetch the reseller application + joined user row
    const [app] = await db
      .select({
        id: resellerApplicationsTable.id,
        userId: resellerApplicationsTable.userId,
        email: resellerApplicationsTable.email,
        storeName: resellerApplicationsTable.storeName,
        storeSlug: resellerApplicationsTable.storeSlug,
        status: resellerApplicationsTable.status,
        securityFeePaid: resellerApplicationsTable.securityFeePaid,
        paymentMethod: resellerApplicationsTable.paymentMethod,
        paymentReference: resellerApplicationsTable.paymentReference,
        commissionRate: resellerApplicationsTable.commissionRate,
        totalEarned: resellerApplicationsTable.totalEarned,
        totalOrders: resellerApplicationsTable.totalOrders,
        rejectionReason: resellerApplicationsTable.rejectionReason,
        createdAt: resellerApplicationsTable.createdAt,
        approvedAt: resellerApplicationsTable.approvedAt,
        // user fields
        ownerName: usersTable.name,
        ownerUsername: usersTable.username,
        ownerEmail: usersTable.email,
        ownerWalletBalance: usersTable.walletBalance,
        ownerStatus: usersTable.status,
        ownerCreatedAt: usersTable.createdAt,
        ownerRegistrationIp: usersTable.registrationIp,
      })
      .from(resellerApplicationsTable)
      .leftJoin(usersTable, eq(resellerApplicationsTable.userId, usersTable.id))
      .where(eq(resellerApplicationsTable.id, resellerId))
      .limit(1);

    if (!app) { res.status(404).json({ error: "Not found" }); return; }

    // Fetch attributed orders (where resellerSlug matches storeSlug)
    const orders = await db
      .select({
        id: ordersTable.id,
        orderCode: ordersTable.orderCode,
        total: ordersTable.total,
        paymentStatus: ordersTable.paymentStatus,
        paymentMethod: ordersTable.paymentMethod,
        customerEmail: ordersTable.customerEmail,
        customerName: ordersTable.customerName,
        orderType: ordersTable.orderType,
        createdAt: ordersTable.createdAt,
        paidAt: ordersTable.paidAt,
      })
      .from(ordersTable)
      .where(eq(ordersTable.resellerSlug, app.storeSlug))
      .orderBy(desc(ordersTable.createdAt))
      .limit(100);

    // Fetch withdrawal history
    const withdrawals = await db
      .select({
        id: resellerWithdrawalsTable.id,
        amount: resellerWithdrawalsTable.amount,
        status: resellerWithdrawalsTable.status,
        paymentMethod: resellerWithdrawalsTable.paymentMethod,
        paymentAddress: resellerWithdrawalsTable.paymentAddress,
        notes: resellerWithdrawalsTable.notes,
        adminNotes: resellerWithdrawalsTable.adminNotes,
        createdAt: resellerWithdrawalsTable.createdAt,
        processedAt: resellerWithdrawalsTable.processedAt,
      })
      .from(resellerWithdrawalsTable)
      .where(eq(resellerWithdrawalsTable.resellerId, resellerId))
      .orderBy(desc(resellerWithdrawalsTable.createdAt));

    // Compute sales stats from live order data
    const paidOrders = orders.filter(o => o.paymentStatus === "paid");
    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total), 0);
    const paidRevenue = paidOrders.reduce((s, o) => s + parseFloat(o.total), 0);
    const commissionRate = parseFloat(app.commissionRate ?? "10");
    const commissionEarned = paidRevenue * (commissionRate / 100);
    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) ordersByStatus[o.paymentStatus] = (ordersByStatus[o.paymentStatus] ?? 0) + 1;

    res.json({
      reseller: app,
      orders,
      withdrawals,
      stats: { totalRevenue, paidRevenue, commissionEarned, commissionRate, ordersByStatus, totalOrders: orders.length, paidOrders: paidOrders.length },
    });
  } catch (err) {
    req.log.error({ err }, "admin/resellers/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: approve withdrawal ────────────────────────────────────────────────
router.post("/admin/resellers/withdrawals/:id/approve", async (req, res) => {
  try {
    const pwd = req.headers["x-admin-password"] as string | undefined;
    if (!await checkAdminPwd(pwd)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const id = Number(req.params.id);
    const adminNotes = String((req.body as { adminNotes?: string })?.adminNotes ?? "");

    const [withdrawal] = await db
      .select()
      .from(resellerWithdrawalsTable)
      .where(eq(resellerWithdrawalsTable.id, id))
      .limit(1);
    if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }
    if (withdrawal.status !== "pending") {
      res.status(409).json({ error: "Withdrawal is not pending" });
      return;
    }

    // Deduct from reseller's totalEarned
    await db
      .update(resellerApplicationsTable)
      .set({
        totalEarned: sql`GREATEST(0, ${resellerApplicationsTable.totalEarned} - ${withdrawal.amount})`,
        updatedAt: new Date(),
      })
      .where(eq(resellerApplicationsTable.id, withdrawal.resellerId));

    const [updated] = await db
      .update(resellerWithdrawalsTable)
      .set({
        status: "approved",
        adminNotes: adminNotes || null,
        processedAt: new Date(),
      })
      .where(eq(resellerWithdrawalsTable.id, id))
      .returning();

    res.json({ ok: true, withdrawal: updated });
  } catch (err) {
    req.log.error({ err }, "admin/resellers/withdrawals/approve error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: reject withdrawal ─────────────────────────────────────────────────
router.post("/admin/resellers/withdrawals/:id/reject", async (req, res) => {
  try {
    const pwd = req.headers["x-admin-password"] as string | undefined;
    if (!await checkAdminPwd(pwd)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const id = Number(req.params.id);
    const adminNotes = String((req.body as { adminNotes?: string })?.adminNotes ?? "");

    const [withdrawal] = await db
      .select()
      .from(resellerWithdrawalsTable)
      .where(eq(resellerWithdrawalsTable.id, id))
      .limit(1);
    if (!withdrawal) { res.status(404).json({ error: "Withdrawal not found" }); return; }
    if (withdrawal.status !== "pending") {
      res.status(409).json({ error: "Withdrawal is not pending" });
      return;
    }

    const [updated] = await db
      .update(resellerWithdrawalsTable)
      .set({
        status: "rejected",
        adminNotes: adminNotes || null,
        processedAt: new Date(),
      })
      .where(eq(resellerWithdrawalsTable.id, id))
      .returning();

    res.json({ ok: true, withdrawal: updated });
  } catch (err) {
    req.log.error({ err }, "admin/resellers/withdrawals/reject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: approve reseller application ──────────────────────────────────────
router.post("/admin/resellers/:id/approve", async (req, res) => {
  try {
    const pwd = req.headers["x-admin-password"] as string | undefined;
    if (!await checkAdminPwd(pwd)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const id = Number(req.params.id);
    const [app] = await db
      .update(resellerApplicationsTable)
      .set({ status: "approved", securityFeePaid: true, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(resellerApplicationsTable.id, id))
      .returning();
    if (!app) { res.status(404).json({ error: "Application not found" }); return; }
    res.json({ ok: true, application: app });
  } catch (err) {
    req.log.error({ err }, "admin/resellers/approve error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: reject reseller application ───────────────────────────────────────
router.post("/admin/resellers/:id/reject", async (req, res) => {
  try {
    const pwd = req.headers["x-admin-password"] as string | undefined;
    if (!await checkAdminPwd(pwd)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const id = Number(req.params.id);
    const reason = String((req.body as { reason?: string })?.reason ?? "");
    const [app] = await db
      .update(resellerApplicationsTable)
      .set({ status: "rejected", rejectionReason: reason || null, updatedAt: new Date() })
      .where(eq(resellerApplicationsTable.id, id))
      .returning();
    if (!app) { res.status(404).json({ error: "Application not found" }); return; }
    res.json({ ok: true, application: app });
  } catch (err) {
    req.log.error({ err }, "admin/resellers/reject error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin: confirm payment manually ─────────────────────────────────────────
router.post("/admin/resellers/:id/confirm-payment", async (req, res) => {
  try {
    const pwd = req.headers["x-admin-password"] as string | undefined;
    if (!await checkAdminPwd(pwd)) { res.status(401).json({ error: "Unauthorized" }); return; }

    const id = Number(req.params.id);
    const [app] = await db
      .update(resellerApplicationsTable)
      .set({ status: "approved", securityFeePaid: true, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(resellerApplicationsTable.id, id))
      .returning();
    if (!app) { res.status(404).json({ error: "Application not found" }); return; }
    res.json({ ok: true, application: app });
  } catch (err) {
    req.log.error({ err }, "admin/resellers/confirm-payment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/reseller/pay-wallet ─ deduct $15 from wallet & mark pending_approval
router.post("/reseller/pay-wallet", requireJwt, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { paymentReference, paymentMethod } = req.body as { paymentReference?: string; paymentMethod?: string };

    // Find pending_payment application for this user
    const [app] = await db
      .select()
      .from(resellerApplicationsTable)
      .where(and(
        eq(resellerApplicationsTable.userId, userId),
        eq(resellerApplicationsTable.status, "pending_payment"),
      ))
      .limit(1);

    if (!app) {
      res.status(404).json({ error: "No pending payment application found" });
      return;
    }

    // Check user wallet balance from users table
    const [userRow] = await db
      .select({ walletBalance: usersTable.walletBalance })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const balance = parseFloat(userRow?.walletBalance ?? "0");
    if (balance < SECURITY_FEE_USD) {
      res.status(400).json({ error: `Insufficient wallet balance. Have $${balance.toFixed(2)}, need $${SECURITY_FEE_USD}` });
      return;
    }

    // Deduct from wallet and update application in a transaction
    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({ walletBalance: String(balance - SECURITY_FEE_USD) })
        .where(eq(usersTable.id, userId));

      await tx
        .update(resellerApplicationsTable)
        .set({
          status: "pending_approval",
          securityFeePaid: true,
          paymentReference: paymentReference || null,
          paymentMethod: paymentMethod || "nowpayments",
          updatedAt: new Date(),
        })
        .where(eq(resellerApplicationsTable.id, app.id));
    });

    req.log.info({ userId, appId: app.id, method: paymentMethod }, "reseller fee paid via wallet");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "reseller/pay-wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
