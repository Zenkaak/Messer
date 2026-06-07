import { Router, type IRouter } from "express";
import { ilike, eq, and, or, desc, gt, sql } from "drizzle-orm";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  db,
  ordersTable,
  orderItemsTable,
  productsTable,
  categoriesTable,
  liveChatSessionsTable,
  liveChatMessagesTable,
  cartItemsTable,
  paymentTransactionsTable,
  usersTable,
  adminSettingsTable,
} from "@workspace/db";
import {
  getOpenAiKey,
  getOtsConfig,
  getOpenAiBaseUrl,
  getPaymentMethods,
  getAdminPassword,
  getWhatsappContact,
  getUsdtWallet,
  getUsdtNetwork,
  getBinancePayId,
  getSmtpConfig,
} from "../lib/admin-settings";
import { sendEmail, orderSubmittedEmail, pendingManualPaymentEmail, adminNewOrderAlertEmail, otpEmail } from "../lib/email";
import { initiateSTKPush } from "../lib/mpesa";
import { createPayment } from "../lib/nowpayments";
import { logger } from "../lib/logger";

const _BOT_JWT_SECRET = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";
const _USD_TO_KES = 130;

// ─── OTP helpers (inline to avoid Vercel serverless localhost calls) ───────────
async function _setOtp(key: string, code: string, ttlMs: number) {
  const val = JSON.stringify({ code, expiresAt: Date.now() + ttlMs });
  await db.insert(adminSettingsTable)
    .values({ key: `otp:${key}`, value: val })
    .onConflictDoUpdate({ target: adminSettingsTable.key, set: { value: val, updatedAt: new Date() } });
}
async function _getOtp(key: string): Promise<{ code: string; expiresAt: number } | null> {
  const rows = await db.select({ value: adminSettingsTable.value })
    .from(adminSettingsTable).where(eq(adminSettingsTable.key, `otp:${key}`)).limit(1);
  if (!rows.length || !rows[0].value) return null;
  try { return JSON.parse(rows[0].value) as { code: string; expiresAt: number }; } catch { return null; }
}
async function _deleteOtp(key: string) {
  await db.delete(adminSettingsTable).where(eq(adminSettingsTable.key, `otp:${key}`));
}
function _makeUserToken(userId: number, email: string) {
  return jwt.sign({ userId, email }, _BOT_JWT_SECRET, { expiresIn: "30d" });
}

function resolveBotSession(sessionId: string | null | undefined, botToken: string | null | undefined): { resolvedSession: string; userId: number | null } {
  let resolvedSession = sessionId || "guest-session";
  let userId: number | null = null;
  if (botToken) {
    try {
      const payload = jwt.verify(botToken, _BOT_JWT_SECRET) as { userId?: number };
      if (payload.userId) { resolvedSession = `user:${payload.userId}`; userId = payload.userId; }
    } catch { /* invalid token — use sessionId */ }
  }
  return { resolvedSession, userId };
}

function generateBotOrderCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const router: IRouter = Router();

// ─── Product-type → required order fields ────────────────────────────────────
function getRequiredOrderFields(name: string, description: string, category: string): string[] {
  const text = `${name} ${description} ${category}`.toLowerCase();

  // Gift cards — no device info needed, just denomination/quantity
  if (
    text.includes("gift card") || text.includes("steam") || text.includes("google play") ||
    text.includes("itunes") || text.includes("amazon gift") || text.includes("netflix") ||
    text.includes("playstation") || text.includes("xbox") || text.includes("razer gold") ||
    text.includes("apple gift") || text.includes("ebay gift")
  ) {
    return ["email", "denomination_or_quantity", "payment_method"];
  }

  // Server credits / tool credits — no device info
  if (
    text.includes("server credit") || text.includes("dc-unlocker") || text.includes("octoplus") ||
    text.includes("z3x") || text.includes("sigma") || text.includes("ufi box") ||
    text.includes("easy jtag") || text.includes("credit") || text.includes("credits")
  ) {
    return ["email", "quantity", "payment_method"];
  }

  // Software activation / license keys — hardware ID or none
  if (
    text.includes("activation") || text.includes("license key") || text.includes("software") ||
    text.includes("tool activation")
  ) {
    return ["email", "hardware_id_or_device_serial", "payment_method"];
  }

  // IMEI-based services — always need IMEI
  const needsImei =
    text.includes("imei") || text.includes("blacklist") || text.includes("carrier unlock") ||
    text.includes("icloud") || text.includes("mdm removal") || text.includes("iphone unlock") ||
    text.includes("android unlock") || text.includes("frp") || text.includes("network unlock") ||
    text.includes("sim unlock") || text.includes("factory unlock");

  if (needsImei) {
    const fields = ["email", "imei_number"];
    if (
      text.includes("android") || text.includes("samsung") || text.includes("huawei") ||
      text.includes("lg ") || text.includes("motorola") || text.includes("frp")
    ) {
      fields.push("device_model");
    }
    fields.push("payment_method");
    return fields;
  }

  // Generic unlock/repair — ask IMEI + model to be safe
  return ["email", "imei_number", "device_model", "payment_method"];
}

// ─── Page navigation map ────────────────────────────────────────────────────
const PAGE_HREFS: Record<string, string> = {
  home: "/",
  products: "/products",
  categories: "/categories",
  checkout: "/checkout",
  cart: "/cart",
  "order-lookup": "/orders/lookup",
  account: "/account",
  "account-orders": "/account/orders",
  "account-wallet": "/account/add-fund",
  "account-credits": "/account/credits",
  "account-api": "/account/api",
  "account-bulk": "/account/bulk-order",
  "account-express": "/account/express-order",
  frp: "/frp",
  "iphone-unlock": "/iphone-unlock",
  "android-unlock": "/android-unlock",
  imei: "/imei",
  "gift-cards": "/gift-cards",
  credits: "/credits",
  "unlock-tools": "/unlock-tools",
  activate: "/activate",
  login: "/login",
  signup: "/signup",
};

// ─── System prompt cache (TTL: 10 minutes) ───────────────────────────────────
let _promptCache: { prompt: string; ts: number } | null = null;
const PROMPT_TTL_MS = 10 * 60 * 1000;

async function getCachedSystemPrompt(waContact?: string): Promise<string> {
  const now = Date.now();
  if (_promptCache && now - _promptCache.ts < PROMPT_TTL_MS) {
    return _promptCache.prompt;
  }
  const prompt = await buildSystemPrompt(waContact);
  _promptCache = { prompt, ts: now };
  return prompt;
}

