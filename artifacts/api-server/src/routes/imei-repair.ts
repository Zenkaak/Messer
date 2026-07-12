import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import {
  sendEmail,
  orderSubmittedEmail,
  appUrl,
} from "../lib/email";
import {
  getUsdtManualAddress,
  getUsdtManualNetwork,
  getBinancePayId,
  getWhatsappContact,
} from "../lib/admin-settings";

const router: IRouter = Router();

const _jwtSecret = process.env.JWT_SECRET ?? "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

function getUserFromToken(authHeader: string | undefined): { userId: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(authHeader.slice(7), _jwtSecret) as { userId: number; email: string };
    return decoded;
  } catch {
    return null;
  }
}

function generateOrderCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

// IMEI Repair model pricing map — kept server-side to prevent tampering
const REPAIR_PRICES: Record<string, Record<string, number>> = {
  "Apple iPhone": {
    "iPhone 4": 8, "iPhone 4S": 8, "iPhone 5": 8, "iPhone 5C": 8, "iPhone 5S": 9,
    "iPhone 6": 9, "iPhone 6 Plus": 9, "iPhone 6S": 10, "iPhone 6S Plus": 10,
    "iPhone SE (1st Gen)": 10, "iPhone 7": 11, "iPhone 7 Plus": 12,
    "iPhone 8": 12, "iPhone 8 Plus": 13, "iPhone X": 14, "iPhone XR": 14,
    "iPhone XS": 15, "iPhone XS Max": 15, "iPhone SE (2nd Gen)": 14,
    "iPhone 11": 15, "iPhone 11 Pro": 16, "iPhone 11 Pro Max": 16,
    "iPhone 12 Mini": 16, "iPhone 12": 17, "iPhone 12 Pro": 17, "iPhone 12 Pro Max": 18,
    "iPhone SE (3rd Gen)": 17, "iPhone 13 Mini": 18, "iPhone 13": 18,
    "iPhone 13 Pro": 19, "iPhone 13 Pro Max": 19,
    "iPhone 14": 20, "iPhone 14 Plus": 21, "iPhone 14 Pro": 22, "iPhone 14 Pro Max": 23,
    "iPhone 15": 24, "iPhone 15 Plus": 25, "iPhone 15 Pro": 26, "iPhone 15 Pro Max": 27,
    "iPhone 16": 28, "iPhone 16 Plus": 29, "iPhone 16 Pro": 30, "iPhone 16 Pro Max": 32,
  },
  "Samsung Galaxy S": {
    "Galaxy S7": 10, "Galaxy S7 Edge": 10, "Galaxy S8": 12, "Galaxy S8+": 12,
    "Galaxy S9": 13, "Galaxy S9+": 13, "Galaxy S10e": 14, "Galaxy S10": 14,
    "Galaxy S10+": 15, "Galaxy S10 5G": 15, "Galaxy S20": 16, "Galaxy S20+": 17,
    "Galaxy S20 Ultra": 17, "Galaxy S20 FE": 15, "Galaxy S21": 17, "Galaxy S21+": 18,
    "Galaxy S21 Ultra": 19, "Galaxy S21 FE": 16, "Galaxy S22": 19, "Galaxy S22+": 20,
    "Galaxy S22 Ultra": 22, "Galaxy S23": 21, "Galaxy S23+": 22, "Galaxy S23 Ultra": 24,
    "Galaxy S23 FE": 19, "Galaxy S24": 23, "Galaxy S24+": 25, "Galaxy S24 Ultra": 27,
    "Galaxy S24 FE": 21, "Galaxy S25": 26, "Galaxy S25+": 28, "Galaxy S25 Ultra": 30,
  },
  "Samsung Galaxy A": {
    "Galaxy A03": 10, "Galaxy A03s": 10, "Galaxy A04": 10, "Galaxy A04s": 10,
    "Galaxy A05": 10, "Galaxy A05s": 10, "Galaxy A13": 11, "Galaxy A14": 11,
    "Galaxy A15": 12, "Galaxy A23": 12, "Galaxy A24": 12, "Galaxy A25": 13,
    "Galaxy A33 5G": 13, "Galaxy A34 5G": 14, "Galaxy A35 5G": 15,
    "Galaxy A50": 12, "Galaxy A51": 13, "Galaxy A52": 14, "Galaxy A53 5G": 15,
    "Galaxy A54 5G": 16, "Galaxy A55 5G": 17, "Galaxy A70": 13, "Galaxy A71": 14,
    "Galaxy A72": 15, "Galaxy A73 5G": 16,
  },
  "Samsung Galaxy Note": {
    "Galaxy Note 8": 13, "Galaxy Note 9": 14, "Galaxy Note 10": 16,
    "Galaxy Note 10+": 17, "Galaxy Note 10 Lite": 14, "Galaxy Note 20": 18,
    "Galaxy Note 20 Ultra": 20,
  },
  "Samsung Galaxy Z": {
    "Galaxy Z Flip": 20, "Galaxy Z Flip 3": 22, "Galaxy Z Flip 4": 24,
    "Galaxy Z Flip 5": 26, "Galaxy Z Flip 6": 28, "Galaxy Z Fold 2": 25,
    "Galaxy Z Fold 3": 27, "Galaxy Z Fold 4": 30, "Galaxy Z Fold 5": 33, "Galaxy Z Fold 6": 35,
  },
  "Samsung Galaxy M": {
    "Galaxy M12": 10, "Galaxy M13": 10, "Galaxy M14": 11, "Galaxy M23": 11,
    "Galaxy M33 5G": 12, "Galaxy M34 5G": 13, "Galaxy M52 5G": 13,
    "Galaxy M53 5G": 14, "Galaxy M54 5G": 15,
  },
};

