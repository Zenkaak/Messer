import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  toolActivationsTable, usersTable, ordersTable, orderItemsTable, paymentTransactionsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendEmail, appUrl, pendingManualPaymentEmail, paymentConfirmedEmail } from "../lib/email";
import {
  getBinancePayId,
  getUsdtManualAddress,
  getUsdtManualNetwork,
} from "../lib/admin-settings";
import { createPayment } from "../lib/nowpayments";
import { initiateSTKPush } from "../lib/mpesa";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-change-in-prod";

function getUser(authHeader: string | undefined): { userId: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

router.get("/activations", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(toolActivationsTable)
    .where(eq(toolActivationsTable.userId, payload.userId))
    .orderBy(desc(toolActivationsTable.createdAt));

  res.json({ activations: rows });
});

router.post("/activations", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { toolName, toolCategory, username, serialKey, orderRef, paymentMethod, priceUsd } = req.body || {};

  if (!toolName || !toolCategory || !username || !serialKey) {
    res.status(400).json({ error: "toolName, toolCategory, username, and serialKey are required" });
    return;
  }

  if (!paymentMethod) {
    res.status(400).json({ error: "Payment method is required. Choose wallet, usdt_manual, or binance_pay." });
    return;
  }

  const price = typeof priceUsd === "number" && priceUsd > 0 ? priceUsd : null;

  if (paymentMethod === "wallet") {
    if (!price || price <= 0) {
      res.status(400).json({ error: "A valid price is required for wallet payment." });
      return;
    }
    const userRows = await db
      .select({ walletBalance: usersTable.walletBalance })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);
    const balance = parseFloat(userRows[0]?.walletBalance ?? "0");
    if (balance < price) {
      res.status(400).json({ error: `Insufficient wallet balance. You have $${balance.toFixed(2)} but need $${price.toFixed(2)}.` });
      return;
    }
    const updated = await db
      .update(usersTable)
      .set({ walletBalance: sql`wallet_balance - ${price.toFixed(2)}` })
      .where(and(eq(usersTable.id, payload.userId), sql`wallet_balance >= ${price.toFixed(2)}`))
      .returning({ id: usersTable.id });
    if (updated.length === 0) {
      res.status(400).json({ error: "Insufficient wallet balance." });
      return;
    }
  }

  const paymentNote = paymentMethod === "wallet"
    ? `Payment: Wallet ($${price?.toFixed(2) ?? "?"})`
    : paymentMethod === "usdt_manual"
      ? `Payment: USDT TRC20 Manual${price ? ` ($${price.toFixed(2)})` : ""} — awaiting confirmation`
      : paymentMethod === "binance_pay"
        ? `Payment: Binance Pay${price ? ` ($${price.toFixed(2)})` : ""} — awaiting confirmation`
        : `Payment method: ${paymentMethod}`;

  const [activation] = await db
    .insert(toolActivationsTable)
    .values({
      userId: payload.userId,
      toolName: String(toolName),
      toolCategory: String(toolCategory),
      username: String(username),
      serialKey: String(serialKey),
      orderRef: orderRef ? String(orderRef) : null,
      status: "pending",
      notes: paymentNote,
    })
    .returning();

  logger.info({ userId: payload.userId, toolName, toolCategory, paymentMethod, priceUsd }, "Activation request submitted");

  const orderLink = appUrl("/account/activations");
  sendEmail({
    to: payload.email,
    subject: `Order Received: ${toolName} — GSM World`,
    text: `Dear Customer,\n\nYour order has been received.\n\nItem: ${toolName}\nReference: GC-${activation.id}\n${paymentNote}\n\nTrack your order here: ${orderLink}\n\nWe will process and deliver within 10-30 minutes.\n\n— GSM World Team`,
    html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;padding:24px;">
      <h2 style="color:#0f172a;margin:0 0 16px;">Order Received</h2>
      <p style="color:#475569;margin:0 0 12px;">Your order has been received and is being processed.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0;">
        <tr style="background:#f8fafc;"><td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;">Item</td><td style="padding:10px 16px;color:#0f172a;font-size:13px;font-weight:700;">${String(toolName)}</td></tr>
        <tr><td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;border-top:1px solid #f1f5f9;">Reference</td><td style="padding:10px 16px;color:#0f172a;font-size:13px;font-weight:700;border-top:1px solid #f1f5f9;">GC-${activation.id}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;border-top:1px solid #f1f5f9;">Payment</td><td style="padding:10px 16px;color:#0f172a;font-size:13px;font-weight:700;border-top:1px solid #f1f5f9;">${paymentNote}</td></tr>
      </table>
      <p style="color:#475569;margin:0 0 16px;font-size:14px;">Delivery within 10-30 minutes. <a href="${orderLink}" style="color:#0ea5e9;">Track your order</a></p>
      <p style="color:#475569;margin:0;font-size:14px;">Regards,<br><strong style="color:#0f172a;">GSM World Team</strong></p>
    </div>`,
  }).catch((err) => logger.error({ err }, "Failed to send activation confirmation email"));

  res.json({ activation });
});

// ── Gift Card Checkout — uses the full payment system ────────────────────────
router.post("/gift-cards/checkout", async (req, res) => {
  try {
    const payload = getUser(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

    const {
      brand, region, currency, symbol, denomination, recipientEmail, giftMessage,
      paymentMethod, priceUsd, payCurrency,
    } = req.body || {};

    if (!brand || !region || !denomination || !recipientEmail || !paymentMethod) {
      res.status(400).json({ error: "brand, region, denomination, recipientEmail, and paymentMethod are required" });
      return;
    }

    const price = typeof priceUsd === "number" && priceUsd > 0 ? priceUsd : null;
    const cardName = `${String(brand)} ${String(symbol ?? "")}${String(denomination)} Gift Card (${String(region)})`;

    // Create real order so payment infrastructure works (paymentTransactions FK)
    const sessionId = `user:${payload.userId}`;
    const [order] = await db
      .insert(ordersTable)
      .values({
        sessionId,
        customerEmail: payload.email,
        paymentMethod,
        paymentStatus: "pending",
        total: price != null ? String(price) : "0",
        currency: String(currency ?? "USD"),
        orderType: "gift_card",
        notes: `Gift card: ${cardName} → ${recipientEmail}${giftMessage ? ` | "${giftMessage}"` : ""}`,
      })
      .returning();

    // Order item (productId 0 = gift card, no FK constraint)
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: 0,
      productName: cardName,
      price: price != null ? String(price) : "0",
      quantity: 1,
    });

    // Tool activation record (customer sees this in /account/activations)
    const [activation] = await db
      .insert(toolActivationsTable)
      .values({
        userId: payload.userId,
        toolName: cardName,
        toolCategory: "Gift Cards",
        username: String(recipientEmail),
        serialKey: `GC-ORDER-${order.id}`,
        orderRef: `ORDER-${order.id}`,
        status: "pending",
        notes: `Payment: ${paymentMethod}${price ? ` ($${price.toFixed(2)})` : ""} — awaiting confirmation`,
      })
      .returning();

    let responseStatus = "pending";
    let customData: Record<string, unknown> | null = null;
    let nowpaymentsData: {
      paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string;
    } | null = null;
    let mpesaData: { checkoutRequestId: string; message: string } | null = null;

    if (paymentMethod === "wallet") {
      if (!price || price <= 0) {
        res.status(400).json({ error: "A USD price is required for wallet payment." });
        return;
      }
      const userRows = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
      const balance = parseFloat(userRows[0]?.walletBalance ?? "0");
      if (balance < price) {
        res.status(400).json({ error: `Insufficient wallet balance. You have $${balance.toFixed(2)} but need $${price.toFixed(2)}.` });
        return;
      }
      const gcUpdated = await db.update(usersTable)
        .set({ walletBalance: sql`wallet_balance - ${price.toFixed(2)}` })
        .where(and(eq(usersTable.id, payload.userId), sql`wallet_balance >= ${price.toFixed(2)}`))
        .returning({ id: usersTable.id });
      if (gcUpdated.length === 0) {
        res.status(400).json({ error: "Insufficient wallet balance." });
        return;
      }
      await db.update(ordersTable).set({ paymentStatus: "paid", paidAt: new Date() }).where(eq(ordersTable.id, order.id));
      await db.update(toolActivationsTable).set({ notes: `Payment: Wallet ($${price.toFixed(2)}) — paid` }).where(eq(toolActivationsTable.id, activation.id));
      sendEmail({
        to: payload.email,
        ...paymentConfirmedEmail({ orderId: order.id, customerName: null, amount: String(price), paymentMethod: "wallet" }),
      }).catch((err) => logger.error({ err }, "Failed to send gift card wallet payment email"));
      responseStatus = "paid";

    } else if (paymentMethod === "nowpayments") {
      if (!price || price < 13) {
        res.status(400).json({ error: "NOWPayments requires a minimum of $13.00. Please choose another payment method." });
        return;
      }
      const npCurrency = payCurrency ?? "usdttrc20";
      try {
        const payment = await createPayment({
          priceAmount: price,
          priceCurrency: "usd",
          payCurrency: npCurrency,
          orderId: `gc-${order.id}`,
          orderDescription: `GSM World Gift Card #${order.id} — ${cardName}`,
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
        logger.error({ payErr }, "NOWPayments gift card payment creation failed");
        await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
        res.status(500).json({ error: msg });
        return;
      }

    } else if (paymentMethod === "mpesa") {
      const phone = req.body.customerPhone as string | undefined;
      if (!phone) { res.status(400).json({ error: "Phone number required for M-Pesa" }); return; }
      if (!price) { res.status(400).json({ error: "A USD price is required for M-Pesa payment." }); return; }
      const amountKes = Math.ceil(price * 130);
      try {
        const stkRes = await initiateSTKPush({ phone, amount: amountKes, orderId: order.id, description: `Gift Card #${order.id}` });
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
        logger.error({ err }, "STK Push failed for gift card");
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
        amount: price != null ? String(price) : "0",
        currency: "USD",
        status: "pending",
        rawResponse: { binanceId, reference: `ORDER-${order.id}` } as Record<string, unknown>,
      });
      customData = { method: "binance_pay", binanceId, amount: price, reference: `ORDER-${order.id}` };
      responseStatus = "pending_payment_confirmation";
      sendEmail({
        to: payload.email,
        ...pendingManualPaymentEmail({ orderId: order.id, customerName: null, paymentMethod: "binance_pay", total: price != null ? String(price) : "0", binanceId }),
      }).catch((err) => logger.error({ err }, "Failed to send gift card Binance email"));

    } else if (paymentMethod === "usdt_manual") {
      const usdtAddress = await getUsdtManualAddress();
      const usdtNetwork = await getUsdtManualNetwork();
      await db.update(ordersTable).set({ paymentStatus: "pending_payment_confirmation" }).where(eq(ordersTable.id, order.id));
      await db.insert(paymentTransactionsTable).values({
        orderId: order.id,
        provider: "usdt_manual",
        providerReference: null,
        amount: price != null ? String(price) : "0",
        currency: "USDT",
        status: "pending",
        rawResponse: { address: usdtAddress, network: usdtNetwork, reference: `ORDER-${order.id}` } as Record<string, unknown>,
      });
      customData = { method: "usdt_manual", address: usdtAddress, network: usdtNetwork, amount: price, reference: `ORDER-${order.id}` };
      responseStatus = "pending_payment_confirmation";
      sendEmail({
        to: payload.email,
        ...pendingManualPaymentEmail({ orderId: order.id, customerName: null, paymentMethod: "usdt_manual", total: price != null ? String(price) : "0", usdtAddress }),
      }).catch((err) => logger.error({ err }, "Failed to send gift card USDT email"));

    } else {
      res.status(400).json({ error: `Unknown payment method: ${paymentMethod}` });
      return;
    }

    logger.info({ userId: payload.userId, orderId: order.id, activationId: activation.id, paymentMethod }, "Gift card checkout created");

    res.json({
      orderId: order.id,
      activationId: activation.id,
      paymentMethod,
      status: responseStatus,
      total: price ?? 0,
      currency: currency ?? "USD",
      custom: customData,
      nowpayments: nowpaymentsData,
      mpesa: mpesaData,
    });
  } catch (err) {
    logger.error({ err }, "Gift card checkout failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/activations/:id", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(toolActivationsTable)
    .where(eq(toolActivationsTable.id, id))
    .limit(1);

  if (!existing || existing.userId !== payload.userId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.status !== "pending") {
    res.status(400).json({ error: "Only pending activations can be cancelled" });
    return;
  }

  await db
    .update(toolActivationsTable)
    .set({ status: "rejected", notes: "Cancelled by user", updatedAt: new Date() })
    .where(eq(toolActivationsTable.id, id));

  res.json({ success: true });
});

export default router;
