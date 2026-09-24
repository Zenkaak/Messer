import { Router, type IRouter } from "express";
import { ilike, eq, and, or } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  productsTable,
  categoriesTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  getOtsConfig,
  getPaymentMethods,
} from "../lib/admin-settings";

const router: IRouter = Router();

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

// ─── Build dynamic system prompt from live DB data ──────────────────────────
async function buildSystemPrompt(): Promise<string> {
  const [categories, products, paymentMethodRows] = await Promise.all([
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
      .orderBy(productsTable.categoryId, productsTable.name)
      .limit(400),
    getPaymentMethods(),
  ]);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, { name: c.name, slug: c.slug }]));

  // Group products by category
  const grouped: Record<string, Array<{ id: number; name: string; price: string; origPrice?: string; desc: string; inStock: boolean; featured: boolean }>> = {};
  for (const p of products) {
    const cat = catMap[p.categoryId]?.name ?? "General";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: p.id,
      name: p.name,
      price: p.price,
      origPrice: p.originalPrice ?? undefined,
      desc: p.description?.slice(0, 120) ?? "",
      inStock: p.inStock,
      featured: p.featured,
    });
  }

  let catalogSection = "═══ LIVE STORE CATALOG (real-time from database) ═══\n";
  for (const [catName, items] of Object.entries(grouped)) {
    catalogSection += `\n▸ ${catName.toUpperCase()}:\n`;
    for (const item of items) {
      const stock = item.inStock ? "" : " [OUT OF STOCK]";
      const sale = item.origPrice && parseFloat(item.origPrice) > parseFloat(item.price)
        ? ` (was $${parseFloat(item.origPrice).toFixed(2)})`
        : "";
      const tag = item.featured ? " ★" : "";
      catalogSection += `  [ID:${item.id}] ${item.name}${tag} — $${parseFloat(item.price).toFixed(2)}${sale}${stock}\n`;
      if (item.desc) catalogSection += `    ${item.desc}\n`;
    }
  }

  // Payment methods
  const enabledMethods = paymentMethodRows.filter((m) => m.enabled !== false);
  const pmSection = enabledMethods.length > 0
    ? `\n═══ PAYMENT METHODS ═══\n${enabledMethods.map((m) =>
        `• ${m.label || m.method}${m.network ? ` — ${m.network}` : ""}${m.walletAddress ? ` (address: ${m.walletAddress})` : ""}`
      ).join("\n")}`
    : `\n═══ PAYMENT METHODS ═══\n• M-Pesa (Kenya mobile money)\n• USDT (crypto — TRC20/ERC20)\n• Binance Pay\n• Bitcoin`;

  // Categories list
  const catSection = `\n═══ CATEGORIES ═══\n${categories.map((c) => `• ${c.name} → /categories (slug: ${c.slug})`).join("\n")}`;

  return `You are GSMBot, the AI assistant for GSM World — a professional online store for mobile phone services.

═══ WHAT YOU CAN DO ═══
You have full knowledge of this store and can:
1. Answer questions about any product, service, or price using the live catalog below
2. Look up a customer's order status (need email + order ID)
3. Cancel a pending order within 30 minutes of placing it
4. Navigate the user to any page in the app
5. Search for specific products
6. Explain payment options, account features, and the ordering process

═══ APP PAGES & FEATURES ═══
• Home: / — featured products, promotions
• Store / All Products: /products — browse everything with filters
• Categories: /categories — browse by service type
• Cart: /cart — review selected items
• Checkout: /checkout — enter email, phone, choose payment method, place order
• Order Lookup (guest): /orders/lookup — track any order with email + order ID
• Login / Register: /login, /signup
• My Account: /account — profile, settings
  - My Orders: /account/orders — full order history with messages & file uploads
  - Add Funds: /account/add-fund — top up wallet balance
  - Server Credits: /account/credits — manage credits for server tools
  - Bulk Order: /account/bulk-order — order many services at once via CSV
  - Express Order: /account/express-order — fast ordering for power users
  - API Access: /account/api — API keys for developers / resellers
• iPhone/iCloud Unlock: /iphone-unlock
• Android Unlock: /android-unlock
• FRP Bypass: /frp
• IMEI Services: /imei
• Gift Cards: /gift-cards
• Server Credits: /credits
• Tool Activation: /activate
• Unlock Tools: /unlock-tools

═══ HOW ORDERING WORKS ═══
1. Customer adds product to cart (or goes directly to checkout)
2. At checkout they enter email, phone, device info (IMEI/serial), and choose payment
3. For M-Pesa: STK push is sent to their phone — they enter M-Pesa PIN
4. For USDT/crypto: they send exact amount to the wallet address shown
5. For Binance Pay: scan QR code in Binance app
6. Order is created with status "pending" → confirmed after payment verifies
7. Service is delivered digitally (unlock code, file, or instruction via Order Messages)
8. Customer can message support directly from their order page and attach files

═══ ACCOUNT FEATURES ═══
• Wallet: top up via any payment method; use balance to pay for orders instantly
• Server Credits: buy credits to use with GSM server tools (DC-Unlocker, etc.)
• Bulk Orders: upload a CSV file to place many orders at once — great for resellers
• Express Orders: order by typing product name + IMEI + quantity directly
• API: generate API keys to integrate GSM World services into your own system/reseller panel
• Invoices: download PDF invoices for any order
• Ledger: full transaction history

═══ CANCELLATION POLICY ═══
Orders can be cancelled within 30 minutes of placement IF status is still "pending" or "awaiting verification". Once processing begins, cancellations must go through human support.

═══ SUPPORT ═══
• Human agents available via "Talk to a human agent" button in this chat
• WhatsApp: wa.me/254756816951
• Response time: typically within a few hours

Be friendly, direct, and use your tools proactively. When a customer asks about a product, search for it. When they want to go somewhere, navigate them there. When they mention an order, look it up.

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
      description:
        "Search for products in the store by name, brand, or service type. Use this whenever a customer asks about a specific product, price, or service.",
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
      description:
        "Look up a customer's order status, items, and payment details. Always ask for email and order ID before calling this.",
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
      description:
        "Cancel a customer's pending or unpaid order within the 30-minute window.",
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
      description:
        "Send the user to a specific page. Use when they want to browse, buy, checkout, or manage their account.",
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
      products: results.map((p) => ({
        id: p.id,
        name: p.name,
        price: `$${parseFloat(p.price).toFixed(2)}`,
        originalPrice: p.originalPrice ? `$${parseFloat(p.originalPrice).toFixed(2)}` : null,
        category: catMap[p.categoryId] ?? "General",
        description: p.description?.slice(0, 150),
        inStock: p.inStock,
      })),
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

    return {
      found: true,
      product: {
        id: product.id,
        name: product.name,
        price: `$${parseFloat(product.price).toFixed(2)}`,
        originalPrice: product.originalPrice ? `$${parseFloat(product.originalPrice).toFixed(2)}` : null,
        category: cat?.name ?? "General",
        description: product.description,
        inStock: product.inStock,
        featured: product.featured,
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

async function sendOtsSms(params: { apiToken: string; senderId: string | null; to: string; message: string }): Promise<boolean> {
  try {
    const res = await fetch("https://api.ots.co.ke/sms/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${params.apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: params.to, from: params.senderId || "GSMSUPPORT", message: params.message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
router.post("/chat/bot", async (req, res) => {
  try {
    const { messages = [], requestHuman = false } = req.body ?? {};

    if (requestHuman) {
      const { apiToken, senderId, adminPhone } = await getOtsConfig();
      let escalated = false;
      if (apiToken && adminPhone) {
        escalated = await sendOtsSms({
          apiToken,
          senderId,
          to: adminPhone,
          message: "GSMBot: A customer is requesting human support on the GSM World website.",
        });
      }
      res.json({
        message: escalated
          ? "Our support team has been notified via SMS! A human agent will reach out to you shortly. You can also WhatsApp us at +254756816951."
          : "Please contact our support team on WhatsApp at +254756816951 for immediate help!",
        escalated,
      });
      return;
    }

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

    const systemPrompt = await buildSystemPrompt();

    const openaiMessages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      ...safeMessages,
    ];

    let actionType: string | null = null;
    let actionData: Record<string, unknown> | null = null;

    for (let iterations = 0; iterations < 4; iterations++) {
      let data;
      try {
        data = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: openaiMessages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
          tools: TOOLS,
          tool_choice: "auto",
          max_tokens: 600,
          temperature: 0.55,
        });
      } catch (err) {
        req.log.warn({ err }, "OpenAI API error");
        res.json({ message: "I'm having trouble right now. Please try again or WhatsApp us." });
        return;
      }

      const assistantMsg = data.choices?.[0]?.message;
      if (!assistantMsg) break;

      const entry: Record<string, unknown> = { role: "assistant", content: assistantMsg.content ?? null };
      if (assistantMsg.tool_calls) entry.tool_calls = assistantMsg.tool_calls;
      openaiMessages.push(entry);

      if (!assistantMsg.tool_calls?.length) {
        const reply = assistantMsg.content?.trim() ?? "I'm not sure how to help with that. Please contact our support team.";
        res.json({ message: reply, action: actionType, actionData });
        return;
      }

      for (const toolCall of assistantMsg.tool_calls) {
        let result = "";
        const args = JSON.parse(toolCall.function.arguments ?? "{}") as Record<string, unknown>;
        const fn = toolCall.function.name;

        if (fn === "search_products") {
          const r = await toolSearchProducts(String(args.query ?? ""));
          result = JSON.stringify(r);
          if (r.found && r.products && r.products.length > 0) {
            actionType = "show_products";
            actionData = { products: r.products };
          }
        } else if (fn === "get_product_details") {
          const r = await toolGetProductDetails(Number(args.product_id ?? 0));
          result = JSON.stringify(r);
          if (r.found && r.product) {
            actionType = "show_product";
            actionData = { product: r.product };
          }
        } else if (fn === "lookup_order") {
          const r = await toolLookupOrder(String(args.email ?? ""), Number(args.order_id ?? 0));
          result = JSON.stringify(r.found ? r.order : r.error);
          if (r.found && r.order) { actionType = "show_order"; actionData = r.order as Record<string, unknown>; }
        } else if (fn === "cancel_order") {
          const r = await toolCancelOrder(String(args.email ?? ""), Number(args.order_id ?? 0));
          result = r.cancelled ? `Order #${args.order_id} cancelled.` : (r.error ?? "Cancellation failed.");
          if (r.cancelled) { actionType = "order_cancelled"; actionData = { orderId: args.order_id }; }
        } else if (fn === "navigate_to") {
          const page = String(args.page ?? "products");
          const label = String(args.label ?? "Go to page");
          const href = PAGE_HREFS[page] ?? "/products";
          actionType = "navigate";
          actionData = { href, label };
          result = `Navigation ready: ${label} → ${href}`;
        }

        openaiMessages.push({ role: "tool", content: result, tool_call_id: toolCall.id, name: fn });
      }
    }

    res.json({ message: "Done! Is there anything else I can help you with?", action: actionType, actionData });
  } catch (err) {
    req.log.error({ err }, "GSMBot error");
    res.json({ message: "Something went wrong. Please try again or WhatsApp us at +254756816951." });
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
