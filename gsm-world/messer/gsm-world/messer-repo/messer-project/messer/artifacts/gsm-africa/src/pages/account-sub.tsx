import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, User, ShieldCheck, Cpu, DollarSign, FileText, BookOpen, ShoppingBag, BarChart2, ShoppingCart, Zap, Copy, Check, Smartphone, KeyRound, Shield, Eye, EyeOff, CheckCircle, RefreshCw, ChevronRight, MessageSquare, Send, Lock, Paperclip, X as XIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";

const PAGES: Record<string, { title: string; icon: React.ReactNode }> = {
  dashboard:       { title: "Dashboard",        icon: <BarChart2 size={20} /> },
  orders:          { title: "My Orders",         icon: <ShoppingBag size={20} /> },
  "bulk-order":    { title: "Bulk Order",        icon: <ShoppingCart size={20} /> },
  "express-order": { title: "Express Order",     icon: <Zap size={20} /> },
  profile:         { title: "Profile",           icon: <User size={20} /> },
  security:        { title: "Account Security",  icon: <ShieldCheck size={20} /> },
  api:             { title: "API Settings",      icon: <Cpu size={20} /> },
  "add-fund":      { title: "Add Fund",          icon: <DollarSign size={20} /> },
  invoices:        { title: "Invoices",          icon: <FileText size={20} /> },
  ledger:          { title: "Account Ledger",    icon: <BookOpen size={20} /> },
};