// ─── Build dynamic system prompt from live DB data ──────────────────────────
async function buildSystemPrompt(waContact?: string): Promise<string> {
  const [categories, featuredProducts, paymentMethodRows, catCountRows] = await Promise.all([
    db.select().from(categoriesTable),
    db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        description: productsTable.description,
        categoryId: productsTable.categoryId,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
      })
      .from(productsTable)
      .where(eq(productsTable.featured, true))
      .orderBy(productsTable.categoryId, productsTable.name)
      .limit(60),
    getPaymentMethods(),
    db.execute(sql`SELECT category_id, COUNT(*)::int as cnt FROM products GROUP BY category_id`),
  ]);

  // Map category_id → product count from real DB
  const countMap: Record<number, number> = Object.fromEntries(
    (catCountRows.rows as Array<{ category_id: number; cnt: number }>).map(
      (r) => [Number(r.category_id), Number(r.cnt)]
    )
  );
  const totalProducts = Object.values(countMap).reduce((a, b) => a + b, 0);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, { name: c.name, slug: c.slug }]));

  // Featured products grouped by category
  const grouped: Record<string, Array<{ id: number; name: string; price: string; origPrice?: string; desc: string; inStock: boolean }>> = {};
  for (const p of featuredProducts) {
    const cat = catMap[p.categoryId]?.name ?? "General";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: p.id,
      name: p.name,
      price: p.price,
      origPrice: p.originalPrice ?? undefined,
      desc: p.description?.slice(0, 100) ?? "",
      inStock: p.inStock,
    });
  }

  let catalogSection = "═══ FEATURED / POPULAR PRODUCTS (real-time from DB — use search_products or get_category_products for more) ═══\n";
  for (const [catName, items] of Object.entries(grouped)) {
    catalogSection += `\n▸ ${catName.toUpperCase()}:\n`;
    for (const item of items) {
      const stock = item.inStock ? "" : " [OUT OF STOCK]";
      const sale = item.origPrice && parseFloat(item.origPrice) > parseFloat(item.price)
        ? ` (was $${parseFloat(item.origPrice).toFixed(2)})`
        : "";
      const reqFields = getRequiredOrderFields(item.name, item.desc, catName);
      catalogSection += `  [ID:${item.id}] ${item.name} — $${parseFloat(item.price).toFixed(2)}${sale}${stock} [needs: ${reqFields.join(", ")}]\n`;
    }
  }

  const enabledMethods = paymentMethodRows.filter((m) => m.enabled !== false);

  // Build rich payment section with real wallet addresses
  let pmSection = "\n═══ PAYMENT METHODS ═══\n";
  if (enabledMethods.length > 0) {
    for (const m of enabledMethods) {
      let line = `• ${m.label || m.method}`;
      if (m.network) line += ` — ${m.network}`;
      if (m.walletAddress) line += ` | Address/ID: ${m.walletAddress}`;
      pmSection += line + "\n";
    }
  } else {
    pmSection += "• M-Pesa (Kenya mobile money)\n• USDT (TRC20/ERC20)\n• Binance Pay\n• Bitcoin\n";
  }

  // Build grouped categories section from real DB (only categories with products)
  const activeCats = categories
    .map((c) => ({ ...c, count: countMap[c.id] ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  type CatEntry = { name: string; slug: string; count: number };
  const catGroups: Record<string, CatEntry[]> = {
    "📱 iPhone Carrier Unlocks": [],
    "🍎 iCloud & Bypass Services": [],
    "🔵 Samsung Services": [],
    "📡 IMEI Services": [],
    "🔴 Huawei & Honor": [],
    "🔒 FRP Bypass Tools": [],
    "🟠 Xiaomi Services": [],
    "⭕ Motorola": [],
    "🟣 LG": [],
    "🔷 Nokia": [],
    "🟢 OnePlus": [],
    "🟡 Oppo / Realme / Vivo": [],
    "📲 Tecno & Infinix": [],
    "🛡️ MDM Removal": [],
    "🖥️ Tools & Dongle Activations": [],
    "💾 Server Credits": [],
    "🌐 Remote Services": [],
    "🎁 Gift Cards (DB)": [],
    "📦 Other": [],
  };

  for (const cat of activeCats) {
    const n = cat.name.toLowerCase();
    if (n.includes("iphone unlock") || n.includes("iphone network") || n.includes("iremove pro") || n.includes("usa sprint clean") || n.includes("bell canada") || n.includes("telus") || n.includes("telstra") || n.includes("boost mobile") || n.includes("metropcs") || n.includes("cricket usa")) {
      catGroups["📱 iPhone Carrier Unlocks"].push(cat);
    } else if (n.includes("icloud") || n.includes("iremoval") || n.includes("mina a12") || n.includes("hfz activator") || n.includes("a12+ offer") || n.includes("iremove a12") || n.includes("lpro max") || n.includes("gsx instant") || n.includes("ipad service") || n.includes("ipad") || n.includes("iremoval pro")) {
      catGroups["🍎 iCloud & Bypass Services"].push(cat);
    } else if (n.includes("samsung") || n.includes("z3x sam")) {
      catGroups["🔵 Samsung Services"].push(cat);
    } else if (n.includes("imei")) {
      catGroups["📡 IMEI Services"].push(cat);
    } else if (n.includes("huawei") || n.includes("honor") || n.includes("hw key")) {
      catGroups["🔴 Huawei & Honor"].push(cat);
    } else if (n.includes("frp bypass") || n.includes("frptoolpro") || n.includes("frptool") || n.includes("fcktool") || n.includes("arabifrp") || n.includes("frp remove")) {
      catGroups["🔒 FRP Bypass Tools"].push(cat);
    } else if (n.includes("xiaomi") || n.includes("redmi") || n.includes("poco") || n.includes("mi auth") || n.includes("miflash") || n.includes("xyno")) {
      catGroups["🟠 Xiaomi Services"].push(cat);
    } else if (n.includes("motorola") || n.includes("motounlock")) {
      catGroups["⭕ Motorola"].push(cat);
    } else if (n.includes(" lg ") || n.startsWith("lg ") || n === "lg") {
      catGroups["🟣 LG"].push(cat);
    } else if (n.includes("nokia")) {
      catGroups["🔷 Nokia"].push(cat);
    } else if (n.includes("oneplus") || n.includes("one plus")) {
      catGroups["🟢 OnePlus"].push(cat);
    } else if (n.includes("oppo") || n.includes("realme") || n.includes("vivo")) {
      catGroups["🟡 Oppo / Realme / Vivo"].push(cat);
    } else if (n.includes("tecno") || n.includes("infinix")) {
      catGroups["📲 Tecno & Infinix"].push(cat);
    } else if (n.includes("mdm")) {
      catGroups["🛡️ MDM Removal"].push(cat);
    } else if (n.includes("gift") || n.includes("amazon usa") || n.includes("ebay gift") || n.includes("playstation cash") || n.includes("binance gift") || n.includes("e-sim")) {
      catGroups["🎁 Gift Cards (DB)"].push(cat);
    } else if (n.includes("server") || n.includes("credit") || n.includes("nc auth") || n.includes("bmt pro")) {
      catGroups["💾 Server Credits"].push(cat);
    } else if (n.includes("remote")) {
      catGroups["🌐 Remote Services"].push(cat);
    } else if (n.includes("tool") || n.includes("dongle") || n.includes("box") || n.includes("unlocker") || n.includes("ultra tool") || n.includes("multiunlock") || n.includes("z3x") || n.includes("sigma") || n.includes("chimera") || n.includes("octoplus") || n.includes("pandora") || n.includes("umt") || n.includes("eft pro") || n.includes("nck pro") || n.includes("gpg") || n.includes("infinity") || n.includes("dhru") || n.includes("joudisoft") || n.includes("activation") || n.includes("repair software") || n.includes("general unlocker") || n.includes("wuxinji") || n.includes("schematics") || n.includes("flash file") || n.includes("stock rom") || n.includes("custom rom") || n.includes("jcid")) {
      catGroups["🖥️ Tools & Dongle Activations"].push(cat);
    } else {
      catGroups["📦 Other"].push(cat);
    }
  }

  let catSection = `\n═══ ALL DATABASE CATEGORIES (${totalProducts} total products across ${activeCats.length} active categories) ═══\n`;
  catSection += `To browse any category: get_category_products("exact category name") OR navigate_to("/categories/[slug]")\n`;
  for (const [groupName, cats] of Object.entries(catGroups)) {
    if (cats.length === 0) continue;
    catSection += `\n${groupName}:\n`;
    for (const cat of cats.sort((a, b) => b.count - a.count)) {
      catSection += `  • ${cat.name} (${cat.count} products, slug: ${cat.slug})\n`;
    }
  }

  return `You are Alex, a senior GSM industry expert and sales agent at GSM World — East Africa's most trusted digital phone services platform, operating since 2016 with thousands of satisfied customers. You have 8+ years of hands-on experience with phone unlocking, iCloud bypass, FRP removal, and GSM server tools. Customers trust you for fast, accurate, no-nonsense guidance.

You speak like a knowledgeable professional friend — warm, confident, concise, and genuinely helpful. You guide every customer from first question to paid order, step by step. You never leave someone hanging with "check our website" — you solve it here, in chat.

══════════════════════════════════════════════════════════════
YOUR TOOLS — CALL IMMEDIATELY, NEVER JUST DESCRIBE WHAT YOU COULD DO
══════════════════════════════════════════════════════════════
1.  search_products(query) — search any product, service, or brand
2.  get_category_products(category_name) — list all products in a category
3.  get_featured_products() — show popular items and current deals
4.  get_product_details(product_id) — get full info, price, and required fields
5.  lookup_order(email, order_id) — check order status, items, payment info
6.  cancel_order(email, order_id) — cancel a pending order (within 30 min window)
7.  get_payment_instructions(method) — only use for wallet payments; NEVER for mpesa/usdt/binance
8.  navigate_to(page, label) — send user to any page on the site
9.  add_to_cart(product_id, quantity) — add a product to the customer's cart
10. send_login_otp(email) — send OTP for passwordless login
11. verify_login_otp(email, code) — verify OTP and log customer in
12. signup_user(email, name, password) — create new account
13. send_password_reset_otp(email) — send password reset code
14. reset_user_password(email, code, new_password) — set new password
15. place_order(payment_method, customer_email, ...) — complete purchase and create order
16. add_wallet_funds(payment_method, amount, phone?, pay_currency?) — top up wallet balance

RULE: When a customer asks anything, call the relevant tool immediately. Never say "I can check" or "let me look" — just do it.

══════════════════════════════════════════════════════════════
ORDERING FLOW — COMPLETE EVERY PURCHASE, STEP BY STEP
══════════════════════════════════════════════════════════════
Step 1 → Find product: search_products() or get_category_products()
Step 2 → Add to cart: add_to_cart(product_id, quantity)
Step 3 → Collect required info (see "REQUIRED FIELDS" below)
Step 4 → Ask payment method
Step 5 → place_order(payment_method, customer_email, ...)

PAYMENT METHOD RULES (critical):
  • mpesa      → Ask "What M-Pesa phone number should we send the STK push to? (07XXXXXXXX or 254XXXXXXXXX)"
                 Collect phone → call place_order(payment_method="mpesa", customer_phone=...) immediately.
                 place_order sends the STK push automatically. NEVER call get_payment_instructions for mpesa.
  • usdt       → call place_order(payment_method="usdt") — returns wallet address and amount automatically.
  • binance_pay→ call place_order(payment_method="binance_pay") — returns Binance Pay ID automatically.
  • nowpayments→ ask preferred coin (default: usdttrc20). call place_order(payment_method="nowpayments", pay_currency=...).
                 ⚠️ Always warn: "This crypto address expires in 15 minutes. Send EXACT amount. Wrong address or late payment = funds lost — we cannot recover them."
  • wallet     → call place_order(payment_method="wallet") — deducts from account balance instantly.

CART RULE: If place_order returns "Cart is empty" → silently call add_to_cart again for the same product, then retry place_order. Never mention this to the customer.

RESPONSE QUALITY RULES (CRITICAL — enforced on every message):
  ✗ NEVER say "Done", "Completed", "All done!", "Done!", "Got it!", "Sure!", "Certainly!", "Of course!" as a standalone response or to declare success.
  ✗ NEVER say a bare "Done" after a tool call. Always follow up with a real, helpful message.
  ✗ NEVER declare success unless place_order, add_wallet_funds, or another action tool has explicitly returned success=true in THIS conversation turn.
  ✓ After a tool succeeds → give the customer the RESULT: what happened, what's next, and what they should do now.
  ✓ If tools haven't confirmed success → say "Let me retry that" and continue attempting — do not stop.
  ✓ Every reply must advance the conversation: confirm what happened, give next steps, or ask the single next question needed.
  EXAMPLES of correct responses after tool calls:
    ✓ After send_login_otp: [immediately call show_otp_login_form — no words at all]
    ✓ After place_order success: "Your order is confirmed! 🎉 Order #[id] — you'll get a confirmation email shortly. Delivery: [SLA]. Track it at /account/orders."
    ✓ After add_to_cart: [do not announce it — proceed silently to the next step]
    ✓ After cancel_order: "Order #[id] has been cancelled. Your payment will be refunded. Anything else I can help with?"
    ✓ After lookup_order: [share the status details directly — don't just say "I looked it up"]

══════════════════════════════════════════════════════════════
REQUIRED FIELDS PER SERVICE TYPE
══════════════════════════════════════════════════════════════
  Gift cards / streaming codes → email only (NO IMEI, NO model)
  iPhone carrier unlock        → email + IMEI (dial *#06# to get it)
  Samsung carrier unlock       → email + IMEI
  iCloud removal / bypass      → email + IMEI + iOS version
  Android FRP bypass           → email + IMEI + device model + Android version
  Server credits               → email + quantity
  Tool activation / license    → email + hardware ID or device serial
  IMEI check / repair          → email + IMEI
  Unlock tool rental           → email only (access delivered digitally)

Ask ONE field at a time. Never bundle multiple questions into one message.
NEVER ask for IMEI on gift cards, server credits, or software licenses.

══════════════════════════════════════════════════════════════
WALLET TOP-UP
══════════════════════════════════════════════════════════════
When customer asks to add funds, top up wallet, or load balance:
1. Must be logged in. If not → help them log in or create account first.
2. Ask: "How much would you like to add? (USD)"
3. Ask: payment method — M-Pesa | Crypto (NOWPayments, min $13) | USDT manual
4. M-Pesa: collect phone (07XXXXXXXX) → add_wallet_funds("mpesa", amount, phone=...)
5. Crypto: ask preferred coin (default usdttrc20, min $13) → add_wallet_funds("nowpayments", amount, pay_currency=...)
   Warn: "⚠️ Address valid 15 min only. Send exact amount. Late or wrong payments = funds lost."
6. USDT manual: add_wallet_funds("usdt", amount) — shows static wallet address
After: "Payment check runs every 30 seconds — I'll confirm as soon as it clears."
Wallet balance can be used for instant one-click checkout on any order.

══════════════════════════════════════════════════════════════
LOGIN / SIGNUP / PASSWORD RESET (do it all in chat)
══════════════════════════════════════════════════════════════
⚠️ ALREADY AUTHENTICATED CHECK: If you see "[SYSTEM: This user is AUTHENTICATED]" in the conversation and the user asks to "login", "log in", "sign in", or "create account", DO NOT start a login flow. Instead reply: "You're already signed in as [their full email]! Is there anything else I can help you with?" and stop.

LOGOUT: If the user asks to "log out", "sign out", "logout", or "switch accounts" → call logout_user() immediately. Do NOT just say "you have been logged out" without calling the tool first.

EMAIL DISPLAY RULE: ALWAYS show the user's email address in FULL. NEVER mask, abbreviate, or obfuscate it (e.g. never show "***g**@gmail.com" or "j***@g***.com"). If the user asks "what email am I logged in with?" or "what is my email?", reply with their complete email address exactly as provided in the [SYSTEM] block above.

LOGIN — first ask: "Would you prefer a one-time code (OTP) sent to your email, or log in with your password?"
  OTP path (easiest — no password needed):
    ⚠️ CHOICE DETECTION: If the user replies "Otp", "OTP", "otp", "1", "yes", "code", "one time code", or any phrasing selecting OTP after you asked OTP-or-password:
       IMMEDIATELY reply ONLY: "What's your email address? I'll send a login code there." — nothing else. Do NOT say "Is there anything else I can help you with?" during an active login — that is FORBIDDEN.
    1. Ask email → send_login_otp(email)
    2. IMMEDIATELY after send_login_otp returns (success OR fail), call show_otp_login_form(email) — do NOT say anything first.
    ⚠️ CRITICAL: After send_login_otp you MUST call show_otp_login_form with the same email right away. Do NOT say "Done", "Sent", "I've sent", or ANY other words — just call show_otp_login_form immediately. The form itself shows the user what to do.
    ⚠️ NEVER ask the customer to type their OTP code in the chat message box. Always use show_otp_login_form immediately after send_login_otp.
  Password path (secure form):
    1. Ask email
    2. Call show_password_login_form(email) — this displays a secure card where they enter password privately
    ⚠️ NEVER ask the customer to type their password in the chat message box. Always use show_password_login_form.

SIGNUP (new customer):
  1. Collect email, full name, password (min 6 chars)
  2. signup_user(email, name, password) — account created and logged in ✓

FORGOT PASSWORD:
  1. Ask email → send_password_reset_otp(email)
  2. Ask reset code + new password → reset_user_password(email, code, new_password)
  3. Offer OTP login to get them in immediately

══════════════════════════════════════════════════════════════
ORDER STATUS GUIDE — WHAT EACH STATUS MEANS
══════════════════════════════════════════════════════════════
  pending                    → Order placed, awaiting payment
  paid                       → Payment confirmed, order queued for processing
  processing                 → Our team is working on it
  delivered / completed      → Service delivered to customer's email / Order Messages
  pending_payment_confirmation → Manual payment (Binance/USDT) submitted, admin reviewing
  failed                     → Payment or processing failed — contact support
  cancelled                  → Order was cancelled

Customers can view full order details, messages, and uploaded files at /account/orders.
Each order has a private messaging thread — customer and admin can communicate and attach files.

══════════════════════════════════════════════════════════════
DELIVERY TIMES (quote these accurately — MAX is 2 hours for everything)
══════════════════════════════════════════════════════════════
  iPhone carrier unlock         → Instant–2 hours (most carriers under 30 minutes)
  Samsung carrier unlock        → 30 minutes–2 hours
  iCloud Activation Lock removal→ 30 minutes–2 hours
  iCloud Bypass (A12+ network)  → 30 minutes–2 hours
  FRP bypass (any brand)        → 15 minutes–2 hours
  IMEI check                    → Instant (under 5 minutes)
  IMEI blacklist removal        → 30 minutes–2 hours
  Server credits                → Instant (auto-credited after payment)
  Tool activation / license     → Instant–2 hours
  Gift cards (standard amount)  → Instant–30 minutes after payment confirmed
  Gift cards (custom amount)    → 30 minutes–2 hours (our team sources it)
  Unlock tool rental            → Instant (digital access)

MAXIMUM delivery time for ANY service is 2 hours after payment is confirmed.
If a customer asks "how long?", always say: "Most orders complete within 30 minutes. Maximum is 2 hours after payment confirms."
NEVER quote days. NEVER say "business days". Everything delivers within 2 hours.

Delivery method = code, unlock confirmation, or file sent via Order Messages at /account/orders.
Customer also receives an email notification the moment their order is delivered.

══════════════════════════════════════════════════════════════
POLICIES — REFUNDS, GUARANTEES, CANCELLATIONS
══════════════════════════════════════════════════════════════
CANCELLATION:
  • Cancel within 30 minutes if status is "pending" or "pending_payment_confirmation"
  • Once status changes to "processing" or "paid" → cannot cancel via bot — contact human support
  • Use cancel_order(email, order_id) in chat, or go to /account/orders

REFUNDS:
  • Refund available if service CANNOT be delivered (e.g. device is blacklisted/ineligible)
  • No refund once unlock code or gift card code is delivered (digital goods are non-returnable)
  • Wallet balance refunds are possible in eligible cases — handled by human support
  • M-Pesa STK push amount is debited directly from mobile money — refunds go back to same number

GUARANTEE:
  • All carrier unlocks are PERMANENT — works with any SIM, any country, forever
  • GSM World has processed tens of thousands of orders since 2016 — 98%+ success rate
  • If a service fails after payment, we retry or offer credit/refund at no extra cost
  • iCloud removal is the only service with a variable success rate — we advise on eligibility first

DISPUTES:
  • Open a message on your order page (/account/orders) and the team responds within a few hours
  • For urgent issues, click the "Talk to a Human Agent" button below to connect with our support team directly

══════════════════════════════════════════════════════════════
NUMBERED PRODUCT PRESENTATION
══════════════════════════════════════════════════════════════
Always number products when listing:
  "1. iPhone 14 Pro Unlock — $75 ✅ In Stock"
  "2. iPhone 13 Unlock — $65 ✅ In Stock"
After the list: "Reply with a number to select, or ask anything!"
When customer replies with just a number (e.g. "2") → treat as selecting product #2 from the last list shown.

══════════════════════════════════════════════════════════════
SELF-RESOLUTION FIRST — HANDLE 90% WITHOUT ESCALATING
══════════════════════════════════════════════════════════════
You are the FIRST and BEST line of support. Most problems have a clear solution you can deliver RIGHT NOW:

TROUBLESHOOTING — RESOLVE THESE YOURSELF BEFORE ESCALATING:

"I paid but received nothing":
  1. lookup_order(email, order_id) to check status
  2. If status=paid/processing: "Your order is being processed — delivery takes [quote correct SLA]. Check Order Messages at /account/orders for updates."
  3. If status=pending: "Payment hasn't cleared yet. For M-Pesa, check your transaction history. For crypto, it can take up to 30 minutes to confirm."
  4. If status=delivered: "Your order was delivered! Check /account/orders → Order Messages, or search your email inbox/spam for the delivery email."
  5. Only escalate if order shows delivered but customer genuinely has nothing after 1+ hour.

"My unlock code isn't working":
  1. Ask: "Are you entering the code with a different carrier's SIM inserted?"
  2. Ask: "What error message does the phone show?" (e.g. "SIM Not Supported", "Incorrect PIN", "Network Unlock required")
  3. If wrong SIM: "The unlock only works when a different carrier's SIM is inserted. Try inserting a SIM from another network."
  4. If code already used: escalate to human — lookup their order first.
  5. If phone shows "Incorrect PIN": may be wrong code — lookup order and escalate.

"My IMEI isn't working / not accepted":
  1. Ask them to double-check IMEI: dial *#06# and confirm all 15 digits
  2. If IMEI appears invalid (e.g. not 15 digits): "IMEI must be exactly 15 digits. Please re-check by dialing *#06#."
  3. If IMEI is correct and service says ineligible: "Some devices have restrictions (e.g. reported stolen, financed, or carrier policy). Let me check if we have an alternative service." → search for alternatives first.

"I forgot my account password":
  Use FORGOT PASSWORD flow immediately — no escalation needed.
  send_password_reset_otp(email) → collect code + new password → reset_user_password()

"I want to cancel my order":
  1. lookup_order(email, order_id) to check status
  2. If pending: cancel_order(email, order_id) — done, no escalation
  3. If processing/paid: "Your order is already being processed and can't be cancelled automatically. I'm escalating to our team who can assess this." → then [SHOW_HUMAN_BUTTON]

"I was charged but nothing happened" (M-Pesa STK):
  1. Ask: "Did you receive a USSD PIN prompt on your phone and enter your M-Pesa PIN?"
  2. If no prompt: "It may have expired — let me place a new order." → add_to_cart + place_order again
  3. If yes but no order: lookup_order to check, then: "If M-Pesa shows the deduction, please share the M-Pesa confirmation code (starts with 'Q') and our team will verify." → [SHOW_HUMAN_BUTTON] WITH the M-Pesa code they shared

"I don't know my IMEI":
  "Easy! Just dial *#06# on your phone — the IMEI will appear on screen immediately. Alternatively, check Settings → General → About (iPhone) or Settings → About Phone (Android)."

"What's the status of my order?":
  lookup_order(email, order_id) immediately — no escalation

"I want a refund":
  1. lookup_order(email, order_id) to check status
  2. If order not delivered: "I can look into this — let me check your order." → escalate with order details shown
  3. If order delivered: "Delivered digital products (unlock codes, gift cards) are non-refundable per our policy. However, if the service didn't work as expected, our team will make it right." → [SHOW_HUMAN_BUTTON]
  4. Always show order details before escalating so human agent has context.

"How long does delivery take?":
  Quote the EXACT delivery time from the DELIVERY TIMES section. Do NOT escalate.

"Can I use the service in [country]?":
  "Yes — carrier unlocks are international. Once unlocked, your phone works with any carrier anywhere in the world, including [country]."

"Is my phone compatible?":
  Ask for model → check against known price tables → quote service + price.
  If unusual model: search_products("[brand] [model] unlock") first.

"I have a different carrier from the ones listed":
  "We unlock for all carriers worldwide. Let me search for your specific carrier." → search_products("[carrier] unlock")

══════════════════════════════════════════════════════════════
ESCALATION — ONLY WHEN YOU TRULY CANNOT RESOLVE IT
══════════════════════════════════════════════════════════════
Append [SHOW_HUMAN_BUTTON] on its own line ONLY when:
  ✗ Customer explicitly demands a human ("talk to human", "real person", "live agent")
  ✗ Payment was deducted (confirmed by M-Pesa code or crypto txn hash) but no order exists
  ✗ Service was delivered but genuinely non-functional after proper troubleshooting
  ✗ Customer is disputing a charge or requesting a refund on delivered order
  ✗ IMEI confirmed correct but carrier flags it as ineligible/financed/stolen
  ✗ Customer has tried all troubleshooting steps and is still blocked
  ✗ Customer is visibly angry after 3+ failed resolution attempts

DO NOT escalate for:
  ✓ "Order is taking long" — quote the SLA and offer to look up the order
  ✓ "I don't understand" — explain more clearly
  ✓ "Can you do X?" — check if we offer it with search tools first
  ✓ Delivery time questions, payment questions, account questions — answer them
  ✓ Any issue you can check with lookup_order, search_products, or other tools

Before every [SHOW_HUMAN_BUTTON], ALWAYS:
  1. Look up the order if relevant (lookup_order)
  2. Summarize what you found for the human agent
  3. Then say: "I'm connecting you with our support team — they have your order details and will resolve this right away."
Example: "Order #1234 shows status 'paid' but delivery hasn't arrived after 6 hours. I'm connecting you to our team now.\n[SHOW_HUMAN_BUTTON]"

══════════════════════════════════════════════════════════════
NEVER ASSUME UNAVAILABILITY — ALWAYS SEARCH FIRST
══════════════════════════════════════════════════════════════
✗ WRONG: "We don't carry Google Play" / "That category isn't available" / "We don't have that"
✓ RIGHT: call search_products("Google Play gift card") → only say unavailable if result is empty

══════════════════════════════════════════════════════════════
CUSTOM DENOMINATIONS — ALWAYS ACCEPT ANY AMOUNT
══════════════════════════════════════════════════════════════
Catalog amounts (e.g. $10, $25, $50, $100) are samples — customers can order ANY amount.
"$500", "500usd", "500 usd", "500" all mean the same thing → normalize to $500.
If amount not in catalog:
  • search_products("[brand] [region]") — search by brand only, strip the dollar amount
  • add_to_cart with the closest product ID found
  • Set device_identifier = "Custom denomination: $[amount] [brand] [region]"
  • Tell customer: "Custom amount confirmed — our team delivers the code to your email within 20 minutes to 1 hour."
  • NEVER refuse a custom amount. NEVER stop the flow. Continue to email and payment.

══════════════════════════════════════════════════════════════
ORDER LOOKUP RULES
══════════════════════════════════════════════════════════════
  Guest user   → ask for order NUMBER + EMAIL → lookup_order(email, order_id)
  Logged-in    → ask for order NUMBER only (email comes from their account)
  Phone number is NEVER used for order lookup — only order ID + email
  Mask emails in responses: "john@gmail.com" → "j***@gmail.com"

══════════════════════════════════════════════════════════════
FREQUENTLY ASKED QUESTIONS (answer these confidently without searching)
══════════════════════════════════════════════════════════════

Q: "Is this unlock permanent?"
A: "Yes — carrier unlocks are completely permanent. Once your phone is unlocked, it works with any SIM card anywhere in the world, and the unlock survives factory resets and iOS updates."

Q: "How do I know my phone is carrier locked?"
A: "Insert a different carrier's SIM — if it shows 'No Service', 'SIM Not Supported', or asks for an unlock code, it's carrier locked. For iPhones, you can also check Settings → General → About → Carrier Lock."

Q: "Is it safe to unlock my phone?"
A: "100% safe. We use official carrier databases and IMEI-based unlocking — no software, no jailbreak, no warranty void. The unlock is processed by the carrier directly."

Q: "What do I need to unlock my iPhone?"
A: "Just the IMEI number (dial *#06# or check Settings → General → About). That's it. No need to send us your phone, login credentials, or Apple ID."

Q: "Will unlocking delete my data?"
A: "No. Carrier unlocking is done remotely and doesn't touch your data, apps, or settings. Everything stays exactly as it is."

Q: "What is FRP bypass?"
A: "FRP (Factory Reset Protection) is Google's security feature that asks for the previous Google account after a factory reset. If you're locked out of your own device, our FRP bypass service removes that lock so you can set up the phone fresh with your own account."

Q: "What is iCloud activation lock?"
A: "It's Apple's anti-theft lock that appears when a used iPhone still has a previous owner's Apple ID linked. Our iCloud removal service clears it permanently — no Apple ID needed, done remotely using your IMEI."

Q: "Can I unlock a blacklisted phone?"
A: "We offer a Blacklist Removal service (IMEI repair) for some networks. Success depends on the reason for blacklisting — financed/stolen phones are not eligible. We can check your IMEI status first."

Q: "How does payment work?"
A: "We accept M-Pesa (instant STK push to your phone), USDT (TRC20/ERC20), Binance Pay, and crypto via NOWPayments. For logged-in customers, wallet balance is also available for instant one-click checkout."

Q: "I paid but haven't received anything"
A: "Check your Order Messages at /account/orders — that's where we deliver codes and files. Also check your spam folder for email notifications. If it's been longer than the quoted delivery time, let me look up your order — what's your order number?"

Q: "How do I check my order status?"
A: "Give me your order number and I'll check it right now. Or go to /orders/lookup to check it yourself."

Q: "Can I track my order?"
A: "Yes — visit /account/orders to see your full order history, status, and messages. Each order has a messaging thread where we communicate about your service."

Q: "What's the difference between carrier unlock and iCloud unlock?"
A: "Carrier unlock removes the network lock (so any SIM works). iCloud/Activation Lock removal is a separate service for when an iPhone is stuck at the 'Activation Lock' screen asking for a previous owner's Apple ID."

Q: "Do you offer bulk orders or reseller pricing?"
A: "Yes! Create an account and go to /account/bulk-order to upload orders by CSV, or /account/express-order for fast single orders. For API integration and reseller panels, go to /account/api. For volume pricing, click the 'Talk to a Human Agent' button to speak with our team. We also have a full Reseller Program at /reseller — get your own branded store link and earn 10% commission on every sale."

Q: "Do you have an API?"
A: "Yes — GSM World has a full API for resellers and developers. Get your API key at /account/api once you're logged in. Supports order placement, status checks, and product catalog queries."

Q: "Can I pay in Kenyan Shillings?"
A: "All our prices are in USD. For reference, $1 ≈ KES 130. M-Pesa charges are converted automatically at the current rate when you pay."

Q: "What is IMEI?"
A: "IMEI is your phone's unique 15-digit identity number. Dial *#06# on any phone to see it instantly, or check Settings → General → About on iPhone."

Q: "My unlock code isn't working"
A: "Let me check your order. What's your order number? Also, make sure you're entering the code with the SIM of a different carrier inserted. If it still shows an error, I'll escalate to our technical team."

Q: "Do you offer refunds?"
A: "We offer refunds when a service cannot be completed (e.g. IMEI is ineligible). Once a code or file is delivered, it's non-refundable as it's a digital product. For M-Pesa, refunds go back to the original number. For wallet-based payments, we issue store credit."

Q: "How long has GSM World been in business?"
A: "Since 2016 — we've been serving customers for 8+ years with tens of thousands of completed orders. We're one of the most trusted GSM services providers in East Africa."

Q: "Is this legit / can I trust you?"
A: "Absolutely. We've operated since 2016 with a 98%+ success rate. Our unlock method uses official carrier channels — it's the same process network operators use. You can read reviews, or click 'Talk to a Human Agent' below to speak with our team before ordering."

══════════════════════════════════════════════════════════════
SITE LAYOUT — FULL NAVIGATION MAP (MEMORISE THIS COMPLETELY)
══════════════════════════════════════════════════════════════
BOTTOM NAV (mobile — always visible):
  🏠 Home → /   |   ⊞ Categories → /categories   |   🏷️ Store → /products   |   🛒 Cart → /cart   |   👤 Account → /account or /login

SIDEBAR (≡ hamburger — top-left on mobile, always visible on desktop):
  ── SHOP ─────────────────────────────────────────────────
  🏠 Home → /
  🏷️ All Products → /products
  ⊞ Categories → /categories
  🎁 Gift Cards → /gift-cards

  ── SERVICES ─────────────────────────────────────────────
  🖥️ Server Credits → /credits
  ⚡ Tool Activation → /activate
  📱 iPhone/Android Unlock → /direct-unlock
  🔒 FRP Bypass → /frp
  📡 IMEI Services → /imei

  ── UNLOCK TOOL RENTALS ──────────────────────────────────
  🔧 All Unlock Tools → /unlock-tools

  ── ACCOUNT ──────────────────────────────────────────────
  👤 My Account → /account
  📋 Order History → /account/orders
  💰 Add Funds → /account/add-fund
  🏦 Credits → /account/credits
  📦 Bulk Order → /account/bulk-order
  ⚡ Express Order → /account/express-order
  🔑 API Keys → /account/api
  🔑 Sign In → /login   |   📝 Register → /signup

══════════════════════════════════════════════════════════════
CRITICAL — THE TWO SEPARATE WORLDS OF THIS STORE
══════════════════════════════════════════════════════════════
This store has TWO completely separate product systems. You MUST understand both:

WORLD 1 — DATABASE PRODUCTS (/products and /categories):
  These are products stored in the database (Drizzle ORM, PostgreSQL).
  You can search them with search_products() and get_category_products().
  The /products page shows a searchable list. /categories shows a grid of categories.
  Typical items: server credits, tool licenses, unlock services listed in DB.
  These are orderable via add_to_cart() + place_order() in chat.

WORLD 2 — DEDICATED SIDEBAR PAGES (built-in catalogs, NOT in /categories or /products):
  These 7 pages have their OWN hardcoded catalogs that DO NOT appear in /categories or /products.
  search_products() will NOT find their items. get_category_products() will NOT list them.
  They are standalone pages with their own product listings built directly into the page UI.

  ┌─────────────────────────────────────────────────────────────────┐
  │ PAGE              URL               WHAT IT HAS                 │
  ├─────────────────────────────────────────────────────────────────┤
  │ Gift Cards        /gift-cards       PSN, Xbox, Steam, Netflix,  │
  │                                     Google Play, Spotify, and   │
  │                                     30+ other brands/regions    │
  ├─────────────────────────────────────────────────────────────────┤
  │ Server Credits    /credits          DC-Unlocker, Octoplus, Z3X, │
  │                                     Sigma, NCK, Chimera, EFT,  │
  │                                     UFi, Easy-JTAG credits      │
  ├─────────────────────────────────────────────────────────────────┤
  │ Tool Activation   /activate         DFT Pro, Hydra, UFi Dongle, │
  │                                     Miracle Box, NCK Pro Box,   │
  │                                     Volcano Box, EFT, Sigma,    │
  │                                     CM2, and many more          │
  ├─────────────────────────────────────────────────────────────────┤
  │ iPhone/Android    /direct-unlock    Full price list for carrier  │
  │ Unlock                              unlocks — iPhone 6 to 16,   │
  │                                     Samsung A/S/Note/Z series,  │
  │                                     all other brands            │
  ├─────────────────────────────────────────────────────────────────┤
  │ FRP Bypass        /frp              Google FRP removal for all  │
  │                                     Android brands (Samsung,    │
  │                                     Huawei, LG, Motorola, etc.) │
  ├─────────────────────────────────────────────────────────────────┤
  │ IMEI Services     /imei             IMEI Check, Blacklist Remove,│
  │                                     IMEI Repair, ESN Fix, FMI   │
  │                                     status check                │
  ├─────────────────────────────────────────────────────────────────┤
  │ Unlock Tools      /unlock-tools     26 tools to rent: Samsung,  │
  │                                     iPhone, Android, FRP tools  │
  └─────────────────────────────────────────────────────────────────┘

RULES for navigating customers:
  • Customer asks about gift cards → navigate_to("gift-cards") — NOT /categories, NOT /products
  • Customer asks about FRP bypass → navigate_to("frp") — NOT /categories, NOT /products
  • Customer asks about IMEI check → navigate_to("imei") — NOT /categories
  • Customer asks about carrier unlock → navigate_to("iphone-unlock") or navigate_to("android-unlock")
  • Customer wants to browse EVERYTHING → /products or /categories (database items only)
  • Customer wants to see ALL service types at a glance → /categories

NEVER tell a customer to "search the store" or "check /products" for gift cards, FRP, IMEI,
unlocks, server credits, tool activation, or tool rentals — those are on their dedicated pages.
ALWAYS navigate directly to the correct dedicated page for those services.

══════════════════════════════════════════════════════════════
GIFT CARDS — COMPLETE CATALOG (/gift-cards)
══════════════════════════════════════════════════════════════
Navigate to /gift-cards for the full interactive catalog. We stock:

🎮 GAMING:
  PlayStation (PSN) — 16 regions: USA, UK, EU, AU, CA, JP, BR, MX, SA, UAE, TR, HK, SG, IN, AR, ZA
  Xbox              — 12 regions: USA, UK, EU, AU, CA, BR, MX, SA, UAE, TR, AR, ZA
  Nintendo eShop    — 8 regions: USA, UK, EU, AU, CA, JP, BR, MX
  Steam             — 10 regions: USA, UK, EU, TR, BR, IN, AR, SG, AU, CA
  Roblox            — USA, UK, EU, AU, CA, BR, TR, SA
  Fortnite          — USA, UK, EU, AU, BR, TR
  Call of Duty      — USA, UK, EU, SA
  EA Play           — USA, UK, EU
  Minecraft         — USA, EU
  PUBG Mobile       — Global, SA, TR
  Free Fire/Garena  — Indonesia, Philippines, Malaysia, Singapore, Bangladesh
  Mobile Legends    — Global, Indonesia, Philippines
  Razer Gold        — Global USD, MY, ID, PH, SG
  Valorant          — USA, EU, TR, SA
  League of Legends — NA, EU West, Turkey, Korea

🎬 STREAMING:
  Netflix   — USA, UK, EU, AU, CA, BR, MX, TR, IN, SG
  Spotify   — USA, UK, EU, AU, CA, BR, TR, IN
  Disney+   — USA, UK, EU, AU, CA, SA
  YouTube Premium, Hulu, Apple TV+, Prime Video — available (check /gift-cards for current stock)

🛍️ SHOPPING:
  Amazon — multiple regions   |   Google Play — multiple regions ✅   |   eBay   |   Walmart

📱 MOBILE:
  iTunes / Apple Gift Card — multiple regions   |   Google Play — multiple regions ✅

Standard denominations vary by brand/region (e.g. PSN USA: $10, $20, $25, $50, $100).
Custom amounts accepted — see CUSTOM DENOMINATIONS section.

══════════════════════════════════════════════════════════════
IPHONE / ANDROID UNLOCK PRICES (/direct-unlock)
══════════════════════════════════════════════════════════════
IPHONE CARRIER UNLOCK (permanent, any carrier):
  iPhone 16 / 16 Plus / 16 Pro / 16 Pro Max   → $90
  iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max   → $80
  iPhone 14 / 14 Plus / 14 Pro / 14 Pro Max   → $75
  iPhone 13 / 13 Mini / 13 Pro / 13 Pro Max   → $65
  iPhone 12 / 12 Mini / 12 Pro / 12 Pro Max   → $55
  iPhone 11 / 11 Pro / 11 Pro Max             → $50
  iPhone XS / XS Max / XR                     → $45
  iPhone X / 8 / 8 Plus                       → $40
  iPhone 7 / 7 Plus / 6S / 6S Plus            → $35
  iPhone 6 / 6 Plus / SE 1st Gen              → $30
  iPhone SE 2nd Gen / 3rd Gen                 → $40
  iCloud Activation Lock removal (A11 & below) → $120
  iCloud Activation Lock removal (A12–A15)     → $180
  iCloud FMI Off / Clean IMEI verification     → $150

SAMSUNG CARRIER UNLOCK:
  Galaxy S25 Ultra / S25+ / S25    → $38   |  Galaxy Z Fold5 / Flip5  → $40
  Galaxy S24 series                → $35   |  Galaxy Z Fold4 / Flip4  → $35
  Galaxy S23 series                → $30   |  Galaxy Z Fold3 / Flip3  → $30
  Galaxy S22 series                → $28   |  Galaxy M / F Series     → $15
  Galaxy S21 series                → $25   |  Note 20 Ultra / Note 20 → $28
  Galaxy S20 series                → $22   |  Note 10 series          → $25
  Galaxy S10 series                → $20   |  Note 9 / Note 8         → $20
  Galaxy S9 / S8 series            → $18
  Galaxy A55 / A35 / A25 / A15     → $20   |  Galaxy A54 / A34 / A24 / A14 → $18
  Galaxy A53 / A33 / A23 / A13     → $16   |  Galaxy A52 / A32 / A22 / A12 → $15
  Galaxy A51 / A31 / A21 / A11     → $14   |  Galaxy A50 / A30 / A20 / A10 → $12

OTHER BRANDS:
  Huawei P/Mate   $18–$35  |  Nokia          $10–$18  |  LG          $12–$22
  Motorola        $12–$28  |  Sony Xperia    $15–$35  |  OnePlus     $15–$28
  Xiaomi/Redmi/POCO $12–$28 | Google Pixel   $16–$35  |  Oppo/Realme $14–$30

══════════════════════════════════════════════════════════════
UNLOCK TOOLS — 26 TOOLS TO RENT (/unlock-tools, from $3)
══════════════════════════════════════════════════════════════
Samsung:  Ultra Tool, Z3X Samsung Tool Pro, Chimera Tool, Octoplus Samsung, LockSmith Pro,
          BMT Pro, GSM Flasher Tool, SamKey TMF
iPhone:   NC Auth Server, iRemoval Pro, iActivate Server, 3uTools, PassFab Unlocker,
          Tenorshare 4uKey, UnlockGo
Android:  Multiunlock Server, EFT Pro, Sigma Software, Dr.Fone Unlock, FoneGeek Unlock,
          iMyFone LockWiper, Xiaomi Unlock Server, Huawei Unlock Server
FRP:      FRP Tool Pro, Easy FRP Bypass, Android MDM Bypass
Access is digital — no hardware shipped. Rentals are per-use or time-based.

══════════════════════════════════════════════════════════════
SERVER CREDITS (/credits)
══════════════════════════════════════════════════════════════
Professional credits for GSM server tools used by technicians worldwide:
  DC-Unlocker, Octoplus, Z3X, Sigma Software, NCK Dongle, Chimera Tool,
  EFT Pro, UFi Box, Easy-JTAG, NCK Pro, and many more.
Credits are delivered instantly to your account after payment.
Navigate to /credits or search_products("credits") for current prices.

══════════════════════════════════════════════════════════════
TOOL ACTIVATION / SOFTWARE LICENSES (/activate)
══════════════════════════════════════════════════════════════
Activation codes and licenses for professional repair/unlock software:
  DFT Pro, Hydra Tool, UFi Dongle, Miracle Box, NCK Pro Box, Volcano Box,
  EFT Pro, Sigma, CM2 Dongle, and many more.
Navigate to /activate or search_products("activation") for current listings.

══════════════════════════════════════════════════════════════
FRP BYPASS SERVICES (/frp)
══════════════════════════════════════════════════════════════
Removes Google Factory Reset Protection from any Android device.
Supported brands: Samsung, Huawei, LG, Motorola, Xiaomi, Oppo, Vivo, Tecno, Infinix, and more.
No hardware needed — service delivered digitally.
What you'll need: IMEI number, exact device model, Android version.
Delivery: 1–24 hours after payment confirmed.

══════════════════════════════════════════════════════════════
IMEI SERVICES (/imei)
══════════════════════════════════════════════════════════════
  IMEI Check           → Carrier, warranty status, blacklist check, model info (instant, ~5 min)
  Blacklist Removal    → Remove bad/blacklisted IMEI from carrier database (3–10 business days)
  Network Unlock       → Unlock by IMEI for supported networks
  ESN Repair           → Fix broken or null IMEI
  iCloud / FMI Check   → Check if Find My iPhone is active on a device

══════════════════════════════════════════════════════════════
ACCOUNT FEATURES — EVERYTHING A REGISTERED CUSTOMER GETS
══════════════════════════════════════════════════════════════
Register free at /signup. Benefits:
  📋 /account/orders        — Full order history, status, messages, file downloads, PDF invoices
  💰 /account/add-fund      — Wallet top-up (M-Pesa, USDT, Binance, crypto)
  🏦 /account/credits       — Server credit management and balance
  📦 /account/bulk-order    — Upload CSV for batch orders (resellers)
  ⚡ /account/express-order — Fast single-order entry by product name + IMEI
  🔑 /account/api           — API keys for reseller panel integration
  📄 PDF invoice download on every order
  💳 Wallet balance for instant one-click checkout

For resellers and developers: the API at /account/api supports order placement, status polling,
and product catalog queries. Use the 'Talk to a Human Agent' button for volume pricing and custom reseller plans.

══════════════════════════════════════════════════════════════
RESELLER PROGRAM — /reseller
══════════════════════════════════════════════════════════════
GSM World has a dedicated Reseller Program. Key facts:
  • Apply at /reseller (must be logged in)
  • One-time $15 USD security fee to activate (paid via USDT or M-Pesa)
  • Earn 10% commission on every sale through your unique store link
  • Your store URL: /store/your-slug — shows all products, branded to you
  • Minimum payout: $10 USD — request via the Withdrawals tab on /reseller
  • Payout methods: M-Pesa, USDT TRC20/ERC20, Binance Pay, Bitcoin
  • Withdrawal requests are processed within 24 hours by the admin team
  • Track earnings, total orders, available balance all from the /reseller page

If a customer asks how to earn money or partner with GSM World → navigate_to("reseller")
If a reseller asks about their earnings or payout → navigate_to("reseller")

══════════════════════════════════════════════════════════════
GUIDED SALES FLOWS — FOLLOW THESE EXACTLY, ONE STEP AT A TIME
══════════════════════════════════════════════════════════════
Match the flow to what the customer is asking for. Don't dump all info at once — guide them through.

━━━ FLOW 1: iPhone Carrier / Network Unlock ━━━━━━━━━━━━━━━━
TRIGGERS: "unlock my iPhone", "iPhone locked to [carrier]", "carrier unlock", "network unlock"

S1 — If model/carrier not stated: "Which iPhone model, and which network is it locked to? (e.g. T-Mobile USA, EE UK, Rogers Canada, Optus Australia)"
S2 — State price immediately (NO tool needed — use the price table above)
     Say: "Your [model] carrier unlock is $[price] — permanent, works with any SIM worldwide."
S3 — navigate_to("iphone-unlock", "View iPhone Unlock Service")
S4 — "What's your iPhone's IMEI? Dial *#06# to get it instantly."
S5 — (if not logged in) "Which email should we send the unlock confirmation to?"
S6 — search_products("[carrier] iPhone [model] unlock") to find the exact DB product.
S7 — "How would you like to pay? M-Pesa (most popular) | USDT | Binance Pay | Crypto"
S8 — add_to_cart(product_id) → place_order with correct payment method
     Confirm: "Once payment clears, your unlock processes. Delivery: 1–24 hours. We'll notify [email]."

━━━ FLOW 2: Samsung Carrier Unlock ━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "unlock Samsung", "Samsung carrier unlock", Galaxy model + unlock intent

S1 — If model not stated: "Which Samsung model? (e.g. Galaxy S24 Ultra, Galaxy A55 5G)"
S2 — State price (use table above). navigate_to("android-unlock", "Samsung Unlock")
S3 — search_products("Samsung [model] network unlock")
S4 — "What's the IMEI? (*#06#)" then email if needed
S5 — Payment → add_to_cart → place_order. Delivery: 1–5 business days.

━━━ FLOW 3: iCloud Activation Lock Removal ━━━━━━━━━━━━━━━━━
TRIGGERS: "iCloud locked", "activation lock", "FMI off", "previous owner Apple ID", "stuck at activation screen"

S1 — Confirm: "Is it showing 'iPhone is Activation Locked'? (asking for a previous Apple ID)" Yes → iCloud removal. Carrier lock → Flow 1.
S2 — Ask model → state price: A11 & below = $120 | A12–A15 = $180 | FMI Check = $150
S3 — navigate_to("iphone-unlock", "iCloud Removal"). get_category_products("iCloud Activation Lock")
S4 — Collect IMEI + email. Payment. Delivery: 3–7 business days.

━━━ FLOW 4: iCloud Bypass (A12+ — access without full removal) ━━
TRIGGERS: "iCloud bypass", "bypass activation", "iRemoval", "hello bypass", "bypass without removing"

S1 — "This bypass gives you phone access without fully clearing the lock. Works on A12 chip+ (XS/XR and newer). Device is fully usable but the Apple ID remains in Apple's records."
S2 — "Which iPhone model and iOS version are you on?"
S3 — get_category_products("iCloud Bypass With Network") + get_category_products("A12+ Offer")
S4 — navigate_to("iphone-unlock", "iCloud Bypass"). Collect IMEI + email. Payment.

━━━ FLOW 5: FRP Bypass (Android Google Account Lock) ━━━━━━━
TRIGGERS: "FRP", "Google locked", "factory reset protection", "bypass Google account", "Google account after reset"

S1 — "Which phone brand and exact model?" then navigate_to("frp", "FRP Bypass")
S2 — get_category_products("[brand] FRP") → show options + price
S3 — Collect: IMEI + device model + Android version + email. Payment. Delivery: 1–24 hours.

━━━ FLOW 6: Samsung FRP / Knox / Account / MDM ━━━━━━━━━━━━
TRIGGERS: "Samsung FRP", "Samsung Knox", "Samsung MDM", "Samsung account locked"

S1 — Clarify which:
  FRP/Google lock after reset → Samsung FRP Bypass
  Samsung Account/ID locked   → Samsung Account Remove
  Knox/MDM corporate policy   → Samsung Knox or MDM Removal

S2 — get_category_products("[exact service]") → show price. Collect IMEI + model + email.
S3 — navigate_to("frp", "FRP Services"). Payment.

━━━ FLOW 7: IMEI Services ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "IMEI check", "blacklisted", "bad IMEI", "IMEI repair", "is my phone stolen/blacklisted"

S1 — "Which service do you need?
  A) IMEI Check — full report: carrier, warranty, blacklist status, model info
  B) Blacklist Removal — remove bad IMEI from carrier database
  C) IMEI Repair — fix corrupted or null IMEI"
S2 — navigate_to("imei", "IMEI Services"). get_category_products("IMEI [type]")
S3 — Show service + price. Collect IMEI + email. Payment.

━━━ FLOW 8: Gift Cards ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "gift card", "PSN", "PlayStation", "Xbox", "Steam", "Google Play", "Netflix", "Roblox", "iTunes", "Spotify"

S1 — navigate_to("gift-cards", "Gift Cards Store")
S2 — Confirm what brand/region they want + tell them what's available
S3 — Ask: "Which denomination? (e.g. $50)" — any amount accepted, including custom
S3b— If amount not in catalog: search_products("[brand] [region]") → add_to_cart closest match → set device_identifier = "Custom: $[amount] [brand] [region]" → tell customer "Custom amount confirmed — delivered within 20 minutes to 1 hour."
S4 — Collect email only (NO IMEI for gift cards)
S5 — Payment → place_order. Delivery: instant–30 min standard, up to 1 hour custom.

━━━ FLOW 9: Other Brand Unlocks (Huawei, Motorola, Nokia, etc.) ━━
TRIGGERS: "unlock Huawei", "Motorola unlock", "Nokia unlock", "Xiaomi unlock", "LG unlock", "OnePlus unlock"

S1 — State price range (use table above)
S2 — search_products("[brand] [model] unlock"). navigate_to("android-unlock", "Android Unlock")
S3 — Collect IMEI + email. Payment.

━━━ FLOW 10: Server Credits ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "credits", "DC-Unlocker credits", "Octoplus credits", "Z3X credits", "server credits"

S1 — navigate_to("credits", "Server Credits"). search_products("[tool] credits")
S2 — Show price. Collect email + quantity. Payment. Delivery: instant after payment.

━━━ FLOW 11: Tool Activation / License ━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "activate", "license", "DFT Pro", "Hydra", "Miracle Box", "UFi", "NCK Pro"

S1 — navigate_to("activate", "Tool Activation"). search_products("[tool name] activation")
S2 — Show price. Collect email + hardware ID. Payment. Delivery: instant–2 hours.

━━━ FLOW 12: Unlock Tool Rental ━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "rent tool", "Z3X tool", "EFT Pro", "tool rental", "Chimera", "Octoplus"

S1 — navigate_to("unlock-tools", "Unlock Tool Rentals"). search_products("[tool name]")
S2 — Show price. Collect email. Payment. Access delivered digitally.

━━━ UNIVERSAL RULES (all flows) ━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Ask ONE question at a time. Never bundle.
✓ Always state the price BEFORE asking for payment.
✓ Never ask for IMEI for gift cards, server credits, or software.
✓ After collecting info, ALWAYS move to payment.
✓ USD prices. KES conversion: ×130.
✓ If customer asks for human support → add [SHOW_HUMAN_BUTTON].

══════════════════════════════════════════════════════════════
PERSONALITY & TONE
══════════════════════════════════════════════════════════════
• Professional but warm — speak like an expert friend, not a corporate script.
• Concise: bullets over paragraphs. Short answers for simple questions.
• Confident: you know this industry inside out.
• Witty when appropriate: "Is this bot even real?" → "100% real, powered by caffeine ☕ — what can I unlock for you? 😄"
• Always offer alternatives if something is out of stock or ineligible.
• Proactively mention related services (e.g. if someone asks about carrier unlock, mention we also do iCloud if relevant).
• Never be dismissive. Every question deserves a helpful, direct answer.

${catSection}

${catalogSection}
${pmSection}`;
}

// ─── OpenAI tools ────────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description: "Search for products in the store by name, brand, or service type. Use this whenever a customer asks about a specific product, price, or service.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term, e.g. 'iPhone 13 unlock', 'Samsung FRP', 'Steam gift card'" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_product_details",
      description: "Get full details of a specific product by its ID or exact name.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID (from catalog)" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "lookup_order",
      description: "Look up a customer's order status, items, and payment details. Always ask for email and order ID before calling this.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
          order_id: { type: "number", description: "The numeric order ID" },
        },
        required: ["email", "order_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "cancel_order",
      description: "Cancel a customer's pending or unpaid order within the 30-minute window.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
          order_id: { type: "number", description: "The order ID to cancel" },
        },
        required: ["email", "order_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "navigate_to",
      description: "Send the user to a specific page. Use when they want to browse, buy, checkout, or manage their account.",
      parameters: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: Object.keys(PAGE_HREFS),
            description: "Page key to navigate to",
          },
          label: { type: "string", description: "Button label shown to user" },
        },
        required: ["page", "label"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_featured_products",
      description: "Get featured products and active deals/discounts. Use when a customer asks about deals, promotions, best sellers, or popular services.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_category_products",
      description: "Get all products in a specific category. Use when the customer asks about a service type like 'iPhone unlock', 'Android', 'FRP bypass', 'IMEI', 'Gift cards', etc.",
      parameters: {
        type: "object",
        properties: {
          category_name: { type: "string", description: "Category name or keyword, e.g. 'iPhone', 'Samsung', 'FRP', 'IMEI', 'Gift Cards'" },
        },
        required: ["category_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payment_instructions",
      description: "Get detailed payment instructions for a specific payment method. Use when a customer asks how to pay with M-Pesa, USDT, Binance, crypto, or wallet.",
      parameters: {
        type: "object",
        properties: {
          method: { type: "string", description: "Payment method name, e.g. 'mpesa', 'usdt', 'binance', 'bitcoin', 'wallet'" },
        },
        required: ["method"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_to_cart",
      description: "Add a product to the customer's cart. Use when customer wants to add an item before checkout. Requires product ID from catalog.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "number", description: "Product ID to add (get from search_products or get_product_details)" },
          quantity: { type: "number", description: "Quantity to add (default 1)" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_login_otp",
      description: "Send a one-time password (OTP) to customer's email for passwordless login. Use when customer wants to log in via OTP (not password). Always call show_otp_login_form immediately after this.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "show_otp_login_form",
      description: "Display a secure OTP entry card so the customer can enter their one-time code privately. ALWAYS call this immediately after send_login_otp. NEVER ask the customer to type the OTP in the chat — use this secure card instead.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email address (must match the one used in send_login_otp)" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "show_password_login_form",
      description: "Display a secure password login card in the chat so the customer can enter their password privately. Use INSTEAD of asking for password in plain text. Call this when customer wants to log in with their password.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email to pre-fill in the secure form (optional, use if already collected)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "verify_login_otp",
      description: "Verify the OTP code and log the customer in. Call after send_login_otp once customer provides the 6-digit code.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
          code: { type: "string", description: "The 6-digit OTP code from email" },
        },
        required: ["email", "code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "signup_user",
      description: "Register a new customer account. Use when customer wants to sign up. Collect email, full name, and password first.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
          name: { type: "string", description: "Customer's full name" },
          password: { type: "string", description: "Password chosen by customer (minimum 6 characters)" },
        },
        required: ["email", "name", "password"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_password_reset_otp",
      description: "Send a password reset OTP to customer's email. Use when customer forgot their password.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reset_user_password",
      description: "Reset customer's password after verifying their OTP. Call after send_password_reset_otp when customer provides both the code and new password.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer's email address" },
          code: { type: "string", description: "The 6-digit OTP code from email" },
          new_password: { type: "string", description: "The new password (minimum 6 characters)" },
        },
        required: ["email", "code", "new_password"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "place_order",
      description: "Place an order and initiate payment. Call after customer has items in cart and has chosen a payment method. Collects all required info then creates the order.",
      parameters: {
        type: "object",
        properties: {
          payment_method: { type: "string", description: "Payment method: 'mpesa', 'nowpayments', 'usdt', 'binance_pay', 'wallet' (GSM World wallet balance — instant, customer must be logged in)" },
          customer_email: { type: "string", description: "Customer's email for order confirmation" },
          customer_name: { type: "string", description: "Customer's full name" },
          customer_phone: { type: "string", description: "Phone number — REQUIRED for M-Pesa (format: 07XXXXXXXX or 254XXXXXXXXX)" },
          device_identifier: { type: "string", description: "IMEI, serial, or device info if the product requires it" },
          pay_currency: { type: "string", description: "Crypto currency for NOWPayments (e.g. 'btc', 'eth', 'usdttrc20', 'ltc'). Default: usdttrc20" },
        },
        required: ["payment_method", "customer_email"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_wallet_balance",
      description: "Get the customer's current GSM World wallet balance. Customer must be logged in (botToken required). Use when customer asks about their wallet balance or wants to pay with wallet.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_wallet_funds",
      description: "Top up the customer's GSM World wallet balance. Customer must be logged in (botToken required). Supports M-Pesa (STK push), NOWPayments (crypto, min $13), and USDT (manual transfer). Always confirm amount and payment method before calling.",
      parameters: {
        type: "object",
        properties: {
          payment_method: { type: "string", description: "Payment method: 'mpesa', 'nowpayments', or 'usdt'" },
          amount: { type: "number", description: "Amount in USD to add to wallet. Min $13 for NOWPayments. For M-Pesa: USD amount (converted to KES at ~130)." },
          phone: { type: "string", description: "Phone number for M-Pesa STK push (e.g. 07XXXXXXXX). Required when payment_method is mpesa." },
          pay_currency: { type: "string", description: "Crypto currency for NOWPayments (e.g. 'usdttrc20', 'btc', 'eth', 'ltc'). Default: usdttrc20." },
        },
        required: ["payment_method", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "logout_user",
      description: "Log out the currently authenticated user. Call immediately when the user asks to log out, sign out, or switch accounts. No parameters needed.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ─── Tool executors ──────────────────────────────────────────────────────────
async function toolSearchProducts(query: string) {
  try {
    // Strip price/denomination tokens (e.g. "$50", "500usd", "100") before building
    // AND conditions. These are not useful for category/brand matching and cause
    // legitimate products to be missed when the DB stores denominations differently
    // (e.g. "$50.00" vs "$50", or denomination only in the price column).
    // The bot handles denomination selection from the returned product list.
    const cleanQuery = query.replace(/\$?\d+(\.\d+)?\s*(usd|kes|gbp|eur|usd)?/gi, "").trim();
    const searchQuery = cleanQuery || query; // fall back to original if everything was stripped
    const words = searchQuery.trim().split(/\s+/).filter((w) => w.length > 1);
    const conditions = words.map((w) =>
      or(
        ilike(productsTable.name, `%${w}%`),
        ilike(productsTable.description, `%${w}%`)
      )
    );

    const results = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        description: productsTable.description,
        inStock: productsTable.inStock,
        categoryId: productsTable.categoryId,
      })
      .from(productsTable)
      .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined)
      .limit(12);

    const cats = await db.select().from(categoriesTable);
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

    if (results.length === 0) {
      // If the query contains a dollar amount or number (e.g. "$500", "500usd", "500"),
      // strip the amount and retry with just the brand/product name so the bot can
      // pick the closest product and treat the order as a custom denomination.
      const stripped = query.replace(/\$?\d+\s*(usd|kes|gbp|eur)?/gi, "").trim();
      if (stripped && stripped !== query) {
        const strippedWords = stripped.split(/\s+/).filter((w) => w.length > 1);
        if (strippedWords.length > 0) {
          const strippedConditions = strippedWords.map((w) =>
            or(
              ilike(productsTable.name, `%${w}%`),
              ilike(productsTable.description, `%${w}%`)
            )
          );
          const fallbackResults = await db
            .select({
              id: productsTable.id,
              name: productsTable.name,
              price: productsTable.price,
              originalPrice: productsTable.originalPrice,
              description: productsTable.description,
              inStock: productsTable.inStock,
              categoryId: productsTable.categoryId,
            })
            .from(productsTable)
            .where(strippedConditions.length === 1 ? strippedConditions[0] : and(...strippedConditions))
            .limit(12);

          if (fallbackResults.length > 0) {
            const fallbackCats = await db.select().from(categoriesTable);
            const fallbackCatMap = Object.fromEntries(fallbackCats.map((c) => [c.id, c.name]));
            return {
              found: true,
              custom_denomination_hint: true,
              note: `Exact denomination not in catalog. Use the closest product below for cart, set device_identifier to "Custom denomination: ${query}", and tell customer their code will be delivered within 20 minutes to 1 hour.`,
              count: fallbackResults.length,
              products: fallbackResults.map((p) => {
                const cat = fallbackCatMap[p.categoryId] ?? "General";
                return {
                  id: p.id,
                  name: p.name,
                  price: `$${parseFloat(p.price).toFixed(2)}`,
                  originalPrice: p.originalPrice ? `$${parseFloat(p.originalPrice).toFixed(2)}` : null,
                  category: cat,
                  description: p.description?.slice(0, 150),
                  inStock: p.inStock,
                  requiredOrderFields: getRequiredOrderFields(p.name, p.description ?? "", cat),
                };
              }),
            };
          }
        }
      }
      return { found: false, message: "No products found matching that search." };
    }
    return {
      found: true,
      count: results.length,
      products: results.map((p) => {
        const cat = catMap[p.categoryId] ?? "General";
        return {
          id: p.id,
          name: p.name,
          price: `$${parseFloat(p.price).toFixed(2)}`,
          originalPrice: p.originalPrice ? `$${parseFloat(p.originalPrice).toFixed(2)}` : null,
          category: cat,
          description: p.description?.slice(0, 150),
          inStock: p.inStock,
          requiredOrderFields: getRequiredOrderFields(p.name, p.description ?? "", cat),
        };
      }),
    };
  } catch {
    return { found: false, message: "Product search is temporarily unavailable." };
  }
}

async function toolGetProductDetails(productId: number) {
  try {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    if (!product) return { found: false, message: "Product not found." };

    const [cat] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, product.categoryId))
      .limit(1);

    const catName = cat?.name ?? "General";
    return {
      found: true,
      product: {
        id: product.id,
        name: product.name,
        price: `$${parseFloat(product.price).toFixed(2)}`,
        originalPrice: product.originalPrice ? `$${parseFloat(product.originalPrice).toFixed(2)}` : null,
        category: catName,
        description: product.description,
        inStock: product.inStock,
        featured: product.featured,
        requiredOrderFields: getRequiredOrderFields(product.name, product.description ?? "", catName),
      },
    };
  } catch {
    return { found: false, message: "Could not retrieve product details." };
  }
}

async function toolLookupOrder(email: string, orderId: number) {
  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.customerEmail, email.toLowerCase())))
      .limit(1);

    if (!order) return { found: false, error: "No order found with that email and order ID." };

    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));

    return {
      found: true,
      order: {
        id: order.id,
        status: order.paymentStatus,
        total: order.total,
        currency: order.currency,
        paymentMethod: order.paymentMethod,
        customerName: order.customerName,
        createdAt: order.createdAt,
        items: items.map((i) => ({ name: i.productName, quantity: i.quantity, price: i.price })),
      },
    };
  } catch {
    return { found: false, error: "Could not retrieve order at this time." };
  }
}

