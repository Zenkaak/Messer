import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { initiateSTKPush } from "../lib/mpesa";
import { getUsdtWallet, getUsdtNetwork } from "../lib/admin-settings";
import { sendEmail } from "../lib/email";
import {
  createPayment,
  getPaymentStatus,
  isNowPaymentsEnabled,
  verifyIpnSignature,
  getIpnSecret,
} from "../lib/nowpayments";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-change-in-prod";
const USD_TO_KES = 130;

const walletTopUpPending = new Map<string, { userId: number; amountUsd: number; email: string }>();
const nowPaymentsPending = new Map<string, { userId: number; amountUsd: number; email: string }>();

function getUser(authHeader: string | undefined): { userId: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

router.get("/wallet/balance", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ balance: parseFloat(rows[0].walletBalance ?? "0") });
});

router.post("/wallet/add-fund/mpesa", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { phone, amount } = req.body || {};
  if (!phone || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: "Phone number and amount are required" });
    return;
  }
  const amountUsd = Number(amount);
  const amountKes = Math.ceil(amountUsd * USD_TO_KES);
  try {
    const stk = await initiateSTKPush({ phone: String(phone), amount: amountKes, orderId: payload.userId, description: `Wallet TopUp $${amountUsd}` });
    walletTopUpPending.set(stk.CheckoutRequestID, { userId: payload.userId, amountUsd, email: payload.email });
    setTimeout(() => walletTopUpPending.delete(stk.CheckoutRequestID), 15 * 60 * 1000);
    logger.info({ userId: payload.userId, amountUsd, amountKes }, "Wallet M-Pesa STK sent");
    const userRows = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (userRows[0]?.email) {
      sendEmail({ to: userRows[0].email, subject: "Wallet top-up started", text: `We sent your top-up request for $${amountUsd}. Enter your M-Pesa PIN to complete.` }).catch((e) => logger.error({ e }, "Email send failed"));
    }
    res.json({ success: true, message: `STK push sent to ${phone}. Enter your M-Pesa PIN to complete.`, checkoutRequestId: stk.CheckoutRequestID, amountKes, amountUsd });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "M-Pesa error";
    logger.error({ err }, "Wallet M-Pesa failed");
    res.status(500).json({ error: msg });
  }
});

