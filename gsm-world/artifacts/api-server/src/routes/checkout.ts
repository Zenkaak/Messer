import { Router } from "express";
import {
  db,
  ordersTable,
  orderItemsTable,
  cartItemsTable,
  productsTable,
  paymentTransactionsTable,
  usersTable,
} from "@workspace/db";

import { and, eq, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

import { logger } from "../lib/logger";

import {
  initiateSTKPush,
  querySTKPush
} from "../lib/mpesa";

import {
  getUsdtWallet,
  getUsdtNetwork,
  getPaymentMethods,
  getBinancePayId,
  getUsdtManualAddress,
  getUsdtManualNetwork,
  getSmtpConfig,
  checkAdminPassword,
  getWhatsappContact,
} from "../lib/admin-settings";

import { createPayment, getPaymentStatus } from "../lib/nowpayments";

import { sendEmail, appUrl, orderSubmittedEmail, pendingManualPaymentEmail, paymentConfirmedEmail, adminNewOrderAlertEmail } from "../lib/email";
import { z } from "zod";

const router = Router();

// ─── In-memory payment notification store ────────────────────────────────────
interface PaymentNotification {
  id: string;
  orderId: number;
  customerEmail: string;
  amount: string;
  method: string;
  ts: number;
  read: boolean;
}
const _notifications: PaymentNotification[] = [];
function addPaymentNotification(n: Omit<PaymentNotification, "id" | "ts" | "read">) {
  _notifications.unshift({ ...n, id: Math.random().toString(36).slice(2), ts: Date.now(), read: false });
  if (_notifications.length > 50) _notifications.length = 50;
}

const USD_TO_KES = 130;

const JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

function generateOrderCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const CreateCheckoutBody = z.object({
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  paymentMethod: z.string(),
  payCurrency: z.string().optional(),
  sessionId: z.string().optional(),
  deviceIdentifier: z.string().optional(),
  resellerSlug: z.string().max(30).optional(),
});

const CreateCheckoutResponse = z.object({
  orderId: z.number(),
  orderCode: z.string().nullable().optional(),
  paymentMethod: z.string(),
  status: z.string(),
  total: z.number(),
  currency: z.string(),
  mpesa: z.object({ checkoutRequestId: z.string(), message: z.string() }).nullable().optional(),
  usdt: z.object({ walletAddress: z.string().nullable(), network: z.string(), amountUsdt: z.number(), memo: z.string() }).nullable().optional(),
  custom: z.unknown().nullable().optional(),
  nowpayments: z.object({
    paymentId: z.string(),
    payAddress: z.string(),
    payAmount: z.number(),
    payCurrency: z.string(),
    expiresAt: z.string().optional(),
  }).nullable().optional(),
});

const QueryMpesaPaymentBody = z.object({
  orderId: z.number().int(),
  checkoutRequestId: z.string().optional(),
});

function resolveSessionId(req: { query: Record<string, unknown>; headers: Record<string, unknown>; body?: Record<string, unknown> }): string {
  const authHeader = req.headers.authorization as string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
      return `user:${payload.userId}`;
    } catch {
    }
  }
  const bodyId = req.body?.sessionId as string | undefined;
  if (bodyId && bodyId.trim()) return bodyId.trim();
  const qsId = req.query.sessionId as string | undefined;
  if (qsId && qsId.trim()) return qsId.trim();
  return "guest-session";
}

async function deductFromWallet(userId: number, amount: number): Promise<boolean> {
  const updated = await db
    .update(usersTable)
    .set({ walletBalance: sql`wallet_balance - ${amount.toFixed(2)}` })
    .where(and(eq(usersTable.id, userId), sql`wallet_balance >= ${amount.toFixed(2)}`))
    .returning({ id: usersTable.id });
  return updated.length > 0;
}

