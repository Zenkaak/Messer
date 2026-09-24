import { db, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SETTING_KEYS = [
  "mpesa_enabled",
  "mpesa_shortcode",
  "mpesa_consumer_key",
  "mpesa_consumer_secret",
  "mpesa_passkey",
  "mpesa_callback_url",
  "whatsapp_contact",
  "mpesa_env",
  "usdt_enabled",
  "usdt_wallet_address",
  "usdt_network",
  "nowpayments_enabled",
  "nowpayments_api_key",
  "nowpayments_ipn_secret",
  "nowpayments_public_key",
  "coingate_enabled",
  "coingate_api_key",
  "email_from",
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_pass",
  "payment_methods",
  "admin_password",
  "google_client_id",
  "google_client_secret",
  "resend_api_key",
  "binance_pay_id",
  "usdt_manual_address",
  "usdt_manual_network",
  "ots_api_token",
  "ots_sender_id",
  "ots_admin_phone",
  "openai_api_key",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

async function getSetting(key: SettingKey): Promise<string | null> {
  const rows = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, key))
    .limit(1);
  if (rows[0]?.value) return rows[0].value;

  // fallback to env vars
  const envFallback: Partial<Record<SettingKey, string | undefined>> = {
    mpesa_shortcode: process.env.MPESA_SHORTCODE,
    mpesa_consumer_key: process.env.MPESA_CONSUMER_KEY,
    mpesa_consumer_secret: process.env.MPESA_CONSUMER_SECRET,
    mpesa_passkey: process.env.MPESA_PASSKEY,
    mpesa_callback_url: process.env.MPESA_CALLBACK_URL,
    usdt_wallet_address: process.env.USDT_WALLET_ADDRESS,
    usdt_network: process.env.USDT_NETWORK,
  };
  return envFallback[key] ?? null;
}

async function setSetting(key: SettingKey, value: string): Promise<void> {
  await db
    .insert(adminSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: adminSettingsTable.key, set: { value, updatedAt: new Date() } });
}

async function deleteSetting(key: SettingKey): Promise<void> {
  await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, key));
}

export async function getAllSettings() {
  const rows = await db.select().from(adminSettingsTable);
  const map: Record<string, string | null> = {};
  for (const row of rows) map[row.key] = row.value;

  const dbOrEnv = (dbKey: string, envKey?: string) =>
    map[dbKey] || (envKey ? process.env[envKey] : null) || null;

  return {
    mpesaEnabled: map["mpesa_enabled"] === "true" || !!(map["mpesa_consumer_key"] || process.env.MPESA_CONSUMER_KEY),
    mpesaShortcode: dbOrEnv("mpesa_shortcode", "MPESA_SHORTCODE"),
    mpesaConsumerKey: (map["mpesa_consumer_key"] || process.env.MPESA_CONSUMER_KEY) ? "***" : null,
    mpesaConsumerSecret: (map["mpesa_consumer_secret"] || process.env.MPESA_CONSUMER_SECRET) ? "***" : null,
    mpesaPasskey: (map["mpesa_passkey"] || process.env.MPESA_PASSKEY) ? "***" : null,
    mpesaCallbackUrl: dbOrEnv("mpesa_callback_url", "MPESA_CALLBACK_URL"),
    whatsappContact: map["whatsapp_contact"] || null,
    mpesaEnv: map["mpesa_env"] || "sandbox",
    usdtEnabled: map["usdt_enabled"] === "true" || !!(map["usdt_wallet_address"] || process.env.USDT_WALLET_ADDRESS),
    usdtWalletAddress: dbOrEnv("usdt_wallet_address", "USDT_WALLET_ADDRESS"),
    usdtNetwork: dbOrEnv("usdt_network", "USDT_NETWORK") || "TRC20",
    nowpaymentsEnabled: map["nowpayments_enabled"] === "true",
    nowpaymentsApiKey: map["nowpayments_api_key"] ? "***" : null,
    nowpaymentsIpnSecret: map["nowpayments_ipn_secret"] ? "***" : null,
    nowpaymentsPublicKey: map["nowpayments_public_key"] ? "***" : null,
    coingateEnabled: map["coingate_enabled"] === "true",
    coingateApiKey: map["coingate_api_key"] ? "***" : null,
    emailFrom: map["email_from"] || null,
    smtpHost: map["smtp_host"] || null,
    smtpPort: map["smtp_port"] || null,
    smtpSecure: map["smtp_secure"] === "true",
    smtpUser: map["smtp_user"] || null,
    smtpPass: map["smtp_pass"] ? "***" : null,
    resendApiKey: map["resend_api_key"] ? "***" : null,
    googleClientId: map["google_client_id"] ? "***" : null,
    googleClientSecret: map["google_client_secret"] ? "***" : null,
    paymentMethods: map["payment_methods"] ? JSON.parse(map["payment_methods"]) : [],
    otsApiToken: map["ots_api_token"] ? "***" : null,
    otsSenderId: map["ots_sender_id"] || null,
    otsAdminPhone: map["ots_admin_phone"] || null,
    openaiApiKey: map["openai_api_key"] ? "***" : null,
  };
}

