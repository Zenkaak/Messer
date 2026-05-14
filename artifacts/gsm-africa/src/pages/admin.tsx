import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, LayoutDashboard, ShoppingBag, Package, Users, Settings,
  LogOut, TrendingUp, DollarSign, RefreshCw, Search, Eye, EyeOff,
  ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, AlertCircle,
  ToggleLeft, ToggleRight, KeyRound, AlertTriangle, X, ArrowUpRight,
  Smartphone, Zap, Ban, Trash2, UserCheck, MoreVertical,
  MessageSquare, Send, Cpu,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────
interface AdminSettings {
  mpesaEnabled: boolean;
  mpesaShortcode: string | null;
  mpesaConsumerKey: string | null;
  mpesaConsumerSecret: string | null;
  mpesaPasskey: string | null;
  mpesaCallbackUrl: string | null;
  mpesaEnv: string;
  usdtEnabled: boolean;
  usdtWalletAddress: string | null;
  usdtNetwork: string | null;
  nowpaymentsEnabled: boolean;
  nowpaymentsApiKey: string | null;
  nowpaymentsIpnSecret?: string | null;
  nowpaymentsPublicKey?: string | null;
  coingateEnabled: boolean;
  coingateApiKey: string | null;
  emailFrom: string | null;
  smtpHost: string | null;
  smtpPort: string | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  whatsappContact: string | null;
  googleClientId?: string | null;
  googleClientSecret?: string | null;
  paymentMethods: Array<{ method: string; walletAddress: string; network: string | null; label: string | null; enabled?: boolean }>;
}
interface Stats {
  orders: { total: number; revenue: number };
  paidOrders: { count: number; revenue: number };
  users: number; products: number;
}
interface Order {
  id: number; customerName: string | null; customerEmail: string | null;
  customerPhone: string | null; paymentMethod: string | null;
  paymentStatus: string; total: string; currency: string; createdAt: string;
  notes: string | null; deviceIdentifier: string | null; orderType: string | null;
}
interface OrderMsg {
  id: number; orderId: number; senderType: string; senderEmail: string;
  message: string; createdAt: string;
}
interface AdminUser {
  id: number; email: string; name: string | null;
  walletBalance: string; status: string; createdAt: string;
}
interface AdminProduct {
  id: number; name: string; price: string;
  inStock: boolean; categoryName: string | null; imageUrl: string | null;
  originalPrice?: string | null; description?: string | null; featured?: boolean;
}

const NAV = [
  { id: "overview",  label: "Overview",  icon: LayoutDashboard },
  { id: "orders",    label: "Orders",    icon: ShoppingBag },
  { id: "products",  label: "Products",  icon: Package },
  { id: "users",     label: "Users",     icon: Users },
  { id: "payments",  label: "Payments",  icon: Settings },
] as const;
type Tab = typeof NAV[number]["id"];