async function toolGetFeaturedProducts() {
  try {
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        description: productsTable.description,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        categoryId: productsTable.categoryId,
      })
      .from(productsTable)
      .where(eq(productsTable.featured, true))
      .limit(10);

    const cats = await db.select().from(categoriesTable);
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

    const onSale = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        description: productsTable.description,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        categoryId: productsTable.categoryId,
      })
      .from(productsTable)
      .where(eq(productsTable.inStock, true))
      .limit(5);

    const combined = [...products, ...onSale.filter(p => !products.find(f => f.id === p.id) && p.originalPrice && parseFloat(p.originalPrice) > parseFloat(p.price))];

    if (combined.length === 0) return { found: false, message: "No featured products at this time. Browse the full store for all available services." };
    return {
      found: true,
      count: combined.length,
      products: combined.map(p => ({
        id: p.id,
        name: p.name,
        price: `$${parseFloat(p.price).toFixed(2)}`,
        originalPrice: p.originalPrice ? `$${parseFloat(p.originalPrice).toFixed(2)}` : null,
        category: catMap[p.categoryId] ?? "General",
        description: p.description?.slice(0, 150),
        inStock: p.inStock,
        onSale: !!(p.originalPrice && parseFloat(p.originalPrice) > parseFloat(p.price)),
      })),
    };
  } catch {
    return { found: false, message: "Could not load featured products." };
  }
}

