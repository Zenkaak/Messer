import { logger } from "./logger.js";
import { getMpesaCredentials } from "./admin-settings.js";

interface MpesaTokenResponse {
  access_token: string;
  expires_in: string;
}

interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

interface STKQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: string;
  ResultDesc?: string;
}

function getBaseUrl(env: string) {
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

async function getAccessToken(consumerKey: string, consumerSecret: string, env: string): Promise<string> {
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const base = getBaseUrl(env);

  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get M-Pesa token: ${res.status}`);
  }

  const data = (await res.json()) as MpesaTokenResponse;
  return data.access_token;
}

function getTimestamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

function makePassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

function formatPhone(raw: string): string {
  let phone = raw.replace(/\s+/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  if (!phone.startsWith("254")) phone = "254" + phone;
  return phone;
}

export async function initiateSTKPush(params: {
  phone: string;
  amount: number;
  orderId: number;
  description: string;
}): Promise<STKPushResponse> {
  const creds = await getMpesaCredentials();
  const { shortcode, consumerKey, consumerSecret, passkey, mpesaEnv } = creds;
  let { callbackUrl } = creds;

  if (!shortcode || !consumerKey || !consumerSecret || !passkey) {
    throw new Error("M-Pesa credentials not fully configured. Set them in the admin Payments panel.");
  }

  if (!callbackUrl) {
    const domain =
      process.env.REPLIT_DOMAINS?.split(",")[0] ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL;
    callbackUrl = domain ? `https://${domain}/api/payments/mpesa/callback` : null;
  }
  if (!callbackUrl) {
    throw new Error("M-Pesa callback URL not configured. Set it in Admin → Payments.");
  }

  const token = await getAccessToken(consumerKey, consumerSecret, mpesaEnv);
  const timestamp = getTimestamp();
  const password = makePassword(shortcode, passkey, timestamp);
  const base = getBaseUrl(mpesaEnv);
  const phone = formatPhone(params.phone);

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.ceil(params.amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: `ORDER-${params.orderId}`,
    TransactionDesc: params.description,
  };

  const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, "STK Push failed");
    throw new Error(`STK Push failed: ${res.status} ${text}`);
  }

  return (await res.json()) as STKPushResponse;
}

export async function querySTKPush(checkoutRequestId: string): Promise<STKQueryResponse> {
  const creds = await getMpesaCredentials();
  const { shortcode, consumerKey, consumerSecret, passkey, mpesaEnv } = creds;

  if (!shortcode || !consumerKey || !consumerSecret || !passkey) {
    throw new Error("M-Pesa credentials not configured");
  }

  const token = await getAccessToken(consumerKey, consumerSecret, mpesaEnv);
  const timestamp = getTimestamp();
  const password = makePassword(shortcode, passkey, timestamp);
  const base = getBaseUrl(mpesaEnv);

  const res = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`STK Query failed: ${text}`);
  }

  return (await res.json()) as STKQueryResponse;
}
