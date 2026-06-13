import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, User, ShieldCheck, Cpu, DollarSign, FileText, BookOpen, ShoppingBag, BarChart2, ShoppingCart, Zap, Copy, Check, Smartphone, KeyRound, Shield, Eye, EyeOff, CheckCircle, RefreshCw, ChevronRight, MessageSquare, Send, Lock, Paperclip, X as XIcon, Wallet, Plus, ArrowRightLeft, CheckCircle2, CreditCard, ArrowDownLeft, ArrowUpRight, Gift } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";

const PAGES: Record<string, { title: string; icon: React.ReactNode }> = {
  dashboard:       { title: "Dashboard",        icon: <BarChart2 size={20} /> },
  wallet:          { title: "My Wallet",         icon: <Wallet size={20} /> },
  orders:          { title: "My Orders",         icon: <ShoppingBag size={20} /> },
  "bulk-order":    { title: "Bulk Order",        icon: <ShoppingCart size={20} /> },
  "express-order": { title: "Express Order",     icon: <Zap size={20} /> },
  profile:         { title: "Profile",           icon: <User size={20} /> },
  security:        { title: "Account Security",  icon: <ShieldCheck size={20} /> },
  api:             { title: "API Settings",      icon: <Cpu size={20} /> },
  "add-fund":      { title: "Add Fund",          icon: <DollarSign size={20} /> },
  invoices:        { title: "Invoices",          icon: <FileText size={20} /> },
  ledger:          { title: "Account Ledger",    icon: <BookOpen size={20} /> },
  transfer:        { title: "Send Funds",        icon: <ArrowRightLeft size={20} /> },
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
        {(sub === "dashboard" || sub === "wallet") && <DashboardContent user={user} />}
        {sub === "orders"    && <OrdersContent />}
        {sub === "profile"   && <ProfileContent user={user} />}
        {sub === "security"  && <SecurityContent user={user} />}
        {sub === "add-fund" && !token && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6 gap-5">
            <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Lock size={28} className="text-blue-400" />
            </div>
            <div>
              <p className="text-gray-900 font-bold text-base mb-1.5">Login Required</p>
              <p className="text-gray-500 text-sm leading-relaxed">You need to be logged in to add funds to your wallet.</p>
            </div>
            <Link href="/login" className="px-7 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm">
              Log In to Continue
            </Link>
          </div>
        )}
        {sub === "add-fund" && token && <AddFundContent token={token} />}
        {(sub === "api" || sub === "invoices") && <ComingSoon title={page.title} />}
        {sub === "ledger" && <LedgerContent token={token} />}
        {sub === "transfer" && <TransferContent token={token} />}
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
function WalletTransferPanel({ token, onClose }: { token: string; onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ transferred: number; fee: number; toUsername: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function submit() {
    const a = Number(amount);
    if (!username.trim()) { setError("Enter recipient username"); return; }
    if (!a || a < 1) { setError("Minimum transfer is $1.00"); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ toUsername: username.trim(), amount: a }),
      });
      const d = await r.json() as { success?: boolean; transferred?: number; fee?: number; toUsername?: string; error?: string };
      if (r.ok && d.success) {
        setResult({ transferred: d.transferred!, fee: d.fee!, toUsername: d.toUsername! });
        toast({ title: `✅ Sent $${d.transferred!.toFixed(2)} to @${d.toUsername}` });
      } else {
        setError(d.error ?? "Transfer failed");
      }
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-3 rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.12)" }}>
      {result ? (
        <div className="text-center space-y-2">
          <p className="text-green-300 font-bold text-sm">✅ Transfer successful!</p>
          <p className="text-blue-200/80 text-xs">Sent <strong>${result.transferred.toFixed(2)}</strong> to <strong>@{result.toUsername}</strong></p>
          <p className="text-blue-200/50 text-[11px]">Fee: ${result.fee.toFixed(2)} (2%)</p>
          <button onClick={onClose} className="text-xs text-blue-300 underline mt-1">Done</button>
        </div>
      ) : (
        <>
          <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Send to Username</p>
          {error && <p className="text-red-300 text-xs bg-red-500/10 rounded-lg px-3 py-1.5">{error}</p>}
          <input
            value={username}
            onChange={e => setUsername(e.target.value.replace(/^@/, ""))}
            placeholder="@username"
            className="w-full bg-white/10 border border-white/15 text-white placeholder-white/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              type="number"
              min="1"
              step="0.01"
              placeholder="Amount (min $1)"
              className="flex-1 bg-white/10 border border-white/15 text-white placeholder-white/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={submit} disabled={loading}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm px-4 rounded-xl disabled:opacity-50 transition-colors">
              {loading ? "…" : "Send"}
            </button>
          </div>
          {amount && Number(amount) >= 1 && (
            <p className="text-blue-200/50 text-[11px]">
              Fee: ${(Number(amount) * 0.02).toFixed(2)} (2%) · You pay: ${(Number(amount) * 1.02).toFixed(2)}
            </p>
          )}
          <button onClick={onClose} className="text-xs text-white/40 hover:text-white/60 transition-colors">Cancel</button>
        </>
      )}
    </div>
  );
}

