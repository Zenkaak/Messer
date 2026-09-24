import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  toolActivationsTable, usersTable, ordersTable, orderItemsTable, paymentTransactionsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  sendEmail, appUrl, pendingManualPaymentEmail, paymentConfirmedEmail, adminNewOrderAlertEmail,
} from "../lib/email";
import { getSmtpConfig, getBinancePayId, getUsdtManualAddress, getUsdtManualNetwork } from "../lib/admin-settings";
import { createPayment } from "../lib/nowpayments";
import { initiateSTKPush } from "../lib/mpesa";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-change-in-prod";
const USD_TO_KES = 130;

function getUser(authHeader: string | undefined): { userId: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

router.post("/unlock-rentals/checkout", async (req, res) => {
  try {
    const payload = getUser(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

    const {
      toolId, toolName, toolCategory, durationDays, priceUsd, paymentMethod, customerPhone, payCurrency,
    } = req.body || {};

    if (!toolId || !toolName || !toolCategory || !durationDays || !paymentMethod) {
      res.status(400).json({ error: "toolId, toolName, toolCategory, durationDays, and paymentMethod are required" });
      return;
    }

    const price = typeof priceUsd === "number" && priceUsd >= 6 ? priceUsd : null;
    if (!price) {
      res.status(400).json({ error: "A valid price (minimum $6.00) is required" });
      return;
    }

    const orderName = `${String(toolName)} — ${Number(durationDays)}-Day Rental`;
    const sessionId = `user:${payload.userId}`;

    const [order] = await db
      .insert(ordersTable)
      .values({
        sessionId,
        customerEmail: payload.email,
        paymentMethod,
        paymentStatus: "pending",
        total: String(price),
        currency: "USD",
        orderType: "unlock_rental",
        notes: `Unlock Tool Rental: ${orderName}`,
      })
      .returning();

    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: 0,
      productName: orderName,
      price: String(price),
      quantity: 1,
    });

    const [activation] = await db
      .insert(toolActivationsTable)
      .values({
        userId: payload.userId,
        toolName: String(toolName),
        toolCategory: String(toolCategory),
        username: payload.email,
        serialKey: `UR-ORDER-${order.id}`,
        orderRef: `ORDER-${order.id}`,
        status: "pending",
        notes: `Rental: ${Number(durationDays)} day(s) | Payment: ${paymentMethod} ($${price.toFixed(2)}) — pending confirmation`,
      })
      .returning();

    let responseStatus = "pending";
    let customData: Record<string, unknown> | null = null;
    let nowpaymentsData: {
      paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string;
    } | null = null;
    let mpesaData: { checkoutRequestId: string; message: string } | null = null;

    if (paymentMethod === "wallet") {
      const userRows = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
      const balance = parseFloat(userRows[0]?.walletBalance ?? "0");
      if (balance < price) {
        res.status(400).json({ error: `Insufficient wallet balance. You have $${balance.toFixed(2)} but need $${price.toFixed(2)}.` });
        return;
      }
      await db.update(usersTable).set({ walletBalance: sql`wallet_balance - ${price.toFixed(2)}` }).where(eq(usersTable.id, payload.userId));
      await db.update(ordersTable).set({ paymentStatus: "paid", paidAt: new Date() }).where(eq(ordersTable.id, order.id));
      await db.update(toolActivationsTable).set({ notes: `Rental: ${Number(durationDays)} day(s) | Payment: Wallet ($${price.toFixed(2)}) — paid` }).where(eq(toolActivationsTable.id, activation.id));
      sendEmail({
        to: payload.email,
        ...paymentConfirmedEmail({ orderId: order.id, customerName: null, amount: String(price), paymentMethod: "wallet" }),
      }).catch((err) => logger.error({ err }, "Failed to send unlock rental wallet payment email"));
      responseStatus = "paid";

    } else if (paymentMethod === "nowpayments") {
      if (price < 13) {
        res.status(400).json({ error: "NOWPayments requires a minimum of $13.00. Please choose another payment method." });
        return;
      }
      const npCurrency = payCurrency ?? "usdttrc20";
      try {
        const payment = await createPayment({
          priceAmount: price,
          priceCurrency: "usd",
          payCurrency: npCurrency,
          orderId: `ur-${order.id}`,
          orderDescription: `GSM World Unlock Rental #${order.id} — ${orderName}`,
        });
        await db.insert(paymentTransactionsTable).values({
          orderId: order.id,
          provider: "nowpayments",
          providerReference: payment.payment_id,
          amount: String(price),
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
        const msg = payErr instanceof Error ? payErr.message : "NOWPayments error";
        logger.error({ payErr }, "NOWPayments unlock rental payment creation failed");
        await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
        res.status(500).json({ error: msg });
        return;
      }

    } else if (paymentMethod === "mpesa") {
      if (!customerPhone) { res.status(400).json({ error: "Phone number required for M-Pesa" }); return; }
      const amountKes = Math.ceil(price * USD_TO_KES);
      try {
        const stkRes = await initiateSTKPush({ phone: customerPhone, amount: amountKes, orderId: order.id, description: `Unlock Rental #${order.id}` });
        await db.insert(paymentTransactionsTable).values({
          orderId: order.id,
          provider: "mpesa",
          providerReference: stkRes.CheckoutRequestID,
          amount: String(amountKes),
          currency: "KES",
          status: "pending",
          rawResponse: stkRes as unknown as Record<string, unknown>,
        });
        mpesaData = { checkoutRequestId: stkRes.CheckoutRequestID, message: stkRes.CustomerMessage };
      } catch (err) {
        logger.error({ err }, "STK Push failed for unlock rental");
        await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
        res.status(500).json({ error: "M-Pesa payment initiation failed" });
        return;
      }

    } else if (paymentMethod === "binance_pay") {
      const binanceId = await getBinancePayId();
      await db.update(ordersTable).set({ paymentStatus: "pending_payment_confirmation" }).where(eq(ordersTable.id, order.id));
      await db.insert(paymentTransactionsTable).values({
        orderId: order.id,
        provider: "binance_pay",
        providerReference: null,
        amount: String(price),
        currency: "USD",
        status: "pending",
        rawResponse: { binanceId, reference: `ORDER-${order.id}` } as Record<string, unknown>,
      });
      customData = { method: "binance_pay", binanceId, amount: price, reference: `ORDER-${order.id}` };
      responseStatus = "pending_payment_confirmation";
      sendEmail({
        to: payload.email,
        ...pendingManualPaymentEmail({ orderId: order.id, customerName: null, paymentMethod: "binance_pay", total: String(price), binanceId }),
      }).catch((err) => logger.error({ err }, "Failed to send unlock rental Binance email"));

    } else if (paymentMethod === "usdt_manual") {
      const usdtAddr = await getUsdtManualAddress();
      const usdtNet = await getUsdtManualNetwork();
      await db.update(ordersTable).set({ paymentStatus: "pending_payment_confirmation" }).where(eq(ordersTable.id, order.id));
      await db.insert(paymentTransactionsTable).values({
        orderId: order.id,
        provider: "usdt_manual",
        providerReference: null,
        amount: String(price),
        currency: "USDT",
        status: "pending",
        rawResponse: { address: usdtAddr, network: usdtNet, reference: `ORDER-${order.id}` } as Record<string, unknown>,
      });
      customData = { method: "usdt_manual", address: usdtAddr, network: usdtNet, amount: price, reference: `ORDER-${order.id}` };
      responseStatus = "pending_payment_confirmation";
      sendEmail({
        to: payload.email,
        ...pendingManualPaymentEmail({ orderId: order.id, customerName: null, paymentMethod: "usdt_manual", total: String(price), usdtAddress: usdtAddr }),
      }).catch((err) => logger.error({ err }, "Failed to send unlock rental USDT email"));
    }

    // Customer order confirmation email (skip manual methods — already sent specific instructions)
    if (paymentMethod !== "binance_pay" && paymentMethod !== "usdt_manual") {
      const orderUrl = appUrl(`/account/activations`);
      sendEmail({
        to: payload.email,
        subject: `Order Received: ${toolName} Rental — GSM World`,
        text: `Your unlock tool rental has been received.\n\nTool: ${toolName}\nDuration: ${durationDays} day(s)\nAmount: $${price.toFixed(2)}\nReference: ORDER-${order.id}\n\nWe will process and deliver within 1–3 hours.\n\nTrack your order: ${orderUrl}\n\n— GSM World Team`,
        html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;padding:24px;"><h2 style="color:#0f172a;">Rental Order Received</h2><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;"><tr style="background:#f8fafc;"><td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;">Tool</td><td style="padding:10px 16px;color:#0f172a;font-size:13px;font-weight:700;">${String(toolName)}</td></tr><tr><td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;border-top:1px solid #f1f5f9;">Duration</td><td style="padding:10px 16px;color:#0f172a;font-size:13px;font-weight:700;border-top:1px solid #f1f5f9;">${Number(durationDays)} day(s)</td></tr><tr style="background:#f8fafc;"><td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;border-top:1px solid #f1f5f9;">Amount</td><td style="padding:10px 16px;color:#0f172a;font-size:13px;font-weight:700;border-top:1px solid #f1f5f9;">$${price.toFixed(2)}</td></tr><tr><td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;border-top:1px solid #f1f5f9;">Reference</td><td style="padding:10px 16px;color:#0f172a;font-size:13px;font-weight:700;border-top:1px solid #f1f5f9;">ORDER-${order.id}</td></tr></table><p style="color:#475569;font-size:14px;">Delivery within 1–3 hours. <a href="${orderUrl}" style="color:#0ea5e9;">Track your order</a></p><p style="color:#475569;font-size:14px;">— GSM World Team</p></div>`,
      }).catch((err) => logger.error({ err }, "Failed to send unlock rental confirmation email"));
    }

    // Admin notification
    try {
      const smtpCfg = await getSmtpConfig();
      const adminEmail = smtpCfg.emailFrom;
      if (adminEmail) {
        sendEmail({
          to: adminEmail,
          ...adminNewOrderAlertEmail({
            orderId: order.id,
            orderType: "Unlock Tool Rental",
            customerEmail: payload.email,
            items: `${orderName}`,
            total: price.toFixed(2),
            paymentMethod,
          }),
        }).catch((err) => logger.error({ err }, "Failed to send admin unlock rental alert"));
      }
    } catch { /* non-fatal */ }

    res.json({
      orderId: order.id,
      activationId: activation.id,
      status: responseStatus,
      paymentMethod,
      total: price,
      mpesa: mpesaData,
      nowpayments: nowpaymentsData,
      custom: customData,
    });
  } catch (err) {
    logger.error({ err }, "Unlock rental checkout failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
