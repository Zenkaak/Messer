import { db, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import * as crypto from "crypto";

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1";

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(adminSettingsTable).where(eq(adminSettingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function getApiKey(): Promise<string> {
  return (await getSetting("nowpayments_api_key")) ?? process.env.NOWPAYMENTS_API_KEY ?? "";
}

export async function getIpnSecret(): Promise<string> {
  return (await getSetting("nowpayments_ipn_secret")) ?? process.env.NOWPAYMENTS_IPN_SECRET ?? "";
}

export async function getPublicKey(): Promise<string> {
  return (await getSetting("nowpayments_public_key")) ?? process.env.NOWPAYMENTS_PUBLIC_KEY ?? "";
}

export async function isNowPaymentsEnabled(): Promise<boolean> {
  const val = await getSetting("nowpayments_enabled");
  if (val !== null) return val === "true";
  return !!(process.env.NOWPAYMENTS_API_KEY);
}

async function apiFetch(path: string, init?: RequestInit) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("NOWPayments API key not configured");
  const res = await fetch(`${NOWPAYMENTS_API}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`NOWPayments ${res.status}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export interface CreatePaymentResult {
  payment_id: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  payment_status: string;
  expiration_estimate_date?: string;
  purchase_id?: string;
}

export interface PaymentStatus {
  payment_id: string;
  payment_status: string;
  pay_amount: number;
  actually_paid: number;
  order_id: string;
  price_amount: number;
  price_currency: string;
  pay_currency: string;
  pay_address: string;
  outcome_amount?: number;
}

export async function createPayment(opts: {
  priceAmount: number;
  priceCurrency?: string;
  payCurrency?: string;
  orderId: string | number;
  orderDescription?: string;
  ipnCallbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CreatePaymentResult> {
  // Only include optional URL fields if they are non-empty.
  // NOWPayments returns INVALID_REQUEST if these are sent as empty strings.
  const body: Record<string, unknown> = {
    price_amount: opts.priceAmount,
    price_currency: opts.priceCurrency ?? "usd",
    pay_currency: opts.payCurrency ?? "usdttrc20",
    order_id: String(opts.orderId),
    order_description: opts.orderDescription ?? `GSM World Order #${opts.orderId}`,
  };
  if (opts.ipnCallbackUrl) body.ipn_callback_url = opts.ipnCallbackUrl;
  if (opts.successUrl) body.success_url = opts.successUrl;
  if (opts.cancelUrl) body.cancel_url = opts.cancelUrl;
  const result = await apiFetch("/payment", { method: "POST", body: JSON.stringify(body) });
  return result as unknown as CreatePaymentResult;
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  const result = await apiFetch(`/payment/${paymentId}`);
  return result as unknown as PaymentStatus;
}

export async function getAvailableCurrencies(): Promise<{ currencies: string[] }> {
  const result = await apiFetch("/currencies");
  return result as unknown as { currencies: string[] };
}

export async function createInvoice(opts: {
  priceAmount: number;
  priceCurrency?: string;
  orderId: string | number;
  orderDescription?: string;
  ipnCallbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ id: string; invoice_url: string; token_id: string; order_id: string }> {
  const body = {
    price_amount: opts.priceAmount,
    price_currency: opts.priceCurrency ?? "usd",
    order_id: String(opts.orderId),
    order_description: opts.orderDescription ?? `GSM World Order #${opts.orderId}`,
    ipn_callback_url: opts.ipnCallbackUrl ?? "",
    success_url: opts.successUrl ?? "",
    cancel_url: opts.cancelUrl ?? "",
  };
  const result = await apiFetch("/invoice", { method: "POST", body: JSON.stringify(body) });
  return result as unknown as { id: string; invoice_url: string; token_id: string; order_id: string };
}

// Verify IPN signature using HMAC-SHA512
export function verifyIpnSignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac("sha512", secret);
    hmac.update(rawBody);
    const expected = hmac.digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (err) {
    logger.error({ err }, "IPN signature verification error");
    return false;
  }
}
