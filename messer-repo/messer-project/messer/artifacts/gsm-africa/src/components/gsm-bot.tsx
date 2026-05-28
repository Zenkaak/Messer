import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  MessageSquare, X, Send, Bot, RefreshCw, User, Phone,
  ExternalLink, CheckCircle, Clock, XCircle, AlertCircle,
  Package, ShoppingCart, Tag, Paperclip, UserCheck, ArrowLeft,
  Headphones, WifiOff, Mail, Copy, Shield, Upload, Smartphone, Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
interface PaymentData {
  method: string;
  instructions: string;
  binancePayId?: string;
  usdtAddress?: string;
  usdtNetwork?: string;
}
interface NowPaymentsData {
  orderId: number; payAddress: string; payAmount: number;
  payCurrency: string; expiresAt?: string; total: number; currency: string;
}
interface MpesaPendingData {
  orderId: number; checkoutRequestId: string; message: string; total: number; currency: string;
}
interface CheckoutDoneData {
  orderId: number; paymentMethod: string; total: number; currency: string;
}
interface CartAddedData { productName: string; quantity: number; price: string }
interface LoginSuccessData {
  token: string; user: { id: number; email: string; name: string | null }; isNewAccount?: boolean;
}
interface WalletTopUpMpesaData {
  checkoutRequestId: string; amountUsd: number; amountKes: number; message: string;
}
interface WalletTopUpNowpaymentsData {
  paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string; amountUsd: number;
}
interface WalletTopUpUsdtData {
  addresses: Array<{ network: string; address: string; minDeposit?: string }>; note: string;
}
interface WalletBalanceData {
  balance: number;
}
interface WalletInsufficientFundsData {
  balance: number;
  needed: number;
  shortfall: number;
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  orderCard?: OrderCard;
  orderCancelled?: boolean;
  navAction?: NavAction;
  products?: ProductResult[];
  showHumanButton?: boolean;
  paymentData?: PaymentData;
  nowpaymentsData?: NowPaymentsData;
  mpesaPendingData?: MpesaPendingData;
  checkoutDoneData?: CheckoutDoneData;
  cartAddedData?: CartAddedData;
  loginSuccessData?: LoginSuccessData;
  passwordResetDone?: boolean;
  walletTopUpMpesaData?: WalletTopUpMpesaData;
  walletTopUpNowpaymentsData?: WalletTopUpNowpaymentsData;
  walletTopUpUsdtData?: WalletTopUpUsdtData;
  walletBalanceData?: WalletBalanceData;
  walletInsufficientFundsData?: WalletInsufficientFundsData;
}
interface HumanMessage {
  id: number;
  senderType: "user" | "admin";
  message: string;
  fileUrl?: string | null;
  createdAt: string;
  readAt?: string | null;
}
type BotResponse = {
  message: string;
  escalated?: boolean;
  sessionId?: number | null;
  action?: string | null;
  actionData?: Record<string, unknown> | null;
  showHumanButton?: boolean;
};

function apiBase() { return import.meta.env.BASE_URL.replace(/\/$/, ""); }

function getVisitorId(): string {
  try {
    let id = sessionStorage.getItem("gsm_visitor_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("gsm_visitor_id", id);
    }
    return id;
  } catch {
    return "visitor-" + Math.random().toString(36).slice(2);
  }
}

// ─── Suggestion chips ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Show me iPhone unlock services",
  "Check my order status",
  "Show featured deals",
  "How to pay with M-Pesa",
  "Android FRP bypass",
  "Cancel my order",
];

const WELCOME: ChatMessage = {
  role: "assistant",
  content: "Hi! I'm GSMBot 👋\n\nI can help you with:\n• 📱 iPhone & Android unlock services\n• 🔍 Look up or cancel your orders\n• 💳 Step-by-step payment help (M-Pesa, USDT, Binance)\n• 🎁 Gift cards & server credits\n• 🔧 IMEI checks, FRP bypass, tool activation\n\nWhat can I help you with today?",
};

// ─── Status helpers ───────────────────────────────────────────────────────────
function statusStyle(status: string) {
  switch (status) {
    case "confirmed": case "completed": case "paid": case "active": return "text-green-600 bg-green-50 border-green-200";
    case "processing": return "text-blue-600 bg-blue-50 border-blue-200";
    case "pending": case "pending_payment_confirmation": return "text-amber-600 bg-amber-50 border-amber-200";
    case "paused": return "text-purple-600 bg-purple-50 border-purple-200";
    case "cancelled": case "failed": return "text-red-600 bg-red-50 border-red-200";
    case "closed": case "refunded": return "text-slate-500 bg-slate-100 border-slate-200";
    default: return "text-slate-600 bg-slate-50 border-slate-200";
  }
}
function StatusIcon({ status }: { status: string }) {
  const cls = "w-3.5 h-3.5";
  switch (status) {
    case "confirmed": case "completed": case "paid": case "active": return <CheckCircle className={cls} />;
    case "processing": return <RefreshCw className={cls} />;
    case "pending": case "pending_payment_confirmation": case "paused": return <Clock className={cls} />;
    case "cancelled": case "closed": return <XCircle className={cls} />;
    case "failed": return <AlertCircle className={cls} />;
    default: return <Package className={cls} />;
  }
}

// ─── Widgets ─────────────────────────────────────────────────────────────────
function OrderCardWidget({ card }: { card: OrderCard }) {
  const base = apiBase();
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
      </div>
      <div className="px-3 py-2 border-t border-slate-100">
        <Link href={`${base}/orders/${card.id}`} className="flex items-center gap-1 text-blue-600 font-semibold text-[11px] hover:underline">
          <ExternalLink size={10} /> View full order details
        </Link>
      </div>
    </div>
  );
}

function ProductCard({ p, number, onSelect }: { p: ProductResult; number?: number; onSelect?: (p: ProductResult) => void }) {
  const base = apiBase();
  return (
    <Link href={`${base}/products/${p.id}`}
      onClick={onSelect ? (e) => { e.preventDefault(); onSelect(p); } : undefined}
      className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0 hover:bg-blue-50/40 rounded-lg px-1 -mx-1 transition-colors cursor-pointer group">
      {number != null && (
        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{number}</span>
      )}
      <div className="flex-1 min-w-0 mr-2">
        <p className="font-semibold text-slate-800 text-[11px] leading-tight truncate group-hover:text-blue-700">{p.name}</p>
        <p className="text-[10px] text-slate-400 truncate">{p.category}</p>
        {p.description && <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[12px] text-slate-800 group-hover:text-blue-700">{p.price}</p>
        {p.originalPrice && <p className="text-[9px] text-slate-400 line-through">{p.originalPrice}</p>}
        {!p.inStock && <p className="text-[9px] text-red-500 font-semibold">Out of stock</p>}
      </div>
    </Link>
  );
}

function ProductsWidget({ products, onSelect }: { products: ProductResult[]; onSelect?: (p: ProductResult) => void }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? products : products.slice(0, 5);
  const base = apiBase();
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-100">
        <Tag size={11} className="text-slate-500" />
        <span className="font-bold text-slate-700 text-[11px]">{products.length} Product{products.length !== 1 ? "s" : ""} Found</span>
        <span className="ml-auto text-[10px] text-slate-400">Reply with # to select</span>
      </div>
      <div className="px-3 py-1">
        {visible.map((p, i) => <ProductCard key={p.id} p={p} number={i + 1} onSelect={onSelect} />)}
      </div>
      {products.length > 5 && (
        <button onClick={() => setShowAll(s => !s)}
          className="w-full text-[10px] font-semibold text-blue-600 py-1.5 hover:bg-blue-50 transition-colors border-t border-slate-100">
          {showAll ? "Show less" : `Show ${products.length - 5} more`}
        </button>
      )}
      <div className="px-3 py-2 border-t border-slate-100">
        <Link href={`${base}/products`} className="flex items-center gap-1 text-blue-600 font-semibold text-[11px] hover:underline">
          <ShoppingCart size={10} /> Browse full store
        </Link>
      </div>
    </div>
  );
}