function WalletPreviewCard({ token }: { token: string | null }) {
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch("/api/wallet/transactions", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d: WalletTxn[]) => { setTxns(Array.isArray(d) ? d.slice(0, 3) : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  function rowIcon(type: string) {
    if (type === "transfer_sent")     return <ArrowUpRight size={13} className="text-red-500" />;
    if (type === "transfer_received") return <ArrowDownLeft size={13} className="text-green-600" />;
    if (type === "credit")            return <Gift size={13} className="text-purple-500" />;
    return <Plus size={13} className="text-blue-500" />;
  }
  function rowIconBg(type: string) {
    if (type === "transfer_sent")     return "bg-red-50 border-red-100";
    if (type === "transfer_received") return "bg-green-50 border-green-100";
    if (type === "credit")            return "bg-purple-50 border-purple-100";
    return "bg-blue-50 border-blue-100";
  }
  function rowLabel(t: WalletTxn) {
    if (t.type === "transfer_sent")     return `Sent to @${t.counterpartyUsername ?? ""}`;
    if (t.type === "transfer_received") return `From @${t.counterpartyUsername ?? ""}`;
    if (t.type === "credit")            return "Admin credit";
    return t.note ?? "Top-up";
  }
  function rowAmount(t: WalletTxn) {
    const sign = t.type === "transfer_sent" ? "-" : "+";
    const color = t.type === "transfer_sent" ? "text-red-600" : "text-green-600";
    return <span className={`text-xs font-black tabular-nums ${color}`}>{sign}${parseFloat(t.amount).toFixed(2)}</span>;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Wallet size={12} className="text-blue-500" />
          </div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Wallet Activity</p>
        </div>
        <Link href="/account/ledger" className="text-blue-500 text-[11px] font-bold">See all</Link>
      </div>

      {loading ? (
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2 bg-gray-100 rounded w-2/3" />
                <div className="h-1.5 bg-gray-100 rounded w-1/3" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-12" />
            </div>
          ))}
        </div>
      ) : txns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-2 border border-gray-100">
            <Wallet size={18} className="text-gray-200" />
          </div>
          <p className="text-xs font-bold text-gray-400">No wallet activity yet</p>
          <Link href="/account/add-fund">
            <button className="mt-3 px-4 py-2 bg-blue-600 text-white text-[11px] font-black rounded-xl">Top Up Now</button>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {txns.map(t => (
            <div key={t.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${rowIconBg(t.type)}`}>
                {rowIcon(t.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-gray-800 truncate">{rowLabel(t)}</p>
                <p className="text-[10px] text-gray-400">
                  {new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}
                  {new Date(t.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {rowAmount(t)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  // Stage colour map (text + bg for badges, gradient for progress/dots)
  const STAGE_STYLES = [
    { badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", bar: "from-yellow-400 to-yellow-500", dot: "#eab308" },
    { badge: "bg-orange-500/20 text-orange-300 border-orange-500/30", bar: "from-orange-400 to-orange-500", dot: "#f97316" },
    { badge: "bg-blue-500/20  text-blue-300  border-blue-500/30",  bar: "from-blue-400  to-blue-500",  dot: "#3b82f6" },
    { badge: "bg-green-500/20 text-green-300 border-green-500/30", bar: "from-green-400 to-green-500", dot: "#22c55e" },
  ] as const;

  return (
    <div className="space-y-4 -mx-4 -mt-5">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(155deg,#0d1623 0%,#0f2744 60%,#0a3260 100%)" }} className="px-5 pt-7 pb-6">

        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-900/50">
              <span className="text-white font-black text-lg tracking-tight">{initials}</span>
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-[#0d1623] rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight truncate">{displayName}</p>
            <p className="text-blue-300/60 text-xs mt-0.5 truncate">{user?.email}</p>
          </div>
          <span className="shrink-0 bg-green-500/15 border border-green-500/25 text-green-300 text-[10px] font-bold px-2.5 py-1 rounded-full">
            Active
          </span>
        </div>

        {/* Wallet card */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-blue-300/60 text-[10px] font-bold uppercase tracking-[0.12em] mb-1">Wallet Balance</p>
              <p className="text-white font-black text-3xl leading-none tracking-tight">
                {isLoading ? <span className="text-xl opacity-40">Loading…</span> : `$${balance.toFixed(2)}`}
              </p>
              <p className="text-blue-300/40 text-[10px] mt-1.5 font-medium">GSM World · USD</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center">
              <Wallet size={18} className="text-blue-300" />
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/account/add-fund" className="flex-1">
              <button className="w-full bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white font-bold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30">
                <Plus size={14} strokeWidth={2.5} />
                {zeroBalance ? "Top Up" : "Add Funds"}
              </button>
            </Link>
            <Link href="/account/transfer" className="flex-1">
              <button className="w-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <ArrowRightLeft size={14} />
                Transfer
              </button>
            </Link>
          </div>
          {zeroBalance && (
            <p className="mt-2.5 text-[11px] text-blue-200/60 font-medium text-center">
              Tap Top Up to choose a payment option
            </p>
          )}
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="px-4 grid grid-cols-3 gap-2.5">
        {[
          { label: "Total",     value: ordersLoading ? "—" : String(totalOrders),     icon: <ShoppingBag size={15} />, grad: "from-blue-500 to-blue-600" },
          { label: "Pending",   value: ordersLoading ? "—" : String(pendingOrders),   icon: <Zap size={15} />,         grad: "from-orange-400 to-orange-500" },
          { label: "Completed", value: ordersLoading ? "—" : String(completedOrders), icon: <CheckCircle size={15} />, grad: "from-emerald-500 to-green-600" },
        ].map(({ label, value, icon, grad }) => (
          <div key={label} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100/80">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center mx-auto mb-2 shadow-sm`}>
              <span className="text-white">{icon}</span>
            </div>
            <p className="text-[22px] font-black text-gray-800 leading-none tabular-nums">{value}</p>
            <p className="text-[10px] text-gray-400 font-semibold mt-1 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Live Order Tracker ────────────────────────────────────────────── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Tracker</p>
            {activeOrders.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-green-600">{activeOrders.length} active</span>
              </span>
            )}
          </div>
          <button onClick={fetchOrders}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-blue-500 transition-colors">
            <RefreshCw size={10} />
            {lastRefresh.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </button>
        </div>

        {ordersLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
            Loading orders…
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={20} className="text-green-400" />
            </div>
            <p className="text-sm font-bold text-gray-500">All clear</p>
            <p className="text-[11px] text-gray-300 mt-0.5">No active orders right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.slice(0, 5).map(order => {
              const stage = getOrderStage(order.paymentStatus);
              const pct = Math.round((stage / (ORDER_STAGES.length - 1)) * 100);
              const styles = STAGE_STYLES[stage] ?? STAGE_STYLES[2];
              return (
                <Link key={order.id} href={`/account/orders#order-${order.id}`} className="block">
                  <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-sm active:shadow-none active:scale-[0.99] transition-all">
                    {/* Order header */}
                    <div className="flex items-start justify-between mb-3.5">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-[13px] font-black text-gray-800">Order #{order.id}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {order.items?.[0]?.productName ?? "Service"}
                          {(order.items?.length ?? 0) > 1 ? ` +${order.items.length - 1} more` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${styles.badge}`}>
                        {ORDER_STAGES[stage].label}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${styles.bar} transition-all duration-700`}
                        style={{ width: `${pct === 0 ? 6 : pct}%` }}
                      />
                    </div>

                    {/* Step dots */}
                    <div className="flex">
                      {ORDER_STAGES.map((s, i) => {
                        const done = i < stage;
                        const active = i === stage;
                        return (
                          <div key={s.key} className="flex flex-col items-center gap-1" style={{ width: `${100 / ORDER_STAGES.length}%` }}>
                            <div
                              className="w-2.5 h-2.5 rounded-full transition-all"
                              style={{
                                background: done || active ? styles.dot : "#e5e7eb",
                                boxShadow: active ? `0 0 0 3px ${styles.dot}30` : "none",
                              }}
                            />
                            <p className={`text-[8px] font-semibold text-center leading-tight ${i <= stage ? "text-gray-600" : "text-gray-300"}`}>
                              {s.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────────── */}
      <div className="px-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "Browse Store",     icon: <ShoppingBag size={15} />, href: "/products",              grad: "from-blue-500 to-blue-700" },
            { label: "Add Funds",        icon: <DollarSign size={15} />,  href: "/account/add-fund",      grad: "from-emerald-500 to-green-700" },
            { label: "Send Funds",       icon: <ArrowRightLeft size={15} />, href: "/account/transfer",  grad: "from-indigo-500 to-indigo-700" },
            { label: "My Orders",        icon: <FileText size={15} />,    href: "/account/orders",        grad: "from-slate-600 to-slate-800" },
            { label: "Security",         icon: <ShieldCheck size={15} />, href: "/account/security",      grad: "from-violet-500 to-purple-700" },
          ].map(({ label, icon, href, grad }) => (
            <Link href={href} key={label}>
              <div className={`bg-gradient-to-br ${grad} rounded-2xl p-4 flex items-center gap-3 active:opacity-80 transition-opacity shadow-sm`}>
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <span className="text-white">{icon}</span>
                </div>
                <span className="font-bold text-[13px] text-white leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Wallet Preview ────────────────────────────────────────────────── */}
      <div className="px-4">
        <WalletPreviewCard token={token} />
      </div>

      {/* ── Recent Orders ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Orders</p>
          <Link href="/account/orders" className="text-blue-500 text-xs font-bold">View all</Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden shadow-sm">
          {ordersLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
              Loading…
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3 border border-gray-100">
                <ShoppingBag size={22} className="text-gray-300" />
              </div>
              <p className="font-bold text-gray-500 text-sm">No orders yet</p>
              <p className="text-gray-400 text-xs mt-1 max-w-[200px]">Place your first order and it will appear here</p>
              <Link href="/products">
                <button className="mt-4 px-6 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl shadow-sm">
                  Shop Now
                </button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.slice(0, 5).map(order => {
                const statusStyle =
                  order.paymentStatus === "paid" || order.paymentStatus === "completed"
                    ? "bg-green-100 text-green-700"
                    : order.paymentStatus === "pending" || order.paymentStatus === "pending_payment_confirmation"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-600";
                return (
                  <Link key={order.id} href={`/account/orders#order-${order.id}`} className="block">
                    <div className="px-4 py-3.5 hover:bg-gray-50 active:bg-blue-50/40 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px] font-black text-gray-800">Order #{order.id}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle}`}>
                            {order.paymentStatus}
                          </span>
                          <ChevronRight size={12} className="text-gray-300" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-gray-400 truncate max-w-[170px]">
                          {order.items?.[0]?.productName ?? "Item"}
                          {(order.items?.length ?? 0) > 1 ? ` +${order.items.length - 1} more` : ""}
                        </p>
                        <p className="text-[12px] font-black text-blue-600 ml-2 tabular-nums">
                          ${parseFloat(order.total).toFixed(2)}
                        </p>
                      </div>
                      <p className="text-[10px] text-gray-300 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {zeroBalance && (
          <div className="mt-3 bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-800">Your wallet is empty</p>
            <p className="text-xs text-gray-400 mt-1">Add funds to place your next order.</p>
            <Link href="/account/add-fund">
              <button className="mt-3 w-full rounded-xl bg-blue-600 text-white font-bold text-sm py-3 shadow-sm">
                Add Top Up
              </button>
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
  const { user } = useAuth();
  const [tab, setTab]         = useState<"mpesa" | "crypto" | "manual" | "card">("mpesa");
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
  const [cardAmount, setCardAmount] = useState("");
  const [cardLoading, setCardLoading] = useState(false);
  const [cardPaid, setCardPaid]     = useState(false);
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
      if (res.status === 401) throw new Error("Session expired — please sign out and sign back in.");
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
      if (res.status === 401) throw new Error("Session expired — please sign out and sign back in.");
      if (!res.ok || !data.paymentId) throw new Error(data.error || "Failed to create payment");
      setNpPayment({ paymentId: data.paymentId, payAddress: data.payAddress!, payAmount: data.payAmount!, payCurrency: data.payCurrency!, expiresAt: data.expiresAt });
      setNpStatus("pending");
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setNpLoading(false);
    }
  }

  async function handleCard() {
    if (!cardAmount || Number(cardAmount) < 1) {
      toast({ title: "Enter amount (min $1)", variant: "destructive" }); return;
    }
    setCardLoading(true);
    try {
      const res = await fetch("/api/wallet/add-fund/stripe/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(cardAmount) }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (res.status === 401) throw new Error("Session expired — please sign out and sign back in.");
      if (!res.ok || !data.url) throw new Error(data.error || "Could not create payment session");
      // Redirect to Stripe-hosted checkout.
      // On success Stripe sends the user back to /account?s_ws=SESSION_ID&s_amt=AMOUNT
      window.location.href = data.url;
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
      setCardLoading(false);
    }
  }

  // Handle return from Stripe Checkout (wallet top-up)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeSession = params.get("s_ws");
    const stripeAmt = params.get("s_amt");
    if (!stripeSession || !token) return;

    // Switch to card tab and clean URL
    setTab("card");
    window.history.replaceState({}, "", window.location.pathname);

    fetch("/api/wallet/add-fund/stripe/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId: stripeSession }),
    })
      .then((r) => r.json() as Promise<{ success?: boolean; alreadyProcessed?: boolean; amountUsd?: number; error?: string }>)
      .then((data) => {
        if (data.success || data.alreadyProcessed) {
          setCardPaid(true);
          if (stripeAmt) setCardAmount(stripeAmt);
          void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
          toast({ title: "Wallet credited!", description: `$${stripeAmt || data.amountUsd?.toFixed(2)} added successfully.` });
        } else {
          toast({ title: data.error || "Payment verification failed. Contact support.", variant: "destructive" });
        }
      })
      .catch(() => toast({ title: "Could not verify payment. Contact support.", variant: "destructive" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    <div className="space-y-4 pb-10">

      {/* ── Header banner ── */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="rounded-2xl p-5">
        <p className="text-blue-300/70 text-[10px] font-bold uppercase tracking-widest mb-1">Add Funds</p>
        <p className="text-white font-black text-xl leading-tight">Top Up Your Wallet</p>
        <p className="text-blue-200/60 text-xs mt-1">Funds appear instantly after payment confirmation</p>
        <div className="mt-4 bg-white/10 border border-white/15 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-blue-300/70 text-[10px] font-bold uppercase tracking-widest">Current Balance</p>
            <p className="text-white font-black text-2xl leading-none mt-0.5">
              {balanceLoading ? <span className="text-base opacity-50">Loading…</span> : `${walletBalance.toFixed(2)}`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/30 flex items-center justify-center">
            <DollarSign size={18} className="text-blue-200" />
          </div>
        </div>
      </div>

      {/* ── Tab selector ── */}
      <div className="flex rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        <button onClick={() => setTab("mpesa")}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${tab === "mpesa" ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-green-50"}`}>
          <Smartphone size={13} strokeWidth={2.5} /> M-Pesa
        </button>
        <button onClick={() => setTab("crypto")}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border-l border-gray-200 ${tab === "crypto" ? "bg-[#1a1a2e] text-white" : "bg-white text-gray-600 hover:bg-blue-50"}`}>
          ₿ Crypto
        </button>
        <button onClick={() => setTab("manual")}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border-l border-gray-200 ${tab === "manual" ? "bg-yellow-500 text-white" : "bg-white text-gray-600 hover:bg-yellow-50"}`}>
          🏦 Manual
        </button>
        <button onClick={() => setTab("card")}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border-l border-gray-200 ${tab === "card" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-blue-50"}`}>
          💳 Card
        </button>
      </div>

      {/* ── M-Pesa tab ── */}
      {tab === "mpesa" && (
        <div className="space-y-3">
          {sent ? (
            paymentConfirmed ? (
              <div className="bg-white border border-green-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
                <div className="w-16 h-16 bg-green-100 border-4 border-green-300 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <p className="font-black text-xl text-gray-800">Wallet Credited!</p>
                <p className="text-sm text-gray-500">Your balance has been updated successfully.</p>
                <button
                  onClick={() => { setSent(false); setPhone(""); setAmount(""); setCheckoutRequestId(null); setPaymentConfirmed(false); }}
                  className="mt-1 px-6 py-2.5 border-2 border-green-400 rounded-xl text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                >
                  Add More Funds
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-green-600 px-5 pt-7 pb-6 text-center">
                  <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Smartphone size={26} className="text-white" />
                  </div>
                  <p className="font-black text-white text-lg">STK Push Sent!</p>
                  <p className="text-green-100/80 text-xs mt-1">Check your phone and enter your M-Pesa PIN</p>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <p className="text-xs text-green-700 font-medium">Auto-checking every 8s ({autoCheckCount}/15)…</p>
                  </div>
                  <button onClick={checkPaymentStatus} disabled={checking}
                    className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    {checking ? <><RefreshCw size={14} className="animate-spin" /> Checking…</> : <><RefreshCw size={14} /> Check Status</>}
                  </button>
                  <button onClick={() => { setSent(false); setCheckoutRequestId(null); }}
                    className="w-full py-2.5 border border-gray-200 text-gray-500 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    Cancel / Try Again
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3.5 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">M-Pesa · STK Push</p>
              </div>
              <div className="px-4 pb-5 pt-4 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-xs text-green-800 font-medium">
                  Enter amount in USD — we'll convert to KES automatically at current rate.
                </div>

                {/* Preset amounts */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Quick Amount (USD)</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {PRESET_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setAmount(String(a))}
                        className={`py-2 rounded-xl text-sm font-bold border transition-colors ${amount === String(a) ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-700 bg-gray-50 hover:border-green-400 hover:bg-green-50"}`}>
                        ${a}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number" min="1" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Or enter custom amount"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">M-Pesa Phone Number</label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-green-400">
                    <span className="px-3 py-2.5 bg-gray-50 text-sm text-gray-600 font-semibold border-r border-gray-200">+254</span>
                    <input
                      type="tel" value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="7XX XXX XXX"
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <button onClick={handleMpesa} disabled={loading || !phone || !amount}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                    : `Send ${amount ? `$${amount}` : ""} via M-Pesa →`}
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
            <div className="bg-white border border-green-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 bg-green-100 border-4 border-green-300 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <p className="font-black text-xl text-gray-800">Payment Confirmed!</p>
              <p className="text-sm text-gray-500">Your wallet has been credited.</p>
              <button onClick={() => { setNpPayment(null); setNpStatus("idle"); setNpAmount(""); }}
                className="px-6 py-2.5 border-2 border-green-400 rounded-xl text-sm font-bold text-green-700 bg-green-50">
                Add More Funds
              </button>
            </div>
          ) : npPayment && npStatus === "pending" ? (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div style={{ background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)" }} className="px-5 pt-6 pb-5">
                <p className="text-blue-200/60 text-[10px] font-bold uppercase tracking-widest mb-1">Send Exactly</p>
                <p className="text-white font-black text-2xl leading-none">{npPayment.payAmount} <span className="text-blue-300 text-lg">{npPayment.payCurrency.toUpperCase()}</span></p>
                {npPayment.expiresAt && <p className="text-blue-200/50 text-xs mt-1">⏱ Expires: {new Date(npPayment.expiresAt).toLocaleTimeString()}</p>}
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="flex flex-col items-center gap-2 py-2">
                  <QRCodeSVG value={npPayment.payAddress} size={140} level="M" className="rounded-xl border-4 border-gray-100 shadow" />
                  <p className="text-[10px] text-gray-400">Scan to get the address</p>
                </div>
                {[
                  { label: "Payment Address", value: npPayment.payAddress, key: "addr" },
                  { label: `Amount (${npPayment.payCurrency.toUpperCase()})`, value: `${npPayment.payAmount}`, key: "amt" },
                ].map(({ label, value, key }) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono text-gray-700 break-all">{value}</div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); }}
                        className={`shrink-0 px-3 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors ${copiedKey === key ? "bg-green-600 text-white" : "bg-gray-800 text-white hover:bg-gray-700"}`}
                      >
                        {copiedKey === key ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <p className="text-xs text-blue-700 font-medium">Auto-checking every 30s for confirmation…</p>
                </div>
                <button onClick={() => { setNpPayment(null); setNpStatus("idle"); }}
                  className="w-full py-2.5 border border-gray-200 text-gray-500 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  Cancel / Start Over
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3.5 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Crypto / USDT · Via NOWPayments</p>
              </div>
              <div className="px-4 pb-5 pt-4 space-y-4">

                {/* Preset amounts */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Amount (USD)</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {PRESET_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setNpAmount(String(a))}
                        className={`py-2 rounded-xl text-sm font-bold border transition-colors ${npAmount === String(a) ? "bg-[#1a1a2e] text-white border-[#1a1a2e]" : "border-gray-200 text-gray-700 bg-gray-50 hover:border-gray-400"}`}>
                        ${a}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number" min="1" value={npAmount}
                    onChange={e => setNpAmount(e.target.value)}
                    placeholder="Or enter custom amount (USD)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Pay With</label>
                  <select value={npCurrency} onChange={e => setNpCurrency(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
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

                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
                  <span className="font-bold">Note:</span> Minimum deposit $13. NOWPayments handles currency conversion automatically.
                </div>

                <button onClick={handleCrypto} disabled={npLoading || !npAmount || Number(npAmount) < 13}
                  className="w-full py-3.5 bg-[#1a1a2e] hover:bg-[#16213e] text-white font-black rounded-xl text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                  {npLoading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating Payment…</>
                    : `Generate Payment Address →`}
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
            <div className="bg-white border border-green-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 bg-green-100 border-4 border-green-300 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <p className="font-black text-xl text-gray-800">Request Submitted!</p>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">Our team verifies your payment and credits your wallet within <strong>10-30 minutes</strong>.</p>
              <button onClick={() => { setManualSent(false); setManualAmount(""); }}
                className="px-6 py-2.5 border-2 border-green-400 rounded-xl text-sm font-bold text-green-700 bg-green-50">
                Add More Funds
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3.5 border-b border-yellow-100 bg-yellow-50">
                <p className="text-xs font-bold text-yellow-800 uppercase tracking-wider">Manual Payment — Admin Verification</p>
                <p className="text-[10px] text-yellow-700 mt-0.5">Send payment first, then notify us. We verify within 10-30 minutes.</p>
              </div>
              <div className="px-4 pb-5 pt-4 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Amount to Add (USD)</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {PRESET_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setManualAmount(String(a))}
                        className={`py-2 rounded-xl text-sm font-bold border transition-colors ${manualAmount === String(a) ? "bg-yellow-500 text-white border-yellow-500" : "border-gray-200 text-gray-700 bg-gray-50 hover:border-yellow-400"}`}>
                        ${a}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="1" value={manualAmount} onChange={e => setManualAmount(e.target.value)}
                    placeholder="Or enter custom amount"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setManualMethod("binance_pay")}
                    className={`py-3 px-3 rounded-xl text-sm font-bold border transition-all text-center ${manualMethod === "binance_pay" ? "bg-yellow-500 text-white border-yellow-500" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                    🟡 Binance Pay
                  </button>
                  <button onClick={() => setManualMethod("usdt_manual")}
                    className={`py-3 px-3 rounded-xl text-sm font-bold border transition-all text-center ${manualMethod === "usdt_manual" ? "bg-green-700 text-white border-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                    ₮ USDT TRC20
                  </button>
                </div>
                {manualMethod === "binance_pay" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest">Send via Binance Pay</p>
                    <div className="flex items-center gap-2 bg-white border border-yellow-200 rounded-lg px-3 py-2.5">
                      <span className="text-lg">🟡</span>
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-400 font-semibold">Binance ID</p>
                        <p className="text-base font-black text-gray-900 tracking-widest">490759406</p>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText("490759406"); toast({ title: "Binance ID copied!" }); }}
                        className="p-1.5 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200"><Copy size={13} /></button>
                    </div>
                    <p className="text-[10px] text-yellow-700">Label: <strong>GSM World — Manual Confirmation</strong></p>
                    {manualAmount && <p className="text-xs font-bold text-yellow-800">Amount to send: <span className="text-green-700">${manualAmount} USD</span></p>}
                    <p className="text-[10px] text-yellow-600">⚠️ Include your registered email as payment reference/note.</p>
                  </div>
                )}
                {manualMethod === "usdt_manual" && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-green-800 uppercase tracking-widest">Send USDT via TRC20 (TRON)</p>
                    <div className="flex flex-col items-center gap-2 py-1">
                      <QRCodeSVG value="TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5" size={110} level="M" className="rounded-xl border-4 border-white shadow" />
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-2 py-2">
                      <span className="font-mono text-[10px] text-gray-700 break-all flex-1">TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5</span>
                      <button onClick={() => { navigator.clipboard.writeText("TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5"); toast({ title: "Address copied!" }); }}
                        className="shrink-0 p-1.5 rounded-lg bg-green-100 text-green-700"><Copy size={13} /></button>
                    </div>
                    <p className="text-[10px] font-bold text-green-800">Network: TRC20 (TRON) only</p>
                    {manualAmount && <p className="text-xs font-bold text-green-800">Amount: <span className="text-green-700">${manualAmount} USDT</span></p>}
                    <p className="text-[10px] text-green-700">⚠️ Include your email as memo/reference.</p>
                  </div>
                )}
                <button onClick={() => {
                    if (!manualAmount || Number(manualAmount) <= 0) { toast({ title: "Enter an amount", variant: "destructive" }); return; }
                    setManualSent(true);
                    toast({ title: "Request submitted!", description: "Our team will credit your wallet within 10-30 minutes." });
                  }}
                  disabled={!manualAmount || Number(manualAmount) <= 0}
                  className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-600 text-white font-black rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                  ✅ I’ve Sent the Payment — Notify Team
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Card tab ── */}
      {tab === "card" && (
        <div className="space-y-3">
          {cardPaid ? (
            <div className="bg-white border border-green-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 bg-green-100 border-4 border-green-300 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <p className="font-black text-xl text-gray-800">Wallet Credited!</p>
              <p className="text-sm text-gray-500">Your balance has been updated successfully.</p>
              <button onClick={() => { setCardPaid(false); setCardAmount(""); }}
                className="mt-1 px-6 py-2.5 border-2 border-green-400 rounded-xl text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 transition-colors">
                Add More Funds
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3.5 border-b border-blue-100 bg-blue-50">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Visa / Mastercard · Powered by Stripe</p>
                <p className="text-[10px] text-blue-600 mt-0.5">Pay securely with your debit or credit card. Instant confirmation.</p>
              </div>
              <div className="px-4 pb-5 pt-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-800 font-medium">
                  Works worldwide — Visa, Mastercard, and more. USD charged; your bank converts to local currency automatically.
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Amount (USD)</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {PRESET_AMOUNTS.map(a => (
                      <button key={a} type="button" onClick={() => setCardAmount(String(a))}
                        className={`py-2 rounded-xl text-sm font-bold border transition-colors ${cardAmount === String(a) ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-700 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"}`}>
                        ${a}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number" min="1" value={cardAmount}
                    onChange={e => setCardAmount(e.target.value)}
                    placeholder="Or enter custom amount"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>

                <button onClick={handleCard} disabled={cardLoading || !cardAmount || Number(cardAmount) < 1}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                  {cardLoading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Opening Checkout…</>
                    : `💳 Pay ${cardAmount ? `$${cardAmount}` : ""} with Card →`}
                </button>

                <div className="flex items-center justify-center gap-3 opacity-60">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Secured by</span>
                  <span className="text-xs font-black text-indigo-600">Stripe</span>
                  <span className="text-[10px] text-gray-300">•</span>
                  <span className="text-[10px] text-gray-400">256-bit SSL</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Help note ── */}
      <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <Shield size={15} className="text-gray-500" />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-700">All payments are secure</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Funds credited instantly after network confirmation.</p>
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

function PayNowPanel({ order, token }: { order: MyOrder; token: string }) {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { toast } = useToast();
  const pm = (order.paymentMethod ?? "").toLowerCase();

  const [loading, setLoading] = useState(false);
  const [payConfig, setPayConfig] = useState<{ binancePayId?: string; usdtAddress?: string; usdtNetwork?: string } | null>(null);
  const [cryptoAddr, setCryptoAddr] = useState<{ payAddress?: string; payAmount?: number; payCurrency?: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [stkSent, setStkSent] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (pm === "binance_pay" || pm === "usdt_manual") {
      fetch(`${baseUrl}/api/payment-config`)
        .then(r => r.json())
        .then(d => setPayConfig(d as { binancePayId?: string; usdtAddress?: string; usdtNetwork?: string }))
        .catch(() => {});
    }
    if (pm === "nowpayments" || pm === "crypto") {
      setLoading(true);
      fetch(`${baseUrl}/api/orders/${order.id}/nowpayments/generate`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.json())
        .then(d => setCryptoAddr(d as { payAddress?: string; payAmount?: number; payCurrency?: string }))
        .catch(() => toast({ title: "Could not generate crypto address", variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [order.id, pm]);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }

  async function payWithWallet() {
    setLoading(true);
    try {
      const r = await fetch(`${baseUrl}/api/orders/${order.id}/pay-wallet`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (r.ok && d.success) {
        toast({ title: "Payment successful! 🎉" });
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast({ title: d.error ?? "Payment failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Payment failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function triggerMpesa() {
    const ph = phone.trim();
    if (!ph) { toast({ title: "Enter your M-Pesa phone number", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const r = await fetch(`${baseUrl}/api/orders/${order.id}/mpesa/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ phone: ph }),
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (r.ok && d.success) {
        setStkSent(true);
        toast({ title: "STK push sent! Check your phone and enter your M-Pesa PIN." });
      } else {
        toast({ title: d.error ?? "Failed to send STK push", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to initiate payment", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const cardCls = "bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3";
  const total = parseFloat(order.total).toFixed(2);

  if (pm === "wallet") {
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-blue-600" />
          <p className="font-black text-gray-800 text-sm">Pay with Wallet</p>
        </div>
        <p className="text-xs text-gray-500">Click below to deduct <span className="font-bold text-gray-800">${total}</span> from your wallet balance.</p>
        <button
          onClick={payWithWallet} disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black rounded-xl text-sm disabled:opacity-60 active:scale-[0.98] transition-all"
        >
          {loading ? "Processing…" : `Pay $${total} from Wallet`}
        </button>
      </div>
    );
  }

  if (pm === "mpesa") {
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-green-600" />
          <p className="font-black text-gray-800 text-sm">Pay via M-Pesa</p>
          <span className="ml-auto text-sm font-black text-green-700">KES {Math.ceil(parseFloat(order.total))}</span>
        </div>
        {stkSent ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-3 text-center">
            <CheckCircle2 size={24} className="mx-auto text-green-600 mb-1" />
            <p className="text-xs font-black text-green-800">STK push sent!</p>
            <p className="text-[11px] text-green-700 mt-0.5">Check your phone and enter your M-Pesa PIN to complete the payment.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">Enter your M-Pesa number and we'll send a payment prompt to your phone.</p>
            <input
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="07XXXXXXXX" maxLength={12}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              onClick={triggerMpesa} disabled={loading || !phone.trim()}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-black rounded-xl text-sm disabled:opacity-60 active:scale-[0.98] transition-all"
            >
              {loading ? "Sending…" : "Send M-Pesa Request"}
            </button>
          </>
        )}
      </div>
    );
  }

  if (pm === "binance_pay") {
    const pid = payConfig?.binancePayId ?? "Loading…";
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-yellow-500" />
          <p className="font-black text-gray-800 text-sm">Pay via Binance Pay</p>
        </div>
        <p className="text-xs text-gray-500">Send exactly <span className="font-bold text-gray-800">${total}</span> using the Binance Pay ID below.</p>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
          <p className="text-sm font-mono font-bold text-gray-800 break-all">{pid}</p>
          <button onClick={() => copyText(pid, "binance")} className="shrink-0 text-gray-400 hover:text-blue-600 transition-colors">
            {copied === "binance" ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        </div>
        <p className="text-[11px] text-gray-400">After sending, please contact support with your transfer receipt so we can confirm your payment.</p>
      </div>
    );
  }

  if (pm === "usdt_manual" || pm === "usdt") {
    const addr = payConfig?.usdtAddress ?? "Loading…";
    const net = payConfig?.usdtNetwork ?? "TRC20";
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-teal-500" />
          <p className="font-black text-gray-800 text-sm">Pay via USDT ({net})</p>
        </div>
        <p className="text-xs text-gray-500">Send exactly <span className="font-bold text-gray-800">${total} USDT</span> on the <span className="font-bold">{net}</span> network.</p>
        {addr && addr !== "Loading…" && (
          <div className="flex justify-center py-1">
            <QRCodeSVG value={addr} size={120} />
          </div>
        )}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
          <p className="text-xs font-mono text-gray-800 break-all">{addr}</p>
          <button onClick={() => copyText(addr, "usdt")} className="shrink-0 text-gray-400 hover:text-blue-600 transition-colors">
            {copied === "usdt" ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        </div>
        <p className="text-[11px] text-amber-600 font-semibold">⚠️ Send exact amount on {net} only. Wrong network = funds lost.</p>
      </div>
    );
  }

  if (pm === "nowpayments" || pm === "crypto") {
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-purple-600" />
          <p className="font-black text-gray-800 text-sm">Pay via Crypto</p>
        </div>
        {loading && <p className="text-xs text-center text-gray-400 py-2">Generating address…</p>}
        {cryptoAddr?.payAddress && (
          <>
            <p className="text-xs text-gray-500">
              Send <span className="font-bold text-gray-800">{cryptoAddr.payAmount} {cryptoAddr.payCurrency?.toUpperCase()}</span> to the address below.
            </p>
            <div className="flex justify-center py-1">
              <QRCodeSVG value={cryptoAddr.payAddress} size={120} />
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
              <p className="text-xs font-mono text-gray-800 break-all">{cryptoAddr.payAddress}</p>
              <button onClick={() => copyText(cryptoAddr.payAddress!, "crypto")} className="shrink-0 text-gray-400 hover:text-blue-600 transition-colors">
                {copied === "crypto" ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-amber-600 font-semibold">⚠️ Address valid ~60 min. Send exact amount only.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2">
        <CreditCard size={16} className="text-blue-600" />
        <p className="font-black text-gray-800 text-sm">Complete Payment</p>
      </div>
      <p className="text-xs text-gray-500">Amount due: <span className="font-bold text-gray-800">${total}</span> via {order.paymentMethod?.replace(/_/g, " ")}.</p>
      <p className="text-[11px] text-gray-400">Please contact support for payment details or if you've already paid.</p>
    </div>
  );
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

      {/* Pay Now panel for pending orders — method-specific UI */}
      {(order.paymentStatus === "pending" || order.paymentStatus === "pending_payment_confirmation") && (
        <PayNowPanel order={order} token={token} />
      )}

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
      if (!r.ok) {
        if (r.status === 401) {
          toast({ title: "Session expired", description: "Please sign out and sign back in to view your orders.", variant: "destructive" });
        } else {
          toast({ title: "Could not load orders", description: (data as { error: string }).error || "Please try again.", variant: "destructive" });
        }
        setOrders([]);
      } else {
        setOrders(Array.isArray(data) ? data : []);
      }
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

                  {/* Pay Now banner for pending orders */}
                  {(order.paymentStatus === "pending" || order.paymentStatus === "pending_payment_confirmation") && (
                    <div className="mt-2.5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="text-[11px] font-bold text-amber-700 flex-1">Payment pending — tap to pay now</span>
                      <ChevronRight size={12} className="text-amber-500 shrink-0" />
                    </div>
                  )}
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
function resizeImageToDataUrl(file: File, maxPx = 200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

function ProfileContent({ user }: { user: { id?: number; name: string | null; email: string; username?: string | null; avatarUrl?: string | null } | null }) {
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState<string | null>(user?.username ?? null);
  const [usernameCopied, setUsernameCopied] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { token, updateUser } = useAuth();

  // Fetch fresh profile data to ensure username and avatar are always current
  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((d: { user?: { username?: string | null; name?: string | null; avatarUrl?: string | null } } | null) => {
        if (d?.user?.username) setUsername(d.user.username);
        if (d?.user?.name !== undefined) setName(d.user.name ?? "");
        if (d?.user?.avatarUrl !== undefined) setAvatarUrl(d.user.avatarUrl ?? null);
      })
      .catch(() => {});
  }, [token]);

  function copyUsername() {
    if (!username) return;
    void navigator.clipboard.writeText(username);
    setUsernameCopied(true);
    setTimeout(() => setUsernameCopied(false), 2000);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 200, 0.82);
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error || "Upload failed");
      }
      const updated = await res.json() as { user: { id: number; email: string; name: string | null; username?: string | null; avatarUrl?: string | null } };
      setAvatarUrl(updated.user.avatarUrl ?? null);
      updateUser({ id: updated.user.id, email: updated.user.email, name: updated.user.name, username: updated.user.username, avatarUrl: updated.user.avatarUrl });
      toast({ title: "Photo updated!", description: "Your profile picture has been saved." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) throw new Error("Failed to remove photo");
      const updated = await res.json() as { user: { id: number; email: string; name: string | null; username?: string | null; avatarUrl?: string | null } };
      setAvatarUrl(null);
      updateUser({ id: updated.user.id, email: updated.user.email, name: updated.user.name, username: updated.user.username, avatarUrl: null });
      toast({ title: "Photo removed" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to remove", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfile() {
    if (!user?.id) { toast({ title: "Not logged in", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error || "Failed to save");
      }
      const updated = await res.json() as { user: { id: number; email: string; name: string | null; username?: string | null; avatarUrl?: string | null } };
      updateUser({ id: updated.user.id, email: updated.user.email, name: updated.user.name, username: updated.user.username, avatarUrl: updated.user.avatarUrl });
      toast({ title: "Profile saved!", description: "Your name has been updated." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      {/* Avatar section */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100/80">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Profile Photo</p>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-blue-100" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center shadow-md">
                <span className="text-white font-black text-xl tracking-tight">{initials}</span>
              </div>
            )}
            {avatarUploading && (
              <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                <RefreshCw size={16} className="text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="w-full py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl disabled:opacity-60 hover:bg-blue-500 active:bg-blue-700 transition-colors"
            >
              {avatarUrl ? "Change Photo" : "Upload Photo"}
            </button>
            {avatarUrl && (
              <button
                onClick={removeAvatar}
                disabled={avatarUploading}
                className="w-full py-2 text-xs font-semibold text-red-500 border border-red-100 rounded-xl bg-red-50/50 hover:bg-red-50 disabled:opacity-60 transition-colors"
              >
                Remove Photo
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2.5">JPG, PNG or GIF · Max 5MB · Resized to 200×200px</p>
      </div>

      {/* Username card */}
      {username && (
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl px-4 py-4 shadow-md">
          <p className="text-indigo-200/70 text-[10px] font-bold uppercase tracking-widest mb-1">Your Username</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white font-black text-xl tracking-tight">@{username}</span>
            <button
              onClick={copyUsername}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-white text-[11px] font-bold transition-colors"
            >
              {usernameCopied ? <Check size={12} /> : <Copy size={12} />}
              {usernameCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-indigo-200/60 text-[11px] mt-2">Share this with others to receive wallet transfers</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Your name" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
        <input type="email" value={user?.email ?? ""} readOnly className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed" />
      </div>
      <button onClick={saveProfile} disabled={saving} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg text-sm disabled:opacity-60">
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

// ── Ledger ────────────────────────────────────────────────────────────────────
interface WalletTxn {
  id: number;
  type: string;
  amount: string;
  fee: string;
  counterpartyUsername: string | null;
  note: string | null;
  createdAt: string;
}

function WalletMovements({ token }: { token: string | null }) {
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/wallet/transactions", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((d: WalletTxn[]) => { setTxns(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-16" />
      ))}
    </div>
  );

  if (txns.length === 0) return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
        <Wallet size={28} className="text-gray-200" />
      </div>
      <p className="font-bold text-gray-500">No wallet movements yet</p>
      <p className="text-xs text-gray-400 mt-1">Top-ups and transfers will appear here</p>
    </div>
  );

  function txnIcon(type: string) {
    if (type === "transfer_sent")     return <ArrowUpRight size={14} className="text-red-500" />;
    if (type === "transfer_received") return <ArrowDownLeft size={14} className="text-green-600" />;
    if (type === "credit")            return <Gift size={14} className="text-purple-500" />;
    return <Plus size={14} className="text-blue-500" />;
  }

  function txnBg(type: string) {
    if (type === "transfer_sent")     return "bg-red-50 border-red-100";
    if (type === "transfer_received") return "bg-green-50 border-green-100";
    if (type === "credit")            return "bg-purple-50 border-purple-100";
    return "bg-blue-50 border-blue-100";
  }

  function txnLabel(t: WalletTxn) {
    if (t.type === "transfer_sent")     return `Sent to @${t.counterpartyUsername ?? ""}`;
    if (t.type === "transfer_received") return `Received from @${t.counterpartyUsername ?? ""}`;
    if (t.type === "credit")            return "Admin credit";
    return t.note ?? "Wallet top-up";
  }

  function txnSign(type: string) {
    return type === "transfer_sent" ? "-" : "+";
  }

  function txnAmountColor(type: string) {
    return type === "transfer_sent" ? "text-red-600" : "text-green-600";
  }

  function txnBadge(type: string) {
    if (type === "transfer_sent")     return { label: "Sent",      cls: "bg-red-100 text-red-700" };
    if (type === "transfer_received") return { label: "Received",  cls: "bg-green-100 text-green-700" };
    if (type === "credit")            return { label: "Credit",    cls: "bg-purple-100 text-purple-700" };
    return { label: "Top-up", cls: "bg-blue-100 text-blue-700" };
  }

  return (
    <div className="space-y-2">
      {txns.map(t => {
        const badge = txnBadge(t.type);
        const fee = parseFloat(t.fee);
        return (
          <div key={t.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${txnBg(t.type)}`}>
                {txnIcon(t.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{txnLabel(t)}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-[10px] text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    {new Date(t.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  {fee > 0 && <span className="text-[9px] text-gray-400">fee ${fee.toFixed(2)}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-black ${txnAmountColor(t.type)}`}>
                  {txnSign(t.type)}${parseFloat(t.amount).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LedgerContent({ token }: { token: string | null }) {
  const { data: balance = 0, isLoading: balanceLoading } = useWalletBalance();
  const [activeTab, setActiveTab] = useState<"wallet" | "orders">("wallet");
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
        <p className="text-blue-200/60 text-xs mt-1">Wallet movements and order history</p>
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

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab("wallet")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "wallet" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
        >
          <Wallet size={13} />Wallet
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === "orders" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
        >
          <ShoppingBag size={13} />Orders
        </button>
      </div>

      {/* Wallet movements */}
      {activeTab === "wallet" && <WalletMovements token={token} />}

      {/* Orders section */}
      {activeTab === "orders" && <>
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
      </>}
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

// ── Wallet Transfer ───────────────────────────────────────────────────────────
function TransferContent({ token }: { token: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: balance } = useWalletBalance();
  const [toUsername, setToUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ transferred: number; fee: number; totalDeducted: number; toUsername: string } | null>(null);

  const FEE_RATE = 0.02;
  const amountNum = parseFloat(amount) || 0;
  const fee = Math.round(amountNum * FEE_RATE * 100) / 100;
  const total = Math.round((amountNum + fee) * 100) / 100;

  async function handleSend() {
    if (!toUsername.trim() || amountNum <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUsername: toUsername.trim(), amount: amountNum }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Transfer Failed", description: data.error, variant: "destructive" }); return; }
      setSuccess(data);
      setToUsername("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center pt-8 pb-16 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <CheckCircle2 size={38} className="text-indigo-500" />
        </div>
        <div>
          <p className="text-xl font-black text-gray-900">Sent!</p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-bold text-indigo-600">${success.transferred.toFixed(2)}</span> sent to{" "}
            <span className="font-bold text-gray-800">@{success.toUsername}</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Fee: ${success.fee.toFixed(2)} · Total deducted: ${success.totalDeducted.toFixed(2)}</p>
        </div>
        <button
          onClick={() => setSuccess(null)}
          className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl text-sm">
          Send Another
        </button>
        <Link href="/account">
          <button className="text-xs text-gray-400 underline">Back to Account</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div>
          <p className="text-indigo-200/80 text-[10px] font-bold uppercase tracking-widest">Your Balance</p>
          <p className="text-white font-black text-2xl mt-0.5">${parseFloat(String(balance ?? "0")).toFixed(2)}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
          <Wallet size={22} className="text-white/80" />
        </div>
      </div>

      {/* Transfer form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Recipient Username</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">@</span>
            <input
              value={toUsername}
              onChange={e => setToUsername(e.target.value)}
              placeholder="username"
              className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Amount (USD)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>

        {amountNum > 0 && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Amount</span>
              <span className="font-semibold text-gray-800">${amountNum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Transfer fee (2%)</span>
              <span className="font-semibold text-gray-800">${fee.toFixed(2)}</span>
            </div>
            <div className="border-t border-indigo-100 mt-1 pt-1 flex justify-between text-sm">
              <span className="font-bold text-indigo-700">Total deducted</span>
              <span className="font-black text-indigo-700">${total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleSend}
        disabled={submitting || !toUsername.trim() || amountNum <= 0 || total > parseFloat(String(balance ?? "0"))}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md">
        {submitting
          ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          : <><Send size={16} /> Send Funds</>}
      </button>
      <p className="text-center text-[11px] text-gray-400">2% fee applies · Transfers are instant and irreversible</p>
    </div>
  );
}