export async function updateSettings(updates: Record<string, unknown>) {
  const allowedUpdates: Record<string, SettingKey> = {
    mpesaEnabled: "mpesa_enabled",
    mpesaShortcode: "mpesa_shortcode",
    mpesaConsumerKey: "mpesa_consumer_key",
    mpesaConsumerSecret: "mpesa_consumer_secret",
    mpesaPasskey: "mpesa_passkey",
    mpesaCallbackUrl: "mpesa_callback_url",
    whatsappContact: "whatsapp_contact",
    mpesaEnv: "mpesa_env",
    usdtEnabled: "usdt_enabled",
    usdtWalletAddress: "usdt_wallet_address",
    usdtNetwork: "usdt_network",
    nowpaymentsEnabled: "nowpayments_enabled",
    nowpaymentsApiKey: "nowpayments_api_key",
    nowpaymentsIpnSecret: "nowpayments_ipn_secret",
    nowpaymentsPublicKey: "nowpayments_public_key",
    coingateEnabled: "coingate_enabled",
    coingateApiKey: "coingate_api_key",
    emailFrom: "email_from",
    smtpHost: "smtp_host",
    smtpPort: "smtp_port",
    smtpSecure: "smtp_secure",
    smtpUser: "smtp_user",
    smtpPass: "smtp_pass",
    resendApiKey: "resend_api_key",
    paymentMethods: "payment_methods",
    googleClientId: "google_client_id",
    googleClientSecret: "google_client_secret",
    binancePayId: "binance_pay_id",
    usdtManualAddress: "usdt_manual_address",
    usdtManualNetwork: "usdt_manual_network",
    otsApiToken: "ots_api_token",
    otsSenderId: "ots_sender_id",
    otsAdminPhone: "ots_admin_phone",
    openaiApiKey: "openai_api_key",
  };

  for (const [jsKey, dbKey] of Object.entries(allowedUpdates)) {
    if (jsKey in updates) {
      const val = updates[jsKey];
      if (val === null || val === "" || val === undefined) {
        await deleteSetting(dbKey);
      } else {
        const serialized = typeof val === "object" ? JSON.stringify(val) : String(val);
        await setSetting(dbKey, serialized);
      }
    }
  }

  return getAllSettings();
}

export async function getAdminPassword(): Promise<string> {
  const rows = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, "admin_password"))
    .limit(1);
  const dbPwd = rows[0]?.value ?? null;
  if (dbPwd) return dbPwd;
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return "";
}

export async function setAdminPassword(newPassword: string): Promise<void> {
  await db
    .insert(adminSettingsTable)
    .values({ key: "admin_password", value: newPassword })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: { value: newPassword, updatedAt: new Date() },
    });
}

export async function hasAdminPasswordBeenSet(): Promise<boolean> {
  const rows = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, "admin_password"))
    .limit(1);
  return Boolean(rows[0]?.value);
}

