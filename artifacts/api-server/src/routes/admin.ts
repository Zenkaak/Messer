import { Router, type IRouter } from "express";
import { eq, and, sql, count, sum, ilike, or, desc } from "drizzle-orm";
import {
  db,
  adminSettingsTable,
  toolActivationsTable,
  insertToolActivationSchema,
  usersTable,
  ordersTable,
} from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db";
import { z } from "zod";
import { getAllSettings, updateSettings, getAdminPassword, hasAdminPasswordBeenSet } from "../lib/admin-settings";
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
} from "../lib/email";

const router: IRouter = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

async function checkAdminAuth(req: import("express").Request, res: import("express").Response): Promise<boolean> {
  const pwd = req.headers["x-admin-password"] as string | undefined;
  const correct = await getAdminPassword();
  if (!pwd || pwd !== correct) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ─── auth ──────────────────────────────────────────────────────────────────────
router.post("/admin/login", async (req, res) => {
  try {
    const { password } = req.body ?? {};
    if (!password) {
      res.status(400).json({ error: "Password required" });
      return;
    }
    const correct = await getAdminPassword();
    if (password !== correct) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
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
    const [orderStats] = await db.select({ total: count() }).from(ordersTable);
    const [paidStats] = await db
      .select({ count: count(), revenue: sum(ordersTable.total) })
      .from(ordersTable)
      .where(eq(ordersTable.paymentStatus, "paid"));
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
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const search = req.query.search as string | undefined;

    const baseSelect = {
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      walletBalance: usersTable.walletBalance,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
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
    const id = Number(req.params.id);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/users/:id/wallet", async (req, res) => {
  try {
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
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const status = req.query.status as string | undefined;

    let baseOrders;
    if (status) {
      baseOrders = await db
        .select().from(ordersTable)
        .where(eq(ordersTable.paymentStatus, status))
        .orderBy(desc(ordersTable.createdAt))
        .limit(limit).offset(offset);
    } else {
      baseOrders = await db
        .select().from(ordersTable)
        .orderBy(desc(ordersTable.createdAt))
        .limit(limit).offset(offset);
    }

    const [{ total }] = await db.select({ total: count() }).from(ordersTable);
    res.json({ orders: baseOrders, total });
  } catch (err) {
    req.log.error({ err }, "Failed to list admin orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/orders/:id", async (req, res) => {
  try {
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
    res.json(order);
  } catch (err) {
    req.log.error({ err }, "Failed to update admin order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/tool-activations", async (req, res) => {
  try {
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
        inStock: productsTable.inStock,
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
    if (parsed.data.imageUrl !== undefined) updateData.imageUrl = parsed.data.imageUrl;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
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

export default router;
