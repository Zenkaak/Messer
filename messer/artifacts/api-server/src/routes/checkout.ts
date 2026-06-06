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
  return "default-session";
}

async function deductFromWallet(userId: number, amount: number): Promise<void> {
  await db
    .update(usersTable)
    .set({ walletBalance: sql`wallet_balance - ${amount.toFixed(2)}` })
    .where(eq(usersTable.id, userId));
}

router.post("/checkout", async (req, res) => {
  try {
    const parsed = CreateCheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { customerEmail, customerPhone, customerName, paymentMethod, deviceIdentifier } = parsed.data;

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
        customerEmail: customerEmail.toLowerCase(),
        customerPhone: customerPhone ?? null,
        customerName: customerName ?? null,
        paymentMethod,
        paymentStatus: "pending",
        total: String(total),
        currency: "USD",
        deviceIdentifier: deviceIdentifier ?? null,
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
      await deductFromWallet(loggedInUserId, total);
      await db.update(ordersTable)
        .set({ paymentStatus: "paid" })
        .where(eq(ordersTable.id, order.id));
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
      addPaymentNotification({ orderId: order.id, customerEmail, amount: total.toFixed(2), method: "wallet" });
      // Send payment confirmed email for wallet payments
      sendEmail({
        to: customerEmail,
        ...paymentConfirmedEmail({
          orderId: order.id,
          orderCode: order.orderCode,
          customerName: customerName ?? null,
          amount: String(total),
          paymentMethod: "wallet",
        }),
      }).catch((err) => logger.error({ err }, "Failed to send wallet payment confirmed email"));
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
      sendEmail({
        to: customerEmail,
        ...pendingManualPaymentEmail({ orderId: order.id, orderCode: order.orderCode, customerName, paymentMethod: "binance_pay", total: String(total), binanceId }),
      }).catch((err) => logger.error({ err }, "Failed to send pending payment email"));
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
      sendEmail({
        to: customerEmail,
        ...pendingManualPaymentEmail({ orderId: order.id, orderCode: order.orderCode, customerName, paymentMethod: "usdt_manual", total: String(total), usdtAddress: usdtManualAddress }),
      }).catch((err) => logger.error({ err }, "Failed to send pending payment email"));
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
      sendEmail({
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
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Checkout failed");
    res.status(500).json({ error: "Internal server error", _debug: msg });
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
          await sendEmail({
            to: customerEmail,
            subject: `✅ Payment confirmed — Order #${orderId}`,
            text: `Hi ${customerName ?? "Customer"},\n\nYour crypto payment has been confirmed and your order is processed!\n\nOrder #${orderId} — Total: $${parseFloat(total).toFixed(2)}\n\nView your order: ${appUrl(`/orders/${orderId}`)}\n\nThank you for shopping with GSM World!`,
            html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>Payment Confirmed ✅</h2><p>Hi ${customerName ?? "Customer"}, your crypto payment for Order <strong>#${orderId}</strong> has been confirmed.</p><p>Total: <strong>$${parseFloat(total).toFixed(2)}</strong></p><a href="${appUrl(`/orders/${orderId}`)}" style="display:inline-block;margin-top:16px;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View Order</a></div>`,
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

          const items = await db
            .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
            .from(orderItemsTable)
            .where(eq(orderItemsTable.orderId, orderId));

          const itemLines = items.map(i => `${i.productName} × ${i.quantity} — $${(parseFloat(i.price) * i.quantity).toFixed(2)}`).join("\n");
          const htmlItems = items.map(i => `<tr><td style="padding:4px 8px">${i.productName}</td><td style="padding:4px 8px;text-align:center">${i.quantity}</td><td style="padding:4px 8px;text-align:right">$${(parseFloat(i.price) * i.quantity).toFixed(2)}</td></tr>`).join("");

          await sendEmail({
            to: customerEmail,
            subject: `✅ Payment confirmed — Order #${orderId}`,
            text: `Hi ${customerName ?? "Customer"},\n\nYour M-Pesa payment has been received and your order is confirmed!\n\nOrder #${orderId}\n${itemLines}\n\nTotal: $${parseFloat(total).toFixed(2)}\n\nView your order: ${appUrl(`/orders/${orderId}`)}\n\nThank you for shopping with GSM World!`,
            html: `<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px"><h2 style="margin:0 0 4px;color:#1a2332">Payment Confirmed ✅</h2><p style="color:#64748b;margin:0 0 20px">Hi ${customerName ?? "Customer"}, your M-Pesa payment for Order <strong>#${orderId}</strong> has been received.</p><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;text-align:left">Item</th><th style="padding:6px 8px;text-align:center">Qty</th><th style="padding:6px 8px;text-align:right">Amount</th></tr></thead><tbody>${htmlItems}</tbody><tfoot><tr><td colspan="2" style="padding:8px;font-weight:bold;text-align:right">Total</td><td style="padding:8px;font-weight:bold;text-align:right">$${parseFloat(total).toFixed(2)}</td></tr></tfoot></table><a href="${appUrl(`/orders/${orderId}`)}" style="display:inline-block;margin-top:20px;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View Order</a><p style="margin-top:24px;color:#64748b;font-size:12px">GSM World</p></div></div>`,
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

          const items = await db
            .select({ productName: orderItemsTable.productName, quantity: orderItemsTable.quantity, price: orderItemsTable.price })
            .from(orderItemsTable)
            .where(eq(orderItemsTable.orderId, orderId));

          const itemLines = items.map(i => `${i.productName} × ${i.quantity} — $${(parseFloat(i.price) * i.quantity).toFixed(2)}`).join("\n");
          const htmlItems = items.map(i => `<tr><td style="padding:4px 8px">${i.productName}</td><td style="padding:4px 8px;text-align:center">${i.quantity}</td><td style="padding:4px 8px;text-align:right">$${(parseFloat(i.price) * i.quantity).toFixed(2)}</td></tr>`).join("");

          await sendEmail({
            to: customerEmail,
            subject: `✅ Payment confirmed — Order #${orderId}`,
            text: `Hi ${customerName ?? "Customer"},\n\nYour M-Pesa payment has been received and your order is confirmed!\n\nOrder #${orderId}\n${itemLines}\n\nTotal: $${parseFloat(total).toFixed(2)}\n\nView your order: ${appUrl(`/orders/${orderId}`)}\n\nThank you for shopping with GSM World!`,
            html: `<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px"><h2 style="margin:0 0 4px;color:#1a2332">Payment Confirmed ✅</h2><p style="color:#64748b;margin:0 0 20px">Hi ${customerName ?? "Customer"}, your M-Pesa payment for Order <strong>#${orderId}</strong> has been received.</p><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;text-align:left">Item</th><th style="padding:6px 8px;text-align:center">Qty</th><th style="padding:6px 8px;text-align:right">Amount</th></tr></thead><tbody>${htmlItems}</tbody><tfoot><tr><td colspan="2" style="padding:8px;font-weight:bold;text-align:right">Total</td><td style="padding:8px;font-weight:bold;text-align:right">$${parseFloat(total).toFixed(2)}</td></tr></tfoot></table><a href="${appUrl(`/orders/${orderId}`)}" style="display:inline-block;margin-top:20px;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View Order</a><p style="margin-top:24px;color:#64748b;font-size:12px">GSM World</p></div></div>`,
          });

          addPaymentNotification({ orderId, customerEmail, amount: parseFloat(total).toFixed(2), method: "mpesa" });
          logger.info({ orderId, customerEmail }, "M-Pesa payment confirmed — confirmation email sent");
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

router.get("/admin/notifications", (_req, res) => {
  res.json({ notifications: _notifications });
});

router.post("/admin/notifications/mark-read", (_req, res) => {
  _notifications.forEach(n => { n.read = true; });
  res.json({ ok: true });
});

export default router;

