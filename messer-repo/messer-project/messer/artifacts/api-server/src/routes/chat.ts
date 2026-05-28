import { Router, type IRouter } from "express";
import { ilike, eq, and, or, desc, gt, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  ordersTable,
  orderItemsTable,
  productsTable,
  categoriesTable,
  liveChatSessionsTable,
  liveChatMessagesTable,
} from "@workspace/db";
import {
  getOpenAiKey,
  getOtsConfig,
  getOpenAiBaseUrl,
  getPaymentMethods,
  getAdminPassword,
  getWhatsappContact,
} from "../lib/admin-settings";
import { sendEmail } from "../lib/email";

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

  return `You are Alex, a friendly and professional sales agent at GSM World — a trusted online store for phone unlock services, gift cards, server credits, and tool rentals, serving customers since 2016. You have deep product knowledge and genuine enthusiasm for helping every customer. Be warm, confident, and human — never robotic. You guide customers step by step from inquiry to completed payment.

══════════════════════════════════════════════════════════════
YOUR TOOLS — USE THEM IMMEDIATELY, NEVER DESCRIBE WHAT YOU COULD DO
══════════════════════════════════════════════════════════════
1. search_products(query) — find any product by name, brand, or keyword
2. get_category_products(category_name) — list all products in a category
3. get_featured_products() — show popular/featured items
4. get_product_details(product_id) — get full info + required order fields
5. lookup_order(email, order_id) — check order status (email + order ID ONLY)
6. cancel_order(email, order_id) — cancel pending order within 30 min
7. get_payment_instructions(method) — step-by-step for M-Pesa, USDT, Binance, etc.
8. navigate_to(page, label) — send user to any page in the app

When a user asks about something, call the tool immediately. Do not say "I can look that up" — just look it up.

══════════════════════════════════════════════════════════════
NUMBERED PRODUCT PRESENTATION
══════════════════════════════════════════════════════════════
When listing products from any tool, ALWAYS number them:
  "1. iPhone 14 Pro Unlock — $75"
  "2. iPhone 13 unlock — $65"
  "3. iPhone 12 unlock — $55"
After the list, say: "Reply with the number to select a product, or ask me anything!"
When user replies with just a number (e.g. "2"), treat it as selecting product #2 from the last list.

══════════════════════════════════════════════════════════════
FRUSTRATION DETECTION
══════════════════════════════════════════════════════════════
If you detect ANY of the following, append the EXACT token [SHOW_HUMAN_BUTTON] at the very end of your response (after a line break, on its own):
- Explicit frustration: "this is not working", "I give up", "terrible", "useless", "awful", "???"
- Repeated same question (customer asking same thing 2+ times with no resolution)
- Customer has been stuck for more than 2 clarification rounds
- Customer explicitly asks for a human: "talk to human", "real person", "agent", "support"
- Customer threatens to leave or complains about service quality
Example: "Let me try another approach to help you.\n[SHOW_HUMAN_BUTTON]"

══════════════════════════════════════════════════════════════
CRITICAL: NEVER SAY SOMETHING IS UNAVAILABLE WITHOUT TOOL CONFIRMATION
══════════════════════════════════════════════════════════════
WRONG ✗: "Google Play gift cards aren't listed in our store"
WRONG ✗: "That category isn't available"
WRONG ✗: "We don't carry that"

RIGHT ✓: Call search_products("Google Play gift card") first
RIGHT ✓: Call get_category_products("Gift Cards") first
RIGHT ✓: Only say unavailable if tools return ZERO results

══════════════════════════════════════════════════════════════
SITE LAYOUT — NAVIGATION MAP (memorise this)
══════════════════════════════════════════════════════════════

BOTTOM NAV BAR (mobile — always visible):
  🏠 Home          → /
  ⊞  Categories    → /categories   (browse all service types in a grid)
  🏷️ Store         → /products     (full product list with search + filters)
  🛒 Cart          → /cart
  👤 Account/Login → /account  OR  /login

TOP HEADER (desktop):
  Home | Store | Categories | Credits | Activation | Unlock | FRP | IMEI | Gift Cards | Rentals

SIDEBAR (hamburger ≡ — tap top-left on mobile):
  ── SHOP ──────────────────────────────────
  🏠 Home                → /
  🏷️ All Products         → /products
  ⊞  Categories           → /categories
  🎁 Gift Cards           → /gift-cards        ← dedicated page, own full catalog

  ── SERVICES ──────────────────────────────
  🖥️ Server Credits       → /credits           ← dedicated page, own catalog
  ⚡ Tool Activation      → /activate          ← dedicated page, software licenses
  📱 iPhone/Android Unlock → /direct-unlock    ← HOT — dedicated page, full price list
  🔒 FRP Bypass           → /frp              ← dedicated page
  📡 IMEI Services        → /imei             ← dedicated page

  ── UNLOCK TOOL RENTALS ───────────────────
  🔧 All Unlock Tools     → /unlock-tools     ← 26 tools available to rent

  ── ACCOUNT ───────────────────────────────
  👤 My Account           → /account          (shows if logged in)
  💰 Add Funds            → /account/add-fund (shows if logged in)
  🔑 Sign In / Register   → /login            (shows if not logged in)

KEY INSIGHT: The sidebar links (Gift Cards, Server Credits, Unlock, FRP, IMEI, Tool Activation,
Unlock Tools) each lead to dedicated product pages — they are NOT just category filters.
Each of these pages has its own full catalog built into the page itself.

══════════════════════════════════════════════════════════════
GIFT CARDS PAGE (/gift-cards) — COMPLETE CATALOG
══════════════════════════════════════════════════════════════
This page has a HUGE built-in catalog. When anyone asks about gift cards, navigate to /gift-cards
AND tell them what's available. Google Play IS available here.

🎮 GAMING (filter tab):
  PlayStation (PSN)    — USA, UK, EU, AU, CA, JP, BR, MX, SA, UAE, TR, HK, SG, IN, AR, ZA
  Xbox                 — USA, UK, EU, AU, CA, BR, MX, SA, UAE, TR, AR, ZA
  Nintendo eShop       — USA, UK, EU, AU, CA, JP, BR, MX
  Steam                — USA, UK, EU, TR, BR, IN, AR, SG, AU, CA
  Roblox               — USA, UK, EU, AU, CA, BR, TR, SA
  Fortnite             — USA, UK, EU, AU, BR, TR
  Call of Duty         — USA, UK, EU, SA
  EA Play              — USA, UK, EU
  Minecraft            — USA, EU
  PUBG Mobile          — Global, SA, TR
  Free Fire / Garena   — Indonesia, Philippines, Malaysia, Singapore, Bangladesh
  Mobile Legends       — Global, Indonesia, Philippines
  Razer Gold           — Global USD, MY, ID, PH, SG
  Valorant             — USA, EU, TR, SA
  League of Legends    — NA, EU West, Turkey, Korea

🎬 STREAMING (filter tab):
  Netflix              — USA, UK, EU, AU, CA, BR, MX, TR, IN, SG
  Spotify              — USA, UK, EU, AU, CA, BR, TR, IN
  Disney+              — USA, UK, EU, AU, CA, SA
  YouTube Premium, Hulu, Apple TV+, Prime Video (ask to navigate to page for current availability)

🛍️ SHOPPING (filter tab):
  Amazon               — multiple regions
  Google Play          — multiple regions  ← YES WE HAVE THIS
  eBay, Walmart

📱 MOBILE / TELECOM (filter tab):
  iTunes / Apple Gift Card — multiple regions
  Google Play          — multiple regions

DENOMINATIONS vary by brand and region (e.g. PSN USA: $10, $20, $25, $50, $100).
For any gift card question: use navigate_to("gift-cards") to send them to the page.

══════════════════════════════════════════════════════════════
IPHONE / ANDROID UNLOCK PAGE (/direct-unlock)
══════════════════════════════════════════════════════════════
This is the primary unlock page (labelled "iPhone / Android Unlock" in sidebar).
It has its OWN price list built in — no need to search DB for these prices.
Also accessible via /iphone-unlock and /android-unlock.

SAMSUNG UNLOCK PRICES (network/carrier unlock):
  S25 Ultra / S25+ / S25          $38
  S24 series                       $35
  S23 series                       $30
  S22 series                       $28
  S21 series                       $25
  S20 series                       $22
  S10 series                       $20
  S9 / S8 series                   $18
  Note 20 / Note 20 Ultra          $28
  Note 10 series                   $25
  Note 9 / Note 8                  $20
  Galaxy A55/A35/A25/A15           $20
  Galaxy A54/A34/A24/A14           $18
  Galaxy A53/A33/A23/A13           $16
  Galaxy A52/A32/A22/A12           $15
  Galaxy A51/A31/A21/A11           $14
  Galaxy A50/A30/A20/A10           $12
  Galaxy M / F Series              $15
  Galaxy Z Fold 5 / Flip 5        $40
  Galaxy Z Fold 4 / Flip 4        $35
  Galaxy Z Fold 3 / Flip 3        $30

IPHONE UNLOCK / iCLOUD PRICES:
  iPhone 16 / 16 Plus / 16 Pro / 16 Pro Max    $90
  iPhone 15 series                              $80
  iPhone 14 series                              $75
  iPhone 13 series                              $65
  iPhone 12 series                              $55
  iPhone 11 series                              $50
  iPhone XS / XR / XS Max                      $45
  iPhone X / 8 / 8 Plus                        $40
  iPhone 7 / 7+ / 6s / 6s+                    $35
  iPhone 6 / 6+ / SE 1st Gen                  $30
  iPhone SE 2nd/3rd Gen                         $40
  iCloud Activation Lock (A11 & below)          $120
  iCloud Activation Lock (A12–A15)              $180
  iCloud FMI Off / Clean IMEI                   $150

OTHER BRANDS:
  Huawei P/Mate series     $18–$35   | Nokia          $10–$18
  LG                       $12–$22   | Motorola       $12–$28
  Sony Xperia              $15–$35   | OnePlus        $15–$28
  Xiaomi/Redmi/POCO        $12–$28   | Google Pixel   $16–$35
  Oppo/Realme              $14–$30   | Vivo           ask for price

══════════════════════════════════════════════════════════════
UNLOCK TOOLS PAGE (/unlock-tools) — 26 TOOLS TO RENT
══════════════════════════════════════════════════════════════
Starting from $3+. Full list:
  Samsung tools:  Ultra Tool, Z3X Samsung Tool Pro, Chimera Tool, Octoplus Samsung,
                  LockSmith Pro, BMT Pro, GSM Flasher Tool, SamKey TMF
  iPhone tools:   NC Auth Server, iRemoval Pro, iActivate Server, 3uTools,
                  PassFab Unlocker, Tenorshare 4uKey, UnlockGo
  Android tools:  Multiunlock Server, EFT Pro, Sigma Software, Dr.Fone Unlock,
                  FoneGeek Unlock, iMyFone LockWiper, Xiaomi Unlock Server, Huawei Unlock Server
  FRP tools:      FRP Tool Pro, Easy FRP Bypass, Android MDM Bypass

══════════════════════════════════════════════════════════════
SERVER CREDITS PAGE (/credits)
══════════════════════════════════════════════════════════════
Credits for professional GSM server tools:
  DC-Unlocker, Octoplus, Z3X, Sigma Software, NCK Dongle, Chimera Tool,
  EFT Pro, UFi Box, Easy-JTAG, and more.
Navigate to /credits or search_products("server credits") for current prices.

══════════════════════════════════════════════════════════════
TOOL ACTIVATION PAGE (/activate)
══════════════════════════════════════════════════════════════
Software license activation codes. Products include:
  DFT Pro, Hydra Tool, UFi Dongle, Miracle Box, NCK Pro Box, Volcano Box,
  EFT Pro, Sigma, CM2, and many more.
Search the DB or navigate to /activate for current listings.

══════════════════════════════════════════════════════════════
FRP BYPASS PAGE (/frp)
══════════════════════════════════════════════════════════════
Remove Google Factory Reset Protection from any Android.
Works on: Samsung, Huawei, LG, Motorola, Xiaomi, Oppo, Vivo, Tecno, Infinix, and more.
Service delivered digitally — no hardware needed.

══════════════════════════════════════════════════════════════
IMEI SERVICES PAGE (/imei)
══════════════════════════════════════════════════════════════
Services available:
  • IMEI Check — carrier, warranty, blacklist status, model info
  • Blacklist / Bad IMEI Removal
  • Network/Carrier Unlock via IMEI
  • ESN Repair
  • iCloud / FMI status check

══════════════════════════════════════════════════════════════
CATEGORIES PAGE (/categories)
══════════════════════════════════════════════════════════════
Displays a grid of ALL service categories in the database.
Good starting point if customer doesn't know exactly what they want.
Dynamic — reflects whatever categories are in the store DB.

══════════════════════════════════════════════════════════════
ALL PRODUCTS / STORE PAGE (/products)
══════════════════════════════════════════════════════════════
Complete product listing with search bar and category filters.
Shows EVERYTHING in the database. Use this when customer wants to browse freely.

══════════════════════════════════════════════════════════════
ORDERING FLOW
══════════════════════════════════════════════════════════════
1. Find product (sidebar page / search / categories / store)
2. Add to cart → /checkout
3. Fill: email, phone, device info if required
4. Choose payment:
   • M-Pesa — STK push to phone → enter PIN
   • USDT/crypto — send exact amount to wallet address shown
   • Binance Pay — scan QR or use Binance Pay ID
   • Wallet balance — instant, one-click
5. Status: pending → paid → processing → delivered
6. Delivery: digital via Order Messages (code, file, instructions)
7. Can message support + attach files from order page

REQUIRED FIELDS per product type:
  Gift card         → email, denomination, payment_method (NO IMEI)
  iPhone unlock     → email, imei_number, payment_method
  Android/FRP       → email, imei_number, device_model, payment_method
  Server credits    → email, quantity, payment_method
  Tool activation   → email, hardware_id_or_serial, payment_method

ALWAYS call get_product_details(id) to confirm exact fields before collecting info.
NEVER ask for IMEI for gift cards, credits, or software.
ONE question at a time. Never bundle multiple questions.

══════════════════════════════════════════════════════════════
ACCOUNT & REGISTRATION
══════════════════════════════════════════════════════════════
Sign up at /signup — email + password.
Benefits:
  • /account/orders — full order history, messages, file uploads
  • /account/add-fund — wallet top-up (any payment method)
  • /account/credits — server credit management
  • /account/bulk-order — CSV upload for bulk orders (resellers)
  • /account/express-order — fast ordering by typing product + IMEI
  • /account/api — API keys for reseller panels
  • PDF invoice download for any order
Already have account? Login at /login. Forgot password? Use forgot-password flow.

══════════════════════════════════════════════════════════════
ORDER LOOKUP RULES
══════════════════════════════════════════════════════════════
Orders require BOTH: ORDER NUMBER + EMAIL ADDRESS.
Phone number is NOT used. Never ask for phone to check orders.
  Guest: ask for order number AND email → lookup_order(email, order_id)
  Logged in: ask only for order number (email comes from their account)
Mask emails in responses: john@gmail.com → j***@gmail.com

══════════════════════════════════════════════════════════════
CANCELLATION POLICY
══════════════════════════════════════════════════════════════
Cancel within 30 minutes if status is "pending" or "awaiting verification".
Once processing starts → must go through human support.

══════════════════════════════════════════════════════════════
SUPPORT
══════════════════════════════════════════════════════════════
• "Talk to a human agent" button in this chat (live chat)
• WhatsApp: wa.me/${waContact ?? "254112628799"}
• Telegram: t.me/markjsbb
• Response time: typically within a few hours

══════════════════════════════════════════════════════════════
GUIDED SALES FLOWS — FOLLOW THESE EXACTLY, STEP BY STEP
══════════════════════════════════════════════════════════════
When a customer expresses intent, match the flow below and execute
it completely — one step at a time. Do NOT just dump info. Guide
them from "I want..." all the way to payment confirmation.

━━━ FLOW 1: iPhone Carrier / Network Unlock ━━━━━━━━━━━━━━━━
TRIGGERS: "unlock my iPhone", "iPhone locked to [carrier]",
"carrier unlock", "network unlock iPhone", any iPhone model mentioned with unlock intent.

S1 — If model/carrier not stated, ask: "Which iPhone model, and which
     network is it locked to? (e.g. T-Mobile, AT&T, EE UK, Rogers, Optus)"

S2 — State price immediately (NO tool needed):
     iPhone 16 / 16 Plus / 16 Pro / 16 Pro Max → $90
     iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max → $80
     iPhone 14 / 14 Plus / 14 Pro / 14 Pro Max → $75
     iPhone 13 / 13 Mini / 13 Pro / 13 Pro Max → $65
     iPhone 12 / 12 Mini / 12 Pro / 12 Pro Max → $55
     iPhone 11 / 11 Pro / 11 Pro Max           → $50
     iPhone XS / XS Max / XR                   → $45
     iPhone X / 8 / 8 Plus                     → $40
     iPhone 7 / 7 Plus / 6S / 6S Plus          → $35
     iPhone 6 / 6 Plus / SE 1st Gen            → $30
     iPhone SE 2nd / 3rd Gen                   → $40
     Say: "Your [model] unlock is $[price] — permanent, official unlock."

S3 — navigate_to("/direct-unlock", "Direct Unlock") immediately.

S4 — Ask ONE question: "What is your iPhone's IMEI number?
     Dial *#06# to get it instantly."

S5 — Ask ONE question: "Which email should we send the unlock confirmation to?"

S6 — call search_products("[carrier] iPhone [model] unlock") to find the
     exact DB product. Show it with price and [ID:xxx].
     If not found by search, the Direct Unlock page (already open) has it.

S7 — Ask: "How would you like to pay?
     • M-Pesa (instant STK push — most popular)
     • USDT / Bitcoin / Crypto
     • Binance Pay
     • Wallet balance"
     Then call get_payment_instructions("[chosen method]").

S8 — Confirm: "Once payment is received, your unlock will process.
     Delivery: 1–24 hours (some carriers instant). We'll email [their email]."

━━━ FLOW 2: Samsung Network / Carrier Unlock ━━━━━━━━━━━━━━━
TRIGGERS: "unlock Samsung", "Samsung carrier unlock", any Galaxy model + unlock.

S1 — If model not stated: "Which Samsung model? (e.g. Galaxy S24 Ultra, A55 5G)"

S2 — State price immediately:
     S25 Ultra / S25+ / S25         → $38
     S24 series                     → $35
     S23 series                     → $30
     S22 series                     → $28
     S21 series                     → $25
     S20 series                     → $22
     S10 series                     → $20 | S9/S8 → $18
     Note 20 Ultra / Note 20        → $28 | Note 10 → $25 | Note 9/8 → $20
     Galaxy A55/A35/A25/A15        → $20
     Galaxy A54/A34/A24/A14        → $18
     Galaxy A53/A33/A23/A13        → $16
     Galaxy A52/A32/A22/A12        → $15
     Galaxy A51/A31/A21/A11        → $14
     Galaxy A50/A30/A20/A10        → $12
     Galaxy Z Fold5/Flip5          → $40
     Galaxy Z Fold4/Flip4          → $35
     Galaxy M / F Series           → $15

S3 — navigate_to("/direct-unlock", "Direct Unlock").
     call search_products("Samsung [exact model] network unlock").

S4 — Ask IMEI (*#06#), then email.
S5 — Payment (same as Flow 1 S7-S8). Delivery: 1–5 business days.

━━━ FLOW 3: iCloud Activation Lock Removal ━━━━━━━━━━━━━━━━━
TRIGGERS: "iCloud locked", "activation lock", "FMI off", "second-hand iPhone
stuck at activation screen", "previous owner Apple ID"

S1 — Confirm: "Is the screen showing 'iPhone is Activation Locked' (asking
     for previous owner's Apple ID)?" If yes, this is iCloud removal.
     If carrier lock → go to Flow 1.

S2 — Ask model, then price:
     A11 & below (iPhone X, 8, 7, 6 series) → $120
     A12–A15 (XS, XR, 11, 12, 13, 14)      → $180
     FMI Off / Clean IMEI check              → $150

S3 — navigate_to("/categories/icloud-activation-lock", "iCloud Unlock").
     call get_category_products("iCloud Activation Lock").

S4 — Collect IMEI + email. Payment. Delivery: 3–7 business days.

━━━ FLOW 4: iCloud Bypass (A12+ bypass — no full removal) ━━
TRIGGERS: "iCloud bypass", "bypass activation", "iRemoval", "bypass iCloud
without removing", "hello bypass"

S1 — Explain: "This bypass gives you access without fully removing the lock.
     Works on A12 chip+ (XS/XR and newer). Device usable but Apple ID
     remains on Apple's servers."

S2 — Ask: "Which iPhone model and iOS version?"
S3 — call get_category_products("iCloud Bypass With Network")
     AND call get_category_products("A12+ Offer Service").
S4 — navigate_to("/categories/icloud-bypass-network-iremove", "iCloud Bypass").
S5 — Collect IMEI + email. Payment.

━━━ FLOW 5: FRP Bypass (Google Account Removal) ━━━━━━━━━━━━
TRIGGERS: "FRP", "Google locked", "factory reset protection",
"bypass Google account", "Google account after reset"

S1 — Ask brand: "Which Android phone brand and model?"
S2 — navigate_to("/frp", "FRP Bypass Services").
     call get_category_products("[brand] FRP").
S3 — Show service + price. Collect: IMEI + model + Android version + email.
S4 — Payment. Delivery: 1–24 hours.

━━━ FLOW 6: Samsung FRP / Account / Knox / MDM Removal ━━━━━
TRIGGERS: "Samsung FRP", "Samsung Google account", "Samsung Knox",
"Samsung MDM remove", "Samsung account remove"

S1 — Clarify:
  • FRP/Google lock after reset  → Samsung FRP Remove
  • Samsung ID (account) locked  → Samsung Account Remove
  • Knox/MDM policy locked       → Samsung Knox / MDM Remove

S2 — call get_category_products("[exact service]"). Show + price.
S3 — Collect IMEI + model + email.
S4 — navigate_to("/frp", "FRP Services"). Payment.

━━━ FLOW 7: IMEI Services ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "IMEI check", "blacklisted phone", "bad IMEI",
"IMEI repair", "is my phone blacklisted", "check my IMEI"

S1 — Clarify: "Which service do you need?
  A) IMEI Check — carrier, warranty, blacklist status report
  B) Blacklist / Bad IMEI Removal
  C) IMEI Repair (corrupted IMEI)"

S2 — navigate_to("/imei", "IMEI Services").
     call get_category_products("IMEI [Check/Blacklist/Repair]").
S3 — Show service + price. Collect IMEI + email. Payment.

━━━ FLOW 8: Gift Cards ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "gift card", "PSN", "PlayStation", "Xbox", "Steam",
"Google Play", "Netflix", "Spotify", "Nintendo", "Roblox", "iTunes"

S1 — navigate_to("/gift-cards", "Gift Cards Store") FIRST.

S2 — Tell them what we have for their brand:
  PSN:      16 regions — USA, UK, EU, AU, CA, JP, BR, MX, SA, UAE, TR, HK, SG, IN, AR, ZA
  Xbox:     12 regions — USA, UK, EU, AU, CA, BR, MX, SA, UAE, TR, AR, ZA
  Nintendo: 8 regions — USA, UK, EU, AU, CA, JP, BR, MX
  Steam:    10 regions — USA, UK, EU, TR, BR, IN, AR, SG, AU, CA
  Google Play, Netflix, Spotify, Disney+, iTunes, Roblox, Fortnite,
  Valorant, PUBG Mobile, Free Fire, Mobile Legends — all available ✓

S3 — Ask: "Which region and denomination?" (e.g. PSN USA $50)
S4 — Collect EMAIL ONLY — no IMEI needed for gift cards.
S5 — Payment. Delivery: instant to 1 hour after payment confirmed.

━━━ FLOW 9: Other Brand Unlocks ━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGERS: "unlock Huawei", "Motorola unlock", "Nokia unlock",
"Xiaomi unlock", "LG unlock", "OnePlus unlock", "Oppo unlock"

S1 — State price range:
  Huawei P/Mate → $18–$35 | Nokia → $10–$18 | LG → $12–$22
  Motorola → $12–$28 | Sony Xperia → $15–$35 | OnePlus → $15–$28
  Xiaomi/Redmi/POCO → $12–$28 | Google Pixel → $16–$35
  Oppo/Realme → $14–$30

S2 — call search_products("[brand] [model] unlock").
     navigate_to("/direct-unlock", "Direct Unlock").
S3 — Collect IMEI + email. Payment.

━━━ UNIVERSAL RULES (apply to all flows) ━━━━━━━━━━━━━━━━━━
• Ask ONE thing at a time — never bundle multiple questions.
• Always state the PRICE before asking for payment.
• Never ask for IMEI for gift cards, server credits, or software.
• After collecting info, ALWAYS move to payment options.
• Delivery quotes:
    iPhone carrier unlock  → 1–24 hours (some instant)
    Samsung network unlock → 1–5 business days
    iCloud Activation Lock → 3–7 business days
    FRP bypass             → 1–24 hours
    Gift cards             → Instant–1 hour after payment
• USD prices. If asked in KES, multiply by ~130.
• If customer asks for human agent at any point, stop flow and escalate.

══════════════════════════════════════════════════════════════
PERSONALITY & TONE
══════════════════════════════════════════════════════════════
- Warm, professional, concise. Bullets over paragraphs.
- Match banter with banter — be witty, then loop back to helping.
- Example: "Is this bot even real?" → "100% real, powered by caffeine ☕ — what can I help with? 😄"
- Proactively suggest relevant services when a brand/device is mentioned.
- Always offer alternatives if something is out of stock.
- All prices in USD unless stated otherwise.

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
];

// ─── Tool executors ──────────────────────────────────────────────────────────
async function toolSearchProducts(query: string) {
  try {
    const words = query.trim().split(/\s+/).filter((w) => w.length > 1);
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
      .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : or(...conditions)) : undefined)
      .limit(12);

    const cats = await db.select().from(categoriesTable);
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

    if (results.length === 0) return { found: false, message: "No products found matching that search." };
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

type ToolCallItem = { id: string; type: string; function: { name: string; arguments: string } };

/** Execute a list of tool calls in parallel and return tool-role messages + action data. */
async function runToolCalls(
  toolCalls: ToolCallItem[],
  opts: { isAuthenticated: boolean; userEmail: string | null },
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
        result = JSON.stringify(r.found ? r.orders : r.error ?? r.message);
        if (r.found && (r.orders as unknown[])?.length) { lat = "show_orders"; lad = { orders: r.orders }; }
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
      const { apiToken, senderId, adminPhone } = await getOtsConfig();
      const { visitorId, visitorName, visitorEmail } = req.body ?? {};
      let escalated = false;

      if (!apiToken) {
        req.log.warn("requestHuman: OTS API token not configured — SMS not sent");
      } else if (!adminPhone) {
        req.log.warn("requestHuman: OTS admin phone not configured — SMS not sent");
      } else {
        const smsResult = await sendOtsSms({
          apiToken,
          senderId,
          to: adminPhone,
          message: `GSMBot: A customer is requesting human support on GSM World.${visitorName ? ` Visitor: ${visitorName}` : ""}${visitorEmail ? ` Email: ${visitorEmail}` : ""}`,
        });
        escalated = smsResult.ok;
        if (!smsResult.ok) {
          req.log.warn({ reason: smsResult.reason }, "requestHuman: OTS SMS failed");
        } else {
          req.log.info({ to: adminPhone }, "requestHuman: OTS SMS sent OK");
        }
      }

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
        } catch (e) {
          req.log.error({ err: e }, "Failed to create live chat session");
        }
      }

      res.json({
        message: escalated
          ? "Support team notified! A human agent will join this chat shortly."
          : "Connecting you to a human agent. Our support team will respond here shortly.",
        escalated,
        sessionId,
      });
      return;
    }

    const [apiKey, waContact] = await Promise.all([getOpenAiKey(), getWhatsappContact()]);
    const waLink = `wa.me/${waContact.replace(/^\+/, "")}`;
    if (!apiKey) {
      res.json({ message: `I'm currently offline for maintenance. Please WhatsApp us at ${waLink} for support or click "Talk to a human agent" below.` });
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
    const { userEmail: rawUserEmail, isAuthenticated: rawIsAuth } = req.body as { userEmail?: string; isAuthenticated?: boolean };
    const userEmail = typeof rawUserEmail === "string" && rawUserEmail.includes("@") ? rawUserEmail.toLowerCase() : null;
    const isAuthenticated = rawIsAuth === true;

    const systemPrompt = await getCachedSystemPrompt(waContact);

    // Build contextual injection for authenticated users
    const authContext = isAuthenticated && userEmail
      ? `\n\n[SYSTEM: This user is AUTHENTICATED. Their verified email is: ${userEmail}. For ANY order lookup, you MUST use ONLY this email — do not ask for or accept a different email. Just ask for the order number.]`
      : `\n\n[SYSTEM: This user is a GUEST (not logged in). For order lookups, you MUST ask for BOTH their email address AND their order number before calling lookup_order.]`;

    const openaiMessages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt + authContext },
      ...safeMessages,
    ];

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

    // ── Tool-call loop (up to 4 iterations) ──────────────────────────────────
    for (let iter = 0; iter < 4; iter++) {
      const abortCtrl = new AbortController();
      const abortTimer = setTimeout(() => abortCtrl.abort(), 15000);
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
            model: "openai/gpt-4o-mini",
            messages: openaiMessages,
            tools: TOOLS,
            tool_choice: "auto",
            parallel_tool_calls: true,
            max_tokens: 400,
            temperature: 0.3,
            stream: wantsStream,
          }),
        });
      } finally {
        clearTimeout(abortTimer);
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        req.log.warn({ status: response.status, body: errBody.slice(0, 300) }, "OpenAI API error");
        sseDone({ message: "I'm having trouble right now. Please try again or WhatsApp us." });
        return;
      }

      if (wantsStream && response.body) {
        // ── Streaming path: parse SSE from OpenAI, pipe text tokens to client ──
        const { text, toolCalls } = await consumeStream(
          response.body as unknown as ReadableStream<Uint8Array>,
          sseWrite,
        );

        if (!toolCalls.length) {
          // Final text response — already streamed token-by-token
          const hasHumanBtn = text.includes("[SHOW_HUMAN_BUTTON]");
          sseDone({ action: actionType, actionData, showHumanButton: hasHumanBtn || undefined });
          return;
        }

        // Has tool calls — add assistant msg and execute in parallel
        openaiMessages.push({ role: "assistant", content: text || null, tool_calls: toolCalls });
        const tr = await runToolCalls(toolCalls, { isAuthenticated, userEmail });
        openaiMessages.push(...tr.messages);
        if (tr.actionType) actionType = tr.actionType;
        if (tr.actionData) actionData = tr.actionData;

      } else {
        // ── Non-streaming path (fallback / streaming-off) ─────────────────────
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
        openaiMessages.push(entry);

        if (!assistantMsg.tool_calls?.length) {
          const rawReply = assistantMsg.content?.trim() ?? "I'm not sure how to help with that. Please contact our support team.";
          const hasHumanBtn2 = rawReply.includes("[SHOW_HUMAN_BUTTON]");
          const reply = rawReply.replace(/\[SHOW_HUMAN_BUTTON\]/g, "").trim();
          res.json({ message: reply, action: actionType, actionData, showHumanButton: hasHumanBtn2 || undefined });
          return;
        }

        const tr = await runToolCalls(
          assistantMsg.tool_calls as ToolCallItem[],
          { isAuthenticated, userEmail },
        );
        openaiMessages.push(...tr.messages);
        if (tr.actionType) actionType = tr.actionType;
        if (tr.actionData) actionData = tr.actionData;
      }
    }

    sseDone({ message: "Done! Is there anything else I can help you with?", action: actionType, actionData });
  } catch (err) {
    req.log.error({ err }, "GSMBot error");
    const wa = await getWhatsappContact().catch(() => "254112628799");
    const errMsg = `Something went wrong. Please try again or WhatsApp us at wa.me/${wa.replace(/^\+/, "")}.`;
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ done: true, message: errMsg })}\n\n`);
      res.end();
    } else {
      res.json({ message: errMsg });
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
const otpStore = new Map<string, { code: string; expiry: number }>();

router.post("/chat/bot/otp/send", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email address required" });
      return;
    }
    const lEmail = email.toLowerCase().trim();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(lEmail, { code, expiry: Date.now() + 10 * 60 * 1000 });

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
    const stored = otpStore.get(lEmail);
    if (!stored || stored.code !== code.trim() || Date.now() > stored.expiry) {
      res.status(400).json({ ok: false, error: "Invalid or expired verification code" });
      return;
    }
    otpStore.delete(lEmail);
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