export async function getMpesaCredentials() {
  const [shortcode, consumerKey, consumerSecret, passkey, callbackUrl, mpesaEnv] = await Promise.all([
    getSetting("mpesa_shortcode"),
    getSetting("mpesa_consumer_key"),
    getSetting("mpesa_consumer_secret"),
    getSetting("mpesa_passkey"),
    getSetting("mpesa_callback_url"),
    getSetting("mpesa_env"),
  ]);
  return { shortcode, consumerKey, consumerSecret, passkey, callbackUrl, mpesaEnv: mpesaEnv || "sandbox" };
}

export async function getUsdtWallet() {
  return getSetting("usdt_wallet_address");
}

export async function getUsdtNetwork() {
  return (await getSetting("usdt_network")) || "TRC20";
}

export async function getBinancePayId(): Promise<string> {
  return (await getSetting("binance_pay_id")) || "490759406";
}

export async function getUsdtManualAddress(): Promise<string> {
  return (await getSetting("usdt_manual_address")) || "TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5";
}

export async function getUsdtManualNetwork(): Promise<string> {
  return (await getSetting("usdt_manual_network")) || "TRC20";
}

export async function getPaymentMethods() {
  const raw = await getSetting("payment_methods" as SettingKey);
  if (!raw) return [];
  try { return JSON.parse(raw) as Array<{ method: string; walletAddress: string; network?: string; label?: string; enabled?: boolean }>; } catch { return []; }
}

export type StoredPaymentMethod = {
  method: string;
  walletAddress: string;
  network?: string;
  label?: string;
  enabled?: boolean;
};

export async function getGoogleCredentials(): Promise<{ clientId: string | null; clientSecret: string | null }> {
  const [clientId, clientSecret] = await Promise.all([
    getSetting("google_client_id"),
    getSetting("google_client_secret"),
  ]);
  // env vars take precedence over DB
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || clientId,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || clientSecret,
  };
}

export async function isEnabled(provider: "mpesa" | "usdt" | "nowpayments" | "coingate") {
  const keyMap: Record<string, SettingKey> = {
    mpesa: "mpesa_enabled",
    usdt: "usdt_enabled",
    nowpayments: "nowpayments_enabled",
    coingate: "coingate_enabled",
  };
  const rows = await db
    .select()
    .from(adminSettingsTable)
    .where(eq(adminSettingsTable.key, keyMap[provider]))
    .limit(1);
  const val = rows[0]?.value ?? null;
  if (val !== null) return val === "true";
  if (provider === "mpesa") return !!(process.env.MPESA_CONSUMER_KEY);
  if (provider === "usdt") return !!(process.env.USDT_WALLET_ADDRESS);
  return false;
}

export async function getResendApiKey(): Promise<string | null> {
  return getSetting("resend_api_key");
}

export async function getOtsConfig(): Promise<{ apiToken: string | null; senderId: string | null; adminPhone: string | null }> {
  const [apiToken, senderId, adminPhone] = await Promise.all([
    getSetting("ots_api_token"),
    getSetting("ots_sender_id"),
    getSetting("ots_admin_phone"),
  ]);
  return {
    apiToken: apiToken || process.env.OTS_API_TOKEN || null,
    senderId: senderId || process.env.SENDER_ID || null,
    adminPhone: adminPhone || process.env.ADMIN_PHONE || null,
  };
}

export async function getOpenAiKey(): Promise<string | null> {
  return (await getSetting("openai_api_key")) || process.env.OPENAI_API_KEY || null;
}

export async function getSmtpConfig() {
  const [smtpHost, smtpPort, smtpUser, smtpPass, emailFrom, smtpSecure] = await Promise.all([
    getSetting("smtp_host"),
    getSetting("smtp_port"),
    getSetting("smtp_user"),
    getSetting("smtp_pass"),
    getSetting("email_from"),
    getSetting("smtp_secure"),
  ]);
  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    emailFrom,
    smtpSecure: smtpSecure === "true",
  };
}