router.post("/wallet/add-fund/mpesa/callback", async (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); return; }
    const checkoutRequestId: string = body.CheckoutRequestID;
    const resultCode: number = body.ResultCode;
    const pending = walletTopUpPending.get(checkoutRequestId);
    if (pending && resultCode === 0) {
      walletTopUpPending.delete(checkoutRequestId);
      const { userId, amountUsd, email } = pending;
      await db.update(usersTable).set({ walletBalance: sql`wallet_balance + ${amountUsd.toFixed(2)}` }).where(eq(usersTable.id, userId));
      logger.info({ userId, amountUsd }, "Wallet top-up credited via M-Pesa callback");
      sendEmail({ to: email, subject: "Wallet top-up confirmed", text: `Your wallet has been credited with $${amountUsd.toFixed(2)} USD. Thank you!` }).catch((e) => logger.error({ e }, "Email send failed"));
    } else if (pending) {
      walletTopUpPending.delete(checkoutRequestId);
      logger.info({ checkoutRequestId, resultCode }, "Wallet top-up failed/cancelled");
    }
  } catch (err) {
    logger.error({ err }, "Wallet M-Pesa callback error");
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.post("/wallet/add-fund/mpesa/query", async (req, res) => {
  try {
    const payload = getUser(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { checkoutRequestId } = req.body || {};
    if (!checkoutRequestId) { res.status(400).json({ error: "checkoutRequestId required" }); return; }
    const { querySTKPush } = await import("../lib/mpesa");
    const result = await querySTKPush(String(checkoutRequestId));
    if (result.ResultCode === "0") {
      const pending = walletTopUpPending.get(checkoutRequestId);
      if (pending) {
        walletTopUpPending.delete(checkoutRequestId);
        await db.update(usersTable).set({ walletBalance: sql`wallet_balance + ${pending.amountUsd.toFixed(2)}` }).where(eq(usersTable.id, pending.userId));
        logger.info({ userId: pending.userId, amountUsd: pending.amountUsd }, "Wallet top-up credited via query");
        res.json({ status: "paid", message: "Payment confirmed. Wallet credited!" });
      } else {
        res.json({ status: "paid", message: "Payment confirmed." });
      }
    } else if (result.ResultCode !== undefined) {
      walletTopUpPending.delete(checkoutRequestId);
      res.json({ status: "failed", message: result.ResultDesc ?? "Payment failed or cancelled." });
    } else {
      res.json({ status: "pending", message: "Waiting for payment confirmation…" });
    }
  } catch {
    res.json({ status: "pending", message: "Checking payment status…" });
  }
});

router.get("/wallet/add-fund/usdt", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const walletAddress = await getUsdtWallet();
  const network = await getUsdtNetwork();
  res.json({ addresses: [{ network: "TRC20 (TRON)", address: walletAddress || "TVqXjYMCWuuEZynkGXL4WP3MnHzrJEfJFM", minDeposit: "1 USDT", confirmations: "1" }], note: "Send only USDT on the TRC20 (TRON) network. Funds are credited automatically after network confirmation. Contact support with your transaction hash if not credited within 30 minutes." });
});

router.post("/wallet/add-fund/nowpayments", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { amount, payCurrency } = req.body || {};
  if (!amount || isNaN(Number(amount)) || Number(amount) < 13) {
    res.status(400).json({ error: "Amount must be at least $13" });
    return;
  }
  const enabled = await isNowPaymentsEnabled();
  if (!enabled) { res.status(503).json({ error: "Crypto payment is not enabled" }); return; }
  const amountUsd = Number(amount);
  const baseUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "https://gsmworld.vercel.app";
  try {
    const payment = await createPayment({
      priceAmount: amountUsd,
      priceCurrency: "usd",
      payCurrency: payCurrency || "usdttrc20",
      orderId: `wallet-${payload.userId}-${Date.now()}`,
      orderDescription: `GSM World wallet top-up $${amountUsd}`,
      ipnCallbackUrl: `${baseUrl}/api/wallet/add-fund/nowpayments/ipn`,
      successUrl: `${baseUrl}/account/add-fund?nowpayments=success`,
      cancelUrl: `${baseUrl}/account/add-fund?nowpayments=cancel`,
    });
    nowPaymentsPending.set(payment.payment_id, { userId: payload.userId, amountUsd, email: payload.email });
    setTimeout(() => nowPaymentsPending.delete(payment.payment_id), 2 * 60 * 60 * 1000);
    logger.info({ userId: payload.userId, amountUsd, paymentId: payment.payment_id }, "NOWPayments wallet top-up created");
    res.json({ success: true, paymentId: payment.payment_id, payAddress: payment.pay_address, payAmount: payment.pay_amount, payCurrency: payment.pay_currency, priceAmount: amountUsd, priceCurrency: "USD", expiresAt: payment.expiration_estimate_date });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "NOWPayments error";
    logger.error({ err }, "NOWPayments wallet top-up failed");
    // Surface NOWPayments AMOUNT_MIN and other client errors as 400 so the UI shows the real reason
    const isClientError = /400|AMOUNT|minimum|too (low|small)/i.test(msg);
    res.status(isClientError ? 400 : 500).json({ error: msg });
  }
});

