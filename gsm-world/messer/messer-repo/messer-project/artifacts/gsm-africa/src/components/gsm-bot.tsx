import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  MessageSquare, X, Send, Bot, RefreshCw, User, Phone,
  ExternalLink, CheckCircle, Clock, XCircle, AlertCircle,
  Package, ShoppingCart, Tag,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface OrderItem { name: string; quantity: number; price: number }
interface OrderCard {
  id: number; status: string; total: number; currency: string;
  paymentMethod: string; customerName?: string; createdAt: string; items: OrderItem[];
}
interface ProductResult {
  id: number; name: string; price: string; originalPrice?: string | null;
  category: string; description?: string; inStock: boolean;
}
interface NavAction { href: string; label: string }

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  orderCard?: OrderCard;
  orderCancelled?: boolean;
  navAction?: NavAction;
  products?: ProductResult[];
  product?: ProductResult;
}

type BotResponse = {
  message: string;
  escalated?: boolean;
  action?: string | null;
  actionData?: Record<string, unknown> | null;
};

function apiBase() { return import.meta.env.BASE_URL.replace(/\/$/, ""); }

// ─── Suggestion chips ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Check my order status",
  "Browse unlock services",
  "Cancel my order",
  "What payment methods do you accept?",
];

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm GSMBot 👋 I know the full GSM World catalog — products, pricing, services, payment options, and more. I can also look up or cancel your orders.\n\nHow can I help you today?",
};

// ─── Status helpers ───────────────────────────────────────────────────────────
function statusStyle(status: string) {
  switch (status) {
    case "confirmed": case "completed": case "paid": return "text-green-600 bg-green-50 border-green-200";
    case "pending": case "pending_payment_confirmation": return "text-amber-600 bg-amber-50 border-amber-200";
    case "cancelled": case "failed": return "text-red-600 bg-red-50 border-red-200";
    default: return "text-slate-600 bg-slate-50 border-slate-200";
  }
}
function StatusIcon({ status }: { status: string }) {
  const cls = "w-3.5 h-3.5";
  switch (status) {
    case "confirmed": case "completed": case "paid": return <CheckCircle className={cls} />;
    case "pending": case "pending_payment_confirmation": return <Clock className={cls} />;
    case "cancelled": return <XCircle className={cls} />;
    case "failed": return <AlertCircle className={cls} />;
    default: return <Package className={cls} />;
  }
}

// ─── Widgets ─────────────────────────────────────────────────────────────────
function OrderCardWidget({ card }: { card: OrderCard }) {
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <span className="font-bold text-slate-700">Order #{card.id}</span>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold capitalize text-[10px] ${statusStyle(card.status)}`}>
          <StatusIcon status={card.status} />
          {card.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {card.items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex justify-between text-slate-600">
            <span className="truncate max-w-[160px]">{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}</span>
            <span className="font-semibold ml-2 shrink-0">{card.currency} {Number(item.price).toFixed(2)}</span>
          </div>
        ))}
        {card.items.length > 3 && <div className="text-slate-400 text-[10px]">+{card.items.length - 3} more</div>}
        <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-100 mt-1">
          <span>Total</span>
          <span>{card.currency} {Number(card.total).toFixed(2)}</span>
        </div>
        <div className="text-slate-400 text-[10px]">
          {card.paymentMethod} · {new Date(card.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-slate-100">
        <Link href={`/orders/${card.id}`} className="flex items-center gap-1 text-blue-600 font-semibold text-[11px] hover:underline">
          <ExternalLink size={10} /> View full order details
        </Link>
      </div>
    </div>
  );
}

function ProductCard({ p }: { p: ProductResult }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0 mr-2">
        <p className="font-semibold text-slate-800 text-[11px] leading-tight truncate">{p.name}</p>
        <p className="text-[10px] text-slate-400 truncate">{p.category}</p>
        {p.description && <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[12px] text-slate-800">{p.price}</p>
        {p.originalPrice && <p className="text-[9px] text-slate-400 line-through">{p.originalPrice}</p>}
        {!p.inStock && <p className="text-[9px] text-red-500 font-semibold">Out of stock</p>}
      </div>
    </div>
  );
}