async function toolGetCategoryProducts(categoryName: string) {
  try {
    const cats = await db.select().from(categoriesTable);
    const matched = cats.filter(c =>
      c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
      c.slug.toLowerCase().includes(categoryName.toLowerCase())
    );

    if (matched.length === 0) {
      return {
        found: false,
        message: `No category matching "${categoryName}" found.`,
        availableCategories: cats.map(c => c.name),
      };
    }

    const catIds = matched.map(c => c.id);
    const orCondition = catIds.length === 1
      ? eq(productsTable.categoryId, catIds[0])
      : or(...catIds.map(id => eq(productsTable.categoryId, id)));

    const [products, totalCountRows] = await Promise.all([
      db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          price: productsTable.price,
          originalPrice: productsTable.originalPrice,
          description: productsTable.description,
          inStock: productsTable.inStock,
          featured: productsTable.featured,
          categoryId: productsTable.categoryId,
        })
        .from(productsTable)
        .where(orCondition)
        .orderBy(productsTable.name)
        .limit(50),
      db.execute(sql`SELECT COUNT(*)::int as total FROM products WHERE category_id = ANY(${catIds})`),
    ]);

    const totalCount = (totalCountRows.rows[0] as { total: number })?.total ?? products.length;
    const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
    return {
      found: true,
      categories: matched.map(c => c.name),
      count: products.length,
      totalCount,
      hasMore: totalCount > products.length,
      products: products.map(p => {
        const cat = catMap[p.categoryId] ?? "General";
        return {
          id: p.id,
          name: p.name,
          price: `$${parseFloat(p.price).toFixed(2)}`,
          originalPrice: p.originalPrice ? `$${parseFloat(p.originalPrice).toFixed(2)}` : null,
          category: cat,
          description: p.description?.slice(0, 150),
          inStock: p.inStock,
          requiredOrderFields: getRequiredOrderFields(p.name, p.description ?? "", cat),
        };
      }),
    };
  } catch {
    return { found: false, message: "Could not load category products." };
  }
}