router.post("/wallet/add-fund/nowpayments/status", async (req, res) => {
  const payload = getUser(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { paymentId } = req.body || {};
  if (!paymentId) { res.status(400).json({ error: "paymentId required" }); return; }
  try {
    const status = await getPaymentStatus(String(paymentId));
    const isFinished = ["finished", "confirmed", "partially_paid"].includes(status.payment_status);
    const isFailed = ["failed", "expired", "refunded"].includes(status.payment_status);
    if (isFinished) {
      const pending = nowPaymentsPending.get(String(paymentId));
      if (pending) {
        nowPaymentsPending.delete(String(paymentId));
        await db.update(usersTable).set({ walletBalance: sql`wallet_balance + ${pending.amountUsd.toFixed(2)}` }).where(eq(usersTable.id, pending.userId));
        logger.info({ userId: pending.userId, amountUsd: pending.amountUsd, paymentId }, "Wallet credited via NOWPayments status check");
        sendEmail({ to: pending.email, subject: "Wallet top-up confirmed", text: `Your wallet has been credited with $${pending.amountUsd.toFixed(2)} via crypto. Thank you!` }).catch(() => null);
      }
      res.json({ status: "paid", paymentStatus: status.payment_status });
    } else if (isFailed) {
      nowPaymentsPending.delete(String(paymentId));
      res.json({ status: "failed", paymentStatus: status.payment_status });
    } else {
      res.json({ status: "pending", paymentStatus: status.payment_status, actuallyPaid: status.actually_paid, payAmount: status.pay_amount });
    }
  } catch (err) {
    logger.error({ err }, "NOWPayments status check failed");
    res.json({ status: "pending", paymentStatus: "unknown" });
  }
});

router.post("/wallet/add-fund/nowpayments/ipn", async (req, res) => {
  try {
    const signature = req.headers["x-nowpayments-sig"] as string | undefined;
    if (signature) {
      const rawBody = JSON.stringify(req.body);
      const secret = await getIpnSecret();
      if (secret && !verifyIpnSignature(rawBody, signature, secret)) {
        logger.warn("NOWPayments IPN signature mismatch");
        res.status(400).json({ error: "Invalid signature" });
        return;
      }
    }
    const data = req.body as { payment_id?: string; payment_status?: string; order_id?: string; price_amount?: number };
    const { payment_id, payment_status, order_id } = data;
    logger.info({ payment_id, payment_status, order_id }, "NOWPayments IPN received");
    const isFinished = ["finished", "confirmed"].includes(payment_status ?? "");
    if (isFinished && payment_id) {
      const pending = nowPaymentsPending.get(payment_id);
      if (pending) {
        nowPaymentsPending.delete(payment_id);
        await db.update(usersTable).set({ walletBalance: sql`wallet_balance + ${pending.amountUsd.toFixed(2)}` }).where(eq(usersTable.id, pending.userId));
        logger.info({ userId: pending.userId, amountUsd: pending.amountUsd }, "Wallet credited via NOWPayments IPN");
        sendEmail({ to: pending.email, subject: "Wallet top-up confirmed", text: `Your wallet has been credited with $${pending.amountUsd.toFixed(2)} via crypto. Thank you!` }).catch(() => null);
      } else if (order_id?.startsWith("wallet-")) {
        const parts = order_id.split("-");
        const userId = parseInt(parts[1] ?? "0", 10);
        const priceAmount = data.price_amount ?? 0;
        if (userId && priceAmount > 0) {
          await db.update(usersTable).set({ walletBalance: sql`wallet_balance + ${priceAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
          logger.info({ userId, priceAmount }, "Wallet credited via NOWPayments IPN (order_id recovery)");
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "NOWPayments IPN error");
  }
  res.status(200).json({ ok: true });
});

router.post("/wallet/credit", async (req, res) => {
  const { userId, amount, adminKey } = req.body || {};
  if (adminKey !== process.env.ADMIN_PASSWORD) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!userId || !amount || isNaN(Number(amount))) { res.status(400).json({ error: "userId and amount required" }); return; }
  await db.update(usersTable).set({ walletBalance: sql`wallet_balance + ${Number(amount).toFixed(2)}` }).where(eq(usersTable.id, Number(userId)));
  const rows = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1);
  if (rows[0]?.email) {
    sendEmail({ to: rows[0].email, subject: "Wallet credited", text: `Your wallet has been credited with $${Number(amount).toFixed(2)}.` }).catch((e) => logger.error({ e }, "Email send failed"));
  }
  res.json({ success: true });
});

export default router;