router.post("/checkout", async (req, res) => {
  try {
    const parsed = CreateCheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { customerEmail, customerPhone, customerName, paymentMethod, deviceIdentifier, resellerSlug } = parsed.data;

    const sessionId = resolveSessionId(req);

    let loggedInUserId: number | null = null;
    const authHeader = req.headers.authorization as string | undefined;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
        loggedInUserId = payload.userId;
      } catch {
      }
    }

    const cartRows = await db
      .select({ cartItem: cartItemsTable, product: productsTable })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.sessionId, sessionId));

    if (cartRows.length === 0) {
      res.status(400).json({ error: "Cart is empty" });
      return;
    }

    const total = cartRows.reduce(
      (acc, r) => acc + parseFloat(r.cartItem.priceAtAdd) * r.cartItem.quantity,
      0
    );

    const orderCode = generateOrderCode();

    const [order] = await db
      .insert(ordersTable)
      .values({
        orderCode,
        sessionId,
        userId: loggedInUserId ?? null,
        customerEmail: customerEmail.toLowerCase(),
        customerPhone: customerPhone ?? null,
        customerName: customerName ?? null,
        paymentMethod,
        paymentStatus: "pending",
        total: String(total),
        currency: "USD",
        deviceIdentifier: deviceIdentifier ?? null,
        resellerSlug: resellerSlug ?? null,
      })
      .returning();

    await db.insert(orderItemsTable).values(
      cartRows.map((r) => ({
        orderId: order.id,
        productId: r.cartItem.productId,
        productName: r.product.name,
        price: r.cartItem.priceAtAdd,
        quantity: r.cartItem.quantity,
      }))
    );

    let mpesaData = null;
    let usdtData = null;
    let customData = null;
    let nowpaymentsData = null;
    let responseStatus = "pending";

    if (paymentMethod === "wallet") {
      if (!loggedInUserId) {
        res.status(401).json({ error: "Must be logged in to pay with wallet" });
        return;
      }
      const userRows = await db
        .select({ walletBalance: usersTable.walletBalance })
        .from(usersTable)
        .where(eq(usersTable.id, loggedInUserId))
        .limit(1);
      const balance = parseFloat(userRows[0]?.walletBalance ?? "0");
      if (balance < total) {
        res.status(400).json({ error: `Insufficient wallet balance. You have $${balance.toFixed(2)} but need $${total.toFixed(2)}.` });
        return;
      }
      const deducted = await deductFromWallet(loggedInUserId, total);
      if (!deducted) {
        res.status(400).json({ error: "Insufficient wallet balance." });
        return;
      }
      await db.update(ordersTable)
        .set({ paymentStatus: "paid" })
        .where(eq(ordersTable.id, order.id));
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
      addPaymentNotification({ orderId: order.id, customerEmail, amount: total.toFixed(2), method: "wallet" });
      // Send payment confirmed email for wallet payments (with order items)
      db.select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id))
        .then((walletItems) => sendEmail({
          to: customerEmail,
          ...paymentConfirmedEmail({
            orderId: order.id,
            orderCode: order.orderCode,
            customerName: customerName ?? null,
            amount: String(total),
            paymentMethod: "wallet",
            items: walletItems,
          }),
        }))
        .catch((err) => logger.error({ err }, "Failed to send wallet payment confirmed email"));
      responseStatus = "paid";
    } else if (paymentMethod === "mpesa") {
      if (!customerPhone) {
        res.status(400).json({ error: "Phone number required" });
        return;
      }

      const amountKes = Math.ceil(total * USD_TO_KES);

      try {
        const stkRes = await initiateSTKPush({
          phone: customerPhone,
          amount: amountKes,
          orderId: order.id,
          description: `Order #${order.id}`,
        });

        await db.insert(paymentTransactionsTable).values({
          orderId: order.id,
          provider: "mpesa",
          providerReference: stkRes.CheckoutRequestID,
          amount: String(amountKes),
          currency: "KES",
          status: "pending",
          rawResponse: stkRes as unknown as Record<string, unknown>,
        });

        mpesaData = {
          checkoutRequestId: stkRes.CheckoutRequestID,
          message: stkRes.CustomerMessage,
        };
      } catch (err) {
        logger.error({ err }, "STK Push failed");

        await db.update(ordersTable)
          .set({ paymentStatus: "failed" })
          .where(eq(ordersTable.id, order.id));

        res.status(500).json({ error: "M-Pesa failed" });
        return;
      }
    } else if (paymentMethod === "usdt") {
      const walletAddress = await getUsdtWallet();
      const network = await getUsdtNetwork();

      await db.insert(paymentTransactionsTable).values({
        orderId: order.id,
        provider: "usdt",
        providerReference: null,
        amount: String(total),
        currency: "USDT",
        status: "pending",
        rawResponse: null,
      });

      usdtData = {
        walletAddress,
        network: network ?? "TRC20",
        amountUsdt: parseFloat(total.toFixed(2)),
        memo: `ORDER-${order.orderCode ?? order.id}`,
      };
    } else if (paymentMethod === "nowpayments") {
      const payCurrency = parsed.data.payCurrency ?? "usdttrc20";
      try {
        const payment = await createPayment({
          priceAmount: total,
          priceCurrency: "usd",
          payCurrency,
          orderId: `checkout-${order.id}`,
          orderDescription: `GSM World Checkout #${order.id}`,
        });

        await db.insert(paymentTransactionsTable).values({
          orderId: order.id,
          provider: "nowpayments",
          providerReference: payment.payment_id,
          amount: String(total),
          currency: "USD",
          status: "pending",
          rawResponse: payment as unknown as Record<string, unknown>,
        });

        nowpaymentsData = {
          paymentId: payment.payment_id,
          payAddress: payment.pay_address,
          payAmount: payment.pay_amount,
          payCurrency: payment.pay_currency,
          expiresAt: payment.expiration_estimate_date,
        };
      } catch (payErr) {
        const payMsg = payErr instanceof Error ? payErr.message : "NOWPayments error";
        logger.error({ payErr }, "NOWPayments checkout payment creation failed");
        await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
        const isClientError = /400|AMOUNT|minimum|too (low|small)/i.test(payMsg);
        res.status(isClientError ? 400 : 500).json({ error: payMsg });
        return;
      }
    } else if (paymentMethod === "binance_pay") {
      // Manual — admin verifies payment
      const binanceId = await getBinancePayId();
      await db.update(ordersTable)
        .set({ paymentStatus: "pending_payment_confirmation" })
        .where(eq(ordersTable.id, order.id));
      await db.insert(paymentTransactionsTable).values({
        orderId: order.id,
        provider: "binance_pay",
        providerReference: null,
        amount: String(total),
        currency: "USD",
        status: "pending",
        rawResponse: { binanceId, reference: `ORDER-${order.orderCode ?? order.id}` } as Record<string, unknown>,
      });
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
      customData = { method: "binance_pay", binanceId, amount: total, reference: `ORDER-${order.orderCode ?? order.id}` };
      responseStatus = "pending_payment_confirmation";
      // Send pending payment email
      getWhatsappContact().then(whatsappContact => {
        sendEmail({
          to: customerEmail,
          ...pendingManualPaymentEmail({ orderId: order.id, orderCode: order.orderCode, customerName, customerEmail, paymentMethod: "binance_pay", total: String(total), binanceId, whatsappContact }),
        }).catch((err) => logger.error({ err }, "Failed to send pending payment email"));
      }).catch(() => {
        sendEmail({
          to: customerEmail,
          ...pendingManualPaymentEmail({ orderId: order.id, orderCode: order.orderCode, customerName, customerEmail, paymentMethod: "binance_pay", total: String(total), binanceId }),
        }).catch((err) => logger.error({ err }, "Failed to send pending payment email"));
      });
    } else if (paymentMethod === "usdt_manual") {
      // Manual USDT TRC20 — admin verifies payment
      const usdtManualAddress = await getUsdtManualAddress();
      const usdtManualNetwork = await getUsdtManualNetwork();
      await db.update(ordersTable)
        .set({ paymentStatus: "pending_payment_confirmation" })
        .where(eq(ordersTable.id, order.id));
      await db.insert(paymentTransactionsTable).values({
        orderId: order.id,
        provider: "usdt_manual",
        providerReference: null,
        amount: String(total),
        currency: "USDT",
        status: "pending",
        rawResponse: { address: usdtManualAddress, network: usdtManualNetwork, reference: `ORDER-${order.orderCode ?? order.id}` } as Record<string, unknown>,
      });
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
      customData = { method: "usdt_manual", address: usdtManualAddress, network: usdtManualNetwork, amount: total, reference: `ORDER-${order.orderCode ?? order.id}` };
      responseStatus = "pending_payment_confirmation";
      // Send pending payment email
      getWhatsappContact().then(whatsappContact => {
        sendEmail({
          to: customerEmail,
          ...pendingManualPaymentEmail({ orderId: order.id, orderCode: order.orderCode, customerName, customerEmail, paymentMethod: "usdt_manual", total: String(total), usdtAddress: usdtManualAddress, whatsappContact }),
        }).catch((err) => logger.error({ err }, "Failed to send pending payment email"));
      }).catch(() => {
        sendEmail({
          to: customerEmail,
          ...pendingManualPaymentEmail({ orderId: order.id, orderCode: order.orderCode, customerName, customerEmail, paymentMethod: "usdt_manual", total: String(total), usdtAddress: usdtManualAddress }),
        }).catch((err) => logger.error({ err }, "Failed to send pending payment email"));
      });
    } else if (paymentMethod === "stripe_card") {
      // Stripe Checkout — order stays pending until the client redirects to Stripe,
      // pays, and calls /api/payments/stripe/verify-order on return.
      await db.insert(paymentTransactionsTable).values({
        orderId: order.id,
        provider: "stripe_card",
        providerReference: null,
        amount: String(total),
        currency: "USD",
        status: "pending",
        rawResponse: {} as Record<string, unknown>,
      });
      // Cart is cleared only after successful payment verification.
      responseStatus = "pending";
    } else {
      const methods = await getPaymentMethods();
      const selected = methods.find(
        (m) => m.method.toLowerCase() === paymentMethod.toLowerCase()
      );

      await db.insert(paymentTransactionsTable).values({
        orderId: order.id,
        provider: "custom",
        providerReference: null,
        amount: String(total),
        currency: "USD",
        status: "pending",
        rawResponse: selected as Record<string, unknown> ?? null,
      });

      customData = selected;
    }

    // Clear cart for all payment methods except stripe_card (Stripe clears only after
    // verified payment return). Methods that already cleared (wallet, binance_pay,
    // usdt_manual) will hit an empty table — safe no-op.
    if (paymentMethod !== "stripe_card") {
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
    }

    const response = CreateCheckoutResponse.parse({
      orderId: order.id,
      orderCode: order.orderCode,
      paymentMethod,
      status: responseStatus,
      total,
      currency: "USD",
      mpesa: mpesaData,
      usdt: usdtData,
      custom: customData,
      nowpayments: nowpaymentsData,
    });

    // Send order confirmation email (skip for binance_pay/usdt_manual — already sent above)
    const itemsForEmail = cartRows.map((r) => ({
      productName: r.product.name,
      quantity: r.cartItem.quantity,
      price: r.cartItem.priceAtAdd,
    }));
    if (paymentMethod !== "binance_pay" && paymentMethod !== "usdt_manual") {
      // await before res.json() — Vercel terminates the lambda as soon as the response
      // is sent, so fire-and-forget emails never actually send on serverless.
      await sendEmail({
        to: customerEmail,
        ...orderSubmittedEmail({ orderId: order.id, orderCode: order.orderCode, customerName, items: itemsForEmail, total: String(total), paymentMethod }),
      }).catch((err) => logger.error({ err }, "Failed to send order confirmation email"));
    }

    // Admin notification — fire-and-forget
    getSmtpConfig().then((cfg) => {
      const adminEmail = cfg.emailFrom;
      if (adminEmail) {
        const itemSummary = itemsForEmail.map((i) => `${i.productName} ×${i.quantity}`).join(", ");
        sendEmail({
          to: adminEmail,
          ...adminNewOrderAlertEmail({
            orderId: order.id,
            orderCode: order.orderCode,
            orderType: "Store Order",
            customerEmail,
            customerName,
            items: itemSummary,
            total: String(total),
            paymentMethod,
          }),
        }).catch((err) => logger.error({ err }, "Failed to send admin order alert"));
      }
    }).catch(() => { /* non-fatal */ });

    res.json(response);
  } catch (err) {
    logger.error({ err }, "Checkout failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Stripe helpers ────────────────────────────────────────────────────────────

function getAppOrigin(req: import("express").Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) || "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ||
    (req.headers.host as string | undefined) ||
    "gsmworld.vercel.app";
  return `${proto}://${host}`;
}

// ── Stripe card: create checkout session for an existing order ────────────────
// Called by the frontend after createCheckout returns stripe_card/pending.
router.post("/payments/stripe/create-session", async (req, res) => {
  const authHeader = req.headers.authorization as string | undefined;
  let loggedInUserId: number | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const p = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
      loggedInUserId = p.userId;
    } catch { /* guest checkout is fine */ }
  }

  const { orderId } = req.body || {};
  if (!orderId) { res.status(400).json({ error: "orderId required" }); return; }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) { res.status(503).json({ error: "Card payment not configured" }); return; }

  try {
    const orderRows = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(orderId))).limit(1);
    const order = orderRows[0];
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.paymentStatus === "paid") { res.json({ alreadyPaid: true }); return; }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);
    const origin = getAppOrigin(req);
    const amountCents = Math.round(Number(order.total) * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `GSM World Order #${order.orderCode ?? order.id}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      customer_email: order.customerEmail || undefined,
      // {CHECKOUT_SESSION_ID} is the Stripe placeholder — replaced at runtime.
      success_url: `${origin}/checkout?s_os={CHECKOUT_SESSION_ID}&s_oid=${order.id}`,
      cancel_url: `${origin}/checkout`,
      metadata: {
        orderId: String(order.id),
        orderCode: order.orderCode ?? "",
        ...(loggedInUserId ? { userId: String(loggedInUserId) } : {}),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Stripe order session create failed");
    res.status(500).json({ error: "Could not create payment session." });
  }
});

// ── Stripe card: verify order payment ────────────────────────────────────────
router.post("/payments/stripe/verify-order", async (req, res) => {
  const { sessionId, orderId } = req.body || {};
  if (!sessionId || !orderId) { res.status(400).json({ error: "sessionId and orderId required" }); return; }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) { res.status(503).json({ error: "Card payment not configured" }); return; }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(400).json({ error: "Payment not confirmed by Stripe" }); return;
    }

    if (String(session.metadata?.orderId) !== String(orderId)) {
      res.status(400).json({ error: "Session/order mismatch" }); return;
    }

    const orderRows = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(orderId))).limit(1);
    const order = orderRows[0];
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.paymentStatus === "paid") { res.json({ success: true, alreadyPaid: true }); return; }

    await db.update(ordersTable).set({ paymentStatus: "paid" }).where(eq(ordersTable.id, order.id));
    await db.update(paymentTransactionsTable)
      .set({ status: "paid", providerReference: sessionId })
      .where(and(eq(paymentTransactionsTable.orderId, order.id), eq(paymentTransactionsTable.provider, "stripe_card")));
    await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, order.sessionId));

    addPaymentNotification({ orderId: order.id, customerEmail: order.customerEmail, amount: order.total, method: "stripe_card" });
    sendEmail({
      to: order.customerEmail,
      ...paymentConfirmedEmail({ orderId: order.id, orderCode: order.orderCode, customerName: order.customerName ?? null, amount: order.total, paymentMethod: "card" }),
    }).catch((err) => logger.error({ err }, "Failed to send card payment confirmed email"));

    logger.info({ orderId: order.id, sessionId }, "Order paid via Stripe card");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Stripe verify-order failed");
    res.status(500).json({ error: "Payment verification failed. Contact support." });
  }
});

const QueryNowpaymentsBody = z.object({
  orderId: z.number().int(),
});

router.post("/payments/nowpayments/query", async (req, res) => {
  try {
    const parsed = QueryNowpaymentsBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
    const { orderId } = parsed.data;

    const txRows = await db
      .select()
      .from(paymentTransactionsTable)
      .where(
        and(
          eq(paymentTransactionsTable.orderId, orderId),
          eq(paymentTransactionsTable.provider, "nowpayments"),
        )
      )
      .limit(1);

    if (!txRows.length) { res.json({ paymentStatus: "pending", message: "Transaction not found" }); return; }
    const tx = txRows[0];
    if (tx.status === "paid") { res.json({ paymentStatus: "paid" }); return; }
    if (tx.status === "failed") { res.json({ paymentStatus: "failed" }); return; }

    const pid = (tx.providerReference as string | null) ?? "";
    if (!pid) { res.json({ paymentStatus: "pending" }); return; }

    try {
      const status = await getPaymentStatus(pid);
      const paidStatuses = ["finished", "confirmed", "complete"];
      const failedStatuses = ["failed", "expired", "refunded", "partially_paid"];

      if (paidStatuses.includes(status.payment_status)) {
        await db.update(paymentTransactionsTable).set({ status: "paid" }).where(eq(paymentTransactionsTable.orderId, orderId));
        await db.update(ordersTable).set({ paymentStatus: "paid" }).where(eq(ordersTable.id, orderId));

        const orderRows = await db
          .select({ sessionId: ordersTable.sessionId, customerEmail: ordersTable.customerEmail, customerName: ordersTable.customerName, total: ordersTable.total })
          .from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);

        if (orderRows[0]) {
          const { sessionId, customerEmail, customerName, total } = orderRows[0];
          await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
          const npItems = await db
            .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
            .from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
          await sendEmail({
            to: customerEmail,
            ...paymentConfirmedEmail({
              orderId,
              customerName: customerName ?? null,
              amount: total,
              paymentMethod: "nowpayments",
              items: npItems,
            }),
          });
        }

        addPaymentNotification({ orderId, customerEmail: orderRows[0]?.customerEmail ?? "", amount: String(orderRows[0] ? parseFloat(orderRows[0].total).toFixed(2) : "0"), method: "nowpayments" });
        res.json({ paymentStatus: "paid" });
      } else if (failedStatuses.includes(status.payment_status)) {
        await db.update(paymentTransactionsTable).set({ status: "failed" }).where(eq(paymentTransactionsTable.orderId, orderId));
        await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, orderId));
        res.json({ paymentStatus: "failed" });
      } else {
        res.json({ paymentStatus: "pending", status: status.payment_status });
      }
    } catch {
      res.json({ paymentStatus: "pending" });
    }
  } catch (err) {
    logger.error({ err }, "NOWPayments checkout query failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/mpesa/query", async (req, res) => {
  try {
    const parsed = QueryMpesaPaymentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { orderId, checkoutRequestId } = parsed.data;

    const txRows = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.orderId, orderId))
      .limit(1);

    if (!txRows.length) {
      res.json({ paymentStatus: "pending", message: "Transaction not found" });
      return;
    }

    const tx = txRows[0];

    if (tx.status === "paid") {
      res.json({ paymentStatus: "paid", message: "Payment confirmed" });
      return;
    }
    if (tx.status === "failed") {
      res.json({ paymentStatus: "failed", message: "Payment failed" });
      return;
    }

    const requestId = checkoutRequestId ?? (tx.providerReference as string | null) ?? "";
    if (!requestId) {
      res.json({ paymentStatus: "pending", message: "Waiting for payment…" });
      return;
    }

    try {
      const result = await querySTKPush(requestId);
      const resultCode = result.ResultCode;

      if (resultCode === "0") {
        await db.update(paymentTransactionsTable)
          .set({ status: "paid" })
          .where(eq(paymentTransactionsTable.orderId, orderId));
        await db.update(ordersTable)
          .set({ paymentStatus: "paid" })
          .where(eq(ordersTable.id, orderId));

        const orderRows = await db
          .select({
            sessionId: ordersTable.sessionId,
            customerEmail: ordersTable.customerEmail,
            customerName: ordersTable.customerName,
            total: ordersTable.total,
          })
          .from(ordersTable)
          .where(eq(ordersTable.id, orderId))
          .limit(1);

        if (orderRows[0]) {
          const { sessionId, customerEmail, customerName, total } = orderRows[0];
          await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
          const mpesaQueryItems = await db
            .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
            .from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
          await sendEmail({
            to: customerEmail,
            ...paymentConfirmedEmail({
              orderId,
              customerName: customerName ?? null,
              amount: total,
              paymentMethod: "mpesa",
              items: mpesaQueryItems,
            }),
          });
        }

        addPaymentNotification({ orderId, customerEmail: orderRows[0]?.customerEmail ?? "", amount: String(orderRows[0] ? parseFloat(orderRows[0].total).toFixed(2) : "0"), method: "mpesa" });
        res.json({ paymentStatus: "paid", message: "Payment confirmed" });
      } else if (resultCode !== undefined) {
        await db.update(paymentTransactionsTable)
          .set({ status: "failed" })
          .where(eq(paymentTransactionsTable.orderId, orderId));
        await db.update(ordersTable)
          .set({ paymentStatus: "failed" })
          .where(eq(ordersTable.id, orderId));
        res.json({ paymentStatus: "failed", message: result.ResultDesc ?? "Payment failed" });
      } else {
        res.json({ paymentStatus: "pending", message: "Waiting for payment…" });
      }
    } catch {
      res.json({ paymentStatus: "pending", message: "Checking payment status…" });
    }
  } catch (err) {
    logger.error({ err }, "M-Pesa query failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/mpesa/callback", async (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); return; }

    const checkoutRequestId: string = body.CheckoutRequestID;
    const resultCode: number = body.ResultCode;

    const txRows = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.providerReference, checkoutRequestId))
      .limit(1);

    if (txRows.length) {
      const orderId = txRows[0].orderId;
      const status = resultCode === 0 ? "paid" : "failed";
      await db.update(paymentTransactionsTable)
        .set({ status, rawResponse: body as Record<string, unknown> })
        .where(eq(paymentTransactionsTable.providerReference, checkoutRequestId));
      await db.update(ordersTable)
        .set({ paymentStatus: status })
        .where(eq(ordersTable.id, orderId));

      if (status === "paid") {
        const orderRows = await db
          .select({
            sessionId: ordersTable.sessionId,
            customerEmail: ordersTable.customerEmail,
            customerName: ordersTable.customerName,
            total: ordersTable.total,
          })
          .from(ordersTable)
          .where(eq(ordersTable.id, orderId))
          .limit(1);

        if (orderRows[0]) {
          const { sessionId, customerEmail, customerName, total } = orderRows[0];
          await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
          const mpesaCbItems = await db
            .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
            .from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
          await sendEmail({
            to: customerEmail,
            ...paymentConfirmedEmail({
              orderId,
              customerName: customerName ?? null,
              amount: total,
              paymentMethod: "mpesa",
              items: mpesaCbItems,
            }),
          });
          addPaymentNotification({ orderId, customerEmail, amount: parseFloat(total).toFixed(2), method: "mpesa" });
          logger.info({ orderId, customerEmail }, "M-Pesa callback confirmed — confirmation email sent");
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "M-Pesa callback error");
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

const RetryNowpaymentsBody = z.object({
  orderId: z.number().int(),
  payCurrency: z.string().optional(),
});

router.post("/payments/nowpayments/retry", async (req, res) => {
  try {
    const parsed = RetryNowpaymentsBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
    const { orderId, payCurrency } = parsed.data;

    const orderRows = await db
      .select({ id: ordersTable.id, total: ordersTable.total, paymentStatus: ordersTable.paymentStatus })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!orderRows[0]) { res.status(404).json({ error: "Order not found" }); return; }
    const order = orderRows[0];
    if (order.paymentStatus === "paid") { res.status(400).json({ error: "Order already paid" }); return; }

    const total = parseFloat(order.total);
    const currency = payCurrency ?? "usdttrc20";

    const payment = await createPayment({
      priceAmount: total,
      priceCurrency: "usd",
      payCurrency: currency,
      orderId: `checkout-${orderId}`,
      orderDescription: `GSM World Checkout #${orderId} (retry)`,
    });

    await db.insert(paymentTransactionsTable).values({
      orderId,
      provider: "nowpayments",
      providerReference: payment.payment_id,
      amount: String(total),
      currency: "USD",
      status: "pending",
      rawResponse: payment as unknown as Record<string, unknown>,
    });

    logger.info({ orderId, paymentId: payment.payment_id }, "NOWPayments retry: new payment created");

    res.json({
      paymentId: payment.payment_id,
      payAddress: payment.pay_address,
      payAmount: payment.pay_amount,
      payCurrency: payment.pay_currency,
      expiresAt: payment.expiration_estimate_date,
    });
  } catch (err) {
    logger.error({ err }, "NOWPayments retry failed");
    res.status(500).json({ error: "Could not create new payment address. Please try again." });
  }
});

router.get("/admin/notifications", async (req, res) => {
  const pwd = req.headers["x-admin-password"] as string | undefined;
  if (!pwd || !(await checkAdminPassword(pwd))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ notifications: _notifications });
});

router.post("/admin/notifications/mark-read", async (req, res) => {
  const pwd = req.headers["x-admin-password"] as string | undefined;
  if (!pwd || !(await checkAdminPassword(pwd))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  _notifications.forEach(n => { n.read = true; });
  res.json({ ok: true });
});

export default router;