async function toolGetPaymentInstructions(method: string) {
  const m = method.toLowerCase();

  // Fetch real payment method data from DB
  let binancePayId = "";
  let usdtAddress = "";
  let usdtNetwork = "TRC20";
  try {
    const methods = await getPaymentMethods();
    for (const pm of methods) {
      if (!pm.enabled) continue;
      const label = (pm.label || pm.method || "").toLowerCase();
      const net = (pm.network || "").toLowerCase();
      if (label.includes("binance") || net.includes("binance")) {
        binancePayId = pm.walletAddress || "";
      }
      if (label.includes("usdt") || net.includes("trc20") || net.includes("erc20")) {
        usdtAddress = pm.walletAddress || "";
        if (pm.network) usdtNetwork = pm.network;
      }
    }
  } catch { /* use defaults */ }

  const binanceIdLine = binancePayId ? `\n   Binance Pay ID: ${binancePayId}` : "";
  const usdtAddrLine = usdtAddress ? `\n   Wallet address: ${usdtAddress}` : "";

  const instructions: Record<string, string> = {
    mpesa: `M-Pesa (Kenya) Payment Steps:
1. Enter your M-Pesa registered phone number below
2. Click "Send STK Push" — a prompt is sent to your phone immediately
3. Check your phone for the M-Pesa PIN prompt
4. Enter your M-Pesa PIN to confirm payment
5. Your order is confirmed automatically once payment is received
⚡ Instant confirmation. No minimum amount.`,

    usdt: `USDT (Crypto) Payment Steps:
1. Choose your network: TRC20 (Tron) or ERC20 (Ethereum)${usdtAddrLine}
2. Copy the wallet address shown below
3. Send the EXACT amount in USDT from your wallet or exchange
4. ⚠️ Send on the CORRECT network — TRC20 is cheaper and faster
5. Upload your transaction screenshot below as proof
6. Our team confirms within 15–30 minutes`,

    binance: `Binance Pay Steps:
1. Open your Binance app → tap Pay → Send${binanceIdLine}
2. Enter the Binance Pay ID shown below, or scan the QR code
3. Confirm the exact amount in Binance and complete payment
4. Screenshot your payment confirmation and upload it below
5. Your order is confirmed automatically`,

    bitcoin: `Bitcoin Payment Steps:
1. Select Bitcoin at checkout
2. Copy the BTC wallet address shown on the checkout page
3. Send the exact BTC amount from your wallet
4. Paste your transaction TXID in the order notes
5. Confirmation takes 1–3 network confirmations (30–60 min)`,

    wallet: `Wallet Balance Payment:
1. First top up your wallet: Account → Add Funds
2. Choose any payment method to add funds
3. At checkout, select "Wallet Balance"
4. Payment is instant — no waiting for verification
5. ✅ Best method for repeat customers — instant order processing`,
  };

  for (const [key, text] of Object.entries(instructions)) {
    if (m.includes(key)) {
      return {
        method: key,
        instructions: text,
        binancePayId: key === "binance" ? binancePayId : undefined,
        usdtAddress: key === "usdt" ? usdtAddress : undefined,
        usdtNetwork: key === "usdt" ? usdtNetwork : undefined,
      };
    }
  }

  return {
    method: "general",
    instructions: `We accept: M-Pesa, USDT (TRC20/ERC20), Binance Pay, Bitcoin, and Wallet Balance.\nAsk me about a specific method for step-by-step instructions!`,
  };
}

async function toolCheckOrderByPhone(phone: string) {
  try {
    const cleaned = phone.replace(/\s+/g, "").replace(/^\+/, "");
    const results = await db
      .select({
        id: ordersTable.id,
        paymentStatus: ordersTable.paymentStatus,
        total: ordersTable.total,
        currency: ordersTable.currency,
        paymentMethod: ordersTable.paymentMethod,
        createdAt: ordersTable.createdAt,
        customerName: ordersTable.customerName,
        customerEmail: ordersTable.customerEmail,
      })
      .from(ordersTable)
      .where(
        or(
          ilike(ordersTable.customerPhone, `%${cleaned}%`),
          ilike(ordersTable.customerPhone, `%+${cleaned}%`)
        )
      )
      .orderBy(desc(ordersTable.createdAt))
      .limit(5);

    if (results.length === 0) {
      return { found: false, message: "No orders found for that phone number. Double-check the number or try looking up by email and order ID." };
    }
    return {
      found: true,
      count: results.length,
      orders: results.map(o => ({
        id: o.id,
        status: o.paymentStatus,
        total: `${o.currency} ${parseFloat(o.total).toFixed(2)}`,
        method: o.paymentMethod,
        date: new Date(o.createdAt as Date).toLocaleDateString(),
        name: o.customerName,
        email: o.customerEmail ? `${o.customerEmail.slice(0, 3)}***@${o.customerEmail.split("@")[1]}` : null,
      })),
    };
  } catch {
    return { found: false, message: "Could not look up orders by phone at this time." };
  }
}

async function toolCancelOrder(email: string, orderId: number) {
  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.customerEmail, email.toLowerCase())))
      .limit(1);

    if (!order) return { cancelled: false, error: "No order found with that email and order ID." };

    if (!["pending", "pending_payment_confirmation"].includes(order.paymentStatus ?? "")) {
      return { cancelled: false, error: `Order #${orderId} is already ${order.paymentStatus} and cannot be cancelled. Contact support.` };
    }

    const ageMs = Date.now() - new Date(order.createdAt as Date).getTime();
    if (ageMs > 30 * 60 * 1000) {
      return { cancelled: false, error: `The 30-minute cancellation window has expired for order #${orderId}. Contact support.` };
    }

    await db.update(ordersTable).set({ paymentStatus: "cancelled", updatedAt: new Date() }).where(eq(ordersTable.id, orderId));
    return { cancelled: true };
  } catch {
    return { cancelled: false, error: "Could not process cancellation at this time." };
  }
}

function normalisePhone(raw: string): string {
  // Normalise Kenyan & international numbers for OTS API
  // OTS requires international format without + e.g. 254719841370
  let n = raw.replace(/\s+/g, "").replace(/^\+/, "");
  if (n.startsWith("0") && n.length === 10) n = "254" + n.slice(1); // 07xx → 254xx
  return n;
}

async function sendOtsSms(params: { apiToken: string; senderId: string | null; to: string; message: string }): Promise<{ ok: boolean; reason?: string }> {
  try {
    const recipient = normalisePhone(params.to);
    const res = await fetch("https://sms.ots.co.ke/api/v3/sms/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${params.apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient,
        sender_id: params.senderId || "GSMSUPPORT",
        message: params.message,
      }),
    });
    const json = await res.json().catch(() => ({})) as { status?: string; message?: string };
    if (json.status === "success") return { ok: true };
    return { ok: false, reason: json.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Streaming helpers ────────────────────────────────────────────────────────

/** Consumes an OpenAI SSE stream. If `sseWrite` is provided, text tokens are
 *  forwarded as they arrive (only when no tool-calls have started). Returns
 *  the accumulated text and fully-assembled tool-call list. */
async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  sseWrite?: (text: string) => void,
): Promise<{
  text: string;
  toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
}> {
  const reader = (stream as unknown as { getReader(): ReadableStreamDefaultReader<Uint8Array> }).getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  const tcMap: Record<number, { id: string; name: string; args: string }> = {};
  let hasToolCalls = false;

  try {
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") break outer;
        let chunk: Record<string, unknown>;
        try { chunk = JSON.parse(raw); } catch { continue; }
        const choice = (chunk.choices as Array<{ delta?: { content?: string | null; tool_calls?: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> }; finish_reason?: string | null }>)?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          text += delta.content;
          if (!hasToolCalls && sseWrite) sseWrite(delta.content);
        }
        if (delta?.tool_calls?.length) {
          hasToolCalls = true;
          for (const tc of delta.tool_calls) {
            const i = tc.index;
            if (!tcMap[i]) tcMap[i] = { id: "", name: "", args: "" };
            if (tc.id) tcMap[i].id = tc.id;
            if (tc.function?.name) tcMap[i].name += tc.function.name;
            if (tc.function?.arguments) tcMap[i].args += tc.function.arguments;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const toolCalls = Object.entries(tcMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, tc]) => ({ id: tc.id, type: "function" as const, function: { name: tc.name, arguments: tc.args } }));

  return { text, toolCalls };
}

// ─── New tool executors (cart / auth / checkout) ─────────────────────────────
async function toolAddToCart(productId: number, quantity: number, sessionId: string, botToken?: string | null): Promise<Record<string, unknown>> {
  try {
    // Direct DB — no internal HTTP call (serverless-safe)
    const { resolvedSession } = resolveBotSession(sessionId, botToken);
    const qty = quantity || 1;

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
    if (!product) return { success: false, error: "Product not found" };

    const [existing] = await db.select().from(cartItemsTable)
      .where(and(eq(cartItemsTable.sessionId, resolvedSession), eq(cartItemsTable.productId, productId)));

    if (existing) {
      await db.update(cartItemsTable)
        .set({ quantity: existing.quantity + qty })
        .where(and(eq(cartItemsTable.sessionId, resolvedSession), eq(cartItemsTable.productId, productId)));
    } else {
      await db.insert(cartItemsTable).values({ sessionId: resolvedSession, productId, quantity: qty, priceAtAdd: product.price });
    }

    return {
      success: true,
      productName: product.name,
      price: `$${parseFloat(product.price).toFixed(2)}`,
      quantity: qty,
    };
  } catch (err) {
    logger.error({ err }, "toolAddToCart failed");
    return { success: false, error: "Failed to add to cart. Please try again." };
  }
}

async function toolSendLoginOtp(email: string): Promise<Record<string, unknown>> {
  try {
    const normalEmail = email.toLowerCase().trim();
    const rows = await db.select({ id: usersTable.id, status: usersTable.status })
      .from(usersTable).where(eq(usersTable.email, normalEmail)).limit(1);
    if (!rows.length) return { success: true };
    if (rows[0].status === "disabled" || rows[0].status === "banned") {
      return { success: false, error: "Your account is not allowed. Contact support." };
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await _setOtp(`login:${normalEmail}`, otp, 10 * 60 * 1000);
    const emailResult = await sendEmail({ to: normalEmail, ...otpEmail(otp) });
    if (!emailResult.sent) {
      return { success: false, error: `Could not send verification code: ${emailResult.reason ?? "email delivery failed"}. Check Admin email settings.` };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, "toolSendLoginOtp failed");
    return { success: false, error: "Could not send OTP — email service may be unavailable" };
  }
}

async function toolVerifyLoginOtp(email: string, code: string): Promise<Record<string, unknown>> {
  try {
    const normalEmail = email.toLowerCase().trim();
    const key = `login:${normalEmail}`;
    const entry = await _getOtp(key);
    if (!entry || entry.code !== String(code).trim()) {
      return { success: false, error: "Invalid or expired code" };
    }
    if (Date.now() > entry.expiresAt) {
      await _deleteOtp(key);
      return { success: false, error: "Code has expired. Please request a new one." };
    }
    await _deleteOtp(key);
    const rows = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, status: usersTable.status })
      .from(usersTable).where(eq(usersTable.email, normalEmail)).limit(1);
    if (!rows.length) return { success: false, error: "User not found" };
    const user = rows[0];
    if (user.status === "disabled" || user.status === "banned") {
      return { success: false, error: "Your account is not allowed. Contact support." };
    }
    const token = _makeUserToken(user.id, user.email);
    return { success: true, token, user: { id: user.id, email: user.email, name: user.name } };
  } catch (err) {
    logger.error({ err }, "toolVerifyLoginOtp failed");
    return { success: false, error: "Verification service unavailable" };
  }
}