const DEFAULT_PRICE = 12;

function getVerifiedPrice(brand: string, model: string): number {
  return REPAIR_PRICES[brand]?.[model] ?? DEFAULT_PRICE;
}

const RegisterBody = z.object({
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
  imei: z.string().regex(/^\d{15}$/, "IMEI must be exactly 15 digits"),
  price: z.number().positive().optional(),
  customerEmail: z.string().email(),
  customerPhone: z.string().max(20).optional(),
  paymentMethod: z.enum(["usdt_manual", "mpesa", "binance_pay", "wallet"]).default("usdt_manual"),
  sessionId: z.string().optional(),
});

router.post("/imei-repair/register", async (req, res) => {
  try {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
      return;
    }

    const { brand, model, imei, customerEmail, customerPhone, paymentMethod } = parsed.data;

    // Validate IMEI Luhn check server-side
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let d = parseInt(imei[i], 10);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    if (sum % 10 !== 0) {
      res.status(400).json({ error: "Invalid IMEI — check digit mismatch" });
      return;
    }

    const user = getUserFromToken(req.headers.authorization);
    const verifiedPrice = getVerifiedPrice(brand, model);
    const orderCode = `IR-${generateOrderCode()}`;
    const sessionId = user ? `user:${user.userId}` : (parsed.data.sessionId ?? `guest:${randomBytes(8).toString("hex")}`);
    const productName = `IMEI Repair — ${model} (${brand})`;

    const [order] = await db.insert(ordersTable).values({
      orderCode,
      sessionId,
      userId: user?.userId ?? null,
      customerEmail,
      customerPhone: customerPhone ?? null,
      paymentMethod,
      paymentStatus: "pending",
      total: String(verifiedPrice),
      currency: "USD",
      notes: `IMEI: ${imei}`,
      deviceIdentifier: imei,
      orderType: "imei_repair",
    }).returning();

    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: 0,
      productName,
      price: String(verifiedPrice),
      quantity: 1,
    });

    // Fetch payment details for response
    const [usdtAddress, usdtNetwork, binancePayId, whatsapp] = await Promise.all([
      getUsdtManualAddress().catch(() => ""),
      getUsdtManualNetwork().catch(() => "TRC-20"),
      getBinancePayId().catch(() => ""),
      getWhatsappContact().catch(() => ""),
    ]);

    // Send confirmation email (best-effort)
    sendEmail({
      ...orderSubmittedEmail({
        orderId: order.id,
        orderCode,
        customerName: null,
        customerEmail,
        items: [{ productName, price: String(verifiedPrice), quantity: 1 }],
        total: String(verifiedPrice),
        paymentMethod,
      }),
      to: customerEmail,
    }).catch(() => {/* non-critical */});

    res.json({
      orderId: order.id,
      orderCode,
      paymentMethod,
      total: verifiedPrice,
      paymentDetails: {
        usdtAddress: usdtAddress || null,
        usdtNetwork: usdtNetwork || "TRC-20",
        binancePayId: binancePayId || null,
        whatsapp: whatsapp || null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "imei-repair register error");
    res.status(500).json({ error: "Internal server error — please try again" });
  }
});

// ── GET /api/imei-repair/status/:orderCode ────────────────────────────────────
// Look up an IMEI repair order by its IR-XXXX code + email (privacy guard).
router.get("/imei-repair/status/:orderCode", async (req, res) => {
  try {
    const orderCode = (req.params.orderCode ?? "").trim().toUpperCase();
    const email = ((req.query.email as string) ?? "").trim().toLowerCase();

    if (!orderCode || !email) {
      res.status(400).json({ error: "orderCode and email are required" });
      return;
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        orderCode: ordersTable.orderCode,
        paymentStatus: ordersTable.paymentStatus,
        orderType: ordersTable.orderType,
        notes: ordersTable.notes,
        deviceIdentifier: ordersTable.deviceIdentifier,
        total: ordersTable.total,
        currency: ordersTable.currency,
        paymentMethod: ordersTable.paymentMethod,
        createdAt: ordersTable.createdAt,
        updatedAt: ordersTable.updatedAt,
        correctionNote: ordersTable.correctionNote,
      })
      .from(ordersTable)
      .where(
        and(
          eq(sql`upper(${ordersTable.orderCode})`, orderCode),
          eq(sql`lower(${ordersTable.customerEmail})`, email),
          eq(ordersTable.orderType, "imei_repair"),
        )
      )
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found. Check your order code and email." });
      return;
    }

    // Fetch order items for device name
    const items = await db
      .select({ productName: orderItemsTable.productName })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id))
      .limit(1);

    const deviceName = items[0]?.productName?.replace("IMEI Repair — ", "") ?? null;

    res.json({
      orderId: order.id,
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      imei: order.deviceIdentifier,
      device: deviceName,
      total: order.total,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      notes: order.correctionNote ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "imei-repair status lookup error");
    res.status(500).json({ error: "Lookup failed — please try again" });
  }
});

export default router;