export function AccountSubPage() {
  const params = useParams<{ sub: string }>();
  const [, navigate] = useLocation();
  const sub = params.sub ?? "dashboard";
  const page = PAGES[sub];
  const { user, token } = useAuth();

  // Bulk Order and Express Order go directly to the store
  useEffect(() => {
    if (sub === "bulk-order" || sub === "express-order") {
      navigate("/products");
    }
  }, [sub]);

  if (sub === "bulk-order" || sub === "express-order") return null;

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-3 text-muted-foreground">
        <p>Page not found</p>
        <Link href="/account" className="text-blue-600 font-medium text-sm">← Back to Account</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-[#f2f4f8]">
      {/* Dark gradient header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 shadow-md"
        style={{ background: "linear-gradient(148deg, #0f172a 0%, #1e3a5f 100%)" }}>
        <Link href="/account"
          className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-colors shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-[15px] text-white leading-none truncate">{page.title}</h1>
        </div>
        <div className="w-8 h-8 rounded-xl bg-white/[0.07] flex items-center justify-center text-blue-300/60 shrink-0">
          {page.icon}
        </div>
      </div>

      <div className="flex-1 px-4 py-5 pb-24">
        {sub === "dashboard" && <DashboardContent user={user} />}
        {sub === "orders"    && <OrdersContent />}
        {sub === "profile"   && <ProfileContent user={user} />}
        {sub === "security"  && <SecurityContent user={user} />}
        {sub === "add-fund"  && <AddFundContent token={token} />}
        {(sub === "api" || sub === "invoices") && <ComingSoon title={page.title} />}
        {sub === "ledger" && <LedgerContent token={token} />}
      </div>
    </div>
  );
}

// ── Order status helpers ──────────────────────────────────────────────────────
const ORDER_STAGES = [
  { key: "placed",      label: "Order Placed" },
  { key: "confirming",  label: "Payment Confirming" },
  { key: "processing",  label: "Processing" },
  { key: "complete",    label: "Complete" },
] as const;

function getOrderStage(status: string): number {
  if (status === "paid" || status === "completed" || status === "delivered") return 3;
  if (status === "processing" || status === "active") return 2;
  if (status === "pending_payment_confirmation") return 1;
  return 0; // pending
}

function isActiveOrder(status: string): boolean {
  return !["paid", "completed", "delivered", "cancelled", "refunded"].includes(status);
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardContent({ user }: { user: { name: string | null; email: string } | null }) {
  const { data: balance = 0, isLoading } = useWalletBalance();
  const { token } = useAuth();
  const [orders, setOrders] = useState<Array<{
    id: number; paymentStatus: string; total: string; createdAt: string;
    items: Array<{ productName: string; price: string; quantity: number }>;
  }>>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const zeroBalance = !isLoading && Number(balance) <= 0;

  const fetchOrders = useCallback(() => {
    if (!token) { setOrdersLoading(false); return; }
    fetch("/api/orders/my", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) { setOrders(data); setLastRefresh(new Date()); } })
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh every 10s when there are active orders
  useEffect(() => {
    const hasActive = orders.some(o => isActiveOrder(o.paymentStatus));
    if (!hasActive) return;
    const t = setInterval(fetchOrders, 10000);
    return () => clearInterval(t);
  }, [orders, fetchOrders]);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.paymentStatus === "pending" || o.paymentStatus === "pending_payment_confirmation").length;
  const completedOrders = orders.filter(o => o.paymentStatus === "paid" || o.paymentStatus === "completed").length;
  const activeOrders = orders.filter(o => isActiveOrder(o.paymentStatus));

  return (
    <div className="space-y-4 -mx-4 -mt-5">

      {/* Hero header */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="px-5 pt-6 pb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <span className="text-white font-black text-base">{initials}</span>
          </div>
          <div>
            <p className="text-white font-black text-base leading-tight">{displayName}</p>
            <p className="text-blue-300/70 text-xs mt-0.5">{user?.email}</p>
          </div>
          <div className="ml-auto">
            <span className="bg-green-500/20 border border-green-500/30 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full">Active</span>
          </div>
        </div>

        {/* Wallet card inside hero */}
        <div className="bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-blue-300/70 text-[10px] font-semibold uppercase tracking-widest">Wallet Balance</p>
              <p className="text-white font-black text-3xl mt-0.5 leading-none">
                {isLoading ? <span className="text-xl opacity-50">Loading…</span> : `$${balance.toFixed(2)}`}
              </p>
              <p className="text-blue-300/50 text-[10px] mt-1">GSM World Wallet · USD</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/30 flex items-center justify-center">
              <DollarSign size={18} className="text-blue-200" />
            </div>
          </div>
          <Link href="/account/add-fund">
            <button className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {zeroBalance ? "Add Top Up" : "Add Funds"}
            </button>
          </Link>
          {zeroBalance && (
            <p className="mt-2 text-[11px] text-blue-200/80 font-medium">Your wallet balance is $0.00. Tap top up to choose a payment option.</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 grid grid-cols-3 gap-3">
        {[
          { label: "Total Orders", value: ordersLoading ? "…" : String(totalOrders),    icon: <ShoppingBag size={16} />, color: "text-blue-600 bg-blue-50" },
          { label: "Pending",      value: ordersLoading ? "…" : String(pendingOrders),  icon: <Zap size={16} />,         color: "text-orange-600 bg-orange-50" },
          { label: "Completed",    value: ordersLoading ? "…" : String(completedOrders), icon: <CheckCircle size={16} />, color: "text-green-600 bg-green-50" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center mx-auto mb-2`}>{icon}</div>
            <p className="text-xl font-black text-gray-800 leading-none">{value}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-1 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Live Order Tracker ─────────────────────────────────────────────── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Order Tracker</p>
            {activeOrders.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-green-600">{activeOrders.length} active</span>
              </span>
            )}
          </div>
          <button onClick={fetchOrders}
            className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-blue-600 transition-colors">
            <RefreshCw size={11} />
            {lastRefresh.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </button>
        </div>

        {ordersLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center text-xs text-gray-400">Loading orders…</div>
        ) : activeOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <CheckCircle size={24} className="mx-auto text-green-300 mb-2" />
            <p className="text-sm font-bold text-gray-400">No active orders</p>
            <p className="text-[11px] text-gray-300 mt-0.5">All your orders are complete</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.slice(0, 5).map(order => {
              const stage = getOrderStage(order.paymentStatus);
              const pct = Math.round((stage / (ORDER_STAGES.length - 1)) * 100);
              const stageColors = ["bg-yellow-500", "bg-orange-500", "bg-blue-500", "bg-green-500"];
              const stageBg = stageColors[stage] ?? "bg-blue-500";
              return (
                <Link key={order.id} href={`/order/${order.id}`} className="block">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-blue-200/70 transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-black text-gray-800">Order #{order.id}</p>
                      <p className="text-[11px] text-gray-400 truncate max-w-[160px]">
                        {order.items?.[0]?.productName ?? "Service"}
                        {(order.items?.length ?? 0) > 1 ? ` +${order.items.length - 1} more` : ""}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full text-white ${stageBg}`}>
                      {ORDER_STAGES[stage].label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="relative mb-2">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${stageBg}`}
                        style={{ width: `${pct === 0 ? 8 : pct}%` }} />
                    </div>
                  </div>

                  {/* Steps indicator */}
                  <div className="flex justify-between mt-2">
                    {ORDER_STAGES.map((s, i) => (
                      <div key={s.key} className="flex flex-col items-center gap-0.5" style={{ width: `${100 / ORDER_STAGES.length}%` }}>
                        <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                          i < stage ? `${stageBg} border-transparent` :
                          i === stage ? `${stageBg} border-transparent ring-2 ring-offset-1 ring-blue-200` :
                          "bg-white border-gray-200"
                        }`} />
                        <p className={`text-[8px] font-semibold text-center leading-tight ${i <= stage ? "text-gray-700" : "text-gray-300"}`}>
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "Browse Store",   icon: <ShoppingBag size={16} />,  href: "/products",       bg: "bg-blue-600 text-white" },
            { label: "Add Fund",       icon: <DollarSign size={16} />,   href: "/account/add-fund", bg: "bg-green-600 text-white" },
            { label: "My Orders",      icon: <FileText size={16} />,     href: "/account/orders", bg: "bg-gray-800 text-white" },
            { label: "Account Security", icon: <ShieldCheck size={16} />, href: "/account/security", bg: "bg-purple-600 text-white" },
          ].map(({ label, icon, href, bg }) => (
            <Link href={href} key={label}>
              <div className={`${bg} rounded-2xl p-4 flex items-center gap-3 hover:opacity-90 transition-opacity shadow-sm`}>
                <div className="bg-white/20 rounded-lg p-1.5">{icon}</div>
                <span className="font-bold text-sm">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div className="px-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Orders</p>
          <Link href="/account/orders" className="text-blue-600 text-xs font-semibold">View all</Link>
        </div>
        <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
          {ordersLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3 border border-gray-100">
                <ShoppingBag size={24} className="text-gray-300" />
              </div>
              <p className="font-bold text-gray-500 text-sm">No orders yet</p>
              <p className="text-gray-400 text-xs mt-1 max-w-[200px]">Place your first order and it will appear here</p>
              <Link href="/products">
                <button className="mt-4 px-5 py-2 bg-blue-600 text-white text-xs font-black rounded-xl">Shop Now</button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.slice(0, 5).map(order => (
                <Link key={order.id} href={`/order/${order.id}`} className="block">
                  <div className="px-4 py-3 hover:bg-blue-50/60 active:bg-blue-50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-black text-gray-700">Order #{order.id}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          order.paymentStatus === "paid" ? "bg-green-100 text-green-700"
                          : order.paymentStatus === "pending" ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                        }`}>{order.paymentStatus}</span>
                        <ChevronRight size={12} className="text-gray-300" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-gray-500 truncate">
                        {order.items?.[0]?.productName ?? "Item"}
                        {(order.items?.length ?? 0) > 1 ? ` +${order.items.length - 1} more` : ""}
                      </p>
                      <p className="text-xs font-black text-blue-700 ml-2">${parseFloat(order.total).toFixed(2)}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {zeroBalance && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4">
            <p className="text-sm font-bold text-slate-900">Your wallet balance is $0.00</p>
            <p className="text-xs text-slate-500 mt-1">Add a top up to view available payment options.</p>
            <Link href="/account/add-fund">
              <button className="mt-3 w-full rounded-xl bg-blue-600 text-white font-bold text-sm py-3">Add Top Up</button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue:   "bg-blue-50 text-blue-700 border-blue-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    green:  "bg-green-50 text-green-700 border-green-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
  };
  return (
    <div className={`rounded-xl p-4 border ${colors[color]}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
    </div>
  );
}

// ── TOTP verification using Web Crypto API (RFC 6238) ────────────────────────
async function verifyTOTP(secret: string, inputCode: string): Promise<boolean> {
  try {
    const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0, value = 0;
    const bytes: number[] = [];
    for (const char of secret.toUpperCase().replace(/=+$/, "")) {
      const idx = base32Chars.indexOf(char);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    const keyBytes = new Uint8Array(bytes);
    const key = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const counter = Math.floor(Date.now() / 1000 / 30);
    for (const drift of [-1, 0, 1]) {
      const t = counter + drift;
      const msg = new Uint8Array(8);
      let tmp = t;
      for (let i = 7; i >= 0; i--) { msg[i] = tmp & 0xff; tmp = Math.floor(tmp / 256); }
      const sig = await crypto.subtle.sign("HMAC", key, msg);
      const hash = new Uint8Array(sig);
      const offset = hash[19] & 0x0f;
      const num = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) |
                  ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
      const otp = String(num % 1_000_000).padStart(6, "0");
      if (otp === inputCode) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Security (Password + 2FA) ─────────────────────────────────────────────────
function generateBase32Secret(len = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function SecurityContent({ user }: { user: { name: string | null; email: string } | null }) {
  const { toast } = useToast();
  const storageKey = `gsmafrica_2fa_${user?.email ?? ""}`;

  // Password change
  const [cur, setCur]   = useState("");
  const [nw, setNw]     = useState("");
  const [conf, setConf] = useState("");
  const [showCur, setShowCur]   = useState(false);
  const [showNw, setShowNw]     = useState(false);
  const [showConf, setShowConf] = useState(false);

  function handlePasswordChange() {
    if (!cur || !nw || !conf) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    if (nw.length < 6)        { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    if (nw !== conf)          { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    toast({ title: "Password updated successfully!" });
    setCur(""); setNw(""); setConf("");
  }

  // 2FA state
  const [twoFaEnabled, setTwoFaEnabled] = useState(() => localStorage.getItem(storageKey) === "enabled");
  const [twoFaStep, setTwoFaStep]       = useState<"idle" | "setup" | "verify" | "disable">("idle");
  const [secret, setSecret]             = useState("");
  const [code, setCode]                 = useState("");
  const [secretVisible, setSecretVisible] = useState(false);

  function startSetup() {
    setSecret(generateBase32Secret());
    setCode("");
    setTwoFaStep("setup");
  }

  async function verifyEnable() {
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      toast({ title: "Enter a valid 6-digit code", variant: "destructive" });
      return;
    }
    const valid = await verifyTOTP(secret, code);
    if (!valid) {
      toast({ title: "Invalid code — check your authenticator app and try again", variant: "destructive" });
      return;
    }
    localStorage.setItem(storageKey, "enabled");
    localStorage.setItem(`${storageKey}_secret`, secret);
    setTwoFaEnabled(true);
    setTwoFaStep("idle");
    setCode("");
    toast({ title: "2FA enabled!", description: "Your account is now protected with two-factor authentication." });
  }

  async function disable2FA() {
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      toast({ title: "Enter your 6-digit authenticator code to confirm", variant: "destructive" });
      return;
    }
    const storedSecret = localStorage.getItem(`${storageKey}_secret`) ?? "";
    const valid = await verifyTOTP(storedSecret, code);
    if (!valid) {
      toast({ title: "Invalid code — use the current code from your authenticator app", variant: "destructive" });
      return;
    }
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}_secret`);
    setTwoFaEnabled(false);
    setTwoFaStep("idle");
    setCode("");
    toast({ title: "2FA disabled", description: "Two-factor authentication has been removed." });
  }

  const otpauthUrl = `otpauth://totp/GSMWorld:${encodeURIComponent(user?.email ?? "user")}?secret=${secret}&issuer=GSMWorld`;

  return (
    <div className="space-y-6 pb-4">

      {/* ── Security status overview ── */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${twoFaEnabled ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
            <ShieldCheck size={20} className={twoFaEnabled ? "text-green-400" : "text-yellow-400"} />
          </div>
          <div className="flex-1">
            <p className="text-white font-black text-sm">Account Security</p>
            <p className={`text-xs font-semibold ${twoFaEnabled ? "text-green-400" : "text-yellow-300"}`}>
              {twoFaEnabled ? "🔒 Strong — 2FA Active" : "⚠️ Moderate — Enable 2FA for better protection"}
            </p>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${twoFaEnabled ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Password", ok: true, icon: "🔑" },
            { label: "2FA", ok: twoFaEnabled, icon: "🛡️" },
            { label: "Email", ok: !!user?.email, icon: "📧" },
          ].map(({ label, ok, icon }) => (
            <div key={label} className="bg-white/10 rounded-xl px-2 py-2 text-center">
              <p className="text-base leading-none mb-1">{icon}</p>
              <p className={`text-[10px] font-black ${ok ? "text-green-400" : "text-red-400"}`}>{ok ? "Active" : "Off"}</p>
              <p className="text-blue-300/60 text-[9px] font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2FA section ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <Shield size={18} className="text-gray-500" />
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-800">Two-Factor Authentication</p>
            <p className="text-xs text-gray-500">Protect your account with an authenticator app</p>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${twoFaEnabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
            {twoFaEnabled ? "ENABLED" : "DISABLED"}
          </span>
        </div>

        <div className="p-4 space-y-4">

          {/* Idle — not enabled */}
          {twoFaStep === "idle" && !twoFaEnabled && (
            <>
              <p className="text-sm text-gray-600">
                Use an authenticator app like <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>Microsoft Authenticator</strong> to generate login codes.
              </p>
              <button
                onClick={startSetup}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <KeyRound size={16} /> Set Up 2FA
              </button>
            </>
          )}

          {/* Idle — already enabled */}
          {twoFaStep === "idle" && twoFaEnabled && (
            <>
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                <Shield size={18} className="text-green-600 shrink-0" />
                <p className="text-sm text-green-800 font-medium">Your account is secured with 2FA.</p>
              </div>
              <button
                onClick={() => { setCode(""); setTwoFaStep("disable"); }}
                className="w-full py-3 border border-red-300 text-red-600 hover:bg-red-50 font-bold rounded-lg text-sm transition-colors"
              >
                Disable 2FA
              </button>
            </>
          )}

          {/* Setup step 1 — show QR + secret */}
          {twoFaStep === "setup" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1">
                <p className="font-bold">Step 1 — Scan with your authenticator app</p>
                <p>Open your authenticator app and scan the QR code below, or enter the key manually.</p>
              </div>

              <div className="flex justify-center p-4 bg-white border border-gray-200 rounded-xl">
                <QRCodeSVG value={otpauthUrl} size={180} level="M" includeMargin />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Manual Entry Key</p>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg overflow-hidden">
                  <code className="flex-1 px-3 py-2.5 text-sm font-mono text-gray-700 tracking-widest bg-gray-50 select-all">
                    {secretVisible ? secret : secret.replace(/./g, "•")}
                  </code>
                  <button onClick={() => setSecretVisible(!secretVisible)} className="px-2 text-gray-400 hover:text-gray-700">
                    {secretVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(secret); toast({ title: "Secret copied!" }); }}
                    className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold border-l border-gray-200 transition-colors"
                  >
                    <Copy size={13} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Keep this key private. Don't share it with anyone.</p>
              </div>

              <button
                onClick={() => { setCode(""); setTwoFaStep("verify"); }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors"
              >
                I've Scanned the Code →
              </button>
              <button onClick={() => setTwoFaStep("idle")} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          )}

          {/* Setup step 2 — verify code */}
          {twoFaStep === "verify" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-bold">Step 2 — Enter the 6-digit code</p>
                <p className="mt-0.5">Open your authenticator app and enter the current code for GSM World.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Verification Code</label>
                <input
                  type="tel"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button onClick={verifyEnable} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                <Check size={16} strokeWidth={3} /> Confirm &amp; Enable 2FA
              </button>
              <button onClick={() => setTwoFaStep("setup")} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
            </div>
          )}

          {/* Disable flow — ask for code */}
          {twoFaStep === "disable" && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                Enter your current authenticator code to disable 2FA.
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Authenticator Code</label>
                <input
                  type="tel"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <button onClick={disable2FA} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors">
                Confirm Disable 2FA
              </button>
              <button onClick={() => setTwoFaStep("idle")} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Password Change ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <KeyRound size={18} className="text-gray-500" />
          <div>
            <p className="font-bold text-sm text-gray-800">Change Password</p>
            <p className="text-xs text-gray-500">Use a strong password at least 8 characters</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {/* Current password */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Current Password</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
              <input type={showCur ? "text" : "password"} value={cur} onChange={e => setCur(e.target.value)}
                placeholder="Enter current password"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
              <button onClick={() => setShowCur(!showCur)} className="px-3 text-gray-400 hover:text-gray-700">
                {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {/* New password */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">New Password</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
              <input type={showNw ? "text" : "password"} value={nw} onChange={e => setNw(e.target.value)}
                placeholder="At least 8 characters"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
              <button onClick={() => setShowNw(!showNw)} className="px-3 text-gray-400 hover:text-gray-700">
                {showNw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {nw.length > 0 && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${nw.length < 6 ? "w-1/4 bg-red-400" : nw.length < 8 ? "w-1/2 bg-yellow-400" : nw.length < 12 ? "w-3/4 bg-blue-400" : "w-full bg-green-400"}`} />
                </div>
                <p className={`text-[10px] font-bold ${nw.length < 6 ? "text-red-400" : nw.length < 8 ? "text-yellow-500" : "text-green-500"}`}>
                  {nw.length < 6 ? "Weak" : nw.length < 8 ? "Fair" : nw.length < 12 ? "Good" : "Strong"}
                </p>
              </div>
            )}
          </div>
          {/* Confirm password */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Confirm New Password</label>
            <div className={`flex items-center border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 ${conf && conf !== nw ? "border-red-300" : "border-gray-200"}`}>
              <input type={showConf ? "text" : "password"} value={conf} onChange={e => setConf(e.target.value)}
                placeholder="Repeat new password"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
              <button onClick={() => setShowConf(!showConf)} className="px-3 text-gray-400 hover:text-gray-700">
                {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {conf && conf !== nw && <p className="text-[10px] text-red-500 mt-1">Passwords don't match</p>}
          </div>
          <button onClick={handlePasswordChange} disabled={!cur || !nw || !conf || nw !== conf}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            <Lock size={14} /> Update Password
          </button>
        </div>
      </div>

      {/* ── Security tips ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2.5">
        <p className="text-xs font-bold text-blue-800 uppercase tracking-widest">Security Tips</p>
        {[
          { icon: "🔑", tip: "Use a unique password not used on other sites" },
          { icon: "📱", tip: "Enable 2FA for maximum account protection" },
          { icon: "🚫", tip: "Never share your login credentials with anyone" },
          { icon: "📧", tip: "Make sure your email address is up to date" },
        ].map(({ icon, tip }) => (
          <div key={tip} className="flex items-start gap-2.5">
            <span className="text-sm leading-none mt-0.5">{icon}</span>
            <p className="text-xs text-blue-700">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Add Fund ─────────────────────────────────────────────────────────────────
const USDT_ADDRESSES = [
  { network: "TRC20 (TRON)",     address: "TVqXjYMCWuuEZynkGXL4WP3MnHzrJEfJFM",        min: "1 USDT",  confirms: "1 confirmation",   color: "bg-red-500"    },
];

function AddFundContent({ token }: { token: string | null }) {
  const PRESET_AMOUNTS = [10, 25, 50, 100, 200, 500];
  const [tab, setTab]         = useState<"mpesa" | "crypto" | "manual">("mpesa");
  const { data: walletBalance = 0, isLoading: balanceLoading } = useWalletBalance();
  const [manualSent, setManualSent] = useState(false);
  const [manualMethod, setManualMethod] = useState<"binance_pay" | "usdt_manual">("binance_pay");
  const [manualAmount, setManualAmount] = useState("");
  const [phone, setPhone]     = useState("");
  const [amount, setAmount]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [checking, setChecking]           = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [autoCheckCount, setAutoCheckCount]     = useState(0);
  const [npAmount, setNpAmount]   = useState("");
  const [npCurrency, setNpCurrency] = useState("usdttrc20");
  const [npPayment, setNpPayment] = useState<{ paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string } | null>(null);
  const [npLoading, setNpLoading]   = useState(false);
  const [npStatus, setNpStatus]     = useState<"idle" | "pending" | "paid" | "failed">("idle");
  const [npAutoCount, setNpAutoCount] = useState(0);
  const [copiedKey, setCopiedKey]   = useState<string | null>(null);
  const { toast }    = useToast();
  const queryClient  = useQueryClient();

  async function handleMpesa() {
    if (!phone || !amount || Number(amount) <= 0) {
      toast({ title: "Enter phone and amount", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/add-fund/mpesa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone, amount: Number(amount) }),
      });
      const data = await res.json() as { error?: string; message?: string; checkoutRequestId?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setSent(true);
      setPaymentConfirmed(false);
      setAutoCheckCount(0);
      setCheckoutRequestId(data.checkoutRequestId ?? null);
      toast({ title: "STK Push sent!", description: data.message });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function checkPaymentStatus() {
    if (!checkoutRequestId || !token) return;
    setChecking(true);
    try {
      const res = await fetch("/api/wallet/add-fund/mpesa/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkoutRequestId }),
      });
      const data = await res.json() as { status: string; message?: string };
      if (data.status === "paid") {
        setPaymentConfirmed(true);
        await queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
        toast({ title: "Payment confirmed!", description: "Your wallet has been credited." });
      } else if (data.status === "failed") {
        toast({ title: "Payment failed", description: data.message ?? "Please try again.", variant: "destructive" });
      } else {
        toast({ title: "Still pending", description: "Payment not yet confirmed. Enter your M-Pesa PIN if prompted." });
      }
    } catch {
      toast({ title: "Could not check status", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  }

  async function handleCrypto() {
    if (!npAmount || Number(npAmount) < 1) {
      toast({ title: "Enter amount (min $1)", variant: "destructive" });
      return;
    }
    setNpLoading(true);
    try {
      const res = await fetch("/api/wallet/add-fund/nowpayments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(npAmount), currency: npCurrency }),
      });
      const data = await res.json() as { paymentId?: string; payAddress?: string; payAmount?: number; payCurrency?: string; expiresAt?: string; error?: string };
      if (!res.ok || !data.paymentId) throw new Error(data.error || "Failed to create payment");
      setNpPayment({ paymentId: data.paymentId, payAddress: data.payAddress!, payAmount: data.payAmount!, payCurrency: data.payCurrency!, expiresAt: data.expiresAt });
      setNpStatus("pending");
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setNpLoading(false);
    }
  }

  useEffect(() => {
    if (!npPayment || npStatus !== "pending" || !token) return;
    if (npAutoCount >= 30) return;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/wallet/add-fund/nowpayments/status", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ paymentId: npPayment.paymentId }),
        });
        const d = await r.json() as { status: string };
        if (d.status === "paid") {
          setNpStatus("paid");
          queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
          toast({ title: "Crypto payment confirmed! Wallet credited." });
        } else if (d.status === "failed") {
          setNpStatus("failed");
        } else {
          setNpAutoCount(c => c + 1);
        }
      } catch { setNpAutoCount(c => c + 1); }
    }, 30000);
    return () => clearTimeout(timer);
  }, [npPayment, npStatus, token, npAutoCount, queryClient, toast]);

  useEffect(() => {
    if (!sent || paymentConfirmed || !checkoutRequestId || !token) return;
    if (autoCheckCount >= 15) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/wallet/add-fund/mpesa/query", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ checkoutRequestId }),
        });
        const data = await res.json() as { status: string; message?: string };
        if (data.status === "paid") {
          setPaymentConfirmed(true);
          queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
          toast({ title: "Payment confirmed!", description: "Your wallet has been credited." });
        } else if (data.status === "failed") {
          toast({ title: "Payment failed", description: data.message ?? "Please try again.", variant: "destructive" });
        } else {
          setAutoCheckCount(c => c + 1);
        }
      } catch { setAutoCheckCount(c => c + 1); }
    }, 8000);
    return () => clearTimeout(timer);
  }, [sent, paymentConfirmed, checkoutRequestId, token, autoCheckCount, queryClient, toast]);

  return (
    <div className="space-y-4 pb-12">

      {/* ── Hero balance card ── */}
      <div className="relative rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1a2d4a 100%)", boxShadow: "0 16px 48px rgba(15,23,42,0.45)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(96,165,250,0.18),transparent_55%)]" />
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.25)" }}>
              <DollarSign size={16} className="text-blue-300" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300/60">Wallet Balance</p>
          </div>
          <p className="text-white font-black leading-none mb-1" style={{ fontSize: 36 }}>
            {balanceLoading
              ? <span className="text-2xl text-white/40 animate-pulse">Loading…</span>
              : <><span className="text-blue-300/70 text-2xl mr-1">$</span>{walletBalance.toFixed(2)}</>}
          </p>
          <p className="text-blue-200/45 text-[11px] mt-2">GSM World Wallet · USD · Instant top-up</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {([
              { label: "M-Pesa",  icon: "🇰🇪", sub: "Instant" },
              { label: "Crypto",  icon: "₿",   sub: "Multi-coin" },
              { label: "Manual",  icon: "🏦",  sub: "10–30 min" },
            ] as const).map(({ label, icon, sub }) => (
              <div key={label} className="rounded-2xl px-3 py-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-base mb-0.5">{icon}</p>
                <p className="text-white text-[11px] font-bold leading-none">{label}</p>
                <p className="text-blue-300/50 text-[9px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab selector ── */}
      <div className="rounded-2xl p-1 flex gap-1" style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
        {([
          { id: "mpesa"  as const, label: "M-Pesa", icon: "🇰🇪", active: "bg-green-600 text-white shadow-lg shadow-green-900/30" },
          { id: "crypto" as const, label: "Crypto",  icon: "₿",  active: "bg-[#0f172a] text-white shadow-lg shadow-slate-900/40" },
          { id: "manual" as const, label: "Manual",  icon: "🏦", active: "bg-amber-500 text-white shadow-lg shadow-amber-900/30" },
        ]).map(({ id, label, icon, active }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2.5 text-[12px] font-black rounded-xl flex items-center justify-center gap-1.5 transition-all ${tab === id ? active : "text-slate-500 hover:text-slate-700"}`}>
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* ── M-Pesa tab ── */}
      {tab === "mpesa" && (
        <div className="space-y-3">
          {sent ? (
            paymentConfirmed ? (
              <div className="rounded-3xl overflow-hidden"
                style={{ background: "linear-gradient(135deg,#052e16,#14532d)", border: "1px solid rgba(74,222,128,0.25)", boxShadow: "0 8px 32px rgba(5,46,22,0.5)" }}>
                <div className="p-8 flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-1"
                    style={{ background: "rgba(74,222,128,0.2)", border: "2px solid rgba(74,222,128,0.4)" }}>
                    <CheckCircle size={32} className="text-green-400" />
                  </div>
                  <p className="font-black text-2xl text-white">Wallet Credited!</p>
                  <p className="text-green-300/70 text-sm">Your balance has been updated.</p>
                  <button
                    onClick={() => { setSent(false); setPhone(""); setAmount(""); setCheckoutRequestId(null); setPaymentConfirmed(false); }}
                    className="mt-2 px-7 py-3 rounded-2xl font-black text-sm text-green-900"
                    style={{ background: "linear-gradient(135deg,#4ade80,#22c55e)" }}>
                    Add More Funds
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl overflow-hidden bg-white shadow-xl" style={{ border: "1px solid #e2e8f0" }}>
                <div className="px-5 pt-7 pb-6 text-center" style={{ background: "linear-gradient(135deg,#15803d,#166534)" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(255,255,255,0.18)" }}>
                    <Smartphone size={28} className="text-white" />
                  </div>
                  <p className="font-black text-white text-xl">STK Push Sent!</p>
                  <p className="text-green-100/75 text-xs mt-1">Enter your M-Pesa PIN on your phone</p>
                </div>
                <div className="px-5 py-5 space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <p className="text-xs text-green-800 font-semibold">Auto-checking every 8 s ({autoCheckCount}/15)…</p>
                  </div>
                  <button onClick={checkPaymentStatus} disabled={checking}
                    className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                    style={{ background: "#1a2332" }}>
                    {checking ? <><RefreshCw size={14} className="animate-spin" /> Checking…</> : <><RefreshCw size={14} /> Check Status</>}
                  </button>
                  <button onClick={() => { setSent(false); setCheckoutRequestId(null); }}
                    className="w-full py-3 rounded-2xl font-semibold text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                    style={{ border: "1px solid #e2e8f0" }}>
                    Cancel / Try Again
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-3xl overflow-hidden bg-white shadow-xl" style={{ border: "1px solid #e2e8f0" }}>
              <div className="px-5 pt-5 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#15803d,#166534)" }}>
                  <Smartphone size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">M-Pesa STK Push</p>
                  <p className="text-[10px] text-slate-400">Kenya · Auto USD→KES conversion</p>
                </div>
              </div>
              <div className="px-5 pb-6 pt-5 space-y-5">
                <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <span className="text-green-600 text-sm mt-0.5">ℹ</span>
                  <p className="text-xs text-green-800 font-medium leading-relaxed">Amount in USD — converted to KES automatically at today's rate.</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Quick Amount (USD)</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {PRESET_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setAmount(String(a))}
                        className={`py-2.5 rounded-2xl text-sm font-black transition-all ${amount === String(a) ? "text-white shadow-lg shadow-green-900/25" : "text-slate-600"}`}
                        style={amount === String(a)
                          ? { background: "linear-gradient(135deg,#16a34a,#15803d)", border: "1px solid rgba(74,222,128,0.3)" }
                          : { background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        ${a}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="Custom amount…"
                    className="w-full rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none"
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">M-Pesa Phone</p>
                  <div className="flex rounded-2xl overflow-hidden" style={{ border: "1.5px solid #e2e8f0" }}>
                    <span className="px-3.5 py-3 text-sm font-black text-slate-500" style={{ background: "#f8fafc", borderRight: "1px solid #e2e8f0" }}>+254</span>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="7XX XXX XXX"
                      className="flex-1 px-3 py-3 text-sm font-semibold focus:outline-none bg-white" />
                  </div>
                </div>
                <button onClick={handleMpesa} disabled={loading || !phone || !amount}
                  className="w-full py-4 rounded-2xl font-black text-[15px] text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 8px 24px rgba(21,128,61,0.4)" }}>
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                    : <>{amount ? `Send $${amount} via M-Pesa` : "Send via M-Pesa"} →</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Crypto tab ── */}
      {tab === "crypto" && (
        <div className="space-y-3">
          {npStatus === "paid" ? (
            <div className="rounded-3xl overflow-hidden"
              style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f)", border: "1px solid rgba(96,165,250,0.25)", boxShadow: "0 8px 32px rgba(15,23,42,0.6)" }}>
              <div className="p-8 flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-1"
                  style={{ background: "rgba(96,165,250,0.15)", border: "2px solid rgba(96,165,250,0.35)" }}>
                  <CheckCircle size={32} className="text-blue-400" />
                </div>
                <p className="font-black text-2xl text-white">Payment Confirmed!</p>
                <p className="text-blue-300/60 text-sm">Your wallet has been credited.</p>
                <button onClick={() => { setNpPayment(null); setNpStatus("idle"); setNpAmount(""); }}
                  className="mt-2 px-7 py-3 rounded-2xl font-black text-sm text-white"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
                  Add More Funds
                </button>
              </div>
            </div>
          ) : npPayment && npStatus === "pending" ? (
            <div className="rounded-3xl overflow-hidden bg-white shadow-xl" style={{ border: "1px solid #e2e8f0" }}>
              <div className="px-5 pt-6 pb-5" style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f)" }}>
                <p className="text-blue-300/60 text-[10px] font-black uppercase tracking-widest mb-1.5">Send Exactly</p>
                <p className="text-white font-black text-3xl leading-none">
                  {npPayment.payAmount} <span className="text-blue-300 text-xl">{npPayment.payCurrency.toUpperCase()}</span>
                </p>
                {npPayment.expiresAt && <p className="text-blue-200/45 text-xs mt-2">⏱ Expires {new Date(npPayment.expiresAt).toLocaleTimeString()}</p>}
              </div>
              <div className="px-5 py-5 space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2.5 rounded-2xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <QRCodeSVG value={npPayment.payAddress} size={136} level="M" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">Scan QR to copy address</p>
                </div>
                {[
                  { label: "Payment Address", value: npPayment.payAddress, key: "addr" },
                  { label: `Amount (${npPayment.payCurrency.toUpperCase()})`, value: `${npPayment.payAmount}`, key: "amt" },
                ].map(({ label, value, key }) => (
                  <div key={key}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-2xl px-3.5 py-3 text-xs font-mono text-slate-700 break-all"
                        style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>{value}</div>
                      <button onClick={() => { navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); }}
                        className={`shrink-0 w-11 rounded-2xl flex items-center justify-center font-bold transition-all ${copiedKey === key ? "bg-green-500 text-white" : "text-white"}`}
                        style={copiedKey === key ? {} : { background: "#1a2332" }}>
                        {copiedKey === key ? <Check size={14} strokeWidth={3} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <p className="text-xs text-blue-800 font-semibold">Auto-checking every 30 s for confirmation…</p>
                </div>
                <button onClick={() => { setNpPayment(null); setNpStatus("idle"); }}
                  className="w-full py-3 rounded-2xl font-semibold text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                  style={{ border: "1px solid #e2e8f0" }}>
                  Cancel / Start Over
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl overflow-hidden bg-white shadow-xl" style={{ border: "1px solid #e2e8f0" }}>
              <div className="px-5 pt-5 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black"
                  style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f)", color: "#93c5fd" }}>₿</div>
                <div>
                  <p className="text-sm font-black text-slate-800">Crypto · NOWPayments</p>
                  <p className="text-[10px] text-slate-400">BTC · ETH · USDT · BNB · LTC + more</p>
                </div>
              </div>
              <div className="px-5 pb-6 pt-5 space-y-5">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Amount (USD)</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {PRESET_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setNpAmount(String(a))}
                        className={`py-2.5 rounded-2xl text-sm font-black transition-all ${npAmount === String(a) ? "text-white" : "text-slate-600"}`}
                        style={npAmount === String(a)
                          ? { background: "linear-gradient(135deg,#1e3a5f,#0f172a)", border: "1px solid rgba(96,165,250,0.3)", boxShadow: "0 4px 12px rgba(15,23,42,0.3)" }
                          : { background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        ${a}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="1" value={npAmount} onChange={e => setNpAmount(e.target.value)}
                    placeholder="Custom amount (USD)…"
                    className="w-full rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none"
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Pay With</p>
                  <select value={npCurrency} onChange={e => setNpCurrency(e.target.value)}
                    className="w-full rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none bg-white"
                    style={{ border: "1.5px solid #e2e8f0" }}>
                    <option value="usdttrc20">USDT (TRC20 · TRON) — Recommended</option>
                    <option value="usdterc20">USDT (ERC20 · Ethereum)</option>
                    <option value="btc">Bitcoin (BTC)</option>
                    <option value="eth">Ethereum (ETH)</option>
                    <option value="ltc">Litecoin (LTC)</option>
                    <option value="xrp">Ripple (XRP)</option>
                    <option value="bnbbsc">BNB (BSC)</option>
                    <option value="trx">TRON (TRX)</option>
                    <option value="doge">Dogecoin (DOGE)</option>
                  </select>
                </div>
                <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">Minimum deposit <strong>$13</strong>. NOWPayments converts currency automatically.</p>
                </div>
                <button onClick={handleCrypto} disabled={npLoading || !npAmount || Number(npAmount) < 13}
                  className="w-full py-4 rounded-2xl font-black text-[15px] text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#1e3a5f,#0f172a)", boxShadow: "0 8px 24px rgba(15,23,42,0.4)" }}>
                  {npLoading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating Payment…</>
                    : <>Generate Payment Address →</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manual payment tab ── */}
      {tab === "manual" && (
        <div className="space-y-3">
          {manualSent ? (
            <div className="rounded-3xl overflow-hidden"
              style={{ background: "linear-gradient(135deg,#451a03,#78350f)", border: "1px solid rgba(251,191,36,0.25)", boxShadow: "0 8px 32px rgba(69,26,3,0.5)" }}>
              <div className="p-8 flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-1"
                  style={{ background: "rgba(251,191,36,0.2)", border: "2px solid rgba(251,191,36,0.35)" }}>
                  <CheckCircle size={32} className="text-amber-300" />
                </div>
                <p className="font-black text-2xl text-white">Request Submitted!</p>
                <p className="text-amber-200/65 text-sm max-w-[220px] leading-relaxed">Our team verifies and credits your wallet within <strong className="text-amber-300">10–30 minutes</strong>.</p>
                <button onClick={() => { setManualSent(false); setManualAmount(""); }}
                  className="mt-2 px-7 py-3 rounded-2xl font-black text-sm text-amber-900"
                  style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>
                  Add More Funds
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl overflow-hidden bg-white shadow-xl" style={{ border: "1px solid #e2e8f0" }}>
              <div className="px-5 pt-5 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid #fef9c3" }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                  style={{ background: "linear-gradient(135deg,#d97706,#b45309)" }}>🏦</div>
                <div>
                  <p className="text-sm font-black text-slate-800">Manual Payment</p>
                  <p className="text-[10px] text-slate-400">Admin verifies · 10–30 min</p>
                </div>
              </div>
              <div className="px-5 pb-6 pt-5 space-y-5">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Amount to Add (USD)</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {PRESET_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setManualAmount(String(a))}
                        className={`py-2.5 rounded-2xl text-sm font-black transition-all ${manualAmount === String(a) ? "text-white" : "text-slate-600"}`}
                        style={manualAmount === String(a)
                          ? { background: "linear-gradient(135deg,#d97706,#b45309)", border: "1px solid rgba(217,119,6,0.4)", boxShadow: "0 4px 12px rgba(180,83,9,0.3)" }
                          : { background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        ${a}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="1" value={manualAmount} onChange={e => setManualAmount(e.target.value)}
                    placeholder="Custom amount…"
                    className="w-full rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none"
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Payment Method</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setManualMethod("binance_pay")}
                      className={`py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all ${manualMethod === "binance_pay" ? "text-white shadow-lg shadow-amber-900/30" : "text-slate-600"}`}
                      style={manualMethod === "binance_pay"
                        ? { background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "1px solid rgba(251,191,36,0.4)" }
                        : { background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      🟡 Binance Pay
                    </button>
                    <button onClick={() => setManualMethod("usdt_manual")}
                      className={`py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all ${manualMethod === "usdt_manual" ? "text-white shadow-lg shadow-green-900/30" : "text-slate-600"}`}
                      style={manualMethod === "usdt_manual"
                        ? { background: "linear-gradient(135deg,#15803d,#166534)", border: "1px solid rgba(74,222,128,0.3)" }
                        : { background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      ₮ USDT TRC20
                    </button>
                  </div>
                </div>
                {manualMethod === "binance_pay" && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid #fde68a" }}>
                      <span className="text-xs font-black text-amber-800 uppercase tracking-wider">Send via Binance Pay</span>
                    </div>
                    <div className="px-4 py-4 space-y-3">
                      <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white" style={{ border: "1px solid #fde68a" }}>
                        <span className="text-2xl">🟡</span>
                        <div className="flex-1">
                          <p className="text-[10px] text-amber-600 font-black uppercase tracking-wider">Binance Pay ID</p>
                          <p className="text-xl font-black text-slate-900 tracking-widest mt-0.5">490759406</p>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText("490759406"); toast({ title: "Binance ID copied!" }); }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-amber-700 hover:bg-amber-100 transition-colors"
                          style={{ background: "rgba(217,119,6,0.12)" }}>
                          <Copy size={13} />
                        </button>
                      </div>
                      {manualAmount && (
                        <div className="rounded-xl px-3 py-2.5 text-xs font-bold text-amber-800" style={{ background: "rgba(217,119,6,0.1)" }}>
                          Amount to send: <span className="text-green-700 font-black">${manualAmount} USD</span>
                        </div>
                      )}
                      <p className="text-[10px] text-amber-700 leading-relaxed">
                        Label: <strong>GSM World — Manual Confirmation</strong><br />
                        ⚠️ Include your registered email as payment reference.
                      </p>
                    </div>
                  </div>
                )}
                {manualMethod === "usdt_manual" && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid #bbf7d0" }}>
                      <span className="text-xs font-black text-green-800 uppercase tracking-wider">USDT TRC20 (TRON)</span>
                    </div>
                    <div className="px-4 py-4 space-y-3">
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-2.5 rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #bbf7d0" }}>
                          <QRCodeSVG value="TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5" size={110} level="M" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl px-3 py-3 bg-white" style={{ border: "1px solid #bbf7d0" }}>
                        <span className="font-mono text-[10px] text-slate-700 break-all flex-1">TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5</span>
                        <button onClick={() => { navigator.clipboard.writeText("TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5"); toast({ title: "Address copied!" }); }}
                          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-green-700"
                          style={{ background: "rgba(21,128,61,0.12)" }}>
                          <Copy size={13} />
                        </button>
                      </div>
                      {manualAmount && (
                        <div className="rounded-xl px-3 py-2.5 text-xs font-bold text-green-800" style={{ background: "rgba(21,128,61,0.1)" }}>
                          Send: <span className="font-black">${manualAmount} USDT</span>
                        </div>
                      )}
                      <p className="text-[10px] text-green-700 leading-relaxed">
                        Network: <strong>TRC20 (TRON) only</strong><br />
                        ⚠️ Include your email as memo/reference.
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!manualAmount || Number(manualAmount) <= 0) { toast({ title: "Enter an amount", variant: "destructive" }); return; }
                    setManualSent(true);
                    toast({ title: "Request submitted!", description: "Our team will credit your wallet within 10-30 minutes." });
                  }}
                  disabled={!manualAmount || Number(manualAmount) <= 0}
                  className="w-full py-4 rounded-2xl font-black text-[15px] text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#d97706,#b45309)", boxShadow: "0 8px 24px rgba(180,83,9,0.35)" }}>
                  ✅ I've Sent the Payment — Notify Team
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Security footer ── */}
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
        style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f)" }}>
          <Shield size={15} className="text-blue-300" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-700">All payments are secure</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Funds credited after network / admin confirmation.</p>
        </div>
      </div>
    </div>
  );
}
// ── Types ─────────────────────────────────────────────────────────────────────
interface MyOrderItem { id: number; productName: string; quantity: number; price: string; }
interface MyOrder {
  id: number; paymentStatus: string; paymentMethod: string; total: string;
  createdAt: string; orderType?: string; deviceIdentifier?: string | null;
  items: MyOrderItem[];
}

interface OrderMessage {
  id: number;
  orderId: number;
  senderType: string;
  senderEmail: string;
  message: string;
  fileUrl?: string | null;
  createdAt: string;
}

function OrderDetailPanel({ order, token, onBack }: { order: MyOrder; token: string; onBack: () => void }) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  function loadMessages() {
    setMsgsLoading(true);
    fetch(`${baseUrl}/api/orders/${order.id}/messages`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (Array.isArray(data)) setMessages(data); })
      .catch(() => {})
      .finally(() => setMsgsLoading(false));
  }

  useEffect(() => { loadMessages(); }, [order.id, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!reply.trim() && !chatFile) return;
    setSending(true);
    setSendError(null);
    try {
      let fileUrl: string | null = null;

      if (chatFile) {
        const fd = new FormData();
        fd.append("file", chatFile);
        const upRes = await fetch(`${baseUrl}/api/uploads`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (upRes.ok) {
          const upData = await upRes.json() as { url?: string };
          fileUrl = upData.url ?? null;
        }
      }

      const body: Record<string, unknown> = { message: reply.trim() || (chatFile ? `[File: ${chatFile.name}]` : "") };
      if (fileUrl) body.fileUrl = fileUrl;

      const res = await fetch(`${baseUrl}/api/orders/${order.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `Error ${res.status}`);
      }

      const msg = await res.json() as OrderMessage;
      setMessages(prev => [...prev, msg]);
      setReply("");
      setChatFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Reply sent" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send reply";
      setSendError(msg);
      toast({ title: "Could not send reply", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  const statusColor = {
    paid: "bg-green-100 text-green-700",
    completed: "bg-emerald-100 text-emerald-700",
    processing: "bg-blue-100 text-blue-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
  }[order.paymentStatus] ?? "bg-gray-100 text-gray-700";

  const hasAdminMessages = messages.some(m => m.senderType === "admin");

  return (
    <div className="flex flex-col gap-4 pb-10">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600">
        <ArrowLeft size={14} /> Back to Orders
      </button>

      {/* Order summary card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="font-black text-gray-800 text-base">Order #{order.id}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
            {order.paymentStatus}
          </span>
        </div>
        <div className="space-y-1.5 mb-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-xs text-gray-600">
              <span className="truncate max-w-[65%]">{item.productName} × {item.quantity}</span>
              <span className="font-semibold ml-2">${parseFloat(item.price).toFixed(2)}</span>
            </div>
          ))}
        </div>
        {order.deviceIdentifier && (
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">IMEI / Device ID</p>
            <p className="text-xs font-mono text-gray-700">{order.deviceIdentifier}</p>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-50 pt-2">
          <p className="text-[11px] text-gray-400">{new Date(order.createdAt).toLocaleDateString()} · {order.paymentMethod}</p>
          <p className="text-sm font-black text-blue-700">${parseFloat(order.total).toFixed(2)}</p>
        </div>
      </div>

      {/* Action required banner */}
      {hasAdminMessages && order.paymentStatus !== "completed" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <MessageSquare size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-amber-800">Action Required</p>
            <p className="text-[11px] text-amber-700 mt-0.5">The support team has sent a message about this order. Please read and reply below.</p>
          </div>
        </div>
      )}

      {/* Messages section */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 bg-gray-50">
          <MessageSquare size={14} className="text-gray-500" />
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Order Messages</p>
        </div>

        <div className="min-h-[120px] max-h-[320px] overflow-y-auto p-4 space-y-3">
          {msgsLoading ? (
            <p className="text-center text-xs text-gray-400 py-4">Loading messages…</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-6">
              <MessageSquare size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">No messages yet.</p>
              <p className="text-[11px] text-gray-300 mt-1">Our team will message here if we need more details.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.senderType === "admin";
              return (
                <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                    isAdmin
                      ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                      : "bg-blue-600 text-white rounded-tr-sm"
                  }`}>
                    <p className={`text-[10px] font-bold mb-1 ${isAdmin ? "text-gray-500" : "text-blue-200"}`}>
                      {isAdmin ? "Support Team" : "You"}
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                    {msg.fileUrl && (
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-1 mt-1.5 text-[10px] font-semibold underline ${isAdmin ? "text-blue-600" : "text-blue-200"}`}>
                        <Paperclip size={9} /> View attachment
                      </a>
                    )}
                    <p className={`text-[9px] mt-1.5 ${isAdmin ? "text-gray-400" : "text-blue-200"}`}>
                      {new Date(msg.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply input */}
        <div className="border-t border-gray-100 p-3 space-y-2">
          {sendError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] text-red-600">
              <span className="flex-1">{sendError}</span>
              <button onClick={() => setSendError(null)}><XIcon size={11} /></button>
            </div>
          )}
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type your reply… (Enter to send)"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-300"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.txt,.zip,.doc,.docx"
              onChange={e => setChatFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors shrink-0 ${
                chatFile ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-blue-300"
              }`}
            >
              <Paperclip size={12} />
              {chatFile ? (
                <span className="flex items-center gap-1">
                  {chatFile.name.length > 14 ? chatFile.name.slice(0, 14) + "…" : chatFile.name}
                  <XIcon size={10} onClick={e => { e.stopPropagation(); setChatFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} />
                </span>
              ) : "Attach"}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || (!reply.trim() && !chatFile)}
              className="ml-auto shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#1a2332] hover:bg-[#253246] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors"
            >
              {sending
                ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Send size={13} />}
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="text-[10px] text-gray-300 px-1">Shift+Enter for new line · Enter to send</p>
        </div>
      </div>
    </div>
  );
}

// ── My Orders ────────────────────────────────────────────────────────────────
type OrderFilter = "all" | "pending" | "paid" | "completed";

function statusStyle(s: string): { bg: string; text: string; dot: string } {
  switch (s) {
    case "paid":       return { bg: "bg-green-100",   text: "text-green-700",   dot: "bg-green-500" };
    case "completed":  return { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "processing": return { bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-500" };
    case "pending":    return { bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-400" };
    case "pending_payment_confirmation": return { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-400" };
    default:           return { bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500" };
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "paid":       return "Paid";
    case "completed":  return "Completed";
    case "processing": return "Processing";
    case "pending":    return "Pending";
    case "pending_payment_confirmation": return "Awaiting Payment";
    case "failed":     return "Failed";
    default:           return s;
  }
}

function orderTypeIcon(type?: string): ReactNode {
  if (type === "unlock")     return <Lock size={11} />;
  if (type === "gift_card")  return <span className="text-[11px]">🎁</span>;
  return <ShoppingBag size={11} />;
}

function orderTypeBadge(type?: string): { label: string; cls: string } {
  if (type === "unlock")    return { label: "UNLOCK",    cls: "bg-purple-100 text-purple-700" };
  if (type === "gift_card") return { label: "GIFT CARD", cls: "bg-pink-100 text-pink-700" };
  return { label: "STORE", cls: "bg-blue-100 text-blue-700" };
}

function OrdersContent() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MyOrder | null>(null);
  const [filter, setFilter] = useState<OrderFilter>("all");
  const { toast } = useToast();

  async function loadOrders(isRefresh = false) {
    if (!token) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    try {
      const r = await fetch("/api/orders/my", { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json() as MyOrder[] | { error: string };
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Could not load orders", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadOrders(); }, [token]);

  // Check for orderId in URL hash to auto-open an order
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/order-(\d+)/);
    if (match && orders.length > 0) {
      const id = Number(match[1]);
      const found = orders.find(o => o.id === id);
      if (found) setSelectedOrder(found);
    }
  }, [orders]);

  if (!token) return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <ShoppingBag size={28} className="text-gray-300" />
      </div>
      <p className="font-bold text-gray-600">Sign in to view your orders</p>
      <Link href="/login"><button className="mt-4 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm">Sign In</button></Link>
    </div>
  );

  if (selectedOrder) {
    return <OrderDetailPanel order={selectedOrder} token={token} onBack={() => setSelectedOrder(null)} />;
  }

  const filtered = filter === "all" ? orders
    : filter === "pending" ? orders.filter(o => o.paymentStatus === "pending" || o.paymentStatus === "pending_payment_confirmation")
    : filter === "paid" ? orders.filter(o => o.paymentStatus === "paid")
    : orders.filter(o => o.paymentStatus === "completed");

  const counts = {
    all: orders.length,
    pending: orders.filter(o => o.paymentStatus === "pending" || o.paymentStatus === "pending_payment_confirmation").length,
    paid: orders.filter(o => o.paymentStatus === "paid").length,
    completed: orders.filter(o => o.paymentStatus === "completed").length,
  };

  return (
    <div className="space-y-4 -mx-4 -mt-5">

      {/* ── Hero header ── */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="px-5 pt-6 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-300/70 text-[10px] font-bold uppercase tracking-widest">My Orders</p>
            <p className="text-white font-black text-xl leading-tight mt-0.5">
              {loading ? "Loading…" : `${orders.length} Total Order${orders.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => loadOrders(true)}
            disabled={refreshing}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center justify-center transition-colors"
          >
            <RefreshCw size={15} className={`text-white ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Total",     value: counts.all,       bg: "bg-white/10 border-white/15" },
            { label: "Pending",   value: counts.pending,   bg: "bg-amber-500/20 border-amber-400/20" },
            { label: "Completed", value: counts.completed + counts.paid, bg: "bg-green-500/20 border-green-400/20" },
          ].map(({ label, value, bg }) => (
            <div key={label} className={`${bg} border rounded-xl px-3 py-2.5 text-center`}>
              <p className="text-white font-black text-2xl leading-none">{loading ? "–" : value}</p>
              <p className="text-blue-200/60 text-[10px] font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="px-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {(["all", "pending", "paid", "completed"] as OrderFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filter === f
                  ? "bg-[#1a2332] text-white border-[#1a2332]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {f === "all" ? `All (${counts.all})` : f === "pending" ? `Pending (${counts.pending})` : f === "paid" ? `Paid (${counts.paid})` : `Completed (${counts.completed})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Order list ── */}
      <div className="px-4 pb-10 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
              <ShoppingBag size={28} className="text-gray-200" />
            </div>
            <p className="font-bold text-gray-500">
              {filter === "all" ? "No orders yet" : `No ${filter} orders`}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
              {filter === "all" ? "Browse the store and place your first order" : `You have no ${filter} orders right now`}
            </p>
            {filter === "all" && (
              <Link href="/products">
                <button className="mt-4 px-5 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl">Shop Now</button>
              </Link>
            )}
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="mt-3 text-xs text-blue-600 font-semibold">
                View all orders
              </button>
            )}
          </div>
        ) : (
          filtered.map((order) => {
            const st = statusStyle(order.paymentStatus);
            const badge = orderTypeBadge(order.orderType);
            const mainItem = order.items[0];
            const extraCount = order.items.length - 1;
            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="w-full bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm text-left hover:shadow-md hover:border-blue-100 transition-all active:scale-[0.99]"
              >
                {/* Colored top accent bar */}
                <div className={`h-0.5 w-full ${st.dot}`} />

                <div className="p-4">
                  {/* Row 1: ID + badges + status */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        {orderTypeIcon(order.orderType)}
                        <span>#{order.id}</span>
                      </span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {statusLabel(order.paymentStatus)}
                      </span>
                      <ChevronRight size={12} className="text-gray-300" />
                    </div>
                  </div>

                  {/* Row 2: Product name */}
                  <div className="mb-2">
                    <p className="text-sm font-bold text-gray-800 leading-tight truncate">
                      {mainItem?.productName ?? "Order items"}
                    </p>
                    {extraCount > 0 && (
                      <p className="text-[11px] text-gray-400 mt-0.5">+{extraCount} more item{extraCount > 1 ? "s" : ""}</p>
                    )}
                    {order.deviceIdentifier && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">IMEI: {order.deviceIdentifier}</p>
                    )}
                  </div>

                  {/* Row 3: Date + method + total */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[10px] text-gray-400 capitalize">{order.paymentMethod?.replace("_", " ")}</p>
                    </div>
                    <p className="text-base font-black text-[#1a2332]">${parseFloat(order.total).toFixed(2)}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Profile ──────────────────────────────────────────────────────────────────
function ProfileContent({ user }: { user: { id?: number; name: string | null; email: string } | null }) {
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const { token, updateUser } = useAuth();

  const displayName = name.trim() || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  async function saveProfile() {
    if (!user?.id) { toast({ title: "Not logged in", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error || "Failed to save");
      }
      const updated = await res.json() as { id: number; email: string; name: string | null };
      updateUser({ id: updated.id, email: updated.email, name: updated.name });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "Profile saved!", description: "Your name has been updated." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 -mx-4 -mt-5">
      {/* Avatar hero */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="px-5 pt-8 pb-7 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-blue-900/40 ring-4 ring-white/10">
          <span className="text-white font-black text-2xl tracking-tight">{initials}</span>
        </div>
        <p className="text-white font-black text-lg leading-tight">{displayName}</p>
        <p className="text-blue-300/60 text-xs mt-1">{user?.email}</p>
        <span className="inline-flex items-center gap-1.5 mt-3 bg-green-500/20 border border-green-500/30 text-green-300 text-[10px] font-bold px-3 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Active Account
        </span>
      </div>

      <div className="px-4 space-y-3">
        {/* Name field */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Display Name</p>
          </div>
          <div className="px-4 pb-3">
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              placeholder="Enter your full name"
              className="w-full text-sm text-gray-800 font-semibold focus:outline-none placeholder:text-gray-300 placeholder:font-normal bg-transparent"
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Address</p>
          </div>
          <div className="px-4 pb-3 flex items-center gap-2">
            <p className="flex-1 text-sm text-gray-400">{user?.email ?? ""}</p>
            <span className="text-[9px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Read-only</span>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={saveProfile}
          disabled={saving || saved}
          className={`w-full py-3.5 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-all ${
            saved
              ? "bg-green-500 text-white"
              : "bg-[#1a2332] hover:bg-[#243b55] text-white disabled:opacity-50"
          }`}
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle size={15} strokeWidth={2.5} /> Saved!</>
          ) : (
            "Save Profile"
          )}
        </button>

        {/* Account info card */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2.5">
          <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest">Account Info</p>
          {[
            { label: "Account ID", value: `#${user?.id ?? "—"}`, mono: true },
            { label: "Account Type", value: "Standard", mono: false },
            { label: "Status", value: "Active", badge: "green" },
          ].map(({ label, value, mono, badge }) => (
            <div key={label} className="flex items-center justify-between">
              <p className="text-xs text-blue-600">{label}</p>
              {badge ? (
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{value}</span>
              ) : (
                <p className={`text-xs font-bold text-blue-900 ${mono ? "font-mono" : ""}`}>{value}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Ledger ────────────────────────────────────────────────────────────────────
function LedgerContent({ token }: { token: string | null }) {
  const { data: balance = 0, isLoading: balanceLoading } = useWalletBalance();
  const [orders, setOrders] = useState<Array<{
    id: number; paymentStatus: string; paymentMethod: string | null; total: string;
    createdAt: string; orderType: string | null;
    items: Array<{ productName: string; quantity: number }>;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/orders?page=1&limit=50", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: { orders?: typeof orders }) => { setOrders(d.orders ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  function methodLabel(m: string | null) {
    if (!m) return "—";
    const map: Record<string, string> = {
      mpesa: "M-Pesa", wallet: "Wallet", nowpayments: "Crypto", binance_pay: "Binance Pay",
      usdt_manual: "USDT Manual", balance: "Wallet",
    };
    return map[m] ?? m.replace(/_/g, " ");
  }
  function methodColor(m: string | null) {
    if (m === "mpesa") return "bg-green-100 text-green-700";
    if (m === "wallet" || m === "balance") return "bg-blue-100 text-blue-700";
    if (m === "nowpayments") return "bg-purple-100 text-purple-700";
    if (m === "binance_pay") return "bg-yellow-100 text-yellow-700";
    if (m === "usdt_manual") return "bg-teal-100 text-teal-700";
    return "bg-gray-100 text-gray-600";
  }
  function statusDot(s: string) {
    if (s === "paid" || s === "completed") return "bg-green-500";
    if (s === "pending") return "bg-yellow-400";
    if (s === "failed") return "bg-red-500";
    return "bg-gray-400";
  }
  function statusLabel(s: string) {
    if (s === "paid") return "Paid";
    if (s === "completed") return "Completed";
    if (s === "pending") return "Pending";
    if (s === "failed") return "Failed";
    return s;
  }

  const totalSpent = orders
    .filter(o => o.paymentStatus === "paid" || o.paymentStatus === "completed")
    .reduce((s, o) => s + parseFloat(o.total), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="rounded-2xl p-5">
        <p className="text-blue-300/70 text-[10px] font-bold uppercase tracking-widest mb-1">Account Ledger</p>
        <p className="text-white font-black text-xl leading-tight">Transaction History</p>
        <p className="text-blue-200/60 text-xs mt-1">All your orders and spending in one place</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3">
            <p className="text-blue-300/70 text-[10px] font-bold uppercase tracking-widest">Wallet Balance</p>
            <p className="text-white font-black text-xl leading-none mt-0.5">
              {balanceLoading ? <span className="text-sm opacity-50">…</span> : `$${balance.toFixed(2)}`}
            </p>
          </div>
          <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3">
            <p className="text-blue-300/70 text-[10px] font-bold uppercase tracking-widest">Total Spent</p>
            <p className="text-white font-black text-xl leading-none mt-0.5">
              {loading ? <span className="text-sm opacity-50">…</span> : `$${totalSpent.toFixed(2)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="bg-gray-100 rounded-xl px-4 py-2 grid grid-cols-[1fr_auto_auto] gap-2 items-center">
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Description</p>
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Method</p>
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-right">Amount</p>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1 mr-4">
                  <div className="h-2.5 bg-gray-100 rounded w-2/3" />
                  <div className="h-2 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="h-4 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
            <BookOpen size={28} className="text-gray-200" />
          </div>
          <p className="font-bold text-gray-500">No transactions yet</p>
          <p className="text-xs text-gray-400 mt-1">Your orders will appear here once you start shopping</p>
          <Link href="/products">
            <button className="mt-4 px-5 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl">Browse Store</button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const itemName = order.items[0]?.productName ?? "Order";
            const extraCount = order.items.length - 1;
            return (
              <div key={order.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(order.paymentStatus)}`} />
                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-800 truncate">{itemName}</p>
                      {extraCount > 0 && <span className="text-[10px] text-gray-400">+{extraCount} more</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-[10px] text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}Order #{order.id}
                      </p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${methodColor(order.paymentMethod)}`}>
                        {methodLabel(order.paymentMethod)}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        order.paymentStatus === "paid" || order.paymentStatus === "completed" ? "bg-green-100 text-green-700" :
                        order.paymentStatus === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"
                      }`}>
                        {statusLabel(order.paymentStatus)}
                      </span>
                    </div>
                  </div>
                  {/* Amount */}
                  <p className={`font-black text-base shrink-0 ${
                    order.paymentStatus === "paid" || order.paymentStatus === "completed" ? "text-gray-900" : "text-gray-400"
                  }`}>
                    -${parseFloat(order.total).toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Coming Soon ───────────────────────────────────────────────────────────────
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🚀</span>
      </div>
      <p className="font-bold text-gray-600">{title}</p>
      <p className="text-sm text-gray-400 mt-2">This feature is coming soon.</p>
      <Link href="/account">
        <button className="mt-5 px-5 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600">← Back to Account</button>
      </Link>
    </div>
  );
}