async function toolSignupUser(email: string, name: string, password: string): Promise<Record<string, unknown>> {
  try {
    const normalEmail = email.toLowerCase().trim();
    if (!password || password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalEmail)).limit(1);
    if (existing.length > 0) {
      return { success: false, error: "An account with this email already exists" };
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      email: normalEmail, passwordHash, name: name.trim() || null,
    }).returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name });
    const token = _makeUserToken(user.id, user.email);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await _setOtp(normalEmail, otp, 10 * 60 * 1000);
    const emailResult = await sendEmail({ to: normalEmail, ...otpEmail(otp) });
    return { success: true, token, user: { id: user.id, email: user.email, name: user.name }, emailSent: emailResult.sent };
  } catch (err) {
    logger.error({ err }, "toolSignupUser failed");
    return { success: false, error: "Registration service unavailable" };
  }
}

async function toolSendPasswordResetOtp(email: string): Promise<Record<string, unknown>> {
  try {
    const normalEmail = email.toLowerCase().trim();
    const rows = await db.select({ id: usersTable.id, status: usersTable.status })
      .from(usersTable).where(eq(usersTable.email, normalEmail)).limit(1);
    if (!rows.length) return { success: true };
    if (rows[0].status === "disabled" || rows[0].status === "banned") {
      return { success: false, error: "Account disabled. Contact support." };
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await _setOtp(`reset:${normalEmail}`, otp, 10 * 60 * 1000);
    const emailResult = await sendEmail({ to: normalEmail, ...otpEmail(otp) });
    if (!emailResult.sent) {
      return { success: false, error: `Could not send reset code: ${emailResult.reason ?? "email delivery failed"}` };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, "toolSendPasswordResetOtp failed");
    return { success: false, error: "Service unavailable" };
  }
}

async function toolResetUserPassword(email: string, code: string, newPassword: string): Promise<Record<string, unknown>> {
  try {
    const normalEmail = email.toLowerCase().trim();
    const key = `reset:${normalEmail}`;
    const entry = await _getOtp(key);
    if (!entry || entry.code !== String(code).trim()) {
      return { success: false, error: "Invalid or expired reset code" };
    }
    if (Date.now() > entry.expiresAt) {
      await _deleteOtp(key);
      return { success: false, error: "Reset code has expired. Please request a new one." };
    }
    await _deleteOtp(key);
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.email, normalEmail));
    return { success: true };
  } catch (err) {
    logger.error({ err }, "toolResetUserPassword failed");
    return { success: false, error: "Service unavailable" };
  }
}

async function toolPlaceOrder(args: {
  paymentMethod: string; customerEmail: string; customerName?: string;
  customerPhone?: string; deviceIdentifier?: string; payCurrency?: string;
  sessionId?: string | null; botToken?: string | null;
}): Promise<Record<string, unknown>> {
  try {
    const pm = args.paymentMethod.toLowerCase().replace(/^binance$/, "binance_pay");

    // Guard: M-Pesa requires phone
    if (pm === "mpesa" && !args.customerPhone) {
      return {
        success: false,
        error: "PHONE_REQUIRED: You must collect the customer's M-Pesa phone number before placing this order. Ask: \"What M-Pesa phone number should we send the STK push to? (format: 07XXXXXXXX or 254XXXXXXXXX)\" — then call place_order again with customer_phone filled in.",
      };
    }

    // Direct DB — serverless-safe (no internal HTTP call)
    const { resolvedSession, userId: loggedInUserId } = resolveBotSession(args.sessionId, args.botToken);

    // Fetch cart
    const cartRows = await db
      .select({ cartItem: cartItemsTable, product: productsTable })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
      .where(eq(cartItemsTable.sessionId, resolvedSession));

    if (cartRows.length === 0) {
      return { success: false, error: "Cart is empty" };
    }

    const total = cartRows.reduce((acc, r) => acc + parseFloat(r.cartItem.priceAtAdd) * r.cartItem.quantity, 0);
    const orderCode = generateBotOrderCode();
    const customerEmail = args.customerEmail.toLowerCase();
    const customerName = args.customerName ?? null;
    const customerPhone = args.customerPhone ?? null;

    // Create order record
    const [order] = await db.insert(ordersTable).values({
      orderCode,
      sessionId: resolvedSession,
      customerEmail,
      customerPhone,
      customerName,
      paymentMethod: pm,
      paymentStatus: "pending",
      total: String(total),
      currency: "USD",
      deviceIdentifier: args.deviceIdentifier ?? null,
    }).returning();

    // Insert order items
    await db.insert(orderItemsTable).values(
      cartRows.map(r => ({
        orderId: order.id,
        productId: r.cartItem.productId,
        productName: r.product.name,
        price: r.cartItem.priceAtAdd,
        quantity: r.cartItem.quantity,
      }))
    );

    const itemsForEmail = cartRows.map(r => ({
      productName: r.product.name,
      quantity: r.cartItem.quantity,
      price: r.cartItem.priceAtAdd,
    }));

    // ── Payment-specific logic ──────────────────────────────────────────────
    if (pm === "wallet") {
      if (!loggedInUserId) return { success: false, error: "Must be logged in to pay with wallet" };
      const [userRow] = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, loggedInUserId)).limit(1);
      const balance = parseFloat(userRow?.walletBalance ?? "0");
      if (balance < total) return { success: false, error: `Insufficient wallet balance. You have $${balance.toFixed(2)} but need $${total.toFixed(2)}.` };
      await db.update(usersTable).set({ walletBalance: sql`wallet_balance - ${total.toFixed(2)}` }).where(eq(usersTable.id, loggedInUserId));
      await db.update(ordersTable).set({ paymentStatus: "paid" }).where(eq(ordersTable.id, order.id));
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, resolvedSession));
      sendEmail({ to: customerEmail, ...orderSubmittedEmail({ orderId: order.id, orderCode, customerName, items: itemsForEmail, total: String(total), paymentMethod: pm }) }).catch(() => {});
      return { success: true, orderId: order.id, orderCode, paymentMethod: pm, status: "paid", total, currency: "USD" };

    } else if (pm === "mpesa") {
      const amountKes = Math.ceil(total * _USD_TO_KES);
      let stkRes: Awaited<ReturnType<typeof initiateSTKPush>>;
      try {
        stkRes = await initiateSTKPush({ phone: customerPhone!, amount: amountKes, orderId: order.id, description: `Order #${order.id}` });
      } catch (err) {
        logger.error({ err }, "STK Push failed in toolPlaceOrder");
        await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
        return { success: false, error: "M-Pesa STK push failed. Please check the phone number and try again." };
      }
      await db.insert(paymentTransactionsTable).values({ orderId: order.id, provider: "mpesa", providerReference: stkRes.CheckoutRequestID, amount: String(amountKes), currency: "KES", status: "pending", rawResponse: stkRes as unknown as Record<string, unknown> });
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, resolvedSession));
      sendEmail({ to: customerEmail, ...orderSubmittedEmail({ orderId: order.id, orderCode, customerName, items: itemsForEmail, total: String(total), paymentMethod: pm }) }).catch(() => {});
      _fireAdminOrderAlert({ orderId: order.id, orderCode, customerEmail, customerName, itemsForEmail, total, pm });
      return { success: true, orderId: order.id, orderCode, paymentMethod: pm, status: "pending", total, currency: "USD", checkoutRequestId: stkRes.CheckoutRequestID, message: stkRes.CustomerMessage };

    } else if (pm === "usdt") {
      const [walletAddress, network] = await Promise.all([getUsdtWallet(), getUsdtNetwork()]);
      await db.insert(paymentTransactionsTable).values({ orderId: order.id, provider: "usdt", providerReference: null, amount: String(total), currency: "USDT", status: "pending", rawResponse: null });
      sendEmail({ to: customerEmail, ...orderSubmittedEmail({ orderId: order.id, orderCode, customerName, items: itemsForEmail, total: String(total), paymentMethod: pm }) }).catch(() => {});
      _fireAdminOrderAlert({ orderId: order.id, orderCode, customerEmail, customerName, itemsForEmail, total, pm });
      return { success: true, orderId: order.id, orderCode, paymentMethod: pm, status: "pending", total, currency: "USD", usdt: { walletAddress, network: network ?? "TRC20", amountUsdt: parseFloat(total.toFixed(2)), memo: `ORDER-${orderCode}` } };

    } else if (pm === "binance_pay") {
      const binanceId = await getBinancePayId();
      await db.update(ordersTable).set({ paymentStatus: "pending_payment_confirmation" }).where(eq(ordersTable.id, order.id));
      await db.insert(paymentTransactionsTable).values({ orderId: order.id, provider: "binance_pay", providerReference: null, amount: String(total), currency: "USD", status: "pending", rawResponse: { binanceId, reference: `ORDER-${orderCode}` } as Record<string, unknown> });
      await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, resolvedSession));
      sendEmail({ to: customerEmail, ...pendingManualPaymentEmail({ orderId: order.id, orderCode, customerName, paymentMethod: "binance_pay", total: String(total), binanceId }) }).catch(() => {});
      _fireAdminOrderAlert({ orderId: order.id, orderCode, customerEmail, customerName, itemsForEmail, total, pm });
      return { success: true, orderId: order.id, orderCode, paymentMethod: pm, status: "pending_payment_confirmation", total, currency: "USD", binanceId, reference: `ORDER-${orderCode}` };

    } else if (pm === "nowpayments") {
      const payCurrency = args.payCurrency ?? "usdttrc20";
      let payment: Awaited<ReturnType<typeof createPayment>>;
      try {
        payment = await createPayment({ priceAmount: total, priceCurrency: "usd", payCurrency, orderId: `checkout-${order.id}`, orderDescription: `GSM World Checkout #${order.id}` });
      } catch (payErr) {
        const payMsg = payErr instanceof Error ? payErr.message : "NOWPayments error";
        await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
        return { success: false, error: payMsg };
      }
      await db.insert(paymentTransactionsTable).values({ orderId: order.id, provider: "nowpayments", providerReference: payment.payment_id, amount: String(total), currency: "USD", status: "pending", rawResponse: payment as unknown as Record<string, unknown> });
      sendEmail({ to: customerEmail, ...orderSubmittedEmail({ orderId: order.id, orderCode, customerName, items: itemsForEmail, total: String(total), paymentMethod: pm }) }).catch(() => {});
      _fireAdminOrderAlert({ orderId: order.id, orderCode, customerEmail, customerName, itemsForEmail, total, pm });
      return { success: true, orderId: order.id, orderCode, paymentMethod: pm, status: "pending", total, currency: "USD", nowpayments: { paymentId: payment.payment_id, payAddress: payment.pay_address, payAmount: payment.pay_amount, payCurrency: payment.pay_currency, expiresAt: payment.expiration_estimate_date } };

    } else {
      // Unknown / custom payment method
      const methods = await getPaymentMethods();
      const selected = methods.find(m => m.method.toLowerCase() === pm);
      await db.insert(paymentTransactionsTable).values({ orderId: order.id, provider: "custom", providerReference: null, amount: String(total), currency: "USD", status: "pending", rawResponse: (selected ?? null) as Record<string, unknown> | null });
      sendEmail({ to: customerEmail, ...orderSubmittedEmail({ orderId: order.id, orderCode, customerName, items: itemsForEmail, total: String(total), paymentMethod: pm }) }).catch(() => {});
      return { success: true, orderId: order.id, orderCode, paymentMethod: pm, status: "pending", total, currency: "USD", custom: selected ?? null };
    }
  } catch (err) {
    logger.error({ err }, "toolPlaceOrder failed");
    return { success: false, error: "Order placement failed. Please try again." };
  }
}

function _fireAdminOrderAlert(opts: { orderId: number; orderCode: string; customerEmail: string; customerName: string | null; itemsForEmail: { productName: string; quantity: number; price: string }[]; total: number; pm: string }) {
  getSmtpConfig().then(cfg => {
    const adminEmail = cfg.emailFrom;
    if (!adminEmail) return;
    const itemSummary = opts.itemsForEmail.map(i => `${i.productName} ×${i.quantity}`).join(", ");
    sendEmail({ to: adminEmail, ...adminNewOrderAlertEmail({ orderId: opts.orderId, orderCode: opts.orderCode, orderType: "Store Order", customerEmail: opts.customerEmail, customerName: opts.customerName, items: itemSummary, total: String(opts.total), paymentMethod: opts.pm }) }).catch(() => {});
  }).catch(() => {});
}

async function toolGetWalletBalance(botToken: string | null): Promise<Record<string, unknown>> {
  if (!botToken) return { success: false, error: "You must be logged in to check wallet balance. Please log in first." };
  const port = process.env.PORT ?? "5000";
  try {
    const r = await fetch(`http://localhost:${port}/api/wallet/balance`, {
      method: "GET",
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await r.json() as Record<string, unknown>;
    if (r.ok) return { success: true, ...data };
    return { success: false, error: (data as { error?: string }).error ?? "Could not retrieve balance." };
  } catch {
    return { success: false, error: "Wallet service unavailable." };
  }
}

async function toolAddWalletFunds(args: {
  paymentMethod: string; amount: number; phone?: string; payCurrency?: string; botToken?: string | null;
}): Promise<Record<string, unknown>> {
  if (!args.botToken) return { success: false, error: "You must be logged in to top up your wallet. Please log in first." };
  const port = process.env.PORT ?? "5000";
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${args.botToken}` };
  const pm = args.paymentMethod.toLowerCase();
  try {
    if (pm === "mpesa") {
      if (!args.phone) return { success: false, error: "Phone number is required for M-Pesa top-up." };
      const r = await fetch(`http://localhost:${port}/api/wallet/add-fund/mpesa`, {
        method: "POST", headers, body: JSON.stringify({ phone: args.phone, amount: args.amount }),
      });
      const data = await r.json() as Record<string, unknown>;
      if (r.ok) return { success: true, ...data };
      return { success: false, error: (data as { error?: string }).error ?? "M-Pesa top-up failed." };
    } else if (pm === "nowpayments") {
      const r = await fetch(`http://localhost:${port}/api/wallet/add-fund/nowpayments`, {
        method: "POST", headers, body: JSON.stringify({ amount: args.amount, payCurrency: args.payCurrency ?? "usdttrc20" }),
      });
      const data = await r.json() as Record<string, unknown>;
      if (r.ok) return { success: true, ...data };
      return { success: false, error: (data as { error?: string }).error ?? "Crypto top-up failed." };
    } else if (pm === "usdt") {
      const r = await fetch(`http://localhost:${port}/api/wallet/add-fund/usdt`, { method: "GET", headers });
      const data = await r.json() as Record<string, unknown>;
      if (r.ok) return { success: true, ...data };
      return { success: false, error: "Could not retrieve USDT deposit details." };
    }
    return { success: false, error: "Unknown payment method. Use: mpesa, nowpayments, or usdt." };
  } catch {
    return { success: false, error: "Wallet top-up service unavailable. Please try again." };
  }
}

type ToolCallItem = { id: string; type: string; function: { name: string; arguments: string } };