function ProductsWidget({ products }: { products: ProductResult[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? products : products.slice(0, 4);
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-100">
        <Tag size={11} className="text-slate-500" />
        <span className="font-bold text-slate-700 text-[11px]">{products.length} Product{products.length !== 1 ? "s" : ""} Found</span>
      </div>
      <div className="px-3 py-1">
        {visible.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
      {products.length > 4 && (
        <button onClick={() => setShowAll(s => !s)}
          className="w-full text-[10px] font-semibold text-blue-600 py-1.5 hover:bg-blue-50 transition-colors border-t border-slate-100">
          {showAll ? "Show less" : `Show ${products.length - 4} more`}
        </button>
      )}
      <div className="px-3 py-2 border-t border-slate-100">
        <Link href="/products" className="flex items-center gap-1 text-blue-600 font-semibold text-[11px] hover:underline">
          <ShoppingCart size={10} /> Browse full store
        </Link>
      </div>
    </div>
  );
}

function NavButton({ action }: { action: NavAction }) {
  return (
    <Link href={action.href}
      className="mt-2 flex items-center justify-center gap-1.5 w-full text-[11px] font-bold text-white rounded-xl py-2.5 px-4 transition-opacity hover:opacity-90"
      style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
      <ExternalLink size={11} />
      {action.label}
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GsmBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); inputRef.current?.focus(); }, 120);
  }, [open]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(text: string = input.trim()) {
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/chat/bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = (await res.json()) as BotResponse;

      const msg: ChatMessage = { role: "assistant", content: data.message };

      if (data.action === "show_order" && data.actionData) {
        msg.orderCard = data.actionData as unknown as OrderCard;
      } else if (data.action === "order_cancelled") {
        msg.orderCancelled = true;
      } else if (data.action === "navigate" && data.actionData) {
        msg.navAction = data.actionData as unknown as NavAction;
      } else if (data.action === "show_products" && data.actionData?.products) {
        msg.products = data.actionData.products as ProductResult[];
      } else if (data.action === "show_product" && data.actionData?.product) {
        msg.products = [data.actionData.product as ProductResult];
      }

      setMessages((prev) => [...prev, msg]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function requestHuman() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/chat/bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestHuman: true }),
      });
      const data = (await res.json()) as BotResponse;
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      setEscalated(true);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Please contact us on WhatsApp at +254756816951 for immediate help." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed right-4 md:right-6 z-[300] w-[340px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ bottom: "calc(5.5rem + 4.5rem)", maxWidth: "calc(100vw - 2rem)", height: "min(540px, calc(100vh - 14rem))" }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 shrink-0"
            style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
              <Bot size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm leading-tight">GSMBot</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                <span className="text-blue-300 text-[11px]">Full store knowledge · Orders · Payments</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} className="text-blue-600" />
                  </div>
                )}
                <div className="max-w-[85%]">
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[#1a2332] text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}>
                    {m.content}
                  </div>
                  {m.orderCard && <OrderCardWidget card={m.orderCard} />}
                  {m.orderCancelled && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <CheckCircle size={12} /> Order cancelled successfully
                    </div>
                  )}
                  {m.products && m.products.length > 0 && <ProductsWidget products={m.products} />}
                  {m.navAction && <NavButton action={m.navAction} />}
                </div>
                {m.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={12} className="text-gray-500" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: `${j * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips — only on first message */}
          {messages.length === 1 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full px-2.5 py-1 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0 space-y-2">
            {!escalated && (
              <button onClick={requestHuman} disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl py-1.5 transition-colors border border-slate-200 disabled:opacity-40">
                <Phone size={11} /> Talk to a human agent
              </button>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask about products, orders, payments…"
                disabled={loading}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
              <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                className="w-9 h-9 text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
                style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close GSMBot" : "Open GSMBot"}
        className="fixed z-40 bottom-[5.5rem] right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
        {open ? <X size={22} className="text-white" /> : <MessageSquare size={24} className="text-white" />}
      </button>
    </>
  );
}