// ─── helpers ──────────────────────────────────────────────────────────────────
function adminFetch(path: string, pwd: string, opts: RequestInit = {}) {
  return fetch(path, {
    ...opts,
    headers: { "x-admin-password": pwd, "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
}

function apiPath(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;
}

function Skeleton({ h = "h-16" }: { h?: string }) {
  return <div className={`${h} bg-slate-100 rounded-2xl animate-pulse`} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    paid:    { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",  icon: <CheckCircle2 size={10} /> },
    pending: { cls: "bg-amber-50 text-amber-700 border border-amber-200",        icon: <Clock size={10} /> },
    failed:  { cls: "bg-red-50 text-red-600 border border-red-200",             icon: <XCircle size={10} /> },
    unpaid:  { cls: "bg-slate-100 text-slate-500 border border-slate-200",      icon: <AlertCircle size={10} /> },
  };
  const s = map[status] ?? map.unpaid;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.icon}{status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-blue-600" : "bg-slate-200"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function MaskedInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 block mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
        <button type="button" onClick={() => setShow(!show)}
          className="px-3 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-50">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

// ─── change-password modal ────────────────────────────────────────────────────
function ChangePasswordModal({ pwd, onSuccess, onDismiss, isForced }: {
  pwd: string; onSuccess: (p: string) => void; onDismiss?: () => void; isForced?: boolean;
}) {
  const { toast } = useToast();
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const strength = newPwd.length === 0 ? 0 : newPwd.length < 6 ? 1 : newPwd.length < 10 ? 2 : 3;
  const strengthLabel = ["", "Too short", "Fair", "Strong"][strength];
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-emerald-500"][strength];
  const strengthText  = ["", "text-red-500", "text-amber-500", "text-emerald-600"][strength];

  async function submit() {
    setError("");
    if (newPwd.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPwd !== confirmPwd) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      const r = await fetch(apiPath("/api/admin/change-password"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwd, newPassword: newPwd }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok) { setError(d.error ?? "Failed to change password."); return; }
      toast({ title: "Password updated", description: "Your new admin password is active." });
      onSuccess(newPwd);
    } catch { setError("Network error — please try again."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!isForced ? onDismiss : undefined} />
      <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <KeyRound size={16} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Change Password</p>
                <p className="text-slate-400 text-[11px]">Admin security settings</p>
              </div>
            </div>
            {!isForced && onDismiss && (
              <button onClick={onDismiss} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white">
                <X size={15} />
              </button>
            )}
          </div>
          {isForced && (
            <div className="mt-3 bg-amber-500/15 border border-amber-400/30 rounded-xl px-3.5 py-2.5 flex gap-2.5">
              <AlertTriangle size={14} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-amber-200 text-xs leading-relaxed">Set a secure admin password before continuing.</p>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">New Password</label>
            <div className="flex gap-2">
              <input type={showNew ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                placeholder="Minimum 6 characters"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="px-3 border border-slate-200 rounded-xl text-slate-400 bg-slate-50">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {newPwd.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1,2,3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : "bg-slate-100"}`} />
                  ))}
                </div>
                <p className={`text-[11px] mt-1 font-medium ${strengthText}`}>{strengthLabel}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Confirm Password</label>
            <div className="flex gap-2">
              <input type={showConfirm ? "text" : "password"} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                placeholder="Repeat new password" onKeyDown={e => e.key === "Enter" && submit()}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="px-3 border border-slate-200 rounded-xl text-slate-400 bg-slate-50">
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button onClick={submit} disabled={saving || !newPwd || !confirmPwd}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-40 transition-colors">
            {saving ? "Saving…" : "Update Password"}
          </button>
          {isForced && onDismiss && (
            <button onClick={onDismiss} className="w-full text-slate-400 hover:text-slate-600 text-sm py-1 font-medium">
              Skip for now (not recommended)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── overview ─────────────────────────────────────────────────────────────────
function OverviewPanel({ pwd, onNavigate }: { pwd: string; onNavigate: (tab: Tab) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await adminFetch("/api/admin/stats", pwd); if (r.ok) setStats(await r.json() as Stats); }
    finally { setLoading(false); }
  }, [pwd]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 pb-6 space-y-4">
      {/* greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">Welcome back</p>
          <h2 className="text-xl font-black text-slate-900">Store Overview</h2>
        </div>
        <button onClick={load} className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors ${loading ? "animate-spin" : ""}`}>
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} h="h-28" />)}</div>
          <Skeleton h="h-32" />
        </div>
      ) : (
        <>
          {/* stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Orders", value: stats?.orders.total ?? 0, sub: `${stats?.paidOrders.count ?? 0} paid`, icon: <ShoppingBag size={16} />, from: "#3b82f6", to: "#1d4ed8" },
              { label: "Revenue", value: `$${(stats?.paidOrders.revenue ?? 0).toFixed(0)}`, sub: "paid orders", icon: <DollarSign size={16} />, from: "#10b981", to: "#065f46" },
              { label: "Users", value: stats?.users ?? 0, sub: "registered", icon: <Users size={16} />, from: "#8b5cf6", to: "#5b21b6" },
              { label: "Products", value: stats?.products ?? 0, sub: "in catalog", icon: <Package size={16} />, from: "#f59e0b", to: "#b45309" },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm overflow-hidden relative">
                <div className="absolute -right-3 -top-3 w-14 h-14 rounded-full opacity-10"
                  style={{ background: `linear-gradient(135deg,${c.from},${c.to})` }} />
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white mb-3"
                  style={{ background: `linear-gradient(135deg,${c.from},${c.to})` }}>
                  {c.icon}
                </div>
                <p className="text-2xl font-black text-slate-900">{c.value}</p>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">{c.label}</p>
                <p className="text-[10px] text-slate-300 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* revenue card */}
          <div className="rounded-2xl p-4 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)" }}>
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #3b82f6 0%, transparent 60%)" }} />
            <div className="flex items-start justify-between relative">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-blue-400" />
                  <span className="text-blue-300 text-xs font-semibold">Total Pipeline</span>
                </div>
                <p className="text-3xl font-black">${(stats?.orders.revenue ?? 0).toFixed(2)}</p>
                <p className="text-slate-400 text-xs mt-1">All orders including pending</p>
              </div>
              <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1.5">
                <ArrowUpRight size={12} className="text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">Live</span>
              </div>
            </div>
          </div>

          {/* quick links */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Quick Actions</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Payment Config", icon: <Zap size={15} />, color: "text-blue-600 bg-blue-50", tab: "payments" as Tab },
                { label: "Manage Stock", icon: <Package size={15} />, color: "text-emerald-600 bg-emerald-50", tab: "products" as Tab },
                { label: "View Users", icon: <Users size={15} />, color: "text-purple-600 bg-purple-50", tab: "users" as Tab },
              ].map(q => (
                <button key={q.label} onClick={() => onNavigate(q.tab)}
                  className="bg-white border border-slate-100 rounded-2xl p-3 text-center shadow-sm hover:shadow-md hover:border-slate-200 transition-all active:scale-95">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1.5 ${q.color}`}>{q.icon}</div>
                  <p className="text-[10px] font-bold text-slate-600 leading-tight">{q.label}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── order detail ─────────────────────────────────────────────────────────────
function OrderDetailView({ order: initialOrder, pwd, onBack }: { order: Order; pwd: string; onBack: () => void }) {
  const { toast } = useToast();
  const [order, setOrder] = useState(initialOrder);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [messages, setMessages] = useState<OrderMsg[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const statusColors: Record<string, string> = {
    paid: "bg-emerald-50 border-emerald-200 text-emerald-700",
    pending: "bg-amber-50 border-amber-200 text-amber-700",
    failed: "bg-red-50 border-red-200 text-red-600",
    unpaid: "bg-slate-100 border-slate-200 text-slate-500",
  };
  const sc = statusColors[order.paymentStatus] ?? statusColors.unpaid;

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    setMsgLoading(true);
    try {
      const r = await fetch(apiPath(`/api/orders/${order.id}/messages`), {
        headers: { "x-admin-password": pwd },
      });
      if (r.ok) setMessages(await r.json() as OrderMsg[]);
    } finally { setMsgLoading(false); }
  }

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    try {
      const r = await adminFetch(apiPath(`/api/admin/orders/${order.id}`), pwd, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: status }),
      });
      if (r.ok) {
        const updated = await r.json() as Order;
        setOrder(prev => ({ ...prev, paymentStatus: updated.paymentStatus }));
        toast({ title: `Order marked as ${status}` });
      } else {
        toast({ title: "Update failed", variant: "destructive" });
      }
    } finally { setUpdatingStatus(false); }
  }

  async function sendMessage() {
    if (!newMsg.trim()) return;
    setSendingMsg(true);
    try {
      const r = await fetch(apiPath(`/api/orders/${order.id}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": pwd },
        body: JSON.stringify({ message: newMsg.trim() }),
      });
      if (r.ok) {
        const msg = await r.json() as OrderMsg;
        setMessages(prev => [...prev, msg]);
        setNewMsg("");
      } else {
        toast({ title: "Failed to send message", variant: "destructive" });
      }
    } finally { setSendingMsg(false); }
  }

  return (
    <div className="p-4 pb-8 space-y-4">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors shrink-0">
          <ChevronLeft size={18} />
        </button>
        <div>
          <p className="text-xs text-slate-400 font-medium">Order #{order.id} · {order.orderType || "product"}</p>
          <h2 className="text-lg font-black text-slate-900 leading-tight">Order Details</h2>
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-3 border rounded-2xl px-4 py-3 ${sc}`}>
        <StatusBadge status={order.paymentStatus} />
        <span className="text-sm font-semibold capitalize">{order.paymentStatus} payment</span>
        <span className="ml-auto text-xs font-medium opacity-70">{new Date(order.createdAt).toLocaleString()}</span>
      </div>

      {/* Status update buttons */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Update Status</p>
          {updatingStatus && <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="p-3 flex gap-2 flex-wrap">
          {[
            { status: "paid", label: "Mark Paid", cls: "bg-emerald-600 text-white hover:bg-emerald-700" },
            { status: "pending", label: "Mark Pending", cls: "bg-amber-500 text-white hover:bg-amber-600" },
            { status: "failed", label: "Mark Failed", cls: "bg-red-500 text-white hover:bg-red-600" },
            { status: "processing", label: "Processing", cls: "bg-blue-600 text-white hover:bg-blue-700" },
            { status: "completed", label: "Completed", cls: "bg-slate-800 text-white hover:bg-slate-900" },
          ].map(({ status, label, cls }) => (
            <button key={status} onClick={() => updateStatus(status)} disabled={updatingStatus || order.paymentStatus === status}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${
                order.paymentStatus === status ? "ring-2 ring-offset-1 ring-blue-400 " + cls : cls
              }`}>
              {label}
            </button>
          ))}
        </div>
        {/* Custom status text */}
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 flex gap-2">
          <input
            placeholder="Custom status text…"
            id="custom-status-input"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            disabled={updatingStatus}
            onClick={() => {
              const inp = document.getElementById("custom-status-input") as HTMLInputElement;
              if (inp?.value?.trim()) updateStatus(inp.value.trim());
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0"
          >
            Set
          </button>
        </div>
      </div>

      {/* IMEI / Device identifier */}
      {order.deviceIdentifier && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Cpu size={11} /> Device / IMEI</p>
          </div>
          <div className="p-4">
            <p className="font-mono text-sm font-bold text-slate-800 break-all">{order.deviceIdentifier}</p>
          </div>
        </div>
      )}

      {/* Customer info */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Customer</p>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "Name", value: order.customerName || "—" },
            { label: "Email", value: order.customerEmail || "—" },
            { label: "Phone", value: order.customerPhone || "—" },
          ].map(row => (
            <div key={row.label} className="flex items-start justify-between gap-4">
              <span className="text-xs font-semibold text-slate-400 shrink-0 w-14">{row.label}</span>
              <span className="text-sm font-medium text-slate-800 text-right break-all">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payment</p>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "Method", value: order.paymentMethod || "—" },
            { label: "Currency", value: order.currency || "USD" },
            { label: "Notes", value: order.notes || "—" },
          ].map(row => (
            <div key={row.label} className="flex items-start justify-between gap-4">
              <span className="text-xs font-semibold text-slate-400 shrink-0 w-16">{row.label}</span>
              <span className="text-sm font-medium text-slate-800 text-right break-words max-w-[65%]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="rounded-2xl p-4 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold mb-1">Order Total</p>
            <p className="text-3xl font-black">${Number(order.total).toFixed(2)}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <DollarSign size={24} className="text-blue-400" />
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <MessageSquare size={13} className="text-slate-400" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1">Order Chat</p>
          <button onClick={loadMessages} className="text-[10px] text-blue-500 font-bold hover:underline">Refresh</button>
        </div>
        <div className="p-3 space-y-2 max-h-52 overflow-y-auto">
          {msgLoading ? (
            <p className="text-center text-xs text-slate-400 py-4">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-slate-300 py-4">No messages yet. Start the conversation.</p>
          ) : messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.senderType === "admin" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${msg.senderType === "admin" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                {msg.senderType === "admin" ? "A" : "U"}
              </div>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs ${msg.senderType === "admin" ? "bg-blue-600 text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"}`}>
                {msg.message.startsWith("__FILE__:") ? (() => {
                  const rest = msg.message.slice(9);
                  const sep = rest.indexOf("|");
                  const fileName = rest.slice(0, sep);
                  const dataUrl = rest.slice(sep + 1);
                  return dataUrl.startsWith("data:image") ? (
                    <div>
                      <img src={dataUrl} alt={fileName} className="max-w-[160px] rounded-lg mb-1" />
                      <p className="text-[9px] opacity-70 truncate max-w-[160px]">{fileName}</p>
                    </div>
                  ) : (
                    <a href={dataUrl} download={fileName} className="underline opacity-80">{fileName}</a>
                  );
                })() : <p>{msg.message}</p>}
                <p className={`text-[9px] mt-0.5 opacity-60`}>{new Date(msg.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-2">
          <div className="flex gap-2">
            <input
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Type a message to customer…"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <label title="Attach image" className="w-9 h-9 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 cursor-pointer transition-colors shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { toast({ title: "File too large", description: "Max 2 MB", variant: "destructive" }); return; }
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  const msgContent = `__FILE__:${file.name}|${dataUrl}`;
                  fetch(apiPath(`/api/orders/${order.id}/messages`), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-admin-password": pwd },
                    body: JSON.stringify({ message: msgContent }),
                  }).then(r => r.ok ? r.json() : null).then(msg => {
                    if (msg) setMessages(prev => [...prev, msg as OrderMsg]);
                    toast({ title: "File sent" });
                  }).catch(() => toast({ title: "Failed to send file", variant: "destructive" }));
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }} />
            </label>
            <button onClick={sendMessage} disabled={sendingMsg || !newMsg.trim()}
              className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors">
              {sendingMsg ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── orders ───────────────────────────────────────────────────────────────────
function OrdersPanel({ pwd }: { pwd: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const PER = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await adminFetch(`/api/admin/orders?limit=${PER}&offset=${p * PER}`, pwd);
      if (r.ok) { const d = await r.json() as { orders: Order[]; total: number }; setOrders(d.orders); setTotal(d.total); }
    } finally { setLoading(false); }
  }, [pwd]);

  useEffect(() => { load(page); }, [load, page]);
  const pages = Math.ceil(total / PER);

  if (selectedOrder) {
    return <OrderDetailView order={selectedOrder} pwd={pwd} onBack={() => setSelectedOrder(null)} />;
  }

  return (
    <div className="p-4 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">{total} total</p>
          <h2 className="text-xl font-black text-slate-900">Orders</h2>
        </div>
        <button onClick={() => load(page)}
          className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors ${loading ? "animate-spin" : ""}`}>
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
        : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <ShoppingBag size={24} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-400 text-sm">No orders yet</p>
            <p className="text-slate-300 text-xs mt-1">Orders will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(o => (
              <button key={o.id} onClick={() => setSelectedOrder(o)}
                className="w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-100 transition-all text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                      <ShoppingBag size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[10px] font-black text-slate-400">#{o.id}</span>
                        <StatusBadge status={o.paymentStatus} />
                      </div>
                      <p className="text-sm font-bold text-slate-800 truncate">{o.customerName || o.customerEmail || "Guest"}</p>
                      <p className="text-[11px] text-slate-400 truncate">{o.customerPhone} · {o.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">${Number(o.total).toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(o.createdAt).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      }

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-bold text-slate-600">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50">
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── products ─────────────────────────────────────────────────────────────────
function ProductsPanel({ pwd }: { pwd: string }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState<AdminProduct | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; price: string; originalPrice: string; imageUrl: string; description: string; inStock: boolean; featured: boolean }>({ name: "", price: "", originalPrice: "", imageUrl: "", description: "", inStock: true, featured: false });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const PER = 30;

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PER), offset: String(p * PER), ...(q ? { search: q } : {}) });
      const r = await adminFetch(`/api/admin/products?${params}`, pwd);
      if (r.ok) { const d = await r.json() as { products: AdminProduct[]; total: number }; setProducts(d.products); setTotal(d.total); }
    } finally { setLoading(false); }
  }, [pwd]);

  useEffect(() => { load(page, search); }, [load, page, search]);

  function openEdit(p: AdminProduct) {
    setEditForm({ name: p.name, price: String(p.price), originalPrice: p.originalPrice ? String(p.originalPrice) : "", imageUrl: p.imageUrl ?? "", description: p.description ?? "", inStock: p.inStock, featured: p.featured ?? false });
    setEditModal(p);
  }

  async function saveProduct() {
    if (!editModal) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        price: editForm.price,
        inStock: editForm.inStock,
        featured: editForm.featured,
        imageUrl: editForm.imageUrl || null,
        description: editForm.description || null,
      };
      if (editForm.originalPrice) body.originalPrice = editForm.originalPrice;
      const r = await adminFetch(`/api/admin/products/${editModal.id}`, pwd, { method: "PATCH", body: JSON.stringify(body) });
      if (r.ok) { toast({ title: "Product updated" }); setEditModal(null); load(page, search); }
      else { const e = await r.json().catch(() => ({})) as { error?: string }; toast({ variant: "destructive", title: e.error ?? "Update failed" }); }
    } finally { setSaving(false); }
  }

  async function deleteProduct(id: number) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const r = await adminFetch(`/api/admin/products/${id}`, pwd, { method: "DELETE" });
    if (r.ok || r.status === 204) { toast({ title: "Product deleted" }); load(page, search); }
    else toast({ variant: "destructive", title: "Delete failed" });
  }

  async function toggleStock(id: number, inStock: boolean) {
    const r = await adminFetch(`/api/admin/products/${id}`, pwd, { method: "PATCH", body: JSON.stringify({ inStock: !inStock }) });
    if (r.ok) { toast({ title: !inStock ? "Marked in stock" : "Marked out of stock" }); load(page, search); }
    else toast({ variant: "destructive", title: "Update failed" });
  }

  const pages = Math.ceil(total / PER);

  return (
    <div className="p-4 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">{total} total</p>
          <h2 className="text-xl font-black text-slate-900">Products</h2>
        </div>
        <button onClick={() => load(page, search)}
          className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors ${loading ? "animate-spin" : ""}`}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search products or category…"
          className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-2xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
      </div>

      {loading
        ? <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} h="h-14" />)}</div>
        : (
          <div className="space-y-1.5">
            {products.map(p => (
              <div key={p.id} className="bg-white border border-slate-100 rounded-2xl px-3.5 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                    {p.imageUrl
                      ? <img src={p.imageUrl} className="w-full h-full object-contain p-1"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      : <Smartphone size={14} className="text-slate-300" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{p.categoryName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-black text-slate-600">${Number(p.price).toFixed(2)}</span>
                    <button onClick={() => toggleStock(p.id, p.inStock)}
                      className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                        p.inStock ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-400 bg-slate-50"
                      }`}>
                      {p.inStock ? "IN STOCK" : "OUT"}
                    </button>
                    <button onClick={() => openEdit(p)}
                      className="text-[9px] font-bold px-2 py-1 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                      EDIT
                    </button>
                    <button onClick={() => deleteProduct(p.id)}
                      className="text-[9px] font-bold px-2 py-1 rounded-lg border border-red-100 text-red-400 bg-red-50 hover:bg-red-100 transition-colors">
                      DEL
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-bold text-slate-600">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50">
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Edit product modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setEditModal(null); }}>
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg">Edit Product</h3>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Name</label><input value={editForm.name} onChange={e => setEditForm(f=>({...f,name:e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Price ($)</label><input type="number" step="0.01" value={editForm.price} onChange={e => setEditForm(f=>({...f,price:e.target.value}))} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Original Price</label><input type="number" step="0.01" value={editForm.originalPrice} onChange={e => setEditForm(f=>({...f,originalPrice:e.target.value}))} placeholder="Optional" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              </div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Image URL</label><input value={editForm.imageUrl} onChange={e => setEditForm(f=>({...f,imageUrl:e.target.value}))} placeholder="https://..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Description</label><textarea value={editForm.description} onChange={e => setEditForm(f=>({...f,description:e.target.value}))} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={editForm.inStock} onChange={e => setEditForm(f=>({...f,inStock:e.target.checked}))} className="w-4 h-4 rounded" /> In Stock</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer"><input type="checkbox" checked={editForm.featured} onChange={e => setEditForm(f=>({...f,featured:e.target.checked}))} className="w-4 h-4 rounded" /> Featured</label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditModal(null)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-2xl text-sm">Cancel</button>
              <button onClick={saveProduct} disabled={saving} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl text-sm disabled:opacity-60">{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── users ────────────────────────────────────────────────────────────────────