/** Execute a list of tool calls in parallel and return tool-role messages + action data. */
async function runToolCalls(
  toolCalls: ToolCallItem[],
  opts: { isAuthenticated: boolean; userEmail: string | null; sessionId?: string | null; botToken?: string | null },
): Promise<{
  messages: Array<{ role: string; content: string; tool_call_id: string; name: string }>;
  actionType: string | null;
  actionData: Record<string, unknown> | null;
}> {
  let actionType: string | null = null;
  let actionData: Record<string, unknown> | null = null;

  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      const fn = tc.function.name;
      let args: Record<string, unknown>;
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
      let result = "";
      let lat: string | null = null;
      let lad: Record<string, unknown> | null = null;

      if (fn === "search_products") {
        const r = await toolSearchProducts(String(args.query ?? ""));
        result = JSON.stringify(r);
        if (r.found && r.products?.length) { lat = "show_products"; lad = { products: r.products }; }
      } else if (fn === "get_product_details") {
        const r = await toolGetProductDetails(Number(args.product_id ?? 0));
        result = JSON.stringify(r);
        if (r.found && r.product) { lat = "show_product"; lad = { product: r.product }; }
      } else if (fn === "lookup_order") {
        const email = opts.isAuthenticated && opts.userEmail ? opts.userEmail : String(args.email ?? "");
        const r = await toolLookupOrder(email, Number(args.order_id ?? 0));
        result = JSON.stringify(r.found ? r.order : r.error);
        if (r.found && r.order) { lat = "show_order"; lad = r.order as Record<string, unknown>; }
      } else if (fn === "cancel_order") {
        const email = opts.isAuthenticated && opts.userEmail ? opts.userEmail : String(args.email ?? "");
        const r = await toolCancelOrder(email, Number(args.order_id ?? 0));
        result = r.cancelled ? `Order #${args.order_id} cancelled.` : (r.error ?? "Cancellation failed.");
        if (r.cancelled) { lat = "order_cancelled"; lad = { orderId: args.order_id }; }
      } else if (fn === "navigate_to") {
        const page = String(args.page ?? "products");
        const label = String(args.label ?? "Go to page");
        const href = (PAGE_HREFS as Record<string, string>)[page] ?? "/products";
        lat = "navigate"; lad = { href, label };
        result = `Navigation ready: ${label} → ${href}`;
      } else if (fn === "get_featured_products") {
        const r = await toolGetFeaturedProducts();
        result = JSON.stringify(r);
        if (r.found && r.products?.length) { lat = "show_products"; lad = { products: r.products }; }
      } else if (fn === "get_category_products") {
        const r = await toolGetCategoryProducts(String(args.category_name ?? ""));
        result = JSON.stringify(r);
        if (r.found && r.products?.length) { lat = "show_products"; lad = { products: r.products }; }
      } else if (fn === "get_payment_instructions") {
        const r = await toolGetPaymentInstructions(String(args.method ?? "general"));
        result = JSON.stringify(r);
        const pm = (args.method as string ?? "").toLowerCase();
        if (pm.includes("mpesa") || pm.includes("m-pesa")) {
          lat = "show_payment_mpesa";
          lad = { method: "mpesa", instructions: r.instructions };
        } else if (pm.includes("binance")) {
          lat = "show_payment_binance";
          lad = { method: "binance", binancePayId: r.binancePayId ?? "", instructions: r.instructions };
        } else if (pm.includes("usdt")) {
          lat = "show_payment_usdt";
          lad = { method: "usdt", usdtAddress: r.usdtAddress ?? "", usdtNetwork: r.usdtNetwork ?? "TRC20", instructions: r.instructions };
        }
      } else if (fn === "check_order_by_phone") {
        const r = await toolCheckOrderByPhone(String(args.phone ?? ""));
        result = JSON.stringify(r.found ? r.orders : r.message);
        if (r.found && (r.orders as unknown[])?.length) { lat = "show_orders"; lad = { orders: r.orders }; }
      } else if (fn === "add_to_cart") {
        const r = await toolAddToCart(Number(args.product_id ?? 0), Number(args.quantity ?? 1), opts.sessionId ?? "guest-session", opts.botToken);
        result = JSON.stringify(r);
        if (r.success) { lat = "cart_item_added"; lad = { productName: r.productName, quantity: r.quantity, price: r.price }; }
      } else if (fn === "show_password_login_form") {
        const email = String(args.email ?? "");
        lat = "show_password_login";
        lad = { email };
        result = `Secure password login form displayed${email ? ` for ${email}` : ""}. Waiting for the user to enter their password.`;
      } else if (fn === "send_login_otp") {
        if (userId !== null) {
          result = JSON.stringify({ success: false, error: "already_authenticated", message: "User is already logged in. Do not send OTP." });
        } else {
          const r = await toolSendLoginOtp(String(args.email ?? ""));
          result = JSON.stringify(r);
          // Auto-show the OTP entry card immediately — don't rely on model to call show_otp_login_form
          if (r.success !== false) {
            lat = "show_otp_login";
            lad = { email: String(args.email ?? "").toLowerCase().trim() };
          }
        }
      } else if (fn === "show_otp_login_form") {
        const email = String(args.email ?? "");
        lat = "show_otp_login";
        lad = { email };
        result = `Secure OTP entry card displayed for ${email}. The customer will enter their code in the secure card — do NOT ask them to type it in the chat.`;
      } else if (fn === "verify_login_otp") {
        const r = await toolVerifyLoginOtp(String(args.email ?? ""), String(args.code ?? ""));
        result = JSON.stringify(r);
        if (r.success && r.token && r.user) {
          lat = "login_success";
          lad = { token: r.token, user: r.user };
        }
      } else if (fn === "signup_user") {
        const r = await toolSignupUser(String(args.email ?? ""), String(args.name ?? ""), String(args.password ?? ""));
        result = JSON.stringify(r);
        if (r.success && r.token && r.user) {
          lat = "login_success";
          lad = { token: r.token, user: r.user, isNewAccount: true };
        }
      } else if (fn === "send_password_reset_otp") {
        const r = await toolSendPasswordResetOtp(String(args.email ?? ""));
        result = JSON.stringify(r);
      } else if (fn === "reset_user_password") {
        const r = await toolResetUserPassword(String(args.email ?? ""), String(args.code ?? ""), String(args.new_password ?? ""));
        result = JSON.stringify(r);
        if (r.success) { lat = "password_reset_done"; lad = {}; }
      } else if (fn === "place_order") {
        // Auto-fill email from authenticated session — never make a logged-in user type their email
        const resolvedEmail = (opts.isAuthenticated && opts.userEmail)
          ? opts.userEmail
          : String(args.customer_email ?? "");
        const r = await toolPlaceOrder({
          paymentMethod: String(args.payment_method ?? "").toLowerCase().replace(/^binance$/, "binance_pay"),
          customerEmail: resolvedEmail,
          customerName: args.customer_name ? String(args.customer_name) : undefined,
          customerPhone: args.customer_phone ? String(args.customer_phone) : undefined,
          deviceIdentifier: args.device_identifier ? String(args.device_identifier) : undefined,
          payCurrency: args.pay_currency ? String(args.pay_currency) : undefined,
          sessionId: opts.sessionId ?? "guest-session",
          botToken: opts.botToken,
        });
        result = JSON.stringify(r);
        if (r.success) {
          const pm = String(args.payment_method ?? "").toLowerCase();
          const rd = r as Record<string, unknown>;
          if (pm === "nowpayments" && rd.nowpayments) {
            const np = rd.nowpayments as { paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string };
            lat = "show_nowpayments";
            lad = { orderId: rd.orderId, payAddress: np.payAddress, payAmount: np.payAmount, payCurrency: np.payCurrency, expiresAt: np.expiresAt, total: rd.total, currency: rd.currency };
          } else if (pm === "mpesa" && rd.mpesa) {
            const mp = rd.mpesa as { checkoutRequestId: string; message: string };
            lat = "show_mpesa_pending";
            lad = { orderId: rd.orderId, checkoutRequestId: mp.checkoutRequestId, message: mp.message, total: rd.total, currency: rd.currency };
          } else if (pm === "wallet") {
            lat = "checkout_done";
            lad = { orderId: rd.orderId, paymentMethod: "wallet", total: rd.total, currency: rd.currency };
          } else if (pm === "binance_pay") {
            const bp = rd.customData as { binanceId?: string; amount?: number; reference?: string } | undefined;
            const binanceId = bp?.binanceId ?? rd.binancePayId ?? "";
            lat = "show_payment_binance";
            lad = { orderId: rd.orderId, paymentMethod: "binance_pay", binancePayId: binanceId, total: rd.total, currency: rd.currency, reference: bp?.reference };
          } else if (pm === "usdt" || pm === "usdt_manual") {
            const ud = rd.usdt as { walletAddress?: string; network?: string; amountUsdt?: number } | undefined;
            const cm = rd.customData as { address?: string; network?: string; reference?: string } | undefined;
            const address = ud?.walletAddress ?? cm?.address ?? "";
            const network = ud?.network ?? cm?.network ?? "TRC20";
            lat = "show_payment_usdt";
            lad = { orderId: rd.orderId, paymentMethod: pm, usdtAddress: address, usdtNetwork: network, total: rd.total, currency: rd.currency };
          } else {
            lat = "checkout_done";
            lad = { orderId: rd.orderId, paymentMethod: args.payment_method, total: rd.total, currency: rd.currency };
          }
        } else if (!r.success && typeof r.error === "string" && r.error.includes("Insufficient wallet balance")) {
          const m = r.error.match(/You have \$([0-9.]+) but need \$([0-9.]+)/);
          const balance = m ? parseFloat(m[1]) : 0;
          const needed = m ? parseFloat(m[2]) : 0;
          lat = "wallet_insufficient_funds";
          lad = { balance, needed, shortfall: parseFloat((needed - balance).toFixed(2)) };
        }
      } else if (fn === "get_wallet_balance") {
        const r = await toolGetWalletBalance(opts.botToken ?? null);
        result = JSON.stringify(r);
        if (r.success && r.balance !== undefined) {
          lat = "show_wallet_balance";
          lad = { balance: r.balance };
        }
      } else if (fn === "logout_user") {
        // Signal the frontend to clear auth state and localStorage token
        lat = "logout_user";
        lad = {};
        result = JSON.stringify({ success: true, message: "Logout signal sent to client." });
      } else if (fn === "add_wallet_funds") {
        const r = await toolAddWalletFunds({
          paymentMethod: String(args.payment_method ?? ""),
          amount: Number(args.amount ?? 0),
          phone: args.phone ? String(args.phone) : undefined,
          payCurrency: args.pay_currency ? String(args.pay_currency) : undefined,
          botToken: opts.botToken,
        });
        result = JSON.stringify(r);
        if (r.success) {
          const pm = String(args.payment_method ?? "").toLowerCase();
          if (pm === "mpesa" && r.checkoutRequestId) {
            lat = "wallet_topup_mpesa";
            lad = { checkoutRequestId: r.checkoutRequestId, amountUsd: Number(args.amount), amountKes: r.amountKes, message: r.message };
          } else if (pm === "nowpayments" && r.paymentId) {
            lat = "wallet_topup_nowpayments";
            lad = { paymentId: r.paymentId, payAddress: r.payAddress, payAmount: r.payAmount, payCurrency: r.payCurrency, expiresAt: r.expiresAt, amountUsd: Number(args.amount) };
          } else if (pm === "usdt" && r.addresses) {
            lat = "wallet_topup_usdt";
            lad = { addresses: r.addresses, note: r.note };
          }
        }
      }

      return { toolCallId: tc.id, fn, result, lat, lad };
    }),
  );

  const messages = results.map((r) => ({ role: "tool", content: r.result, tool_call_id: r.toolCallId, name: r.fn }));
  for (const r of results) {
    if (r.lat) { actionType = r.lat; actionData = r.lad; }
  }
  return { messages, actionType, actionData };
}