function NavButton({ action, onClose }: { action: NavAction; onClose?: () => void }) {
  const base = apiBase();
  const href = action.href.startsWith("http") ? action.href : `${base}${action.href}`;
  return (
    <Link href={href}
      onClick={() => onClose?.()}
      className="mt-2 flex items-center justify-center gap-1.5 w-full text-[11px] font-bold text-white rounded-xl py-2.5 px-4 transition-opacity hover:opacity-90"
      style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
      <ExternalLink size={11} />
      {action.label}
    </Link>
  );
}

// ─── Payment Widgets ──────────────────────────────────────────────────────────
function MpesaPaymentWidget({ data, onSend }: { data: PaymentData; onSend: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const handleSend = async () => {
    const cleaned = phone.trim().replace(/\s+/g, "");
    if (!cleaned || cleaned.length < 9) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setSent(true);
    setSending(false);
    onSend(cleaned);
  };
  return (
    <div className="mt-2 rounded-xl border border-green-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border-b border-green-100">
        <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
          <Smartphone size={13} className="text-white" />
        </div>
        <span className="font-bold text-green-800 text-[11px]">M-Pesa Payment</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-slate-600 text-[11px] leading-relaxed whitespace-pre-wrap">{data.instructions}</p>
        {!sent ? (
          <div className="flex gap-2 pt-1">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
              placeholder="07XX XXX XXX"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
            />
            <button
              onClick={handleSend}
              disabled={sending || !phone.trim()}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 shrink-0">
              {sending ? <RefreshCw size={12} className="animate-spin" /> : "Send STK Push"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle size={14} className="text-green-600 shrink-0" />
            <span className="text-green-700 text-[11px] font-semibold">STK Push sent! Check your phone for the M-Pesa PIN prompt.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BinancePaymentWidget({ data }: { data: PaymentData }) {
  const [copied, setCopied] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const copy = () => {
    if (data.binancePayId) {
      void navigator.clipboard.writeText(data.binancePayId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="mt-2 rounded-xl border border-yellow-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border-b border-yellow-100">
        <div className="w-6 h-6 rounded-lg bg-yellow-400 flex items-center justify-center shrink-0">
          <span className="font-black text-yellow-900 text-[11px]">B</span>
        </div>
        <span className="font-bold text-yellow-800 text-[11px]">Binance Pay</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-slate-600 text-[11px] leading-relaxed whitespace-pre-wrap">{data.instructions}</p>
        {data.binancePayId && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <span className="flex-1 font-mono text-[11px] font-bold text-yellow-900 truncate">{data.binancePayId}</span>
            <button onClick={copy}
              className="flex items-center gap-1 text-[10px] font-semibold text-yellow-700 hover:text-yellow-900 shrink-0">
              <Copy size={11} /> {copied ? "Copied!" : "Copy ID"}
            </button>
          </div>
        )}
        <div>
          <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf"
            onChange={e => setProofFile(e.target.files?.[0] || null)} />
          <button onClick={() => fileRef.current?.click()}
            className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${proofFile ? "border-yellow-400 bg-yellow-50 text-yellow-700" : "border-gray-200 text-gray-500 hover:border-yellow-300"}`}>
            <Upload size={11} />
            {proofFile ? `✓ ${proofFile.name.slice(0, 20)}` : "Upload payment proof"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsdtPaymentWidget({ data }: { data: PaymentData }) {
  const [copied, setCopied] = useState(false);
  const [network, setNetwork] = useState<"TRC20" | "ERC20">(
    (data.usdtNetwork?.toUpperCase() as "TRC20" | "ERC20") || "TRC20"
  );
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const copy = () => {
    if (data.usdtAddress) {
      void navigator.clipboard.writeText(data.usdtAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="mt-2 rounded-xl border border-blue-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
        <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
          <span className="font-black text-white text-[10px]">₮</span>
        </div>
        <span className="font-bold text-blue-800 text-[11px]">USDT Payment</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex gap-1.5">
          {(["TRC20", "ERC20"] as const).map(n => (
            <button key={n} onClick={() => setNetwork(n)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${network === n ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:border-blue-300"}`}>
              {n}
            </button>
          ))}
          <span className="ml-1 text-[10px] text-slate-400 self-center">{network === "TRC20" ? "Faster & cheaper" : "Ethereum network"}</span>
        </div>
        <p className="text-slate-600 text-[11px] leading-relaxed whitespace-pre-wrap">{data.instructions}</p>
        {data.usdtAddress && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="flex-1 font-mono text-[10px] text-blue-900 truncate">{data.usdtAddress}</span>
            <button onClick={copy}
              className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:text-blue-900 shrink-0">
              <Copy size={11} /> {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <Shield size={11} /> Send on <strong>{network}</strong> network only — wrong network = lost funds
        </div>
        <div>
          <input ref={fileRef} type="file" className="hidden" accept="image/*"
            onChange={e => setProofFile(e.target.files?.[0] || null)} />
          <button onClick={() => fileRef.current?.click()}
            className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${proofFile ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-blue-300"}`}>
            <Upload size={11} />
            {proofFile ? `✓ ${proofFile.name.slice(0, 20)}` : "Upload transaction screenshot"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineHumanButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white rounded-xl py-2 px-4 transition-opacity hover:opacity-90"
      style={{ background: "linear-gradient(135deg,#059669 0%,#047857 100%)" }}>
      <Headphones size={12} /> Talk to a Human Agent
    </button>
  );
}

function OtpVerifyWidget({ email, base, onVerified, onCancel }: {
  email: string; base: string;
  onVerified: () => void; onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const sendOtp = async () => {
    setSending(true); setError("");
    try {
      const r = await fetch(`${base}/api/chat/bot/otp/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) { setSent(true); } else { setError("Could not send code. Try again."); }
    } catch { setError("Network error. Try again."); }
    finally { setSending(false); }
  };

  const verifyOtp = async () => {
    if (!code.trim() || code.trim().length < 6) { setError("Enter the 6-digit code."); return; }
    setVerifying(true); setError("");
    try {
      const r = await fetch(`${base}/api/chat/bot/otp/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (d.ok) { setSuccess(true); setTimeout(onVerified, 800); }
      else { setError(d.error ?? "Invalid code. Try again."); }
    } catch { setError("Network error. Try again."); }
    finally { setVerifying(false); }
  };

  if (success) {
    return (
      <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
        <CheckCircle size={14} className="text-green-600 shrink-0" />
        <span className="text-green-700 text-[11px] font-semibold">Email verified! Loading your orders…</span>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-blue-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
        <Shield size={13} className="text-blue-600" />
        <span className="font-bold text-blue-800 text-[11px]">Email Verification Required</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-slate-600 text-[11px]">
          To view orders for <strong>{email.slice(0, 3)}***@{email.split("@")[1]}</strong>, we need to verify it's you.
        </p>
        {!sent ? (
          <div className="flex gap-2">
            <button onClick={sendOtp} disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50">
              {sending ? <RefreshCw size={11} className="animate-spin" /> : <Mail size={11} />}
              {sending ? "Sending…" : "Send verification code"}
            </button>
            <button onClick={onCancel} className="text-[11px] text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-green-600 font-semibold">Code sent to your email!</p>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={e => { setCode(e.target.value); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") verifyOtp(); }}
                placeholder="6-digit code"
                maxLength={6}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono tracking-widest focus:outline-none focus:border-blue-400"
              />
              <button onClick={verifyOtp} disabled={verifying || !code.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50">
                {verifying ? <RefreshCw size={11} className="animate-spin" /> : "Verify"}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <button onClick={sendOtp} className="text-[11px] text-slate-400 hover:text-slate-600">Resend code</button>
          </div>
        )}
        {error && !sent && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    </div>
  );
}

// ─── Cart added widget ────────────────────────────────────────────────────────
function CartAddedWidget({ data }: { data: CartAddedData }) {
  const base = apiBase();
  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-b border-emerald-100">
        <ShoppingCart size={12} className="text-emerald-600" />
        <span className="font-bold text-emerald-800 text-[11px]">Added to Cart</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="flex justify-between text-slate-700">
          <span className="font-semibold truncate">{data.quantity > 1 ? `${data.quantity}× ` : ""}{data.productName}</span>
          <span className="font-bold ml-2 shrink-0">{data.price}</span>
        </div>
        <Link href={`${base}/cart`}
          className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline">
          <ShoppingCart size={10} /> View Cart & Checkout →
        </Link>
      </div>
    </div>
  );
}

// ─── Login success widget ─────────────────────────────────────────────────────
function LoginSuccessWidget({ data }: { data: LoginSuccessData }) {
  return (
    <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
      <CheckCircle size={14} className="text-green-600 shrink-0" />
      <div>
        <p className="text-green-700 text-[11px] font-semibold">
          {data.isNewAccount ? "Account created & logged in!" : "Logged in successfully!"}
        </p>
        <p className="text-green-600 text-[10px]">{data.user.email}</p>
      </div>
    </div>
  );
}

// ─── Password reset done widget ───────────────────────────────────────────────
function PasswordResetDoneWidget() {
  return (
    <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
      <CheckCircle size={14} className="text-green-600 shrink-0" />
      <span className="text-green-700 text-[11px] font-semibold">Password reset successfully! You can now log in with your new password.</span>
    </div>
  );
}

// ─── Shared crypto address copy block ────────────────────────────────────────
function CopyBlock({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
        <span className={`flex-1 ${mono ? "font-mono text-[9px]" : "text-[10px]"} text-slate-700 truncate`}>{value}</span>
        <button onClick={copy} className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-800 shrink-0">
          <Copy size={10} /> {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ─── NOWPayments checkout widget (order) ──────────────────────────────────────
function NowPaymentsWidget({ data }: { data: NowPaymentsData }) {
  const [copiedAmt, setCopiedAmt] = useState(false);
  const [activeData, setActiveData] = useState<NowPaymentsData>(data);
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!data.expiresAt) return 15 * 60;
    const ms = new Date(data.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 1000));
  });
  const [pollStatus, setPollStatus] = useState<"pending" | "paid" | "failed">("pending");
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const expired = secondsLeft <= 0;
  const base = apiBase();

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const r = await fetch(`${base}/api/payments/nowpayments/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: activeData.orderId, payCurrency: activeData.payCurrency }),
      });
      const d = await r.json() as { payAddress?: string; payAmount?: number; payCurrency?: string; expiresAt?: string; error?: string };
      if (r.ok && d.payAddress) {
        const newData: NowPaymentsData = { ...activeData, payAddress: d.payAddress, payAmount: d.payAmount ?? activeData.payAmount, payCurrency: d.payCurrency ?? activeData.payCurrency, expiresAt: d.expiresAt };
        setActiveData(newData);
        const newSecs = d.expiresAt ? Math.max(0, Math.round((new Date(d.expiresAt).getTime() - Date.now()) / 1000)) : 15 * 60;
        setSecondsLeft(newSecs);
        setPollStatus("pending");
      } else {
        setRetryError(d.error ?? "Could not get new address. Please try again.");
      }
    } catch {
      setRetryError("Network error. Please try again.");
    }
    setRetrying(false);
  };

  useEffect(() => {
    if (expired || pollStatus !== "pending") return undefined;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [expired, pollStatus]);

  useEffect(() => {
    if (pollStatus !== "pending") return undefined;
    const poll = async () => {
      try {
        const r = await fetch(`${base}/api/payments/nowpayments/query`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: activeData.orderId }),
        });
        if (!r.ok) return;
        const d = await r.json() as { paymentStatus?: string };
        if (d.paymentStatus === "paid") setPollStatus("paid");
        else if (d.paymentStatus === "failed") setPollStatus("failed");
      } catch { /* network error — retry next interval */ }
    };
    void poll();
    const t = setInterval(() => void poll(), 30_000);
    return () => clearInterval(t);
  }, [base, activeData.orderId, pollStatus]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const urgent = secondsLeft < 5 * 60;
  const copyAmt = () => { void navigator.clipboard.writeText(String(activeData.payAmount)); setCopiedAmt(true); setTimeout(() => setCopiedAmt(false), 2000); };

  if (pollStatus === "paid") {
    return (
      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden text-xs shadow-sm px-3 py-3 flex items-start gap-2">
        <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-emerald-800 text-[12px]">Payment Confirmed! ✅</p>
          <p className="text-emerald-700 text-[11px] mt-0.5">Order #{activeData.orderId} is now being processed. Check your email for confirmation.</p>
        </div>
      </div>
    );
  }
  if (pollStatus === "failed") {
    return (
      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 flex items-start gap-2 text-xs">
        <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
        <p className="text-red-700 font-semibold">Payment failed or expired. Please start a new order.</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-purple-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-[9px]">₿</span>
          </div>
          <span className="font-bold text-purple-800 text-[11px]">Crypto Payment — Order #{activeData.orderId}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {!expired && (
            <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${urgent ? "text-red-700 bg-red-100 border border-red-300 animate-pulse" : "text-amber-700 bg-amber-100 border border-amber-300"}`}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          )}
          {expired && <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">EXPIRED</span>}
          {!expired && <span className="text-[9px] text-slate-400 animate-pulse">● checking</span>}
        </div>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        {expired ? (
          <div className="space-y-2">
            <div className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span className="font-semibold">This payment address has expired. Do NOT send funds — they will be lost.</span>
            </div>
            {retryError && (
              <p className="text-[10px] text-red-600 font-semibold">{retryError}</p>
            )}
            <button
              onClick={() => void handleRetry()}
              disabled={retrying}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 transition-colors disabled:opacity-60">
              <RefreshCw size={11} className={retrying ? "animate-spin" : ""} />
              {retrying ? "Getting new address…" : "Get New Payment Address"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <AlertCircle size={11} className="shrink-0 mt-0.5" />
              <span><strong>⚠️ This address expires in {mins}m {secs}s.</strong> Send the EXACT amount below. Late or incorrect payments = funds permanently lost. GSM World is not liable.</span>
            </div>
            <div className="flex gap-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(activeData.payAddress)}`}
                alt="Payment QR code"
                className="w-[70px] h-[70px] rounded-lg border border-purple-100 shrink-0"
              />
              <div className="flex-1 space-y-1.5">
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Send Amount</p>
                  <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1">
                    <span className="flex-1 font-mono text-[12px] font-bold text-purple-900">{activeData.payAmount} <span className="uppercase">{activeData.payCurrency}</span></span>
                    <button onClick={copyAmt} className="flex items-center gap-0.5 text-[10px] font-semibold text-purple-600 hover:text-purple-800 shrink-0">
                      <Copy size={10} /> {copiedAmt ? "✓" : "Copy"}
                    </button>
                  </div>
                </div>
                <CopyBlock label="Wallet Address" value={activeData.payAddress} />
              </div>
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Order total: <strong>{activeData.currency} {Number(activeData.total).toFixed(2)}</strong></span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── M-Pesa pending widget (order) ───────────────────────────────────────────
function MpesaPendingWidget({ data }: { data: MpesaPendingData }) {
  const [pollStatus, setPollStatus] = useState<"pending" | "paid" | "failed">("pending");
  const base = apiBase();

  useEffect(() => {
    if (pollStatus !== "pending") return undefined;
    const poll = async () => {
      try {
        const r = await fetch(`${base}/api/payments/mpesa/query`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId, checkoutRequestId: data.checkoutRequestId }),
        });
        if (!r.ok) return;
        const d = await r.json() as { paymentStatus?: string };
        if (d.paymentStatus === "paid") setPollStatus("paid");
        else if (d.paymentStatus === "failed") setPollStatus("failed");
      } catch { /* retry next interval */ }
    };
    void poll();
    const t = setInterval(() => void poll(), 30_000);
    return () => clearInterval(t);
  }, [base, data.orderId, data.checkoutRequestId, pollStatus]);

  if (pollStatus === "paid") {
    return (
      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 flex items-start gap-2 text-xs shadow-sm">
        <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-emerald-800 text-[12px]">M-Pesa Payment Confirmed! ✅</p>
          <p className="text-emerald-700 text-[11px] mt-0.5">Order #{data.orderId} is now being processed. Check your email for confirmation.</p>
        </div>
      </div>
    );
  }
  if (pollStatus === "failed") {
    return (
      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 flex items-start gap-2 text-xs">
        <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
        <p className="text-red-700 font-semibold">M-Pesa payment failed or was cancelled. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-green-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-green-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center shrink-0">
            <Smartphone size={11} className="text-white" />
          </div>
          <span className="font-bold text-green-800 text-[11px]">M-Pesa STK Push Sent — Order #{data.orderId}</span>
        </div>
        <span className="text-[9px] text-slate-400 animate-pulse">● checking</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle size={13} className="text-green-600 shrink-0" />
          <span className="text-green-700 text-[11px] font-semibold">STK push sent! Check your phone for the M-Pesa PIN prompt.</span>
        </div>
        <p className="text-slate-600 text-[11px]">{data.message}</p>
        <p className="text-slate-500 text-[10px]">Total: <strong>{data.currency} {Number(data.total).toFixed(2)}</strong> · Auto-checking every 30s</p>
      </div>
    </div>
  );
}

// ─── Checkout done widget ─────────────────────────────────────────────────────
function CheckoutDoneWidget({ data }: { data: CheckoutDoneData }) {
  const base = apiBase();
  return (
    <div className="mt-2 rounded-xl border border-blue-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
        <CheckCircle size={13} className="text-blue-600 shrink-0" />
        <span className="font-bold text-blue-800 text-[11px]">Order #{data.orderId} Placed Successfully</span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        <p className="text-slate-600 text-[11px]">
          Payment method: <strong className="capitalize">{data.paymentMethod}</strong> · Total: <strong>{data.currency} {Number(data.total).toFixed(2)}</strong>
        </p>
        <Link href={`${base}/orders/${data.orderId}`} className="flex items-center gap-1 text-blue-600 font-semibold text-[11px] hover:underline">
          <ExternalLink size={10} /> View order details
        </Link>
      </div>
    </div>
  );
}

// ─── Wallet top-up M-Pesa widget (with polling) ───────────────────────────────
function WalletTopUpMpesaWidget({ data }: { data: WalletTopUpMpesaData }) {
  const [pollStatus, setPollStatus] = useState<"pending" | "paid" | "failed">("pending");
  const base = apiBase();
  const token = typeof window !== "undefined" ? (localStorage.getItem("gsmafrica_token") ?? undefined) : undefined;

  useEffect(() => {
    if (pollStatus !== "pending") return undefined;
    const poll = async () => {
      try {
        const r = await fetch(`${base}/api/wallet/add-fund/mpesa/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ checkoutRequestId: data.checkoutRequestId }),
        });
        if (!r.ok) return;
        const d = await r.json() as { status?: string };
        if (d.status === "paid") setPollStatus("paid");
        else if (d.status === "failed") setPollStatus("failed");
      } catch { /* retry */ }
    };
    void poll();
    const t = setInterval(() => void poll(), 30_000);
    return () => clearInterval(t);
  }, [base, data.checkoutRequestId, pollStatus, token]);

  if (pollStatus === "paid") {
    return (
      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 flex items-start gap-2 text-xs shadow-sm">
        <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-emerald-800 text-[12px]">Wallet Topped Up! ✅</p>
          <p className="text-emerald-700 text-[11px] mt-0.5">${data.amountUsd.toFixed(2)} has been credited to your GSM World wallet.</p>
        </div>
      </div>
    );
  }
  if (pollStatus === "failed") {
    return (
      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 flex items-start gap-2 text-xs">
        <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
        <p className="text-red-700 font-semibold">M-Pesa payment failed or was cancelled. Please try again.</p>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-green-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-green-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center shrink-0">
            <Smartphone size={11} className="text-white" />
          </div>
          <span className="font-bold text-green-800 text-[11px]">Wallet Top-Up — M-Pesa</span>
        </div>
        <span className="text-[9px] text-slate-400 animate-pulse">● checking</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle size={13} className="text-green-600 shrink-0" />
          <span className="text-green-700 text-[11px] font-semibold">STK push sent! Enter your M-Pesa PIN to confirm.</span>
        </div>
        <p className="text-slate-600 text-[11px]">{data.message}</p>
        <p className="text-slate-500 text-[10px]">Amount: <strong>KES {data.amountKes} (≈ ${data.amountUsd.toFixed(2)})</strong> · Auto-checking every 30s</p>
      </div>
    </div>
  );
}

// ─── Wallet top-up NOWPayments widget (with countdown + polling) ──────────────
function WalletTopUpNowpaymentsWidget({ data }: { data: WalletTopUpNowpaymentsData }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!data.expiresAt) return 15 * 60;
    const ms = new Date(data.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 1000));
  });
  const [pollStatus, setPollStatus] = useState<"pending" | "paid" | "failed">("pending");
  const expired = secondsLeft <= 0;
  const base = apiBase();
  const token = typeof window !== "undefined" ? (localStorage.getItem("gsmafrica_token") ?? undefined) : undefined;

  useEffect(() => {
    if (expired || pollStatus !== "pending") return undefined;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [expired, pollStatus]);

  useEffect(() => {
    if (pollStatus !== "pending") return undefined;
    const poll = async () => {
      try {
        const r = await fetch(`${base}/api/wallet/add-fund/nowpayments/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ paymentId: data.paymentId, amountUsd: data.amountUsd }),
        });
        if (!r.ok) return;
        const d = await r.json() as { status?: string };
        if (d.status === "paid") setPollStatus("paid");
        else if (d.status === "failed") setPollStatus("failed");
      } catch { /* retry */ }
    };
    void poll();
    const t = setInterval(() => void poll(), 30_000);
    return () => clearInterval(t);
  }, [base, data.paymentId, data.amountUsd, pollStatus, token]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const urgent = secondsLeft < 5 * 60;

  if (pollStatus === "paid") {
    return (
      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 flex items-start gap-2 text-xs shadow-sm">
        <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-emerald-800 text-[12px]">Wallet Topped Up! ✅</p>
          <p className="text-emerald-700 text-[11px] mt-0.5">${data.amountUsd.toFixed(2)} has been credited to your GSM World wallet via crypto.</p>
        </div>
      </div>
    );
  }
  if (pollStatus === "failed") {
    return (
      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 flex items-start gap-2 text-xs">
        <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
        <p className="text-red-700 font-semibold">Payment failed or expired. Please try again.</p>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-purple-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-[9px]">₿</span>
          </div>
          <span className="font-bold text-purple-800 text-[11px]">Wallet Top-Up — Crypto</span>
        </div>
        <div className="flex items-center gap-1.5">
          {!expired ? (
            <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${urgent ? "text-red-700 bg-red-100 border border-red-300 animate-pulse" : "text-amber-700 bg-amber-100 border border-amber-300"}`}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          ) : (
            <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">EXPIRED</span>
          )}
          <span className="text-[9px] text-slate-400 animate-pulse">● checking</span>
        </div>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        {expired ? (
          <div className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span className="font-semibold">This address has expired. Do NOT send funds — they will be lost.</span>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <AlertCircle size={11} className="shrink-0 mt-0.5" />
              <span><strong>⚠️ Expires in {mins}m {secs}s.</strong> Send the EXACT amount. Late or wrong payments = funds lost.</span>
            </div>
            <div className="flex gap-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(data.payAddress)}`}
                alt="Payment QR"
                className="w-[70px] h-[70px] rounded-lg border border-purple-100 shrink-0"
              />
              <div className="flex-1 space-y-1.5">
                <CopyBlock label={`Send Amount (${data.payCurrency.toUpperCase()})`} value={String(data.payAmount)} />
                <CopyBlock label="Wallet Address" value={data.payAddress} />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">Top-up: <strong>${data.amountUsd.toFixed(2)} USD</strong> · Auto-checking every 30s</p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Wallet top-up USDT widget ────────────────────────────────────────────────
function WalletTopUpUsdtWidget({ data }: { data: WalletTopUpUsdtData }) {
  return (
    <div className="mt-2 rounded-xl border border-teal-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border-b border-teal-100">
        <div className="w-5 h-5 rounded-md bg-teal-600 flex items-center justify-center shrink-0">
          <span className="text-white font-black text-[9px]">$</span>
        </div>
        <span className="font-bold text-teal-800 text-[11px]">Wallet Top-Up — USDT Manual Transfer</span>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          <span><strong>Send USDT on the correct network only.</strong> Sending on the wrong network = funds lost permanently.</span>
        </div>
        {data.addresses.map((a) => (
          <div key={a.network} className="space-y-1">
            <p className="text-[10px] font-bold text-slate-600">{a.network}{a.minDeposit ? ` · Min: ${a.minDeposit}` : ""}</p>
            <CopyBlock label="Deposit Address" value={a.address} />
          </div>
        ))}
        <p className="text-[10px] text-slate-500 leading-relaxed">{data.note}</p>
      </div>
    </div>
  );
}

// ─── Wallet balance widget ────────────────────────────────────────────────────
function WalletBalanceWidget({ data }: { data: WalletBalanceData }) {
  const base = apiBase();
  return (
    <div className="mt-2 rounded-xl border border-blue-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
        <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
          <Wallet size={11} className="text-white" />
        </div>
        <span className="font-bold text-blue-800 text-[11px]">GSM World Wallet</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <span className="text-[11px] text-blue-700 font-semibold">Available Balance</span>
          <span className="font-mono font-black text-blue-900 text-[14px]">${data.balance.toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          <Link href={`${base}/account/wallet`}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-colors">
            <Wallet size={10} /> Top Up Wallet
          </Link>
          <Link href={`${base}/account/wallet`}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-[10px] font-bold hover:bg-blue-50 transition-colors">
            <ExternalLink size={10} /> View History
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Wallet insufficient funds widget ─────────────────────────────────────────
function WalletInsufficientFundsWidget({ data, onSendMessage }: { data: WalletInsufficientFundsData; onSendMessage: (text: string) => void }) {
  const base = apiBase();
  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-white overflow-hidden text-xs shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
        <AlertCircle size={13} className="text-amber-600 shrink-0" />
        <span className="font-bold text-amber-800 text-[11px]">Insufficient Wallet Balance</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
            <p className="text-[9px] font-bold text-slate-500 uppercase">Balance</p>
            <p className="font-mono font-black text-slate-800 text-[11px]">${data.balance.toFixed(2)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
            <p className="text-[9px] font-bold text-red-500 uppercase">Needed</p>
            <p className="font-mono font-black text-red-700 text-[11px]">${data.needed.toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
            <p className="text-[9px] font-bold text-amber-600 uppercase">Short</p>
            <p className="font-mono font-black text-amber-800 text-[11px]">${data.shortfall.toFixed(2)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`${base}/account/wallet`}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-colors">
            <Wallet size={10} /> Top Up Wallet
          </Link>
          <button
            onClick={() => onSendMessage("I want to choose a different payment method")}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-slate-200 text-slate-700 text-[10px] font-bold hover:bg-slate-50 transition-colors">
            <RefreshCw size={10} /> Choose Another
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GsmBot() {
  const { user, isAuthenticated, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(true);
  // Bot chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [WELCOME];
    try {
      const saved = localStorage.getItem("gsm_chat_history");
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [WELCOME];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Track last product list for number-selection
  const lastProductsRef = useRef<ProductResult[]>([]);
  // Human chat state
  const [humanMode, setHumanMode] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"waiting" | "active" | "closed">("waiting");
  const [humanMessages, setHumanMessages] = useState<HumanMessage[]>([]);
  const [humanInput, setHumanInput] = useState("");
  const [humanSending, setHumanSending] = useState(false);
  const [humanFile, setHumanFile] = useState<File | null>(null);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  // Email capture step for guest users
  const [humanEmailStep, setHumanEmailStep] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const humanInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailCaptureRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visitorId = useRef(getVisitorId());
  const base = apiBase();

  useEffect(() => {
    try {
      const toSave = messages.map(m => ({ role: m.role, content: m.content }));
      localStorage.setItem("gsm_chat_history", JSON.stringify(toSave));
    } catch { /* ignore */ }
  }, [messages]);

  function startNewChat() {
    try { localStorage.removeItem("gsm_chat_history"); } catch { /* ignore */ }
    setMessages([WELCOME]);
    setInput("");
  }

  useEffect(() => {
    if (open) {
      setTooltipVisible(false);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        (humanMode ? humanInputRef : inputRef).current?.focus();
      }, 120);
    }
  }, [open, humanMode]);

  // Auto-hide tooltip after 8 seconds
  useEffect(() => {
    const t = setTimeout(() => setTooltipVisible(false), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, humanMessages]);

  // Poll for human chat messages
  const pollHumanMessages = useCallback(async (sid: number) => {
    try {
      const since = lastPollTime ? `?visitorId=${encodeURIComponent(visitorId.current)}&since=${encodeURIComponent(lastPollTime.toISOString())}` : `?visitorId=${encodeURIComponent(visitorId.current)}`;
      const res = await fetch(`${base}/api/chat/live/${sid}/messages${since}`);
      if (!res.ok) return;
      const data = await res.json() as HumanMessage[];
      if (Array.isArray(data) && data.length > 0) {
        setHumanMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMsgs = data.filter(m => !existingIds.has(m.id));
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
        });
        setLastPollTime(new Date());
      }
      // Check session status
      const sessRes = await fetch(`${base}/api/chat/live/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: visitorId.current }),
      });
      if (sessRes.ok) {
        const sess = await sessRes.json() as { status: string; id: number };
        if (sess.status === "closed") {
          setSessionStatus("closed");
          if (pollRef.current) clearInterval(pollRef.current);
        } else {
          setSessionStatus(sess.status as "waiting" | "active");
        }
      }
    } catch { /* silent */ }
  }, [lastPollTime, base]);

  useEffect(() => {
    if (humanMode && sessionId) {
      pollRef.current = setInterval(() => pollHumanMessages(sessionId), 4000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    return undefined;
  }, [humanMode, sessionId, pollHumanMessages]);

  // ── Bot send (SSE streaming) ──────────────────────────────────────────────
  async function sendMessage(text: string = input.trim()) {
    if (!text || loading) return;

    // Handle numeric product selection
    const numMatch = text.match(/^(\d+)$/);
    if (numMatch && lastProductsRef.current.length > 0) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < lastProductsRef.current.length) {
        const selected = lastProductsRef.current[idx];
        return sendMessage(`Tell me more about: ${selected.name} (ID: ${selected.id})`);
      }
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const cartSessionId = typeof window !== "undefined" ? (localStorage.getItem("gsm_session_id") ?? undefined) : undefined;
      const botToken = typeof window !== "undefined" ? (localStorage.getItem("gsmafrica_token") ?? undefined) : undefined;

      const res = await fetch(`${base}/api/chat/bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          userEmail: isAuthenticated && user?.email ? user.email : undefined,
          isAuthenticated: isAuthenticated && !!user?.email,
          sessionId: cartSessionId,
          botToken,
        }),
      });

      if (!res.body) throw new Error("no body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";
      let finalAction: string | null = null;
      let finalActionData: Record<string, unknown> | null = null;
      let finalShowHumanButton = false;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as {
              t?: string; done?: boolean; message?: string;
              action?: string; actionData?: Record<string, unknown>;
              showHumanButton?: boolean;
            };
            if (evt.t) {
              fullText += evt.t;
              // Show text live but strip the signal token from display
              const display = fullText.replace(/\[SHOW_HUMAN_BUTTON\]/g, "").trim();
              setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: display }]);
            }
            if (evt.done) {
              if (evt.message && !fullText) fullText = evt.message;
              finalAction = evt.action ?? null;
              finalActionData = evt.actionData ?? null;
              finalShowHumanButton = evt.showHumanButton ?? fullText.includes("[SHOW_HUMAN_BUTTON]");
              break outer;
            }
          } catch { /* malformed chunk, skip */ }
        }
      }

      // Strip the signal from the final text
      const cleanText = fullText.replace(/\[SHOW_HUMAN_BUTTON\]/g, "").trim();

      // Build the final message with any action widgets attached
      const msg: ChatMessage = {
        role: "assistant",
        content: cleanText || "Done!",
        showHumanButton: finalShowHumanButton || undefined,
      };

      if (finalAction === "show_order" && finalActionData) {
        msg.orderCard = finalActionData as unknown as OrderCard;
      } else if (finalAction === "order_cancelled") {
        msg.orderCancelled = true;
      } else if (finalAction === "navigate" && finalActionData) {
        msg.navAction = finalActionData as unknown as NavAction;
      } else if (finalAction === "show_products" && finalActionData?.products) {
        const prods = finalActionData.products as ProductResult[];
        msg.products = prods;
        lastProductsRef.current = prods;
      } else if (finalAction === "show_product" && finalActionData?.product) {
        const prod = [finalActionData.product as ProductResult];
        msg.products = prod;
        lastProductsRef.current = prod;
      } else if (finalAction === "show_payment_mpesa" && finalActionData) {
        msg.paymentData = finalActionData as unknown as PaymentData;
      } else if (finalAction === "show_payment_binance" && finalActionData) {
        msg.paymentData = finalActionData as unknown as PaymentData;
      } else if (finalAction === "show_payment_usdt" && finalActionData) {
        msg.paymentData = finalActionData as unknown as PaymentData;
      } else if (finalAction === "cart_item_added" && finalActionData) {
        msg.cartAddedData = finalActionData as unknown as CartAddedData;
      } else if (finalAction === "login_success" && finalActionData) {
        const ld = finalActionData as unknown as LoginSuccessData;
        msg.loginSuccessData = ld;
        // Persist token and log user in via auth context
        login(ld.token, ld.user);
      } else if (finalAction === "password_reset_done") {
        msg.passwordResetDone = true;
      } else if (finalAction === "show_nowpayments" && finalActionData) {
        msg.nowpaymentsData = finalActionData as unknown as NowPaymentsData;
      } else if (finalAction === "show_mpesa_pending" && finalActionData) {
        msg.mpesaPendingData = finalActionData as unknown as MpesaPendingData;
      } else if (finalAction === "checkout_done" && finalActionData) {
        msg.checkoutDoneData = finalActionData as unknown as CheckoutDoneData;
      } else if (finalAction === "wallet_topup_mpesa" && finalActionData) {
        msg.walletTopUpMpesaData = finalActionData as unknown as WalletTopUpMpesaData;
      } else if (finalAction === "wallet_topup_nowpayments" && finalActionData) {
        msg.walletTopUpNowpaymentsData = finalActionData as unknown as WalletTopUpNowpaymentsData;
      } else if (finalAction === "wallet_topup_usdt" && finalActionData) {
        msg.walletTopUpUsdtData = finalActionData as unknown as WalletTopUpUsdtData;
      } else if (finalAction === "show_wallet_balance" && finalActionData) {
        msg.walletBalanceData = finalActionData as unknown as WalletBalanceData;
      } else if (finalAction === "wallet_insufficient_funds" && finalActionData) {
        msg.walletInsufficientFundsData = finalActionData as unknown as WalletInsufficientFundsData;
      }

      setMessages(prev => [...prev.slice(0, -1), msg]);

    } catch {
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  // ── Handle product number selection from widget ────────────────────────────
  function handleProductSelect(p: ProductResult) {
    void sendMessage(`Tell me more about: ${p.name} (ID: ${p.id})`);
  }

  // ── Request human (core, accepts optional guest email) ────────────────────
  async function requestHuman(guestEmail?: string) {
    if (loading) return;
    setLoading(true);
    try {
      const visitorEmail = user?.email || guestEmail || null;
      const visitorName = user?.name || user?.email?.split("@")[0] || (guestEmail ? guestEmail.split("@")[0] : null);
      const res = await fetch(`${base}/api/chat/bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestHuman: true,
          visitorId: visitorId.current,
          visitorName,
          visitorEmail,
        }),
      });
      const data = (await res.json()) as BotResponse;
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);

      const sid = data.sessionId ?? null;
      setSessionId(sid);
      setSessionStatus("waiting");
      setHumanMode(true);
      setHumanEmailStep(false);
      setCapturedEmail("");
      setLastPollTime(new Date());
      if (sid) {
        await pollHumanMessages(sid);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Please contact our support team on WhatsApp at +254756816951 for immediate help." }]);
    } finally {
      setLoading(false);
    }
  }

  // ── Initiate human request — connect immediately for everyone ─────────────
  function startHumanRequest() {
    if (loading) return;
    void requestHuman();
  }

  // ── Submit captured email then connect ────────────────────────────────────
  function submitEmailAndConnect() {
    const email = capturedEmail.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) {
      setEmailError("Please enter a valid email address.");
      emailCaptureRef.current?.focus();
      return;
    }
    setEmailError("");
    setHumanEmailStep(false);
    void requestHuman(email);
  }

  // ── Send human message ────────────────────────────────────────────────────
  async function sendHumanMessage() {
    if ((!humanInput.trim() && !humanFile) || humanSending || !sessionId) return;
    setHumanSending(true);
    try {
      let fileUrl: string | null = null;
      if (humanFile) {
        const fd = new FormData();
        fd.append("file", humanFile);
        const upRes = await fetch(`${base}/api/uploads`, { method: "POST", body: fd });
        if (upRes.ok) {
          const upData = await upRes.json() as { url?: string };
          fileUrl = upData.url ?? null;
        }
      }
      const body: Record<string, unknown> = {
        message: humanInput.trim() || (humanFile ? `[File: ${humanFile.name}]` : ""),
      };
      if (fileUrl) body.fileUrl = fileUrl;

      const res = await fetch(
        `${base}/api/chat/live/${sessionId}/messages?visitorId=${encodeURIComponent(visitorId.current)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        const msg = await res.json() as HumanMessage;
        setHumanMessages(prev => [...prev, msg]);
        setHumanInput("");
        setHumanFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setLastPollTime(new Date());
      }
    } catch { /* silent */ } finally {
      setHumanSending(false);
    }
  }

  // ── Close human chat ──────────────────────────────────────────────────────
  async function closeHumanChat() {
    if (!sessionId) { setHumanMode(false); return; }
    try {
      await fetch(
        `${base}/api/chat/live/${sessionId}?visitorId=${encodeURIComponent(visitorId.current)}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) }
      );
    } catch { /* silent */ }
    setSessionStatus("closed");
    if (pollRef.current) clearInterval(pollRef.current);
  }

  function resetToBot() {
    setHumanMode(false);
    setSessionId(null);
    setHumanMessages([]);
    setHumanInput("");
    setHumanFile(null);
    setSessionStatus("waiting");
    if (pollRef.current) clearInterval(pollRef.current);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {open && (
        <div className="fixed right-4 md:right-6 z-[300] w-[340px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ bottom: "calc(5.5rem + 4.5rem)", maxWidth: "calc(100vw - 2rem)", height: "min(560px, calc(100vh - 14rem))" }}>

          {/* ── HEADER ── */}
          {humanMode ? (
            <div className="flex items-center gap-3 px-4 py-3.5 shrink-0"
              style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                <Headphones size={17} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm leading-tight">Live Support</p>
                <div className="flex items-center gap-1.5">
                  {sessionStatus === "waiting" && <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    <span className="text-blue-300 text-[11px]">Waiting for agent…</span>
                  </>}
                  {sessionStatus === "active" && <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    <span className="text-blue-300 text-[11px]">Agent connected</span>
                  </>}
                  {sessionStatus === "closed" && <>
                    <WifiOff size={10} className="text-slate-400" />
                    <span className="text-slate-400 text-[11px]">Chat ended</span>
                  </>}
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
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
              <button onClick={startNewChat}
                title="Start new chat"
                className="text-[10px] font-bold text-white/60 hover:text-white/90 border border-white/20 rounded-lg px-2 py-1 transition-colors hover:bg-white/10">
                New Chat
              </button>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── HUMAN CHAT BODY ── */}
          {humanMode ? (
            <>
              {/* Back to bot bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-100 shrink-0">
                <button onClick={resetToBot}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline">
                  <ArrowLeft size={11} /> Back to GSMBot
                </button>
                {sessionStatus !== "closed" && (
                  <button onClick={closeHumanChat}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors">
                    End chat
                  </button>
                )}
              </div>

              {/* Human messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Headphones size={11} className="text-emerald-600" />
                  </div>
                  <div className="max-w-[85%] bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed">
                    <p className="text-[10px] font-bold text-gray-500 mb-0.5">Support Team</p>
                    You're now connected to our live support. Our team will respond shortly — usually within a few minutes.
                  </div>
                </div>

                {humanMessages.map(msg => {
                  const isAdmin = msg.senderType === "admin";
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isAdmin ? "justify-start" : "justify-end"}`}>
                      {isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <UserCheck size={11} className="text-emerald-600" />
                        </div>
                      )}
                      <div className="max-w-[85%]">
                        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isAdmin ? "bg-gray-100 text-gray-800 rounded-bl-sm" : "bg-[#1a2332] text-white rounded-br-sm"
                        }`}>
                          {isAdmin && <p className="text-[10px] font-bold text-gray-500 mb-0.5">Support Team</p>}
                          {msg.message}
                          {msg.fileUrl && (
                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                              className={`flex items-center gap-1 mt-1.5 text-[10px] font-semibold underline ${isAdmin ? "text-blue-600" : "text-blue-300"}`}>
                              <Paperclip size={9} /> View attachment
                            </a>
                          )}
                        </div>
                        <p className={`text-[9px] mt-0.5 px-1 ${isAdmin ? "text-gray-400" : "text-right text-gray-400"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!isAdmin && (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                          <User size={11} className="text-gray-500" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {sessionStatus === "closed" && (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <WifiOff size={18} className="text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 font-semibold">Chat ended</p>
                    <button onClick={resetToBot}
                      className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                      <Bot size={11} /> Back to GSMBot
                    </button>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Human input area */}
              {sessionStatus !== "closed" && (
                <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0 space-y-2">
                  <div className="flex gap-2 items-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.txt,.zip,.doc,.docx"
                      onChange={e => setHumanFile(e.target.files?.[0] || null)}
                    />
                    <button onClick={() => fileInputRef.current?.click()}
                      className={`h-9 px-2.5 rounded-xl border text-xs font-bold transition-colors shrink-0 flex items-center gap-1 ${
                        humanFile ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-400 hover:border-blue-300"
                      }`}>
                      <Paperclip size={13} />
                      {humanFile && (
                        <span className="flex items-center gap-0.5 max-w-[60px] overflow-hidden">
                          <span className="truncate text-[10px]">{humanFile.name.slice(0, 8)}</span>
                          <X size={9} onClick={e => { e.stopPropagation(); setHumanFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} />
                        </span>
                      )}
                    </button>
                    <input
                      ref={humanInputRef}
                      value={humanInput}
                      onChange={e => setHumanInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendHumanMessage(); } }}
                      placeholder="Type your message…"
                      disabled={humanSending}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 h-9"
                    />
                    <button onClick={sendHumanMessage}
                      disabled={humanSending || (!humanInput.trim() && !humanFile)}
                      className="w-9 h-9 text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
                      style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
                      {humanSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── BOT CHAT BODY ── */}
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
                      {m.products && m.products.length > 0 && (
                        <ProductsWidget products={m.products} onSelect={handleProductSelect} />
                      )}
                      {m.navAction && <NavButton action={m.navAction} onClose={() => setOpen(false)} />}
                      {m.paymentData?.method === "mpesa" && (
                        <MpesaPaymentWidget
                          data={m.paymentData}
                          onSend={phone => void sendMessage(`My M-Pesa phone is ${phone}`)}
                        />
                      )}
                      {m.paymentData?.method === "binance" && (
                        <BinancePaymentWidget data={m.paymentData} />
                      )}
                      {m.paymentData?.method === "usdt" && (
                        <UsdtPaymentWidget data={m.paymentData} />
                      )}
                      {m.cartAddedData && <CartAddedWidget data={m.cartAddedData} />}
                      {m.loginSuccessData && <LoginSuccessWidget data={m.loginSuccessData} />}
                      {m.passwordResetDone && <PasswordResetDoneWidget />}
                      {m.nowpaymentsData && <NowPaymentsWidget data={m.nowpaymentsData} />}
                      {m.mpesaPendingData && <MpesaPendingWidget data={m.mpesaPendingData} />}
                      {m.checkoutDoneData && <CheckoutDoneWidget data={m.checkoutDoneData} />}
                      {m.walletTopUpMpesaData && <WalletTopUpMpesaWidget data={m.walletTopUpMpesaData} />}
                      {m.walletTopUpNowpaymentsData && <WalletTopUpNowpaymentsWidget data={m.walletTopUpNowpaymentsData} />}
                      {m.walletTopUpUsdtData && <WalletTopUpUsdtWidget data={m.walletTopUpUsdtData} />}
                      {m.walletBalanceData && <WalletBalanceWidget data={m.walletBalanceData} />}
                      {m.walletInsufficientFundsData && (
                        <WalletInsufficientFundsWidget
                          data={m.walletInsufficientFundsData}
                          onSendMessage={text => void sendMessage(text)}
                        />
                      )}
                      {m.showHumanButton && m.role === "assistant" && (
                        <InlineHumanButton onClick={startHumanRequest} />
                      )}
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
                        {[0, 1, 2].map(j => (
                          <div key={j} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: `${j * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Suggestion chips */}
              {messages.length === 1 && !loading && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full px-2.5 py-1 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Bot input area */}
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0 space-y-2">
                {humanEmailStep ? (
                  /* ── Email capture step ── */
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                      <Mail size={11} className="shrink-0" />
                      Enter your email to connect with a human agent
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={emailCaptureRef}
                        type="email"
                        value={capturedEmail}
                        onChange={e => { setCapturedEmail(e.target.value); setEmailError(""); }}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitEmailAndConnect(); } if (e.key === "Escape") { setHumanEmailStep(false); setCapturedEmail(""); } }}
                        placeholder="your@email.com"
                        disabled={loading}
                        className={`flex-1 bg-gray-50 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 ${emailError ? "border-red-400 focus:border-red-400 focus:ring-red-300" : "border-gray-200 focus:border-blue-400 focus:ring-blue-400"}`}
                      />
                      <button onClick={submitEmailAndConnect} disabled={loading || !capturedEmail.trim()}
                        className="w-9 h-9 text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
                        style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                    {emailError && <p className="text-[11px] text-red-500 font-medium px-1">{emailError}</p>}
                    <button onClick={() => { setHumanEmailStep(false); setCapturedEmail(""); setEmailError(""); }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                      Skip — connect without email
                    </button>
                  </div>
                ) : (
                  <>
                    <button onClick={startHumanRequest} disabled={loading}
                      className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl py-1.5 transition-colors border border-slate-200 disabled:opacity-40">
                      <Phone size={11} /> Talk to a human agent
                    </button>
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
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
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Floating chat button with tooltip ── */}
      <div className="fixed z-40 bottom-[5.5rem] right-4 md:bottom-6 md:right-6 flex flex-col items-end gap-2">
        {!open && tooltipVisible && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-3.5 py-2 shadow-lg animate-fade-in"
            style={{ animationDuration: "0.3s" }}>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            <span className="text-[12px] font-semibold text-slate-700 whitespace-nowrap">We're here to help 😊</span>
            <button onClick={() => setTooltipVisible(false)}
              className="ml-1 text-gray-300 hover:text-gray-500 transition-colors">
              <X size={11} />
            </button>
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? "Close GSMBot" : "Open GSMBot"}
          className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
          {open ? <X size={22} className="text-white" /> : <MessageSquare size={24} className="text-white" />}
        </button>
      </div>
    </>
  );
}