function UserStatusBadge({ status }: { status: string }) {
  if (status === "banned") return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
      <Ban size={9} /> BANNED
    </span>
  );
  if (status === "disabled") return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
      <XCircle size={9} /> DISABLED
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
      <CheckCircle2 size={9} /> ACTIVE
    </span>
  );
}

function UsersPanel({ pwd }: { pwd: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [walletModal, setWalletModal] = useState<{ user: AdminUser; action: "add" | "deduct" } | null>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletSaving, setWalletSaving] = useState(false);
  const { toast } = useToast();
  const PER = 30;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await adminFetch(`/api/admin/users?limit=${PER}&offset=${p * PER}`, pwd);
      if (r.ok) { const d = await r.json() as { users: AdminUser[]; total: number }; setUsers(d.users); setTotal(d.total); }
    } finally { setLoading(false); }
  }, [pwd]);

  useEffect(() => { load(page); }, [load, page]);
  const pages = Math.ceil(total / PER);

  async function setStatus(user: AdminUser, status: string) {
    setActing(user.id);
    try {
      const r = await adminFetch(`/api/admin/users/${user.id}`, pwd, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status } : u));
        toast({ title: status === "active" ? "User re-activated" : status === "disabled" ? "User disabled" : "User banned" });
        setExpandedId(null);
      } else {
        toast({ variant: "destructive", title: "Action failed" });
      }
    } finally { setActing(null); }
  }

  async function adjustWallet() {
    if (!walletModal) return;
    const amt = parseFloat(walletAmount);
    if (isNaN(amt) || amt <= 0) { toast({ variant: "destructive", title: "Enter a valid amount" }); return; }
    setWalletSaving(true);
    try {
      const r = await adminFetch(`/api/admin/users/${walletModal.user.id}/wallet`, pwd, {
        method: "POST",
        body: JSON.stringify({ action: walletModal.action, amount: amt }),
      });
      const d = await r.json() as { walletBalance?: string; error?: string };
      if (!r.ok) throw new Error(d.error || "Failed");
      const newBalance = d.walletBalance ?? "0";
      setUsers(prev => prev.map(u => u.id === walletModal.user.id ? { ...u, walletBalance: newBalance } : u));
      toast({ title: walletModal.action === "add" ? `Added $${amt.toFixed(2)}` : `Deducted $${amt.toFixed(2)}`, description: `New balance: $${Number(newBalance).toFixed(2)}` });
      setWalletModal(null);
      setWalletAmount("");
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Wallet update failed" });
    } finally {
      setWalletSaving(false);
    }
  }

  async function deleteUser(user: AdminUser) {
    setActing(user.id);
    try {
      const r = await adminFetch(`/api/admin/users/${user.id}`, pwd, { method: "DELETE" });
      if (r.ok) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        setTotal(t => t - 1);
        toast({ title: "User deleted" });
        setConfirmDelete(null);
        setExpandedId(null);
      } else {
        toast({ variant: "destructive", title: "Delete failed" });
      }
    } finally { setActing(null); }
  }

  const COLORS = ["from-blue-500 to-blue-700","from-purple-500 to-purple-700","from-emerald-500 to-emerald-700","from-rose-500 to-rose-700","from-amber-500 to-amber-700"];

  return (
    <div className="p-4 pb-6 space-y-3">
      {/* wallet modal */}
      {walletModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setWalletModal(null); setWalletAmount(""); }}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${walletModal.action === "add" ? "bg-emerald-100" : "bg-red-100"}`}>
              <DollarSign size={22} className={walletModal.action === "add" ? "text-emerald-600" : "text-red-500"} />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center mb-1">
              {walletModal.action === "add" ? "Add Funds" : "Deduct Funds"}
            </h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              {walletModal.action === "add" ? "Add" : "Deduct"} balance for{" "}
              <span className="font-semibold text-slate-700">{walletModal.user.email}</span>
            </p>
            <p className="text-xs text-slate-400 mb-1">Current balance: <span className="font-bold text-slate-600">${Number(walletModal.user.walletBalance).toFixed(2)}</span></p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg font-black text-slate-400">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={walletAmount}
                onChange={e => setWalletAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-3 text-lg font-bold text-center focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {["1", "5", "10", "20", "50", "100", "200", "500"].map(v => (
                <button key={v} onClick={() => setWalletAmount(v)}
                  className="py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  ${v}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setWalletModal(null); setWalletAmount(""); }}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600">
                Cancel
              </button>
              <button onClick={adjustWallet} disabled={walletSaving || !walletAmount}
                className={`flex-1 py-3 rounded-2xl text-white text-sm font-bold disabled:opacity-60 ${walletModal.action === "add" ? "bg-emerald-500" : "bg-red-500"}`}>
                {walletSaving ? "Saving…" : walletModal.action === "add" ? "Add Balance" : "Deduct Balance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center mb-1">Delete user?</h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              <span className="font-semibold text-slate-700">{confirmDelete.email}</span> will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600">
                Cancel
              </button>
              <button onClick={() => deleteUser(confirmDelete)} disabled={acting === confirmDelete.id}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold disabled:opacity-60">
                {acting === confirmDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">{total} registered</p>
          <h2 className="text-xl font-black text-slate-900">Users</h2>
        </div>
        <button onClick={() => load(page)}
          className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors ${loading ? "animate-spin" : ""}`}>
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
        : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Users size={24} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-400 text-sm">No users yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u, i) => {
              const isExpanded = expandedId === u.id;
              return (
                <div key={u.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${u.status === "banned" ? "border-red-100" : u.status === "disabled" ? "border-amber-100" : "border-slate-100"}`}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${COLORS[i % COLORS.length]} flex items-center justify-center text-white font-black text-sm shrink-0 ${u.status !== "active" ? "opacity-50" : ""}`}>
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800 truncate">{u.name || "No name set"}</p>
                        <UserStatusBadge status={u.status} />
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-600">${Number(u.walletBalance).toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => setExpandedId(isExpanded ? null : u.id)}
                        className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors">
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50/60">
                      {/* Wallet management row */}
                      <div className="flex gap-2">
                        <button onClick={() => { setWalletModal({ user: u, action: "add" }); setWalletAmount(""); setExpandedId(null); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold">
                          <DollarSign size={13} /> Add Balance
                        </button>
                        <button onClick={() => { setWalletModal({ user: u, action: "deduct" }); setWalletAmount(""); setExpandedId(null); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-bold">
                          <DollarSign size={13} /> Deduct
                        </button>
                      </div>
                      {/* Status / admin actions row */}
                      <div className="flex gap-2 flex-wrap">
                        {u.status !== "active" && (
                          <button onClick={() => setStatus(u, "active")} disabled={acting === u.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-bold disabled:opacity-60">
                            <UserCheck size={13} /> Activate
                          </button>
                        )}
                        {u.status !== "disabled" && (
                          <button onClick={() => setStatus(u, "disabled")} disabled={acting === u.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold disabled:opacity-60">
                            <XCircle size={13} /> Disable
                          </button>
                        )}
                        {u.status !== "banned" && (
                          <button onClick={() => setStatus(u, "banned")} disabled={acting === u.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold disabled:opacity-60">
                            <Ban size={13} /> Ban
                          </button>
                        )}
                        <button onClick={() => { setConfirmDelete(u); setExpandedId(null); }} disabled={acting === u.id}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold disabled:opacity-60">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      }

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-bold text-slate-600">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
            className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50">
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── payments ─────────────────────────────────────────────────────────────────
function PlainInput({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 block mb-1.5">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function PaymentsPanel({ pwd }: { pwd: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [form, setForm] = useState({
    mpesaEnabled: false,
    mpesaShortcode: "",
    mpesaConsumerKey: "",
    mpesaConsumerSecret: "",
    mpesaPasskey: "",
    mpesaCallbackUrl: "",
    mpesaEnv: "sandbox",
    usdtEnabled: false,
    usdtWalletAddress: "",
    usdtNetwork: "TRC20",
    nowpaymentsEnabled: false,
    nowpaymentsApiKey: "",
    nowpaymentsIpnSecret: "",
    nowpaymentsPublicKey: "",
    coingateEnabled: false,
    coingateApiKey: "",
    emailFrom: "",
    smtpHost: "",
    smtpPort: "",
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    whatsappContact: "",
    googleClientId: "",
    googleClientSecret: "",
    paymentMethods: [{ method: "BTC", walletAddress: "", network: "", label: "", enabled: true }],
  });

  useEffect(() => {
    adminFetch(apiPath("/api/admin/settings"), pwd)
      .then(r => r.json())
      .then((d: AdminSettings) => {
        setSettings(d);
        setForm({
          mpesaEnabled: d.mpesaEnabled,
          mpesaShortcode: d.mpesaShortcode ?? "",
          mpesaConsumerKey: "",
          mpesaConsumerSecret: "",
          mpesaPasskey: "",
          mpesaCallbackUrl: d.mpesaCallbackUrl ?? "",
          mpesaEnv: d.mpesaEnv ?? "sandbox",
          usdtEnabled: d.usdtEnabled,
          usdtWalletAddress: d.usdtWalletAddress ?? "",
          usdtNetwork: d.usdtNetwork ?? "TRC20",
          nowpaymentsEnabled: d.nowpaymentsEnabled,
          nowpaymentsApiKey: "",
          nowpaymentsIpnSecret: "",
          nowpaymentsPublicKey: "",
          coingateEnabled: d.coingateEnabled,
          coingateApiKey: "",
          emailFrom: d.emailFrom ?? "",
          smtpHost: d.smtpHost ?? "",
          smtpPort: d.smtpPort ?? "",
          smtpSecure: d.smtpSecure,
          smtpUser: d.smtpUser ?? "",
          smtpPass: "",
          whatsappContact: d.whatsappContact ?? "",
          googleClientId: "",
          googleClientSecret: "",
          paymentMethods: d.paymentMethods?.length ? d.paymentMethods.map(m => ({ method: m.method ?? "", walletAddress: m.walletAddress ?? "", network: m.network ?? "", label: m.label ?? "", enabled: m.enabled !== false })) : [{ method: "BTC", walletAddress: "", network: "", label: "", enabled: true }],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pwd]);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        mpesaEnabled: form.mpesaEnabled,
        mpesaEnv: form.mpesaEnv,
        usdtEnabled: form.usdtEnabled,
        usdtNetwork: form.usdtNetwork,
        nowpaymentsEnabled: form.nowpaymentsEnabled,
        ...(form.nowpaymentsIpnSecret ? { nowpaymentsIpnSecret: form.nowpaymentsIpnSecret } : {}),
        ...(form.nowpaymentsPublicKey ? { nowpaymentsPublicKey: form.nowpaymentsPublicKey } : {}),
        coingateEnabled: form.coingateEnabled,
        emailFrom: form.emailFrom,
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser,
        whatsappContact: form.whatsappContact,
        paymentMethods: form.paymentMethods.filter(m => m.method || m.walletAddress || m.label || m.network),
      };
      if (form.mpesaShortcode) body.mpesaShortcode = form.mpesaShortcode;
      if (form.mpesaConsumerKey) body.mpesaConsumerKey = form.mpesaConsumerKey;
      if (form.mpesaConsumerSecret) body.mpesaConsumerSecret = form.mpesaConsumerSecret;
      if (form.mpesaPasskey) body.mpesaPasskey = form.mpesaPasskey;
      if (form.mpesaCallbackUrl) body.mpesaCallbackUrl = form.mpesaCallbackUrl;
      if (form.usdtWalletAddress) body.usdtWalletAddress = form.usdtWalletAddress;
      if (form.nowpaymentsApiKey) body.nowpaymentsApiKey = form.nowpaymentsApiKey;
      if (form.coingateApiKey) body.coingateApiKey = form.coingateApiKey;
      if (form.smtpPass) body.smtpPass = form.smtpPass;
      if (form.whatsappContact) body.whatsappContact = form.whatsappContact;
      if (form.googleClientId) body.googleClientId = form.googleClientId;
      if (form.googleClientSecret) body.googleClientSecret = form.googleClientSecret;

      const r = await adminFetch(apiPath("/api/admin/settings/update"), pwd, { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      const updated = await r.json() as AdminSettings;
      setSettings(updated);
      setForm(f => ({
        ...f,
        mpesaConsumerKey: "", mpesaConsumerSecret: "", mpesaPasskey: "",
        nowpaymentsApiKey: "", coingateApiKey: "",
        smtpPass: "",
        googleClientId: "", googleClientSecret: "",
        paymentMethods: updated.paymentMethods?.length
          ? updated.paymentMethods.map(m => ({ method: m.method, walletAddress: m.walletAddress, network: m.network ?? "", label: m.label ?? "", enabled: m.enabled !== false }))
          : f.paymentMethods,
      }));
      toast({ title: "Settings saved", description: "Payment configuration updated." });
    } catch { toast({ variant: "destructive", title: "Failed to save settings" }); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} h="h-40" />)}</div>;

  const saved = (v: string | null) => v === "***";

  return (
    <div className="p-4 pb-28 space-y-3">
      <div>
        <p className="text-xs text-slate-400 font-medium">Configure gateways</p>
        <h2 className="text-xl font-black text-slate-900">Payments</h2>
      </div>

      {/* ── Wallets / custom methods ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3.5 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-800">Wallets & Custom Methods</p>
          <p className="text-[10px] font-semibold text-slate-400">Add BTC, USDT, or any custom payment option</p>
        </div>
        <div className="px-4 pb-4 pt-3 space-y-3">
          {form.paymentMethods.map((item, index) => (
            <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <PlainInput label="Method Type" value={item.method} onChange={v => setForm(f => ({ ...f, paymentMethods: f.paymentMethods.map((m, i) => i === index ? { ...m, method: v } : m) }))} placeholder="BTC, USDT, Custom" />
                  <PlainInput label="Label" value={item.label ?? ""} onChange={v => setForm(f => ({ ...f, paymentMethods: f.paymentMethods.map((m, i) => i === index ? { ...m, label: v } : m) }))} placeholder="e.g. Bitcoin wallet" />
                </div>
                <Toggle
                  enabled={item.enabled !== false}
                  onToggle={() => setForm(f => ({
                    ...f,
                    paymentMethods: f.paymentMethods.map((m, i) => i === index ? { ...m, enabled: m.enabled === false ? true : false } : m),
                  }))}
                />
              </div>
              <PlainInput label="Wallet Address" value={item.walletAddress} onChange={v => setForm(f => ({ ...f, paymentMethods: f.paymentMethods.map((m, i) => i === index ? { ...m, walletAddress: v } : m) }))} placeholder="Wallet address" />
              <PlainInput label="Network / Notes" value={item.network ?? ""} onChange={v => setForm(f => ({ ...f, paymentMethods: f.paymentMethods.map((m, i) => i === index ? { ...m, network: v } : m) }))} placeholder="TRC20, ERC20, custom note" />
            </div>
          ))}
          <button type="button" onClick={() => setForm(f => ({ ...f, paymentMethods: [...f.paymentMethods, { method: "", walletAddress: "", network: "", label: "", enabled: true }] }))}
            className="w-full rounded-2xl border border-dashed border-slate-200 py-3 text-sm font-semibold text-slate-500">
            Add payment method
          </button>
        </div>
      </div>

      {/* ── M-Pesa ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm bg-green-600">M</div>
            <div>
              <p className="text-sm font-bold text-slate-800">M-Pesa (Daraja)</p>
              <span className="text-[10px] font-semibold text-slate-400">Kenya · STK Push</span>
            </div>
          </div>
          <Toggle enabled={form.mpesaEnabled} onToggle={() => setForm(f => ({ ...f, mpesaEnabled: !f.mpesaEnabled }))} />
        </div>
        <div className={`px-4 pb-4 pt-3 space-y-3 transition-opacity ${form.mpesaEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          {/* env toggle */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Environment</label>
            <div className="flex gap-2">
              {["sandbox","production"].map(env => (
                <button key={env} type="button" onClick={() => setForm(f => ({ ...f, mpesaEnv: env }))}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors capitalize ${form.mpesaEnv === env ? "bg-green-600 text-white border-green-600" : "border-slate-200 text-slate-500 bg-slate-50 hover:border-green-400"}`}>
                  {env}
                </button>
              ))}
            </div>
          </div>
          <PlainInput label="Paybill / Shortcode" value={form.mpesaShortcode}
            onChange={v => setForm(f => ({ ...f, mpesaShortcode: v }))} placeholder="e.g. 174379" />
          <MaskedInput label="Consumer Key" value={form.mpesaConsumerKey}
            onChange={v => setForm(f => ({ ...f, mpesaConsumerKey: v }))}
            placeholder={saved(settings?.mpesaConsumerKey ?? null) ? "Saved — enter new to replace" : "Daraja consumer key"} />
          <MaskedInput label="Consumer Secret" value={form.mpesaConsumerSecret}
            onChange={v => setForm(f => ({ ...f, mpesaConsumerSecret: v }))}
            placeholder={saved(settings?.mpesaConsumerSecret ?? null) ? "Saved — enter new to replace" : "Daraja consumer secret"} />
          <MaskedInput label="Passkey (LipaNaMpesa)" value={form.mpesaPasskey}
            onChange={v => setForm(f => ({ ...f, mpesaPasskey: v }))}
            placeholder={saved(settings?.mpesaPasskey ?? null) ? "Saved — enter new to replace" : "STK push passkey"} />
          <PlainInput label="Callback URL" value={form.mpesaCallbackUrl}
            onChange={v => setForm(f => ({ ...f, mpesaCallbackUrl: v }))}
            placeholder="https://yourdomain.com/api/payments/mpesa/callback"
            hint="Leave blank to auto-detect from your domain." />
        </div>
      </div>

      {/* ── USDT ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm bg-amber-500">₮</div>
            <div>
              <p className="text-sm font-bold text-slate-800">USDT Manual Pay</p>
              <span className="text-[10px] font-semibold text-slate-400">Worldwide · Crypto</span>
            </div>
          </div>
          <Toggle enabled={form.usdtEnabled} onToggle={() => setForm(f => ({ ...f, usdtEnabled: !f.usdtEnabled }))} />
        </div>
        <div className={`px-4 pb-4 pt-3 space-y-3 transition-opacity ${form.usdtEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <MaskedInput label="Wallet Address" value={form.usdtWalletAddress}
            onChange={v => setForm(f => ({ ...f, usdtWalletAddress: v }))} placeholder="Your USDT wallet address" />
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Network</label>
            <div className="flex gap-2">
              {["TRC20","ERC20","BEP20"].map(net => (
                <button key={net} type="button" onClick={() => setForm(f => ({ ...f, usdtNetwork: net }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${form.usdtNetwork === net ? "bg-amber-500 text-white border-amber-500" : "border-slate-200 text-slate-500 bg-slate-50 hover:border-amber-300"}`}>
                  {net}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── NowPayments ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm bg-blue-600">N</div>
            <div>
              <p className="text-sm font-bold text-slate-800">NowPayments</p>
              <span className="text-[10px] font-semibold text-slate-400">Crypto gateway</span>
            </div>
          </div>
          <Toggle enabled={form.nowpaymentsEnabled} onToggle={() => setForm(f => ({ ...f, nowpaymentsEnabled: !f.nowpaymentsEnabled }))} />
        </div>
        <div className={`px-4 pb-4 pt-3 space-y-2 transition-opacity ${form.nowpaymentsEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <MaskedInput label="API Key (Secret)" value={form.nowpaymentsApiKey}
            onChange={v => setForm(f => ({ ...f, nowpaymentsApiKey: v }))}
            placeholder={saved(settings?.nowpaymentsApiKey ?? null) ? "Saved — enter new to replace" : "Enter API key"} />
          <MaskedInput label="Public Key" value={(form as unknown as Record<string,string>).nowpaymentsPublicKey ?? ""}
            onChange={v => setForm(f => ({ ...f, nowpaymentsPublicKey: v }))}
            placeholder={saved((settings as unknown as Record<string,string|null>|undefined)?.nowpaymentsPublicKey ?? null) ? "Saved — enter new to replace" : "Enter public key"} />
          <MaskedInput label="IPN Secret" value={(form as unknown as Record<string,string>).nowpaymentsIpnSecret ?? ""}
            onChange={v => setForm(f => ({ ...f, nowpaymentsIpnSecret: v }))}
            placeholder={saved((settings as unknown as Record<string,string|null>|undefined)?.nowpaymentsIpnSecret ?? null) ? "Saved — enter new to replace" : "Enter IPN secret"} />
          <p className="text-[10px] text-slate-400">Get keys at <a href="https://nowpayments.io" target="_blank" rel="noreferrer" className="text-blue-500 underline">nowpayments.io</a> → Store Settings → Payment Settings</p>
        </div>
      </div>

      {/* ── CoinGate ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm bg-purple-600">C</div>
            <div>
              <p className="text-sm font-bold text-slate-800">CoinGate</p>
              <span className="text-[10px] font-semibold text-slate-400">Crypto gateway</span>
            </div>
          </div>
          <Toggle enabled={form.coingateEnabled} onToggle={() => setForm(f => ({ ...f, coingateEnabled: !f.coingateEnabled }))} />
        </div>
        <div className={`px-4 pb-4 pt-3 space-y-2 transition-opacity ${form.coingateEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <MaskedInput label="API Token" value={form.coingateApiKey}
            onChange={v => setForm(f => ({ ...f, coingateApiKey: v }))}
            placeholder={saved(settings?.coingateApiKey ?? null) ? "Saved — enter new to replace" : "Enter API token"} />
          <p className="text-[10px] text-slate-400">Get token at <a href="https://coingate.com" target="_blank" rel="noreferrer" className="text-purple-500 underline">coingate.com</a></p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Support Contact</p>
          <p className="text-[10px] font-semibold text-slate-400">Used by payment help and order support links</p>
        </div>
        <PlainInput label="WhatsApp Number" value={form.whatsappContact} onChange={v => setForm(f => ({ ...f, whatsappContact: v }))} placeholder="2547XXXXXXXX" hint="Include country code, no plus sign needed." />
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Email SMTP</p>
          <p className="text-[10px] font-semibold text-slate-400">Used for signup, order, wallet, and activation emails</p>
        </div>
        <PlainInput label="From Email" value={form.emailFrom} onChange={v => setForm(f => ({ ...f, emailFrom: v }))} placeholder="GSM World <no-reply@yourdomain.com>" />
        <PlainInput label="SMTP Host" value={form.smtpHost} onChange={v => setForm(f => ({ ...f, smtpHost: v }))} placeholder="smtp.mailprovider.com" />
        <PlainInput label="SMTP Port" value={form.smtpPort} onChange={v => setForm(f => ({ ...f, smtpPort: v }))} placeholder="587" />
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Use TLS</p>
            <p className="text-[10px] text-slate-400">Enable for secure SMTP connections</p>
          </div>
          <Toggle enabled={form.smtpSecure} onToggle={() => setForm(f => ({ ...f, smtpSecure: !f.smtpSecure }))} />
        </div>
        <PlainInput label="SMTP Username" value={form.smtpUser} onChange={v => setForm(f => ({ ...f, smtpUser: v }))} placeholder="SMTP username" />
        <MaskedInput label="SMTP Password" value={form.smtpPass} onChange={v => setForm(f => ({ ...f, smtpPass: v }))} placeholder="Enter new SMTP password" />
      </div>


      {/* ── Google OAuth ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-200 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Google OAuth</p>
            <span className="text-[10px] font-semibold text-slate-400">Sign in with Google · Backend flow</span>
          </div>
        </div>
        <div className="px-4 pb-4 pt-3 space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 text-[11px] text-blue-700 leading-relaxed">
            Get your credentials at{" "}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="font-bold underline">
              Google Cloud Console
            </a>{" "}
            → Create OAuth 2.0 Client ID → Web application.
            Set Authorised redirect URI to:{" "}
            <code className="bg-blue-100 px-1 rounded text-[10px]">https://gsmworld.vercel.app/api/auth/google/callback</code>
          </div>
          <MaskedInput
            label="Client ID"
            value={(form as unknown as Record<string,string>).googleClientId ?? ""}
            onChange={v => setForm(f => ({ ...f, googleClientId: v }))}
            placeholder={settings?.googleClientId ? "Saved — enter new to replace" : "Enter Google Client ID"}
          />
          <MaskedInput
            label="Client Secret"
            value={(form as unknown as Record<string,string>).googleClientSecret ?? ""}
            onChange={v => setForm(f => ({ ...f, googleClientSecret: v }))}
            placeholder={settings?.googleClientSecret ? "Saved — enter new to replace" : "Enter Google Client Secret"}
          />
          {settings?.googleClientId && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              Google OAuth is configured
            </div>
          )}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-50 transition-colors shadow-sm">
        {saving ? "Saving…" : "Save Payment Settings"}
      </button>
    </div>
  );
}

// ─── login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (pwd: string, isDefault: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!password) return;
    setLoading(true); setError("");
    try {
      const r = await fetch(apiPath("/api/admin/login"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await r.json() as { ok?: boolean; isDefaultPassword?: boolean; error?: string };
      if (!r.ok) { setError(d.error ?? "Incorrect password."); return; }
      onLogin(password, !!(d as { isDefaultPassword?: boolean }).isDefaultPassword);
    } catch { setError("Cannot reach server."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* decorative top */}
      <div className="h-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500" />

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* logo block */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 mb-6">
              <Smartphone size={14} className="text-blue-400" />
              <span className="text-white/70 text-xs font-semibold">GSM World</span>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/40">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">Admin Console</h1>
            <p className="text-slate-400 text-sm mt-1">Secure access required</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
              <XCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex gap-2">
              <input type={show ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="Enter admin password"
                className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              <button type="button" onClick={() => setShow(v => !v)}
                className="px-3.5 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button onClick={submit} disabled={!password || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-40 transition-colors">
              {loading ? "Verifying…" : "Sign In →"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────
export function AdminPage() {
  const ADMIN_KEY = "gsm_admin_session";
  const [pwd, setPwd] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_KEY + "_pwd") ?? ""; } catch { return ""; }
  });
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_KEY + "_ok") === "1"; } catch { return false; }
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [isDefaultWarn, setIsDefaultWarn] = useState(false);

  function handleLogin(password: string, isDefault: boolean) {
    setPwd(password);
    setAuthed(true);
    try { sessionStorage.setItem("gsm_admin_session_pwd", password); sessionStorage.setItem("gsm_admin_session_ok", "1"); } catch {}
    if (isDefault) { setIsDefaultWarn(true); setShowChangePwd(true); }
  }

  if (!authed) return <LoginScreen onLogin={handleLogin} />;

  const pageTitle: Record<Tab, string> = {
    overview: "Dashboard", orders: "Orders",
    products: "Products", users: "Users", payments: "Payments",
  };

  return (
    <>
      {showChangePwd && (
        <ChangePasswordModal pwd={pwd} isForced={isDefaultWarn}
          onSuccess={np => { setPwd(np); setShowChangePwd(false); setIsDefaultWarn(false); try { sessionStorage.setItem("gsm_admin_session_pwd", np); } catch {} }}
          onDismiss={() => { setShowChangePwd(false); setIsDefaultWarn(false); }}
        />
      )}

      <div className="flex h-screen bg-slate-50 overflow-hidden">

        {/* ── Desktop Left Sidebar ── */}
        <aside className="hidden md:flex flex-col w-56 bg-slate-900 shrink-0">
          {/* Brand */}
          <div className="px-5 py-5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Shield size={15} className="text-white" />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-none">GSM World</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Admin Console</p>
              </div>
            </div>
          </div>

          {/* Sidebar Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
            {NAV.map(item => {
              const active = tab === item.id;
              return (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                    active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}>
                  <item.icon size={16} strokeWidth={active ? 2.5 : 1.8} />
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-white/10 space-y-1">
            <button onClick={() => { setShowChangePwd(true); setIsDefaultWarn(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
              <KeyRound size={15} />
              <span className="text-sm font-medium">Change Password</span>
            </button>
            <button onClick={() => { setAuthed(false); setPwd(""); try { sessionStorage.removeItem("gsm_admin_session_pwd"); sessionStorage.removeItem("gsm_admin_session_ok"); } catch {} }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors">
              <LogOut size={15} />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </aside>

        {/* ── Main Area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── top header ── */}
          <header className="shrink-0 bg-slate-900 px-4">
            {/* Mobile: brand row */}
            <div className="flex md:hidden items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Shield size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-sm leading-none">GSM World</p>
                  <p className="text-slate-500 text-[10px]">Admin Console</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setShowChangePwd(true); setIsDefaultWarn(false); }}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <KeyRound size={13} />
                </button>
                <button onClick={() => { setAuthed(false); setPwd(""); try { sessionStorage.removeItem("gsm_admin_session_pwd"); sessionStorage.removeItem("gsm_admin_session_ok"); } catch {} }}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold px-3 h-8 rounded-xl transition-colors">
                  <LogOut size={12} />
                  Logout
                </button>
              </div>
            </div>
            {/* Page title row */}
            <div className="py-2.5 flex items-center justify-between">
              <h1 className="text-white font-black text-lg">{pageTitle[tab]}</h1>
              {/* Desktop: actions in header */}
              <div className="hidden md:flex items-center gap-1">
                <button onClick={() => { setShowChangePwd(true); setIsDefaultWarn(false); }}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <KeyRound size={13} />
                </button>
                <button onClick={() => { setAuthed(false); setPwd(""); try { sessionStorage.removeItem("gsm_admin_session_pwd"); sessionStorage.removeItem("gsm_admin_session_ok"); } catch {} }}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold px-3 h-8 rounded-xl transition-colors">
                  <LogOut size={12} />
                  Logout
                </button>
              </div>
            </div>
          </header>

          {/* ── scrollable content ── */}
          <main className="flex-1 overflow-y-auto">
            {tab === "overview"  && <OverviewPanel pwd={pwd} onNavigate={setTab} />}
            {tab === "orders"    && <OrdersPanel   pwd={pwd} />}
            {tab === "products"  && <ProductsPanel pwd={pwd} />}
            {tab === "users"     && <UsersPanel    pwd={pwd} />}
            {tab === "payments"  && <PaymentsPanel pwd={pwd} />}
          </main>

          {/* ── Mobile bottom nav ── */}
          <nav className="md:hidden shrink-0 bg-white border-t border-slate-100">
            <div className="flex">
              {NAV.map(item => {
                const active = tab === item.id;
                return (
                  <button key={item.id} onClick={() => setTab(item.id)}
                    className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors">
                    {active && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                    )}
                    <item.icon
                      size={20}
                      className={`transition-colors ${active ? "text-blue-600" : "text-slate-400"}`}
                      strokeWidth={active ? 2.5 : 1.8}
                    />
                    <span className={`text-[10px] font-bold transition-colors ${active ? "text-blue-600" : "text-slate-400"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

        </div>
      </div>
    </>
  );
}