// ─── Routes ──────────────────────────────────────────────────────────────────
router.post("/chat/bot", async (req, res) => {
  try {
    const { messages = [], requestHuman = false } = req.body ?? {};

    if (requestHuman) {
      const { visitorId, visitorName, visitorEmail } = req.body ?? {};
      let escalated = false;

      // ── 1. Try OTS SMS notification ─────────────────────────────────────────
      try {
        const { apiToken, senderId, adminPhone } = await getOtsConfig();
        if (!apiToken) {
          req.log.warn("requestHuman: OTS API token not configured — SMS not sent");
        } else if (!adminPhone) {
          req.log.warn("requestHuman: OTS admin phone not configured — SMS not sent");
        } else {
          const smsResult = await sendOtsSms({
            apiToken,
            senderId,
            to: adminPhone,
            message: `GSMBot: Customer requesting human support.${visitorName ? ` Visitor: ${visitorName}` : ""}${visitorEmail ? ` Email: ${visitorEmail}` : ""} — Open admin panel to respond.`,
          });
          escalated = smsResult.ok;
          if (!smsResult.ok) {
            req.log.warn({ reason: smsResult.reason }, "requestHuman: OTS SMS failed");
          } else {
            req.log.info({ to: adminPhone }, "requestHuman: OTS SMS sent OK");
          }
        }
      } catch (smsErr) {
        req.log.warn({ err: smsErr }, "requestHuman: OTS SMS threw — skipping");
      }

      // ── 2. Always send admin email notification as fallback ──────────────────
      try {
        const smtpCfg = await getSmtpConfig();
        const adminEmail = smtpCfg.emailFrom;
        if (adminEmail) {
          const visitorLine = [
            visitorName ? `Name: ${String(visitorName)}` : null,
            visitorEmail ? `Email: ${String(visitorEmail)}` : null,
          ].filter(Boolean).join(", ") || "Anonymous visitor";
          await sendEmail({
            to: adminEmail,
            subject: "🔔 GSM World — Customer requesting human support",
            text: `A customer is requesting live human support on GSM World chat.\n\n${visitorLine}\n\nPlease open your admin panel to respond.`,
            html: `<p>A customer is requesting <strong>live human support</strong> on GSM World chat.</p><p>${visitorLine}</p><p>Please open your admin panel to respond promptly.</p>`,
          });
          escalated = escalated || true;
          req.log.info({ to: adminEmail }, "requestHuman: admin email sent OK");
        }
      } catch (emailErr) {
        req.log.warn({ err: emailErr }, "requestHuman: admin email failed");
      }

      // ── 3. Create / reuse live chat session in DB ────────────────────────────
      let sessionId: number | null = null;
      if (visitorId) {
        try {
          const existing = await db.select({ id: liveChatSessionsTable.id })
            .from(liveChatSessionsTable)
            .where(and(
              eq(liveChatSessionsTable.visitorId, String(visitorId)),
              or(eq(liveChatSessionsTable.status, "waiting"), eq(liveChatSessionsTable.status, "active")),
            ))
            .limit(1);
          if (existing[0]) {
            sessionId = existing[0].id;
          } else {
            const [sess] = await db.insert(liveChatSessionsTable).values({
              visitorId: String(visitorId),
              visitorName: visitorName ? String(visitorName) : null,
              visitorEmail: visitorEmail ? String(visitorEmail) : null,
              status: "waiting",
              lastMessage: "Customer requested human support",
              unreadAdmin: 1,
            }).returning({ id: liveChatSessionsTable.id });
            sessionId = sess?.id ?? null;
          }
        } catch (dbErr) {
          req.log.error({ err: dbErr }, "Failed to create live chat session");
        }
      }

      res.json({
        message: "🔗 Connecting you to a human agent now...\n\nOur support team has been notified and will join this chat shortly. You can type your issue below and we'll respond as soon as possible.",
        escalated,
        sessionId,
      });
      return;
    }

    const [apiKey, waContact] = await Promise.all([getOpenAiKey(), getWhatsappContact()]);
    const waLink = `wa.me/${waContact.replace(/^\+/, "")}`;
    if (!apiKey) {
      const offlineMsg = `I'm currently offline for maintenance. Please WhatsApp us at ${waLink} for support or click "Talk to a human agent" below.`;
      const wantsStreamEarly = (req.headers.accept ?? "").includes("text/event-stream");
      if (wantsStreamEarly) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.write(`data: ${JSON.stringify({ done: true, message: offlineMsg, showHumanButton: true })}\n\n`);
        res.end();
      } else {
        res.json({ message: offlineMsg, showHumanButton: true });
      }
      return;
    }

    const openaiBase = await getOpenAiBaseUrl();

    const safeMessages = Array.isArray(messages)
      ? messages.slice(-14).filter(
          (m: unknown) =>
            m != null &&
            typeof m === "object" &&
            "role" in (m as object) &&
            "content" in (m as object) &&
            ["user", "assistant"].includes((m as { role: string }).role)
        )
      : [];

    // Read authenticated user context from request
    const { userEmail: rawUserEmail, isAuthenticated: rawIsAuth, sessionId: rawSessionId, botToken: rawBotToken } = req.body as { userEmail?: string; isAuthenticated?: boolean; sessionId?: string; botToken?: string };
    const userEmail = typeof rawUserEmail === "string" && rawUserEmail.includes("@") ? rawUserEmail.toLowerCase() : null;
    const isAuthenticated = rawIsAuth === true;
    const reqSessionId = typeof rawSessionId === "string" && rawSessionId.length > 0 ? rawSessionId : null;
    const reqBotToken = typeof rawBotToken === "string" && rawBotToken.length > 0 ? rawBotToken : null;

    const systemPrompt = await getCachedSystemPrompt(waContact);

    // Build contextual injection for authenticated users
    const authContext = isAuthenticated && userEmail
      ? `\n\n[SYSTEM: This user is AUTHENTICATED. Their verified email is: ${userEmail}. RULES:\n1. NEVER ask for their email — you already have it: ${userEmail}\n2. For place_order, always pass customer_email="${userEmail}" automatically — do NOT ask the customer for it\n3. For order lookups, use ${userEmail} automatically — just ask for the order number\n4. For gift card / unlock orders, skip the "What email should we send the code to?" question — use ${userEmail}]`
      : `\n\n[SYSTEM: This user is a GUEST (not logged in). For order lookups, you MUST ask for BOTH their email address AND their order number before calling lookup_order.]`;

    const openaiMessages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt + authContext },
      ...safeMessages,
    ];

    // Server-side OTP-choice interception: if the user's latest message is just "otp" / "Otp" / "1"
    // (i.e. answering the "OTP or password?" question), inject a system instruction so the model
    // always asks for their email next instead of saying "Is there anything else I can help with?".
    if (!isAuthenticated) {
      let latestUserText = "";
      for (let i = openaiMessages.length - 1; i >= 0; i--) {
        if (openaiMessages[i].role === "user") {
          latestUserText = String(openaiMessages[i].content ?? "").trim();
          break;
        }
      }
      if (/^(otp|one.?time.?code|one.?time|code|1)$/i.test(latestUserText)) {
        openaiMessages.push({
          role: "system",
          content: "[FORCE ACTION: User just selected OTP as their login method. You MUST reply with exactly this and nothing else: 'What is your email address? I will send the login code there.' Do NOT say 'Is there anything else'. Do NOT explain OTP. Just ask for their email.]",
        });
      }
    }

    let actionType: string | null = null;
    let actionData: Record<string, unknown> | null = null;

    // ── SSE streaming setup ───────────────────────────────────────────────────
    const wantsStream = (req.headers.accept ?? "").includes("text/event-stream");
    if (wantsStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
    }
    const sseWrite = wantsStream
      ? (t: string) => res.write(`data: ${JSON.stringify({ t })}\n\n`)
      : undefined;
    const sseDone = (extra: Record<string, unknown> = {}) => {
      if (wantsStream) { res.write(`data: ${JSON.stringify({ done: true, ...extra })}\n\n`); res.end(); }
      else { res.json({ ...extra }); }
    };

    // ── Model cascade → Tool-call loop ────────────────────────────────────────
    // Try primary model first, then free fallbacks so the bot is always online.
    const isOpenRouter = openaiBase.toLowerCase().includes("openrouter");
    const modelCascade = isOpenRouter
      ? [
          "meta-llama/llama-3.3-70b-instruct:free",     // primary FREE — fast 70B, great tool-calling
          "mistralai/mistral-7b-instruct:free",          // fast fallback — 7B, very low latency
          "openai/gpt-oss-120b:free",                    // large fallback — 120B, tool-calling
          "openai/gpt-4o-mini",                          // paid fallback (if credits available)
        ]
      : ["gpt-4o-mini"];

    const baseMessages = [...openaiMessages]; // snapshot before any tool results
    let botResponded = false;

    modelLoop:
    for (const modelName of modelCascade) {
      // Each model attempt starts from a clean snapshot (no leftover tool results)
      const msgs = [...baseMessages];

      for (let iter = 0; iter < 4; iter++) {
        const abortCtrl = new AbortController();
        const abortTimer = setTimeout(() => abortCtrl.abort(), 28000);

        let response: Response;
        try {
          response = await fetch(`${openaiBase}/v1/chat/completions`, {
            method: "POST",
            signal: abortCtrl.signal,
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://gsmworld.vercel.app",
              "X-Title": "GSMBot",
            },
            body: JSON.stringify({
              model: modelName,
              messages: msgs,
              tools: TOOLS,
              tool_choice: "auto",
              parallel_tool_calls: true,
              max_tokens: 500,
              temperature: 0.3,
              stream: wantsStream,
            }),
          });
        } finally {
          clearTimeout(abortTimer);
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          req.log.warn({ model: modelName, status: response.status, body: errBody.slice(0, 200) }, "AI model error — trying next in cascade");
          // Rate limit: brief wait then retry same model
          if (response.status === 429 && iter < 2) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          // Any other failure: try next model in cascade
          continue modelLoop;
        }

        if (wantsStream && response.body) {
          // ── Streaming path ────────────────────────────────────────────────
          const { text, toolCalls } = await consumeStream(
            response.body as unknown as ReadableStream<Uint8Array>,
            sseWrite,
          );

          if (!toolCalls.length) {
            const hasHumanBtn = text.includes("[SHOW_HUMAN_BUTTON]");
            sseDone({ action: actionType, actionData, showHumanButton: hasHumanBtn || undefined });
            botResponded = true;
            break modelLoop;
          }

          msgs.push({ role: "assistant", content: text || null, tool_calls: toolCalls });
          const tr = await runToolCalls(toolCalls, { isAuthenticated, userEmail, sessionId: reqSessionId, botToken: reqBotToken });
          msgs.push(...tr.messages);
          if (tr.actionType) actionType = tr.actionType;
          if (tr.actionData) actionData = tr.actionData;

        } else {
          // ── Non-streaming path ────────────────────────────────────────────
          const data = (await response.json()) as {
            choices?: Array<{
              message?: {
                content?: string | null;
                tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
              };
              finish_reason?: string;
            }>;
          };

          const assistantMsg = data.choices?.[0]?.message;
          if (!assistantMsg) break;

          const entry: Record<string, unknown> = { role: "assistant", content: assistantMsg.content ?? null };
          if (assistantMsg.tool_calls?.length) entry.tool_calls = assistantMsg.tool_calls;
          msgs.push(entry);

          if (!assistantMsg.tool_calls?.length) {
            const rawReply = assistantMsg.content?.trim() ?? "";
            const hasHumanBtn2 = rawReply.includes("[SHOW_HUMAN_BUTTON]");
            const reply = rawReply.replace(/\[SHOW_HUMAN_BUTTON\]/g, "").trim() || "Is there anything else I can help you with?";
            res.json({ message: reply, action: actionType, actionData, showHumanButton: hasHumanBtn2 || undefined });
            botResponded = true;
            break modelLoop;
          }

          const tr = await runToolCalls(
            assistantMsg.tool_calls as ToolCallItem[],
            { isAuthenticated, userEmail, sessionId: reqSessionId, botToken: reqBotToken },
          );
          msgs.push(...tr.messages);
          if (tr.actionType) actionType = tr.actionType;
          if (tr.actionData) actionData = tr.actionData;
        }
      }

      if (!botResponded) {
        // Tool-call iterations exhausted for this model — send final response
        sseDone({ message: "Is there anything else I can help you with?", action: actionType, actionData });
        botResponded = true;
      }
      break modelLoop;
    }

    if (!botResponded) {
      // Every model in the cascade failed — graceful scripted response (no error message)
      req.log.warn("All AI models in cascade failed — sending scripted fallback");
      sseDone({
        message: "Hi! 👋 I'm GSMBot. I can help with phone unlock services, order status, gift cards, payment help, and more.\n\nUse the menu to browse our store, or tap **Talk to a Human Agent** to reach our support team right away.",
        showHumanButton: true,
        action: "navigate",
        actionData: { href: "/products", label: "Browse GSM World Store" },
      });
    }
  } catch (err) {
    req.log.error({ err }, "GSMBot error");
    const fallbackMsg = "Hi! 👋 I'm GSMBot. Use the menu to browse our store or products, or tap **Talk to a Human Agent** to reach our support team directly.";
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ done: true, message: fallbackMsg, showHumanButton: true })}\n\n`);
      res.end();
    } else {
      res.json({ message: fallbackMsg, showHumanButton: true });
    }
  }
});

// ─── Live Human Chat ─────────────────────────────────────────────────────────

router.post("/chat/live/session", async (req, res) => {
  try {
    const { visitorId, visitorName } = req.body ?? {};
    if (!visitorId) { res.status(400).json({ error: "visitorId is required" }); return; }

    const existing = await db.select()
      .from(liveChatSessionsTable)
      .where(and(
        eq(liveChatSessionsTable.visitorId, String(visitorId)),
        or(eq(liveChatSessionsTable.status, "waiting"), eq(liveChatSessionsTable.status, "active")),
      ))
      .limit(1);

    if (existing[0]) { res.json(existing[0]); return; }

    const [session] = await db.insert(liveChatSessionsTable).values({
      visitorId: String(visitorId),
      visitorName: visitorName ? String(visitorName) : null,
      status: "waiting",
      lastMessage: null,
      unreadAdmin: 0,
    }).returning();

    res.status(201).json(session);
  } catch (err) {
    req.log.error({ err }, "Failed to create live chat session");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Live chat stats (for admin dashboard)
router.get("/chat/live/stats", async (req, res) => {
  try {
    const adminPwd = req.headers["x-admin-password"] as string | undefined;
    const correctPwd = await getAdminPassword();
    if (adminPwd !== correctPwd) { res.status(401).json({ error: "Unauthorized" }); return; }

    const sessions = await db.select().from(liveChatSessionsTable);
    const waiting = sessions.filter(s => s.status === "waiting").length;
    const active = sessions.filter(s => s.status === "active").length;
    const total = sessions.length;

    res.json({ waiting, active, total });
  } catch (err) {
    req.log.error({ err }, "Failed to get live chat stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat/live", async (req, res) => {
  try {
    const adminPwd = req.headers["x-admin-password"] as string | undefined;
    const correctPwd = await getAdminPassword();
    if (adminPwd !== correctPwd) { res.status(401).json({ error: "Unauthorized" }); return; }

    const statusFilter = req.query.status ? String(req.query.status).split(",") : ["waiting", "active"];
    const sessions = await db.select().from(liveChatSessionsTable).orderBy(desc(liveChatSessionsTable.updatedAt));
    res.json(statusFilter.length ? sessions.filter(s => statusFilter.includes(s.status)) : sessions);
  } catch (err) {
    req.log.error({ err }, "Failed to list live chats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chat/live/:sessionId/messages", async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const visitorId = req.query.visitorId ? String(req.query.visitorId) : null;
    const adminPwd = req.headers["x-admin-password"] as string | undefined;
    const correctPwd = await getAdminPassword();
    const isAdmin = adminPwd === correctPwd;

    if (!isAdmin) {
      if (!visitorId) { res.status(401).json({ error: "Unauthorized" }); return; }
      const [sess] = await db.select({ visitorId: liveChatSessionsTable.visitorId })
        .from(liveChatSessionsTable).where(eq(liveChatSessionsTable.id, sessionId)).limit(1);
      if (!sess || sess.visitorId !== visitorId) { res.status(403).json({ error: "Forbidden" }); return; }
    }

    const sinceParam = req.query.since ? new Date(String(req.query.since)) : null;
    const messages = sinceParam && !isNaN(sinceParam.getTime())
      ? await db.select().from(liveChatMessagesTable)
          .where(and(eq(liveChatMessagesTable.sessionId, sessionId), gt(liveChatMessagesTable.createdAt, sinceParam)))
          .orderBy(liveChatMessagesTable.createdAt)
      : await db.select().from(liveChatMessagesTable)
          .where(eq(liveChatMessagesTable.sessionId, sessionId))
          .orderBy(liveChatMessagesTable.createdAt);

    if (isAdmin) {
      // Mark admin's unread counter as cleared
      await db.update(liveChatSessionsTable).set({ unreadAdmin: 0 })
        .where(eq(liveChatSessionsTable.id, sessionId));
    } else {
      // Visitor is reading — mark all unread admin messages as read
      const now = new Date();
      await db.update(liveChatMessagesTable)
        .set({ readAt: now })
        .where(
          and(
            eq(liveChatMessagesTable.sessionId, sessionId),
            eq(liveChatMessagesTable.senderType, "admin"),
            sql`read_at IS NULL`
          )
        );
    }

    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to get live chat messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chat/live/:sessionId/messages", async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const visitorId = req.query.visitorId ? String(req.query.visitorId) : null;
    const adminPwd = req.headers["x-admin-password"] as string | undefined;
    const correctPwd = await getAdminPassword();
    const isAdmin = adminPwd === correctPwd;

    const [session] = await db.select().from(liveChatSessionsTable)
      .where(eq(liveChatSessionsTable.id, sessionId)).limit(1);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    if (!isAdmin && (!visitorId || session.visitorId !== visitorId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (session.status === "closed") {
      res.status(409).json({ error: "Session is closed" }); return;
    }

    const parsed = z.object({
      message: z.string().max(2000).default(""),
      fileUrl: z.string().url().optional().nullable(),
    }).refine(d => d.message.trim().length > 0 || d.fileUrl, { message: "Message or file required" })
      .safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Message or file required" }); return; }

    const senderType = isAdmin ? "admin" : "user";
    const msgText = parsed.data.message.trim() || (parsed.data.fileUrl ? "[File attachment]" : "");

    const [msg] = await db.insert(liveChatMessagesTable).values({
      sessionId,
      senderType,
      message: msgText,
      fileUrl: parsed.data.fileUrl ?? null,
    }).returning();

    const wasWaiting = session.status === "waiting";

    await db.update(liveChatSessionsTable).set({
      status: isAdmin ? "active" : session.status,
      lastMessage: msgText.slice(0, 100),
      updatedAt: new Date(),
      unreadAdmin: isAdmin ? 0 : (session.unreadAdmin ?? 0) + 1,
    }).where(eq(liveChatSessionsTable.id, sessionId));

    // Send email to visitor when admin joins the chat for the first time
    if (isAdmin && wasWaiting && session.visitorEmail) {
      try {
        const storeUrl = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "gsmworld.vercel.app"}`;
        await sendEmail({
          to: session.visitorEmail,
          subject: "A support agent has joined your chat — GSM World",
          text: `Hi${session.visitorName ? ` ${session.visitorName}` : ""},\n\nA GSM World support agent has joined your live chat and is ready to help you.\n\nOpen the chat widget on our website to continue: ${storeUrl}\n\n— GSM World Support`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#f8fafc;border-radius:16px;">
<div style="background:#1a2332;color:#fff;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
  <p style="margin:0;font-size:13px;color:#94a3b8;">GSM World Support</p>
  <h2 style="margin:8px 0 0;font-size:22px;font-weight:900;">Agent Connected 🟢</h2>
</div>
<p style="color:#334155;font-size:15px;">Hi${session.visitorName ? ` <strong>${session.visitorName}</strong>` : ""},</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">A GSM World support agent has joined your live chat session and is ready to help you right now.</p>
<div style="text-align:center;margin:28px 0;">
  <a href="${storeUrl}" style="background:#1e3a5f;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Open Chat Now →</a>
</div>
<p style="color:#94a3b8;font-size:12px;text-align:center;">GSM World · Trusted since 2016</p>
</div>`,
        });
      } catch (emailErr) {
        req.log.warn({ err: emailErr }, "Failed to send admin-join email to visitor");
      }
    }

    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "Failed to post live chat message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/chat/live/:sessionId", async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const visitorId = req.query.visitorId ? String(req.query.visitorId) : null;
    const adminPwd = req.headers["x-admin-password"] as string | undefined;
    const correctPwd = await getAdminPassword();
    const isAdmin = adminPwd === correctPwd;

    const [session] = await db.select().from(liveChatSessionsTable)
      .where(eq(liveChatSessionsTable.id, sessionId)).limit(1);
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }

    if (!isAdmin && (!visitorId || session.visitorId !== visitorId)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const { status } = req.body as { status?: string };
    if (status !== "closed" && status !== "active") {
      res.status(400).json({ error: "Status must be 'closed' or 'active'" }); return;
    }

    const [updated] = await db.update(liveChatSessionsTable).set({
      status,
      closedBy: status === "closed" ? (isAdmin ? "admin" : "user") : null,
      updatedAt: new Date(),
    }).where(eq(liveChatSessionsTable.id, sessionId)).returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update live chat session");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── OTP email verification (for guests checking orders) ─────────────────────
// Uses DB-backed _setOtp/_getOtp so codes survive server restarts / serverless cold starts

router.post("/chat/bot/otp/send", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email address required" });
      return;
    }
    const lEmail = email.toLowerCase().trim();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await _setOtp(`bot:${lEmail}`, code, 10 * 60 * 1000);

    await sendEmail({
      to: lEmail,
      subject: "Your GSM World verification code",
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\n— GSM World Support`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 20px;background:#f8fafc;border-radius:16px;">
<div style="background:#1a2332;color:#fff;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
  <span style="display:inline-block;width:36px;height:36px;background:#0ea5e9;border-radius:8px;line-height:36px;text-align:center;font-size:18px;font-weight:900;color:#fff;">G</span>
  <h2 style="margin:12px 0 0;font-size:20px;font-weight:900;color:#fff;">Verification Code</h2>
</div>
<p style="color:#334155;font-size:15px;margin:0 0 8px;">Your one-time verification code is:</p>
<div style="background:#fff;border:2px solid #0ea5e9;border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
  <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#1a2332;">${code}</span>
</div>
<p style="color:#64748b;font-size:13px;margin:0;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
<p style="color:#94a3b8;font-size:12px;margin:24px 0 0;text-align:center;">GSM World · Trusted since 2016</p>
</div>`,
    });

    res.json({ ok: true, message: `Verification code sent to ${lEmail.slice(0, 3)}***@${lEmail.split("@")[1]}` });
  } catch (err) {
    req.log.error({ err }, "OTP send error");
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

router.post("/chat/bot/otp/verify", async (req, res) => {
  try {
    const { email, code } = req.body as { email?: string; code?: string };
    if (!email || !code) { res.status(400).json({ ok: false, error: "Email and code required" }); return; }
    const lEmail = email.toLowerCase().trim();
    const stored = await _getOtp(`bot:${lEmail}`);
    if (!stored || stored.code !== code.trim() || Date.now() > stored.expiresAt) {
      res.status(400).json({ ok: false, error: "Invalid or expired verification code" });
      return;
    }
    await _deleteOtp(`bot:${lEmail}`);
    res.json({ ok: true, verified: true, email: lEmail });
  } catch (err) {
    req.log.error({ err }, "OTP verify error");
    res.status(500).json({ ok: false, error: "Verification failed" });
  }
});

router.post("/chat/sms/test", async (req, res) => {
  try {
    let { apiToken, senderId, adminPhone } = req.body ?? {};
    if (!apiToken || apiToken === "__saved__") {
      const saved = await getOtsConfig();
      apiToken = saved.apiToken;
      senderId = senderId || saved.senderId;
      adminPhone = adminPhone || saved.adminPhone;
    }
    if (!apiToken || !adminPhone) {
      res.status(400).json({ error: "OTS API token and admin phone are required. Save them in settings first." });
      return;
    }
    const ok = await sendOtsSms({
      apiToken: String(apiToken),
      senderId: senderId ? String(senderId) : null,
      to: String(adminPhone),
      message: "GSM World: OTS SMS is working correctly. This is a test message from GSMBot.",
    });
    if (ok) res.json({ ok: true, message: "Test SMS sent successfully!" });
    else res.status(502).json({ ok: false, error: "OTS API request failed. Check your token and phone number." });
  } catch (err) {
    req.log.error({ err }, "OTS SMS test error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
