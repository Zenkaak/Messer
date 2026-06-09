import { db, adminSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ── In-memory cache for admin settings (60s TTL) ────────────────────────────
const _settingsCache = new Map<string, { value: string | null; ts: number }>();
const SETTINGS_CACHE_TTL_MS = 60_000;

function _invalidateSettingsCache(): void {
  _settingsCache.clear();
}

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
  "openai_api_url",
  "imei_info_api_token",
  "bot_system_prompt",
  "cascade_models",
  "cascade_updated_at",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

async function getSetting(key: SettingKey): Promise<string | null> {
  const now = Date.now();
  const hit = _settingsCache.get(key);
  if (hit && now - hit.ts < SETTINGS_CACHE_TTL_MS) return hit.value;

  let result: string | null = null;
  try {
    const rows = await db
      .select()
      .from(adminSettingsTable)
      .where(eq(adminSettingsTable.key, key))
      .limit(1);
    if (rows[0]?.value) result = rows[0].value;
  } catch {
    // admin_settings table may not exist yet — fall through to env-var fallback
  }

  if (result === null) {
    const envFallback: Partial<Record<SettingKey, string | undefined>> = {
      mpesa_shortcode: process.env.MPESA_SHORTCODE,
      mpesa_consumer_key: process.env.MPESA_CONSUMER_KEY,
      mpesa_consumer_secret: process.env.MPESA_CONSUMER_SECRET,
      mpesa_passkey: process.env.MPESA_PASSKEY,
      mpesa_callback_url: process.env.MPESA_CALLBACK_URL,
      usdt_wallet_address: process.env.USDT_WALLET_ADDRESS,
      usdt_network: process.env.USDT_NETWORK,
      ots_api_token: process.env.OTS_API_TOKEN,
      ots_sender_id: process.env.SENDER_ID,
      ots_admin_phone: process.env.ADMIN_PHONE,
      openai_api_key: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      openai_api_url: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
    };
    result = envFallback[key] ?? null;
  }

  _settingsCache.set(key, { value: result, ts: now });
  return result;
}

async function setSetting(key: SettingKey, value: string): Promise<void> {
  await db
    .insert(adminSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: adminSettingsTable.key, set: { value, updatedAt: new Date() } });
  _settingsCache.delete(key);
}

async function deleteSetting(key: SettingKey): Promise<void> {
  await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, key));
  _settingsCache.delete(key);
}

export async function getAllSettings() {
  let rows: { key: string; value: string | null }[] = [];
  try {
    rows = await db.select().from(adminSettingsTable);
  } catch {
    // admin_settings table may not exist yet — return safe defaults
  }
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
    otsApiToken: (map["ots_api_token"] || process.env.OTS_API_TOKEN) ? "***" : null,
    otsSenderId: map["ots_sender_id"] || process.env.SENDER_ID || null,
    otsAdminPhone: map["ots_admin_phone"] || process.env.ADMIN_PHONE || null,
    openaiApiKey: (map["openai_api_key"] || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY) ? "***" : null,
    imeiInfoApiToken: (map["imei_info_api_token"] || process.env.IMEI_INFO_API_TOKEN) ? "***" : null,
    botSystemPromptOverride: map["bot_system_prompt"] || null,
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
    imeiInfoApiToken: "imei_info_api_token",
    botSystemPromptOverride: "bot_system_prompt",
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
  const hash = await bcrypt.hash(newPassword, 12);
  await db
    .insert(adminSettingsTable)
    .values({ key: "admin_password", value: hash })
    .onConflictDoUpdate({
      target: adminSettingsTable.key,
      set: { value: hash, updatedAt: new Date() },
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

export async function checkAdminPassword(input: string): Promise<boolean> {
  if (!input) return false;
  const stored = await getAdminPassword();
  if (!stored) return false;
  if (stored.startsWith("$2")) {
    return bcrypt.compare(input, stored);
  }
  // Legacy plaintext — compare then transparently re-hash (one-time migration)
  if (input === stored) {
    setAdminPassword(input).catch(() => null);
    return true;
  }
  return false;
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

export async function getWhatsappContact(): Promise<string> {
  return (await getSetting("whatsapp_contact")) || "254112628799";
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

export async function getOtsConfig(): Promise<{ apiToken: string | null; senderId: string | null; adminPhone: string | null }> {
  const [apiToken, senderId, adminPhone] = await Promise.all([
    getSetting("ots_api_token"),
    getSetting("ots_sender_id"),
    getSetting("ots_admin_phone"),
  ]);
  return { apiToken, senderId, adminPhone };
}

export async function getOpenAiKey(): Promise<string | null> {
  return getSetting("openai_api_key");
}

export async function getOpenAiBaseUrl(): Promise<string> {
  return (await getSetting("openai_api_url")) || "https://api.openai.com";
}

export async function getBotSystemPromptOverride(): Promise<string | null> {
  return getSetting("bot_system_prompt");
}

export async function getImeiInfoApiToken(): Promise<string | null> {
  return (await getSetting("imei_info_api_token")) || process.env.IMEI_INFO_API_TOKEN || null;
}

// ── AI Model Cascade ─────────────────────────────────────────────────────────
// The cascade is stored in DB as a JSON array of working model IDs.
// If the DB has no value (first run), fall back to the hardcoded defaults.

export const FALLBACK_CASCADE = [
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

export async function getWorkingCascade(): Promise<string[]> {
  const raw = await getSetting("cascade_models");
  if (raw) {
    try {
      const models = JSON.parse(raw) as string[];
      if (Array.isArray(models) && models.length > 0) return models;
    } catch { /* fall through */ }
  }
  return [...FALLBACK_CASCADE];
}

export async function setWorkingCascade(models: string[]): Promise<void> {
  await setSetting("cascade_models", JSON.stringify(models));
  await setSetting("cascade_updated_at", new Date().toISOString());
}

export async function getCascadeStatus(): Promise<{
  models: string[];
  updatedAt: string | null;
  isDefault: boolean;
}> {
  const [modelsRaw, updatedAt] = await Promise.all([
    getSetting("cascade_models"),
    getSetting("cascade_updated_at"),
  ]);
  let models = [...FALLBACK_CASCADE];
  let isDefault = true;
  if (modelsRaw) {
    try {
      const parsed = JSON.parse(modelsRaw) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        models = parsed;
        isDefault = false;
      }
    } catch { /* fall through */ }
  }
  return { models, updatedAt: updatedAt ?? null, isDefault };
}
