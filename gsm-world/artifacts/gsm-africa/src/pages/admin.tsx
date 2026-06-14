import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, LayoutDashboard, ShoppingBag, Package, Users, Settings,
  LogOut, TrendingUp, DollarSign, RefreshCw, Search, Eye, EyeOff,
  ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, AlertCircle,
  ToggleLeft, ToggleRight, KeyRound, AlertTriangle, X, ArrowUpRight,
  Smartphone, Zap, Ban, Trash2, UserCheck, MoreVertical,
  MessageSquare, Send, Cpu, UserPlus, Phone, Headphones, WifiOff, Bell,
  Store, ExternalLink, Image, Menu, Megaphone, RotateCcw, Wallet,
  Download, Tag, Fingerprint,
} from "lucide-react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

// ─── types ────────────────────────────────────────────────────────────────────
interface PaymentNotification {
  id: string;
  orderId: number;
  customerEmail: string;
  amount: string;
  method: string;
  ts: number;
  read: boolean;
}

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
  resendApiKey?: string | null;
  whatsappContact: string | null;
  supportPhone?: string | null;
  supportEmail?: string | null;
  googleClientId?: string | null;
  googleClientSecret?: string | null;
  paymentMethods: Array<{ method: string; walletAddress: string; network: string | null; label: string | null; enabled?: boolean }>;
  otsApiToken?: string | null;
  otsSenderId?: string | null;
  otsAdminPhone?: string | null;
  openaiApiKey?: string | null;
  imeiInfoApiToken?: string | null;
  botSystemPromptOverride?: string | null;
}
interface Stats {
  orders: { total: number };
  paidOrders: { count: number; revenue: number };
  pendingOrders: { count: number };
  failedOrders: { count: number };
  users: number;
  products: number;
  recentOrders: Order[];
}
interface Order {
  id: number; customerName: string | null; customerEmail: string | null;
  customerPhone: string | null; paymentMethod: string | null;
  paymentStatus: string; total: string; currency: string; createdAt: string;
  notes: string | null; correctionNote: string | null; deviceIdentifier: string | null; orderType: string | null;
}
interface OrderMsg {
  id: number; orderId: number; senderType: string; senderEmail: string;
  message: string; createdAt: string;
}
interface ToolActivation {
  id: number; toolName: string; userId: number | null; userEmail: string | null;
  recipientEmail: string | null; status: string; activationCode: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
}
interface AdminUser {
  id: number; email: string; name: string | null; username: string | null;
  walletBalance: string; status: string; createdAt: string; registrationIp: string | null;
}
interface AdminProduct {
  id: number; name: string; price: string;
  inStock: boolean; categoryName: string | null; imageUrl: string | null;
  originalPrice?: string | null; description?: string | null; featured?: boolean;
}
interface LiveChatSession {
  id: number; visitorId: string; visitorName: string | null;
  status: string; createdAt: string; updatedAt: string;
  closedBy: string | null; lastMessage: string | null; unreadAdmin: number;
}
interface LiveChatMsg {
  id: number; sessionId: number; senderType: string;
  message: string; fileUrl: string | null; createdAt: string;
  readAt: string | null;
}

const NAV = [
  { id: "overview",       label: "Overview",       icon: LayoutDashboard },
  { id: "orders",         label: "Orders",         icon: ShoppingBag },
  { id: "products",       label: "Products",       icon: Package },
  { id: "users",          label: "Users",          icon: Users },
  { id: "resellers",      label: "Resellers",      icon: Store },
  { id: "payments",       label: "Payments",       icon: Settings },
  { id: "announcements",  label: "Announcements",  icon: Megaphone },
  { id: "live_chat",      label: "Live Chat",      icon: Headphones },
  { id: "imei_logs",      label: "IMEI Logs",      icon: Smartphone },
] as const;
type Tab = typeof NAV[number]["id"];

// Bottom-nav tabs (mobile) — keep to 5 so they fit comfortably
const BOTTOM_NAV: Array<typeof NAV[number]> = [
  { id: "overview",  label: "Overview",  icon: LayoutDashboard },
  { id: "orders",    label: "Orders",    icon: ShoppingBag },
  { id: "products",  label: "Products",  icon: Package },
  { id: "users",     label: "Users",     icon: Users },
  { id: "payments",  label: "Payments",  icon: Settings },
] as typeof NAV[number][];

// ─── WebAuthn session token (persisted across page loads via sessionStorage) ────
let _waToken: string | null = (() => { try { return sessionStorage.getItem("gsm_admin_webauthn_token"); } catch { return null; } })();
function _setWaToken(t: string | null) {
  _waToken = t;
  try { if (t) sessionStorage.setItem("gsm_admin_webauthn_token", t); else sessionStorage.removeItem("gsm_admin_webauthn_token"); } catch {}
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function adminFetch(path: string, pwd: string, opts: RequestInit = {}) {
  const extra: Record<string, string> = {};
  if (_waToken) extra["x-admin-token"] = _waToken;
  return fetch(path, {
    ...opts,
    headers: { "x-admin-password": pwd, "Content-Type": "application/json", ...extra, ...(opts.headers ?? {}) },
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
    paid:        { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: <CheckCircle2 size={10} /> },
    completed:   { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: <CheckCircle2 size={10} /> },
    active:      { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: <CheckCircle2 size={10} /> },
    processing:  { cls: "bg-blue-50 text-blue-700 border border-blue-200",          icon: <RefreshCw size={10} /> },
    pending:     { cls: "bg-amber-50 text-amber-700 border border-amber-200",       icon: <Clock size={10} /> },
    pending_payment_confirmation: { cls: "bg-amber-50 text-amber-700 border border-amber-200", icon: <Clock size={10} /> },
    paused:      { cls: "bg-purple-50 text-purple-700 border border-purple-200",    icon: <Clock size={10} /> },
    failed:      { cls: "bg-red-50 text-red-600 border border-red-200",             icon: <XCircle size={10} /> },
    cancelled:   { cls: "bg-red-50 text-red-600 border border-red-200",             icon: <XCircle size={10} /> },
    refunded:    { cls: "bg-slate-100 text-slate-500 border border-slate-200",      icon: <AlertCircle size={10} /> },
    closed:      { cls: "bg-slate-100 text-slate-500 border border-slate-200",      icon: <XCircle size={10} /> },
    unpaid:      { cls: "bg-slate-100 text-slate-500 border border-slate-200",      icon: <AlertCircle size={10} /> },
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
      <div className="relative w-full max-w-sm mx-4 mb-20 sm:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden">
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
interface ApkRelease {
  tag: string;
  name: string;
  published: string;
  downloadUrl: string;
  size: number;
  body: string;
}

function OverviewPanel({ pwd, onNavigate }: { pwd: string; onNavigate: (tab: Tab) => void }) {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveRequests, setLiveRequests] = useState<{ waiting: number; active: number } | null>(null);
  const [cascadeStatus, setCascadeStatus] = useState<{ models: string[]; updatedAt: string | null; isDefault: boolean } | null>(null);
  const [cascadeRefreshing, setCascadeRefreshing] = useState(false);
  const [apkRelease, setApkRelease] = useState<ApkRelease | null>(null);
  const [apkLoading, setApkLoading] = useState(true);
  const [apkError, setApkError] = useState(false);

  async function refreshCascade() {
    setCascadeRefreshing(true);
    try {
      const r = await adminFetch(apiPath("/api/admin/cascade/refresh"), pwd, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setCascadeStatus({ models: d.working, updatedAt: new Date().toISOString(), isDefault: false });
        toast({ title: `Model check complete — ${d.working.length} of ${d.tested} models working` });
      } else {
        toast({ variant: "destructive", title: d.error ?? "Check failed" });
      }
    } catch { toast({ variant: "destructive", title: "Check failed" }); }
    finally { setCascadeRefreshing(false); }
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, liveRes] = await Promise.all([
        adminFetch("/api/admin/stats", pwd),
        adminFetch("/api/chat/live/stats", pwd),
      ]);
      if (statsRes.ok) setStats(await statsRes.json() as Stats);
      if (liveRes.ok) setLiveRequests(await liveRes.json() as { waiting: number; active: number });
    }
    finally { if (!silent) setLoading(false); }
    // Fetch cascade status separately (best-effort — don't block stats)
    adminFetch(apiPath("/api/admin/cascade/status"), pwd)
      .then(r => r.ok ? r.json() : null)
      .then((d: { models: string[]; updatedAt: string | null; isDefault: boolean } | null) => {
        if (d) setCascadeStatus(d);
      })
      .catch(() => {});
  }, [pwd]);

  // Fetch latest ADMIN APK release from GitHub
  // Searches all releases for one tagged admin-apk-* or with an admin APK asset
  const fetchApkRelease = useCallback(async () => {
    setApkLoading(true);
    setApkError(false);
    try {
      const r = await fetch(apiPath("/api/app/version"));
      if (!r.ok) { setApkError(true); return; }
      const d = await r.json() as { version: string; apkUrl: string | null };
      if (!d.version || !d.apkUrl) { setApkError(true); return; }
      setApkRelease({
        tag: d.version,
        name: `Admin APK · ${d.version}`,
        published: "",
        downloadUrl: d.apkUrl,
        size: 0,
        body: "",
      });
    } catch {
      setApkError(true);
    } finally {
      setApkLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const tick = () => load(true);
    const interval = setInterval(tick, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [load]);
  // Auto-poll GitHub for new APK releases every 5 minutes so the dashboard
  // card updates automatically when a build finishes — no page reload needed.
  // Also re-fetches when the tab becomes visible or the window regains focus.
  useEffect(() => {
    fetchApkRelease();
    const interval = setInterval(fetchApkRelease, 5 * 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchApkRelease(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchApkRelease);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchApkRelease);
    };
  }, [fetchApkRelease]);

  const confirmed = stats?.paidOrders.count ?? 0;
  const pending = stats?.pendingOrders?.count ?? 0;
  const failed = stats?.failedOrders?.count ?? 0;
  const avgOrder = confirmed ? (stats!.paidOrders.revenue / confirmed).toFixed(0) : "0";

  function statusColor(s: string) {
    const m: Record<string, string> = {
      paid:        "bg-emerald-100 text-emerald-700",
      completed:   "bg-emerald-100 text-emerald-700",
      active:      "bg-emerald-100 text-emerald-700",
      processing:  "bg-blue-100 text-blue-700",
      pending:     "bg-amber-100 text-amber-700",
      paused:      "bg-purple-100 text-purple-700",
      failed:      "bg-red-100 text-red-700",
      cancelled:   "bg-red-100 text-red-700",
      refunded:    "bg-slate-100 text-slate-600",
      closed:      "bg-slate-100 text-slate-600",
    };
    return m[s] ?? "bg-slate-100 text-slate-500";
  }

  return (
    <div className="pb-8">
      {/* ── Hero ─────────────────────────────────── */}
      <div className="relative overflow-hidden px-4 pt-5 pb-5"
        style={{ background: "linear-gradient(150deg,#0c1220 0%,#162032 55%,#0c1220 100%)" }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle,#3b82f6,transparent 65%)" }} />
          <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle,#8b5cf6,transparent 65%)" }} />
        </div>
        <div className="relative flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">
              {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
            </p>
            <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">Dashboard</h2>
          </div>
          <button onClick={load}
            className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-all active:scale-90">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-3 w-32 bg-white/10 rounded-full animate-pulse" />
            <div className="h-12 w-48 bg-white/10 rounded-xl animate-pulse" />
            <div className="h-px w-full bg-white/10 my-3" />
            <div className="flex gap-4">{[1,2,3,4].map(i => <div key={i} className="flex-1 h-10 bg-white/10 rounded-xl animate-pulse" />)}</div>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={10} className="text-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-widest">Confirmed Revenue</span>
            </div>
            <p className="text-[52px] font-black text-white leading-none tracking-tight">
              ${(stats?.paidOrders.revenue ?? 0).toFixed(2)}
            </p>
            <p className="text-slate-500 text-[11px] mt-1.5">
              from <span className="text-slate-300 font-bold">{stats?.paidOrders.count ?? 0}</span> paid orders
            </p>
            <div className="flex items-center gap-0 mt-4 pt-3.5 border-t border-white/10">
              {[
                { label: "Paid",    value: confirmed, color: "text-emerald-400" },
                { label: "Pending", value: pending,   color: "text-amber-400"   },
                { label: "Failed",  value: failed,    color: "text-red-400"     },
                { label: "Avg",     value: `$${avgOrder}`, color: "text-blue-300" },
              ].map((k, i, arr) => (
                <div key={k.label} className="flex-1 text-center">
                  <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${k.color} opacity-60`}>{k.label}</p>
                  {i < arr.length - 1 && (
                    <div className="absolute" style={{ display: "none" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 space-y-4 mt-4">
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i=><Skeleton key={i} h="h-28"/>)}</div>
            <Skeleton h="h-48"/>
          </div>
        ) : (
          <>
            {/* ── Metric grid ─────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Orders", value: stats?.orders.total ?? 0, sub: `${confirmed} confirmed`, icon: <ShoppingBag size={15}/>, accent: "#3b82f6", tab: "orders" as Tab },
                { label: "Customers",    value: stats?.users ?? 0,         sub: "registered accounts",  icon: <Users size={15}/>,       accent: "#8b5cf6", tab: "users"   as Tab },
                { label: "Products",     value: stats?.products ?? 0,      sub: "in catalog",           icon: <Package size={15}/>,     accent: "#f59e0b", tab: "products" as Tab },
                { label: "Avg. Order",   value: `$${avgOrder}`,            sub: "per paid order",       icon: <TrendingUp size={15}/>,  accent: "#10b981", tab: null as unknown as Tab },
              ].map(c => (
                <button key={c.label} onClick={() => c.tab && onNavigate(c.tab)}
                  className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-slate-200 active:scale-95 transition-all text-left relative overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(circle at 95% 5%,${c.accent}18,transparent 55%)` }} />
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white mb-3"
                    style={{ background: `linear-gradient(135deg,${c.accent},${c.accent}99)` }}>
                    {c.icon}
                  </div>
                  <p className="text-[30px] font-black text-slate-900 leading-none">{c.value}</p>
                  <p className="text-xs font-black text-slate-700 mt-1.5">{c.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{c.sub}</p>
                </button>
              ))}
            </div>

            {/* ── Live chat alert ──────────────────── */}
            {(liveRequests?.waiting ?? 0) > 0 && (
              <button onClick={() => onNavigate("live_chat")}
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-4 shadow-sm active:scale-[0.98] transition-transform relative overflow-hidden text-left"
                style={{ background: "linear-gradient(135deg,#10b981,#0d9488)" }}>
                <div className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: "radial-gradient(circle at 90% 50%,#ffffff30,transparent 60%)" }} />
                <div className="relative w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-400 border-2 border-emerald-500 animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-400 border-2 border-emerald-500" />
                  <Headphones size={18} className="text-white relative" />
                </div>
                <div className="relative flex-1">
                  <p className="text-[15px] font-black text-white leading-tight">
                    {liveRequests!.waiting} Live Request{liveRequests!.waiting !== 1 ? "s" : ""} Waiting
                  </p>
                  <p className="text-[11px] text-white/80 mt-0.5">
                    {liveRequests!.active > 0 && `${liveRequests!.active} active · `}Tap to respond now
                  </p>
                </div>
                <ChevronRight size={16} className="relative text-white/70 shrink-0" />
              </button>
            )}

            {/* ── Recent orders ────────────────────── */}
            {(stats?.recentOrders?.length ?? 0) > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Recent Orders</p>
                  <button onClick={() => onNavigate("orders")}
                    className="text-[11px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                    View all <ArrowUpRight size={11} />
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {stats!.recentOrders.map((o, idx) => {
                    const initials = (o.customerName ?? o.customerEmail ?? `#${o.id}`)
                      .split(" ").slice(0,2).map((w: string) => w[0]).join("").toUpperCase().slice(0,2);
                    const colors = ["bg-blue-100 text-blue-700","bg-violet-100 text-violet-700","bg-amber-100 text-amber-700","bg-emerald-100 text-emerald-700","bg-rose-100 text-rose-700"];
                    const ic = colors[idx % colors.length];
                    return (
                      <button key={o.id} onClick={() => onNavigate("orders")}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-50 last:border-0 text-left">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${ic}`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 leading-tight truncate">
                            {o.customerName ?? o.customerEmail ?? `Order #${o.id}`}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            #{o.id} · {new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-slate-900">${parseFloat(o.total).toFixed(2)}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusColor(o.paymentStatus)}`}>
                            {o.paymentStatus}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Quick actions ────────────────────── */}
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Orders",       sub: `${stats?.orders.total ?? 0} total`,      icon: <ShoppingBag size={17} />, tab: "orders"    as Tab, accent: "#3b82f6", badge: pending > 0 ? pending : null, badgeColor: "bg-amber-500" },
                  { label: "Products",     sub: `${stats?.products ?? 0} in stock`,       icon: <Package size={17} />,     tab: "products"  as Tab, accent: "#10b981", badge: null, badgeColor: "" },
                  { label: "Customers",    sub: `${stats?.users ?? 0} accounts`,           icon: <Users size={17} />,       tab: "users"     as Tab, accent: "#8b5cf6", badge: null, badgeColor: "" },
                  { label: "Payments",     sub: "config & methods",                        icon: <Zap size={17} />,         tab: "payments"  as Tab, accent: "#f59e0b", badge: null, badgeColor: "" },
                ].map(q => (
                  <button key={q.label} onClick={() => onNavigate(q.tab)}
                    className="bg-white border border-slate-100 rounded-2xl p-4 text-left shadow-sm hover:shadow-md hover:border-slate-200 active:scale-95 transition-all relative overflow-hidden flex items-center gap-3">
                    <div className="absolute inset-0 opacity-[0.03]"
                      style={{ background: `radial-gradient(circle at 0% 100%,${q.accent},transparent 70%)` }} />
                    {q.badge !== null && (
                      <span className={`absolute top-2.5 right-2.5 w-5 h-5 ${q.badgeColor} rounded-full text-white text-[9px] font-black flex items-center justify-center`}>
                        {q.badge}
                      </span>
                    )}
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
                      style={{ background: `linear-gradient(135deg,${q.accent}dd,${q.accent}88)` }}>
                      {q.icon}
                    </div>
                    <div className="relative min-w-0">
                      <p className="text-sm font-black text-slate-800 leading-tight">{q.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight truncate">{q.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── AI Model health ──────────────────── */}
            {cascadeStatus && (
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                  <Cpu size={16} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800">AI Model Health</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {cascadeStatus.isDefault
                      ? "Using default cascade"
                      : `${cascadeStatus.models.length} model${cascadeStatus.models.length !== 1 ? "s" : ""} active`}
                    {!cascadeStatus.isDefault && cascadeStatus.updatedAt &&
                      ` · checked ${new Date(cascadeStatus.updatedAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}`}
                  </p>
                </div>
                <button onClick={refreshCascade} disabled={cascadeRefreshing}
                  className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 transition-colors">
                  <RefreshCw size={11} className={cascadeRefreshing ? "animate-spin" : ""} />
                  {cascadeRefreshing ? "…" : "Check"}
                </button>
              </div>
            )}

            {/* ── Admin APK ────────────────────────── */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Smartphone size={14} className="text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-700">Admin Android App</p>
                  <p className="text-[10px] text-slate-400">Latest APK build from GitHub</p>
                </div>
                <button onClick={fetchApkRelease} disabled={apkLoading}
                  className="text-slate-300 hover:text-blue-500 transition-colors">
                  <RefreshCw size={12} className={apkLoading ? "animate-spin" : ""} />
                </button>
              </div>

              {apkLoading && (
                <div className="px-4 py-4 flex items-center gap-2.5">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Checking latest build…</p>
                </div>
              )}

              {!apkLoading && apkError && (
                <div className="px-4 py-4 space-y-2.5">
                  <p className="text-xs text-slate-400">No APK release found yet.</p>
                  <a href="https://github.com/Zenkaak/Messer/actions" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:underline">
                    <ExternalLink size={11} /> View GitHub Actions
                  </a>
                </div>
              )}

              {!apkLoading && apkRelease && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                      <Tag size={8}/> {apkRelease.tag}
                    </span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <ol className="text-[10px] text-blue-700 leading-relaxed list-decimal list-inside space-y-0.5">
                      <li>Enable <em>"Install from unknown sources"</em> in Settings → Apps.</li>
                      <li>If Play Protect warns you, tap <strong>Install anyway</strong>.</li>
                    </ol>
                  </div>
                  {/* Route through the API proxy so the WebView's
                      DownloadListener intercepts the response and hands it
                      to the native install flow. Direct github.com links
                      get blocked by shouldOverrideUrlLoading. */}
                  <a href={apiPath("/api/admin/download/apk")} download
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors active:scale-95">
                    <Download size={15}/> Download APK
                  </a>
                  <a href="https://github.com/Zenkaak/Messer/releases" target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600">
                    <ExternalLink size={10}/> All releases on GitHub
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

}

interface OrderItem {
  id: number; orderId: number; productId: number; productName: string;
  price: string; quantity: number;
}

// ─── order detail ─────────────────────────────────────────────────────────────
function OrderDetailView({ order: initialOrder, pwd, onBack }: { order: Order; pwd: string; onBack: () => void }) {
  const { toast } = useToast();
  const [order, setOrder] = useState(initialOrder);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [messages, setMessages] = useState<OrderMsg[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Refund state
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState(String(Number(initialOrder.total).toFixed(2)));
  const [refundReason, setRefundReason] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);

  const statusColors: Record<string, string> = {
    paid:        "bg-emerald-50 border-emerald-200 text-emerald-700",
    completed:   "bg-emerald-50 border-emerald-200 text-emerald-700",
    active:      "bg-emerald-50 border-emerald-200 text-emerald-700",
    processing:  "bg-blue-50 border-blue-200 text-blue-700",
    pending:     "bg-amber-50 border-amber-200 text-amber-700",
    paused:      "bg-purple-50 border-purple-200 text-purple-700",
    failed:      "bg-red-50 border-red-200 text-red-600",
    cancelled:   "bg-red-50 border-red-200 text-red-600",
    refunded:    "bg-slate-100 border-slate-200 text-slate-500",
    closed:      "bg-slate-100 border-slate-200 text-slate-500",
    unpaid:      "bg-slate-100 border-slate-200 text-slate-500",
  };
  const sc = statusColors[order.paymentStatus] ?? statusColors.unpaid;

  useEffect(() => {
    loadOrderDetail();
  }, []);

  async function loadOrderDetail() {
    setMsgLoading(true);
    try {
      const r = await adminFetch(apiPath(`/api/admin/orders/${order.id}`), pwd);
      if (r.ok) {
        const data = await r.json() as Order & { items?: OrderItem[]; messages?: OrderMsg[] };
        if (data.items) setOrderItems(data.items);
        if (data.messages) setMessages(data.messages);
      } else {
        // Fallback: load messages separately
        const mr = await fetch(apiPath(`/api/orders/${order.id}/messages`), {
          headers: { "x-admin-password": pwd },
        });
        if (mr.ok) setMessages(await mr.json() as OrderMsg[]);
      }
    } finally { setMsgLoading(false); }
  }

  async function loadMessages() {
    try {
      const r = await fetch(apiPath(`/api/orders/${order.id}/messages`), {
        headers: { "x-admin-password": pwd },
      });
      if (r.ok) setMessages(await r.json() as OrderMsg[]);
    } catch { /* ignore */ }
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

  async function issueRefund() {
    const amt = parseFloat(refundAmount);
    if (!amt || amt <= 0) { toast({ title: "Enter a valid refund amount", variant: "destructive" }); return; }
    setRefunding(true);
    setRefundSuccess(null);
    try {
      const r = await adminFetch(apiPath(`/api/admin/orders/${order.id}/refund`), pwd, {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          reason: refundReason.trim() || "Order correction",
          correctionNote: correctionNote.trim() || undefined,
        }),
      });
      const data = await r.json() as { success?: boolean; message?: string; error?: string };
      if (r.ok && data.success) {
        setRefundSuccess(data.message ?? `$${amt.toFixed(2)} queued for GSM Wallet.`);
        setOrder(prev => ({ ...prev, paymentStatus: "refunded", correctionNote: correctionNote.trim() || prev.correctionNote }));
        setShowRefund(false);
        toast({ title: "Refund issued", description: data.message });
      } else {
        toast({ title: "Refund failed", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } finally { setRefunding(false); }
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

      {/* Correction note — permanent banner once set */}
      {order.correctionNote && (
        <div className="flex gap-3 border border-rose-300 bg-rose-50 rounded-2xl px-4 py-3">
          <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Correction Note</p>
            <p className="text-sm text-rose-800 leading-snug break-words">{order.correctionNote}</p>
          </div>
        </div>
      )}

      {/* Status update buttons */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Update Status</p>
          {updatingStatus && <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="p-3 flex gap-2 flex-wrap">
          {[
            { status: "paid",        label: "Mark Paid",    cls: "bg-emerald-600 text-white hover:bg-emerald-700" },
            { status: "active",      label: "Active",       cls: "bg-emerald-500 text-white hover:bg-emerald-600" },
            { status: "processing",  label: "Processing",   cls: "bg-blue-600 text-white hover:bg-blue-700" },
            { status: "pending",     label: "Mark Pending", cls: "bg-amber-500 text-white hover:bg-amber-600" },
            { status: "paused",      label: "Paused",       cls: "bg-purple-500 text-white hover:bg-purple-600" },
            { status: "completed",   label: "Completed",    cls: "bg-slate-800 text-white hover:bg-slate-900" },
            { status: "closed",      label: "Closed",       cls: "bg-slate-600 text-white hover:bg-slate-700" },
            { status: "failed",      label: "Mark Failed",  cls: "bg-red-500 text-white hover:bg-red-600" },
            { status: "refunded",    label: "Refunded",     cls: "bg-slate-500 text-white hover:bg-slate-600" },
            { status: "cancelled",   label: "Cancelled",    cls: "bg-red-700 text-white hover:bg-red-800" },
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

      {/* Order Items */}
      {orderItems.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Package size={11} /> Order Items</p>
          </div>
          <div className="divide-y divide-slate-50">
            {orderItems.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.productName}</p>
                  <p className="text-[11px] text-slate-400">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-black text-slate-900 shrink-0">${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Wallet Refund */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <RotateCcw size={11} /> Wallet Refund
          </p>
          {order.paymentStatus === "refunded" ? (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Refunded</span>
          ) : (order.paymentStatus === "paid" || order.paymentStatus === "completed") ? (
            <button
              onClick={() => { setShowRefund(v => !v); setRefundSuccess(null); }}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 transition-colors"
            >
              {showRefund ? "Cancel" : "Issue Refund"}
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium">Confirm payment first</span>
          )}
        </div>

        {refundSuccess && (
          <div className="px-4 py-3 bg-emerald-50 flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 font-medium">{refundSuccess}</p>
          </div>
        )}

        {!showRefund && !refundSuccess && (
          <div className="px-4 py-3">
            <p className="text-xs text-slate-400">
              Credit the customer's GSM Wallet for a wrong or disputed charge.
              Refunds appear within <strong>3–5 business days</strong>.
            </p>
          </div>
        )}

        {showRefund && (
          <div className="p-4 space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex gap-2">
              <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700">
                Refund goes to <strong>{order.customerEmail}</strong>'s GSM Wallet within <strong>3–5 business days</strong>.
                The order will be marked as <strong>Refunded</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Refund Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Reason (sent to customer)</label>
              <input
                type="text"
                placeholder="e.g. Wrong product charged by bot"
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Correction Note <span className="text-rose-500">*</span>
                <span className="ml-1 text-slate-400 font-normal normal-case tracking-normal">— internal, saved on order forever</span>
              </label>
              <textarea
                rows={3}
                placeholder='e.g. "Bot added iSunshare instead of Google Play $50 — issued full refund to wallet"'
                value={correctionNote}
                onChange={e => setCorrectionNote(e.target.value)}
                className="w-full border border-rose-200 bg-rose-50 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              />
            </div>

            <button
              onClick={issueRefund}
              disabled={refunding}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              {refunding
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
                : <><Wallet size={15} /> Refund to GSM Wallet</>
              }
            </button>
          </div>
        )}
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
type OrderFilter = "all" | "unlock" | "product" | "activation" | "giftcard";

const ORDER_FILTER_TABS: { id: OrderFilter; label: string }[] = [
  { id: "all",        label: "All" },
  { id: "unlock",     label: "Unlock" },
  { id: "product",    label: "Product" },
  { id: "activation", label: "Credits" },
  { id: "giftcard",   label: "Gift Cards" },
];

function OrderTypeBadge({ type }: { type: string | null }) {
  const t = (type ?? "product").toLowerCase();
  const cls =
    t === "unlock"     ? "bg-violet-100 text-violet-700" :
    t === "activation" ? "bg-amber-100 text-amber-700" :
    t === "credits"    ? "bg-blue-100 text-blue-700" :
                         "bg-slate-100 text-slate-500";
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${cls}`}>{t}</span>
  );
}

function OrdersPanel({ pwd }: { pwd: string }) {
  const [filterType, setFilterType] = useState<OrderFilter>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [activations, setActivations] = useState<ToolActivation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const PER = 20;

  const load = useCallback(async (p: number, ft: OrderFilter, silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (ft === "giftcard") {
        const r = await adminFetch(`/api/admin/tool-activations`, pwd);
        if (r.ok) {
          const d = await r.json() as ToolActivation[];
          setActivations(d);
          setTotal(d.length);
        }
      } else {
        const typeParam = ft !== "all" ? `&orderType=${ft === "activation" ? "credits" : ft}` : "";
        const r = await adminFetch(`/api/admin/orders?limit=${PER}&offset=${p * PER}${typeParam}`, pwd);
        if (r.ok) {
          const d = await r.json() as { orders: Order[]; total: number };
          setOrders(d.orders);
          setTotal(d.total);
        }
      }
    } finally { if (!silent) setLoading(false); }
  }, [pwd]);

  // Preserve scroll position during silent auto-refresh
  // Mobile: body scrolls (window.scrollY). Desktop (md+): <main> element scrolls.
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    scrollContainerRef.current = document.querySelector("main[class*='overflow-y-auto']") as HTMLElement | null;
  }, []);

  const getScroll = () => scrollContainerRef.current?.scrollTop ?? 0;
  const restoreScroll = (y: number) => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = y; };

  useEffect(() => {
    load(page, filterType);
    const tick = () => {
      const savedScroll = getScroll();
      load(page, filterType, true);
      requestAnimationFrame(() => {
        if (savedScroll > 0) restoreScroll(savedScroll);
      });
    };
    const interval = setInterval(tick, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [load, page, filterType]);

  function handleFilterChange(ft: OrderFilter) {
    setFilterType(ft);
    setPage(0);
  }

  const pages = filterType === "giftcard" ? 1 : Math.ceil(total / PER);

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
        <button onClick={() => load(page, filterType)}
          className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors ${loading ? "animate-spin" : ""}`}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {ORDER_FILTER_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleFilterChange(t.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border ${
              filterType === t.id
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
      ) : filterType === "giftcard" ? (
        activations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Zap size={24} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-400 text-sm">No gift card orders yet</p>
            <p className="text-slate-300 text-xs mt-1">Gift card activations will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activations.map(a => (
              <div key={a.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                      <Zap size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[10px] font-black text-slate-400">#{a.id}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                          a.status === "pending"   ? "bg-amber-100 text-amber-700"
                          : a.status === "completed" || a.status === "active" ? "bg-emerald-100 text-emerald-700"
                          : a.status === "failed"  ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-500"
                        }`}>{a.status}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 truncate">{a.toolName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{a.userEmail || a.recipientEmail || "—"}</p>
                      {a.activationCode && (
                        <p className="text-[11px] font-mono text-emerald-600 mt-0.5 truncate">Code: {a.activationCode}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 shrink-0">{new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : orders.length === 0 ? (
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
                      <OrderTypeBadge type={o.orderType} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate">{o.customerName || o.customerEmail || "Guest"}</p>
                    <p className="text-[11px] text-slate-400 truncate">{o.customerPhone}</p>
                    {o.paymentMethod && (
                      <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide">{o.paymentMethod.replace(/_/g, " ")}</span>
                    )}
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
      )}

      {pages > 1 && filterType !== "giftcard" && (
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

  const IMAGE_MAP: Array<{ keywords: string[]; url: string }> = [
    { keywords: ["iphone 15", "iphone15"], url: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&q=80" },
    { keywords: ["iphone 14", "iphone14"], url: "https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?w=300&q=80" },
    { keywords: ["iphone 13", "iphone13"], url: "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=300&q=80" },
    { keywords: ["iphone 12", "iphone12"], url: "https://images.unsplash.com/photo-1602524816984-c6f8f4cc4a7a?w=300&q=80" },
    { keywords: ["iphone 11", "iphone11"], url: "https://images.unsplash.com/photo-1574755393849-623942496936?w=300&q=80" },
    { keywords: ["iphone x", "iphonex", "iphone xs", "iphone xr"], url: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=300&q=80" },
    { keywords: ["iphone"], url: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300&q=80" },
    { keywords: ["samsung galaxy", "samsung s", "samsung note", "samsung a"], url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=300&q=80" },
    { keywords: ["samsung"], url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=300&q=80" },
    { keywords: ["huawei"], url: "https://images.unsplash.com/photo-1551817958-d9d86fb29431?w=300&q=80" },
    { keywords: ["motorola", "moto"], url: "https://images.unsplash.com/photo-1567581935884-3349723552ca?w=300&q=80" },
    { keywords: ["sony xperia", "sony"], url: "https://images.unsplash.com/photo-1565536421961-3d5ee59c1e0a?w=300&q=80" },
    { keywords: ["xiaomi", "redmi", "poco"], url: "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=300&q=80" },
    { keywords: ["lg ", "lg-", "lg v", "lg g"], url: "https://images.unsplash.com/photo-1586917049952-4c9a0e5b2e16?w=300&q=80" },
    { keywords: ["frp bypass", "frp remove", "frp unlock", "bypass frp", "remove frp"], url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=80" },
    { keywords: ["imei check", "imei unlock", "imei lookup"], url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=300&q=80" },
    { keywords: ["server credit", "server package", "server plan"], url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=300&q=80" },
    { keywords: ["tool activation", "license", "activate", "activation"], url: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=300&q=80" },
    { keywords: ["android unlock", "android remove"], url: "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=300&q=80" },
    { keywords: ["pattern remove", "screen lock", "screen unlock", "pin remove"], url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=80" },
    { keywords: ["nokia"], url: "https://images.unsplash.com/photo-1567581935884-3349723552ca?w=300&q=80" },
    { keywords: ["blackberry"], url: "https://images.unsplash.com/photo-1586464395186-dfe2e14a8cc5?w=300&q=80" },
    { keywords: ["credits", "credit"], url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80" },
  ];

  function getSmartImage(name: string): string | null {
    const lower = name.toLowerCase();
    for (const entry of IMAGE_MAP) {
      if (entry.keywords.some(kw => lower.includes(kw))) return entry.url;
    }
    return null;
  }

  async function smartUpdateImages() {
    const toUpdate = products.filter(p => !p.imageUrl);
    if (toUpdate.length === 0) {
      toast({ title: "All products already have images" }); return;
    }
    let updated = 0;
    for (const p of toUpdate) {
      const url = getSmartImage(p.name);
      if (!url) continue;
      const r = await adminFetch(apiPath(`/api/admin/products/${p.id}`), pwd, {
        method: "PATCH", body: JSON.stringify({ imageUrl: url }),
      });
      if (r.ok) updated++;
    }
    toast({ title: `Updated ${updated} products with images` });
    void load(page, search);
  }

  return (
    <div className="p-4 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">{total} total</p>
          <h2 className="text-xl font-black text-slate-900">Products</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void smartUpdateImages()}
            title="Auto-assign images to products without images"
            className="flex items-center gap-1.5 px-3 h-9 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors">
            <Image size={13} /> Smart Images
          </button>
          <button onClick={() => load(page, search)}
            className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors ${loading ? "animate-spin" : ""}`}>
            <RefreshCw size={15} />
          </button>
        </div>
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

// ─── resellers ────────────────────────────────────────────────────────────────
interface AdminReseller {
  id: number; userId: number; email: string; storeName: string | null;
  storeSlug: string; status: string; securityFeePaid: boolean;
  paymentMethod: string | null; paymentReference: string | null;
  commissionRate: string; totalEarned: string; totalOrders: number;
  rejectionReason: string | null; createdAt: string; approvedAt: string | null;
  ownerName: string | null;
}

interface AdminWithdrawal {
  id: number; resellerId: number; amount: string; status: string;
  paymentMethod: string; paymentAddress: string;
  notes: string | null; adminNotes: string | null;
  createdAt: string; processedAt: string | null;
  storeName: string | null; storeSlug: string;
  ownerName: string | null; ownerEmail: string;
}

function ResellerStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_payment: "bg-orange-50 text-orange-700 border border-orange-200",
    pending_approval: "bg-amber-50 text-amber-700 border border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    rejected: "bg-red-50 text-red-700 border border-red-200",
  };
  const label: Record<string, string> = {
    pending_payment: "Pending Payment",
    pending_approval: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
  };
  return (
    <span className={`inline-flex text-[9px] font-bold px-2 py-0.5 rounded-full ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {label[status] ?? status}
    </span>
  );
}

function WithdrawalBadge({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="inline-flex text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</span>
  );
  if (status === "rejected") return (
    <span className="inline-flex text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Rejected</span>
  );
  return (
    <span className="inline-flex text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
  );
}

function ResellersPanel({ pwd }: { pwd: string }) {
  const [activeTab, setActiveTab] = useState<"applications" | "withdrawals">("applications");
  const [resellers, setResellers] = useState<AdminReseller[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [wLoading, setWLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<AdminReseller | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);
  const [wActingId, setWActingId] = useState<number | null>(null);
  const [wNotes, setWNotes] = useState("");
  const [wActionModal, setWActionModal] = useState<{ w: AdminWithdrawal; action: "approve" | "reject" } | null>(null);
  const [selectedReseller, setSelectedReseller] = useState<AdminReseller | null>(null);
  const { toast } = useToast();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch(apiPath("/api/admin/resellers"), pwd);
      if (r.ok) { const d = await r.json() as { resellers: AdminReseller[] }; setResellers(d.resellers); }
    } finally { setLoading(false); }
  }, [pwd]);

  const loadWithdrawals = useCallback(async () => {
    setWLoading(true);
    try {
      const r = await adminFetch(apiPath("/api/admin/resellers/withdrawals"), pwd);
      if (r.ok) { const d = await r.json() as { withdrawals: AdminWithdrawal[] }; setWithdrawals(d.withdrawals); }
    } finally { setWLoading(false); }
  }, [pwd]);

  useEffect(() => { void load(); void loadWithdrawals(); }, [load, loadWithdrawals]);

  async function approve(id: number) {
    setActingId(id);
    try {
      const r = await adminFetch(apiPath(`/api/admin/resellers/${id}/approve`), pwd, { method: "POST" });
      if (r.ok) { toast({ title: "Reseller approved" }); void load(); }
      else toast({ variant: "destructive", title: "Failed to approve" });
    } finally { setActingId(null); }
  }

  async function confirmPayment(id: number) {
    setActingId(id);
    try {
      const r = await adminFetch(apiPath(`/api/admin/resellers/${id}/confirm-payment`), pwd, { method: "POST" });
      if (r.ok) { toast({ title: "Payment confirmed, reseller approved" }); void load(); }
      else toast({ variant: "destructive", title: "Failed" });
    } finally { setActingId(null); }
  }

  async function submitReject() {
    if (!rejectModal) return;
    setActingId(rejectModal.id);
    try {
      const r = await adminFetch(apiPath(`/api/admin/resellers/${rejectModal.id}/reject`), pwd, {
        method: "POST", body: JSON.stringify({ reason: rejectReason }),
      });
      if (r.ok) { toast({ title: "Application rejected" }); setRejectModal(null); void load(); }
      else toast({ variant: "destructive", title: "Failed to reject" });
    } finally { setActingId(null); }
  }

  async function processWithdrawal(id: number, action: "approve" | "reject", notes: string) {
    setWActingId(id);
    try {
      const r = await adminFetch(apiPath(`/api/admin/resellers/withdrawals/${id}/${action}`), pwd, {
        method: "POST", body: JSON.stringify({ adminNotes: notes }),
      });
      if (r.ok) {
        toast({ title: action === "approve" ? "Withdrawal marked as paid" : "Withdrawal rejected" });
        setWActionModal(null);
        void loadWithdrawals();
        void load();
      } else toast({ variant: "destructive", title: "Failed" });
    } finally { setWActingId(null); }
  }

  const stats = {
    total: resellers.length,
    approved: resellers.filter(r => r.status === "approved").length,
    pending: resellers.filter(r => r.status === "pending_approval").length,
    pendingPayment: resellers.filter(r => r.status === "pending_payment").length,
  };

  const pendingW = withdrawals.filter(w => w.status === "pending").length;

  return (
    <div className="px-4 md:px-6 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-slate-900 text-xl">Resellers</h2>
        <button onClick={() => { void load(); void loadWithdrawals(); }} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button onClick={() => setActiveTab("applications")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === "applications" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
          }`}>
          Applications ({resellers.length})
        </button>
        <button onClick={() => setActiveTab("withdrawals")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors relative ${
            activeTab === "withdrawals" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
          }`}>
          Withdrawals {pendingW > 0 && (
            <span className="ml-1 inline-flex w-4 h-4 items-center justify-center text-[9px] bg-amber-500 text-white rounded-full">{pendingW}</span>
          )}
        </button>
      </div>

      {/* ── APPLICATIONS TAB ─────────────────────────────────────────── */}
      {activeTab === "applications" && (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total", value: stats.total, cls: "text-slate-700" },
              { label: "Approved", value: stats.approved, cls: "text-emerald-600" },
              { label: "Reviewing", value: stats.pending, cls: "text-amber-600" },
              { label: "Awaiting Pay", value: stats.pendingPayment, cls: "text-orange-600" },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-3 text-center">
                <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)}</div>
          ) : resellers.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400">
              <Store size={32} className="mb-3 opacity-40" />
              <p className="font-semibold text-sm">No reseller applications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {resellers.map(r => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all" onClick={() => setSelectedReseller(r)}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Store size={16} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 text-sm">{r.storeName ?? r.storeSlug}</p>
                        <ResellerStatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{r.ownerName ?? r.email} · {r.email}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-500">
                        <span className="font-mono bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px]">/store/{r.storeSlug}</span>
                        {r.status === "approved" && (
                          <a href={`${base}/store/${r.storeSlug}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-blue-500 hover:underline text-[10px]"
                            onClick={e => e.stopPropagation()}>
                            <ExternalLink size={9} /> View Store
                          </a>
                        )}
                        <span>{r.commissionRate}% commission</span>
                        <span>Earned: ${parseFloat(r.totalEarned).toFixed(2)}</span>
                      </div>
                      {(r.paymentMethod || r.paymentReference) && (
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5 text-[11px] text-blue-700">
                          <span className="font-bold">Payment: </span>
                          {r.paymentMethod} — Ref: <span className="font-mono">{r.paymentReference}</span>
                        </div>
                      )}
                      {r.rejectionReason && (
                        <p className="text-[11px] text-red-500 mt-1">Rejected: {r.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {r.status === "pending_approval" && (
                      <>
                        <button onClick={() => approve(r.id)} disabled={actingId === r.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50">
                          <CheckCircle2 size={11} /> Approve
                        </button>
                        <button onClick={() => { setRejectModal(r); setRejectReason(""); }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl">
                          <XCircle size={11} /> Reject
                        </button>
                      </>
                    )}
                    {r.status === "pending_payment" && (
                      <>
                        <button onClick={() => confirmPayment(r.id)} disabled={actingId === r.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50">
                          <CheckCircle2 size={11} /> Confirm Payment
                        </button>
                        <button onClick={() => { setRejectModal(r); setRejectReason(""); }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl">
                          <XCircle size={11} /> Reject
                        </button>
                      </>
                    )}
                    {r.status === "rejected" && (
                      <button onClick={() => approve(r.id)} disabled={actingId === r.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold rounded-xl disabled:opacity-50">
                        <CheckCircle2 size={11} /> Approve Anyway
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── WITHDRAWALS TAB ──────────────────────────────────────────── */}
      {activeTab === "withdrawals" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total", value: withdrawals.length, cls: "text-slate-700" },
              { label: "Pending", value: withdrawals.filter(w => w.status === "pending").length, cls: "text-amber-600" },
              { label: "Paid Out", value: withdrawals.filter(w => w.status === "approved").reduce((s, w) => s + parseFloat(w.amount), 0).toFixed(2), prefix: "$", cls: "text-emerald-600" },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-3 text-center">
                <p className={`text-lg font-black ${s.cls}`}>{s.prefix ?? ""}{s.value}</p>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {wLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} />)}</div>
          ) : withdrawals.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400">
              <DollarSign size={32} className="mb-3 opacity-40" />
              <p className="font-semibold text-sm">No withdrawal requests yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {withdrawals.map(w => (
                <div key={w.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <DollarSign size={16} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-slate-800 text-base">${parseFloat(w.amount).toFixed(2)}</p>
                        <WithdrawalBadge status={w.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {w.ownerName ?? w.ownerEmail} · {w.storeName ?? w.storeSlug}
                      </p>
                      <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-600">
                        <span className="font-bold">{w.paymentMethod}: </span>
                        <span className="font-mono break-all">{w.paymentAddress}</span>
                      </div>
                      {w.notes && <p className="text-[11px] text-slate-400 mt-1">Note: {w.notes}</p>}
                      {w.adminNotes && <p className="text-[11px] text-blue-500 mt-1">Admin note: {w.adminNotes}</p>}
                      <p className="text-[10px] text-slate-300 mt-1">
                        {new Date(w.createdAt).toLocaleDateString()}
                        {w.processedAt && ` · Processed ${new Date(w.processedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  {w.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setWActionModal({ w, action: "approve" }); setWNotes(""); }}
                        disabled={wActingId === w.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50">
                        <CheckCircle2 size={11} /> Mark Paid
                      </button>
                      <button
                        onClick={() => { setWActionModal({ w, action: "reject" }); setWNotes(""); }}
                        disabled={wActingId === w.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl">
                        <XCircle size={11} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reseller full-page detail */}
      {selectedReseller && (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-slate-900 flex items-center gap-3 px-4 py-3">
            <button onClick={() => setSelectedReseller(null)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 font-mono">/store/{selectedReseller.storeSlug}</p>
              <h2 className="text-base font-black text-white truncate">{selectedReseller.storeName ?? selectedReseller.storeSlug}</h2>
            </div>
            <ResellerStatusBadge status={selectedReseller.status} />
          </div>

          {/* Store hero */}
          <div className="bg-slate-900 px-4 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Store size={28} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">{selectedReseller.storeName ?? selectedReseller.storeSlug}</h3>
                <p className="text-slate-400 text-sm">{selectedReseller.email}</p>
                {selectedReseller.ownerName && <p className="text-slate-300 text-xs mt-0.5">Owner: {selectedReseller.ownerName}</p>}
              </div>
            </div>
            {/* KPI row */}
            <div className="flex items-center gap-0 mt-4 pt-3.5 border-t border-white/10">
              {[
                { label: "Earned",     value: `$${parseFloat(selectedReseller.totalEarned).toFixed(2)}`, color: "text-emerald-400" },
                { label: "Orders",     value: String(selectedReseller.totalOrders),                       color: "text-white"       },
                { label: "Commission", value: `${selectedReseller.commissionRate}%`,                      color: "text-blue-300"    },
              ].map(k => (
                <div key={k.label} className="flex-1 text-center">
                  <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${k.color} opacity-60`}>{k.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-4 space-y-4">
            {/* Owner info */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Owner Details</p>
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { label: "Name",    value: selectedReseller.ownerName ?? "—" },
                  { label: "Email",   value: selectedReseller.email             },
                  { label: "User ID", value: `#${selectedReseller.userId}`      },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-400">{row.label}</span>
                    <span className="text-xs font-bold text-slate-700 text-right max-w-[65%] break-all">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Store details */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Details</p>
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { label: "Store Name",  value: selectedReseller.storeName ?? "—"   },
                  { label: "Store Slug",  value: selectedReseller.storeSlug           },
                  { label: "Status",      value: selectedReseller.status              },
                  { label: "Security Fee Paid", value: selectedReseller.securityFeePaid ? "✓ Yes" : "✗ No" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-400">{row.label}</span>
                    <span className="text-xs font-bold text-slate-700 text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment info */}
            {(selectedReseller.paymentMethod || selectedReseller.paymentReference) && (
              <div className="bg-blue-50 rounded-2xl border border-blue-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-blue-100">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Security Fee Payment</p>
                </div>
                <div className="divide-y divide-blue-50">
                  {[
                    { label: "Method",    value: selectedReseller.paymentMethod ?? "—"    },
                    { label: "Reference", value: selectedReseller.paymentReference ?? "—"  },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-semibold text-blue-500">{row.label}</span>
                      <span className="text-xs font-bold text-blue-800 font-mono text-right max-w-[65%] break-all">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</p>
              </div>
              <div className="divide-y divide-slate-50">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-400">Applied</span>
                  <span className="text-xs font-bold text-slate-700">{new Date(selectedReseller.createdAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span>
                </div>
                {selectedReseller.approvedAt && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-400">Approved</span>
                    <span className="text-xs font-bold text-emerald-600">{new Date(selectedReseller.approvedAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rejection reason */}
            {selectedReseller.rejectionReason && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Rejection Reason</p>
                <p className="text-sm text-red-700 leading-relaxed">{selectedReseller.rejectionReason}</p>
              </div>
            )}

            {/* Live store link */}
            {selectedReseller.status === "approved" && (
              <a href={`${base}/store/${selectedReseller.storeSlug}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm active:scale-95 transition-all">
                <ExternalLink size={14} /> View Live Store
              </a>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {selectedReseller.status === "pending_approval" && (
                <>
                  <button onClick={() => { approve(selectedReseller.id); setSelectedReseller(null); }} disabled={actingId === selectedReseller.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl disabled:opacity-50 active:scale-95 transition-all">
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button onClick={() => { setRejectModal(selectedReseller); setRejectReason(""); setSelectedReseller(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-2xl">
                    <XCircle size={14} /> Reject
                  </button>
                </>
              )}
              {selectedReseller.status === "pending_payment" && (
                <>
                  <button onClick={() => { confirmPayment(selectedReseller.id); setSelectedReseller(null); }} disabled={actingId === selectedReseller.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl disabled:opacity-50 active:scale-95 transition-all">
                    <CheckCircle2 size={14} /> Confirm Payment
                  </button>
                  <button onClick={() => { setRejectModal(selectedReseller); setRejectReason(""); setSelectedReseller(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-2xl">
                    <XCircle size={14} /> Reject
                  </button>
                </>
              )}
              {selectedReseller.status === "rejected" && (
                <button onClick={() => { approve(selectedReseller.id); setSelectedReseller(null); }} disabled={actingId === selectedReseller.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-bold rounded-2xl disabled:opacity-50">
                  <CheckCircle2 size={14} /> Approve Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject application modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 pb-20 md:pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900">Reject Application</h3>
              <button onClick={() => setRejectModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm">✕</button>
            </div>
            <p className="text-sm text-slate-500">Rejecting <strong>{rejectModal.storeName ?? rejectModal.storeSlug}</strong></p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-2xl text-sm">Cancel</button>
              <button onClick={() => void submitReject()} disabled={actingId === rejectModal.id}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-sm disabled:opacity-60">
                {actingId === rejectModal.id ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal action modal */}
      {wActionModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 pb-20 md:pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900">
                {wActionModal.action === "approve" ? "Mark as Paid" : "Reject Withdrawal"}
              </h3>
              <button onClick={() => setWActionModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm">✕</button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
              <p className="font-bold text-slate-800">${parseFloat(wActionModal.w.amount).toFixed(2)} → {wActionModal.w.paymentMethod}</p>
              <p className="font-mono text-xs text-slate-500 mt-0.5 break-all">{wActionModal.w.paymentAddress}</p>
              <p className="text-xs text-slate-400 mt-1">{wActionModal.w.ownerName ?? wActionModal.w.ownerEmail} · {wActionModal.w.storeName}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Admin note (optional)</label>
              <input value={wNotes} onChange={e => setWNotes(e.target.value)}
                placeholder={wActionModal.action === "approve" ? "e.g. Sent via M-Pesa" : "Reason for rejection..."}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setWActionModal(null)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-2xl text-sm">Cancel</button>
              <button
                onClick={() => void processWithdrawal(wActionModal.w.id, wActionModal.action, wNotes)}
                disabled={wActingId === wActionModal.w.id}
                className={`flex-1 py-3 text-white font-black rounded-2xl text-sm disabled:opacity-60 ${
                  wActionModal.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}>
                {wActingId === wActionModal.w.id ? "Processing…" : wActionModal.action === "approve" ? "Confirm Paid" : "Confirm Reject"}
              </button>
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

// ─── full user detail view ─────────────────────────────────────────────────────
function UserDetailView({ user: initUser, pwd, onBack, onUserUpdated, onUserDeleted }: {
  user: AdminUser; pwd: string;
  onBack: () => void;
  onUserUpdated?: (u: AdminUser) => void;
  onUserDeleted?: (id: number) => void;
}) {
  const [user, setUser] = useState(initUser);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [walletModal, setWalletModal] = useState<{ action: "add" | "deduct" } | null>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletSaving, setWalletSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ id: number; senderType: string; message: string; createdAt: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setOrdersLoading(true);
    fetch(`/api/orders?customerEmail=${encodeURIComponent(user.email)}`)
      .then(r => r.ok ? r.json() as Promise<Order[]> : [])
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [user.email]);

  async function loadChat() {
    setChatLoading(true);
    try {
      const r = await adminFetch(`/api/admin/users/${user.id}/messages`, pwd);
      if (r.ok) {
        const d = await r.json() as { messages: { id: number; senderType: string; message: string; createdAt: string }[] };
        setChatHistory(d.messages ?? []);
      }
    } finally { setChatLoading(false); }
  }

  async function setStatus(status: string) {
    setActing(true);
    try {
      const r = await adminFetch(`/api/admin/users/${user.id}`, pwd, { method: "PATCH", body: JSON.stringify({ status }) });
      if (r.ok) {
        const updated = { ...user, status };
        setUser(updated);
        onUserUpdated?.(updated);
        toast({ title: status === "active" ? "User activated" : status === "disabled" ? "User disabled" : "User banned" });
      } else toast({ variant: "destructive", title: "Action failed" });
    } finally { setActing(false); }
  }

  async function adjustWallet() {
    const amt = parseFloat(walletAmount);
    if (isNaN(amt) || amt <= 0 || !walletModal) { toast({ variant: "destructive", title: "Enter a valid amount" }); return; }
    setWalletSaving(true);
    try {
      const r = await adminFetch(`/api/admin/users/${user.id}/wallet`, pwd, {
        method: "POST",
        body: JSON.stringify({ action: walletModal.action, amount: amt }),
      });
      const d = await r.json() as { walletBalance?: string; error?: string };
      if (!r.ok) throw new Error(d.error || "Failed");
      const updated = { ...user, walletBalance: d.walletBalance ?? "0" };
      setUser(updated);
      onUserUpdated?.(updated);
      toast({ title: walletModal.action === "add" ? `Added $${amt.toFixed(2)}` : `Deducted $${amt.toFixed(2)}`, description: `New balance: $${Number(d.walletBalance ?? 0).toFixed(2)}` });
      setWalletModal(null); setWalletAmount("");
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Wallet update failed" });
    } finally { setWalletSaving(false); }
  }

  async function deleteUser() {
    setActing(true);
    try {
      const r = await adminFetch(`/api/admin/users/${user.id}`, pwd, { method: "DELETE" });
      if (r.ok) {
        toast({ title: "User deleted" });
        onUserDeleted?.(user.id);
        onBack();
      } else toast({ variant: "destructive", title: "Delete failed" });
    } finally { setActing(false); }
  }

  async function sendDirectMessage() {
    if (!msgText.trim()) return;
    setMsgSending(true);
    const text = msgText.trim();
    try {
      const r = await adminFetch(`/api/admin/users/${user.id}/message`, pwd, { method: "POST", body: JSON.stringify({ message: text }) });
      const d = await r.json() as { error?: string; id?: number };
      if (!r.ok) throw new Error(d.error || "Failed");
      setChatHistory(prev => [...prev, { id: d.id ?? Date.now(), senderType: "admin", message: text, createdAt: new Date().toISOString() }]);
      setMsgText("");
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Send failed" });
    } finally { setMsgSending(false); }
  }

  const COLORS = ["from-blue-500 to-blue-700","from-purple-500 to-purple-700","from-emerald-500 to-emerald-700","from-rose-500 to-rose-700","from-amber-500 to-amber-700"];
  const avatarGrad = COLORS[user.id % COLORS.length];

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Wallet modal */}
      {walletModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setWalletModal(null); setWalletAmount(""); }}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 pb-24 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${walletModal.action === "add" ? "bg-emerald-100" : "bg-red-100"}`}>
              <DollarSign size={22} className={walletModal.action === "add" ? "text-emerald-600" : "text-red-500"} />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center mb-1">{walletModal.action === "add" ? "Add Funds" : "Deduct Funds"}</h3>
            <p className="text-sm text-slate-500 text-center mb-4">Current: <span className="font-bold text-slate-700">${Number(user.walletBalance).toFixed(2)}</span></p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg font-black text-slate-400">$</span>
              <input type="number" min="0.01" step="0.01" value={walletAmount} onChange={e => setWalletAmount(e.target.value)}
                placeholder="0.00" autoFocus
                className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-3 text-lg font-bold text-center focus:outline-none focus:border-blue-400" />
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {["1","5","10","20","50","100","200","500"].map(v => (
                <button key={v} onClick={() => setWalletAmount(v)}
                  className="py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">${v}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setWalletModal(null); setWalletAmount(""); }}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600">Cancel</button>
              <button onClick={adjustWallet} disabled={walletSaving || !walletAmount}
                className={`flex-1 py-3 rounded-2xl text-white text-sm font-bold disabled:opacity-60 ${walletModal.action === "add" ? "bg-emerald-500" : "bg-red-500"}`}>
                {walletSaving ? "Saving…" : walletModal.action === "add" ? "Add Balance" : "Deduct Balance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 pb-24 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-black text-slate-900 text-center mb-1">Delete user?</h3>
            <p className="text-sm text-slate-500 text-center mb-5"><span className="font-semibold text-slate-700">{user.email}</span> will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600">Cancel</button>
              <button onClick={deleteUser} disabled={acting}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold disabled:opacity-60">
                {acting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message drawer */}
      {msgOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) { setMsgOpen(false); setMsgText(""); setChatHistory([]); } }}>
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col" style={{ maxHeight: "88vh" }}>
            <div className="flex items-center gap-3 px-5 pt-5 pb-3.5 border-b border-slate-100">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-black text-sm shrink-0`}>
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{user.name || "No name"}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
              <button onClick={() => { setMsgOpen(false); setMsgText(""); setChatHistory([]); }}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" style={{ minHeight: 160 }}>
              {chatLoading ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
              ) : chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <MessageSquare size={28} className="text-slate-200 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No messages yet</p>
                </div>
              ) : chatHistory.map(m => (
                <div key={m.id} className={`flex ${m.senderType === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${m.senderType === "admin" ? "bg-blue-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                    <p className={`text-[9px] mt-0.5 ${m.senderType === "admin" ? "text-blue-200" : "text-slate-400"}`}>{new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2 px-4 py-3 border-t border-slate-100">
              <textarea value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDirectMessage(); } }}
                rows={2} placeholder="Type a message…"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              <button onClick={sendDirectMessage} disabled={msgSending || !msgText.trim()}
                className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl disabled:opacity-40 shrink-0">
                {msgSending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 flex items-center gap-3 px-4 py-3 shadow-sm">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 shrink-0">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-medium">User #{user.id}</p>
          <h2 className="text-base font-black text-slate-900 truncate">{user.name || user.email}</h2>
        </div>
        <UserStatusBadge status={user.status} />
      </div>

      {/* ── Profile ── */}
      <div className="bg-white border-b border-slate-100 px-5 py-5">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-black text-2xl shrink-0 ${user.status !== "active" ? "opacity-60" : ""}`}>
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-900 text-lg leading-tight">{user.name || "No name set"}</h3>
            <p className="text-slate-500 text-sm truncate">{user.email}</p>
            {user.username && <p className="text-blue-500 text-sm font-bold mt-0.5">@{user.username}</p>}
            <p className="text-slate-400 text-xs mt-1.5">
              Member since {new Date(user.createdAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
            </p>
          </div>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-emerald-600">${Number(user.walletBalance).toFixed(2)}</p>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Wallet Balance</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-slate-800">{ordersLoading ? "—" : orders.length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Orders</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Account info */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Details</p>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { label: "User ID",   value: `#${user.id}`,       mono: false },
              ...(user.username ? [{ label: "Username", value: `@${user.username}`, mono: false }] : []),
              { label: "Status",    value: user.status,          mono: false },
              { label: "Joined",    value: new Date(user.createdAt).toLocaleDateString(), mono: false },
              ...(user.registrationIp ? [{ label: "Reg. IP", value: user.registrationIp, mono: true }] : []),
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-400">{row.label}</span>
                <span className={`text-xs font-bold text-slate-700 ${row.mono ? "font-mono" : ""} text-right max-w-[60%] break-all`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wallet actions */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Wallet</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setWalletModal({ action: "add" }); setWalletAmount(""); }}
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold active:scale-95 transition-all">
              <DollarSign size={14} /> Add Funds
            </button>
            <button onClick={() => { setWalletModal({ action: "deduct" }); setWalletAmount(""); }}
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold active:scale-95 transition-all">
              <DollarSign size={14} /> Deduct
            </button>
          </div>
        </div>

        {/* Message */}
        <button onClick={() => { loadChat(); setMsgOpen(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold active:scale-95 transition-all">
          <MessageSquare size={14} /> Send Direct Message
        </button>

        {/* Status actions */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Account Status</p>
          <div className="flex gap-2 flex-wrap">
            {user.status !== "active" && (
              <button onClick={() => setStatus("active")} disabled={acting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-60">
                <UserCheck size={13} /> Activate
              </button>
            )}
            {user.status !== "disabled" && (
              <button onClick={() => setStatus("disabled")} disabled={acting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-60">
                <XCircle size={13} /> Disable
              </button>
            )}
            {user.status !== "banned" && (
              <button onClick={() => setStatus("banned")} disabled={acting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-60">
                <Ban size={13} /> Ban
              </button>
            )}
          </div>
        </div>

        {/* Orders */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
            Order History ({ordersLoading ? "…" : orders.length})
          </p>
          {ordersLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} />)}</div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <ShoppingBag size={24} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map(o => {
                const statusColors: Record<string, string> = {
                  paid: "bg-emerald-100 text-emerald-700",
                  pending: "bg-amber-100 text-amber-700",
                  failed: "bg-red-100 text-red-700",
                };
                return (
                  <div key={o.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <ShoppingBag size={14} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">Order #{o.id}</p>
                      <p className="text-[11px] text-slate-400">{new Date(o.createdAt).toLocaleDateString()} · {o.orderType ?? "order"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-900">${Number(o.total).toFixed(2)}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[o.paymentStatus] ?? "bg-slate-100 text-slate-500"}`}>
                        {o.paymentStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="border border-red-100 rounded-2xl p-4">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">Danger Zone</p>
          <button onClick={() => setConfirmDelete(true)} disabled={acting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 active:scale-95 transition-all disabled:opacity-60">
            <Trash2 size={14} /> Delete User Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── users panel ───────────────────────────────────────────────────────────────
function UsersPanel({ pwd }: { pwd: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", name: "", walletBalance: "" });
  const [creating, setCreating] = useState(false);
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

  async function createUser() {
    if (!createForm.email || !createForm.password) { toast({ variant: "destructive", title: "Email and password are required" }); return; }
    setCreating(true);
    try {
      const body: Record<string, unknown> = { email: createForm.email, password: createForm.password };
      if (createForm.name) body.name = createForm.name;
      if (createForm.walletBalance) body.walletBalance = createForm.walletBalance;
      const r = await adminFetch(`/api/admin/users`, pwd, { method: "POST", body: JSON.stringify(body) });
      const d = await r.json() as AdminUser & { error?: string };
      if (!r.ok) throw new Error(d.error || "Failed");
      setUsers(prev => [d, ...prev]);
      setTotal(t => t + 1);
      toast({ title: "User created", description: d.email });
      setCreateModal(false);
      setCreateForm({ email: "", password: "", name: "", walletBalance: "" });
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Create failed" });
    } finally { setCreating(false); }
  }

  const COLORS = ["from-blue-500 to-blue-700","from-purple-500 to-purple-700","from-emerald-500 to-emerald-700","from-rose-500 to-rose-700","from-amber-500 to-amber-700"];

  if (selectedUser) {
    return (
      <UserDetailView
        user={selectedUser}
        pwd={pwd}
        onBack={() => setSelectedUser(null)}
        onUserUpdated={u => setUsers(prev => prev.map(x => x.id === u.id ? u : x))}
        onUserDeleted={id => { setUsers(prev => prev.filter(x => x.id !== id)); setTotal(t => t - 1); }}
      />
    );
  }

  return (
    <div className="p-4 pb-6 space-y-3">
      {/* Create User Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setCreateModal(false); }}>
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg">Create User</h3>
              <button onClick={() => setCreateModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Email *</label><input type="email" value={createForm.email} onChange={e => setCreateForm(f=>({...f,email:e.target.value}))} placeholder="user@example.com" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Password * (min 6 chars)</label><input type="password" value={createForm.password} onChange={e => setCreateForm(f=>({...f,password:e.target.value}))} placeholder="••••••" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Name (optional)</label><input value={createForm.name} onChange={e => setCreateForm(f=>({...f,name:e.target.value}))} placeholder="John Doe" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Starting Wallet Balance ($)</label><input type="number" step="0.01" min="0" value={createForm.walletBalance} onChange={e => setCreateForm(f=>({...f,walletBalance:e.target.value}))} placeholder="0.00" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setCreateModal(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-2xl text-sm">Cancel</button>
              <button onClick={createUser} disabled={creating} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl text-sm disabled:opacity-60">{creating ? "Creating…" : "Create User"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">{total} registered</p>
          <h2 className="text-xl font-black text-slate-900">Users</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
            <UserPlus size={13} /> Create
          </button>
          <button onClick={() => load(page)}
            className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors ${loading ? "animate-spin" : ""}`}>
            <RefreshCw size={15} />
          </button>
        </div>
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
            {users.map((u, i) => (
              <button key={u.id} onClick={() => setSelectedUser(u)}
                className={`w-full bg-white border rounded-2xl shadow-sm active:scale-[.98] transition-all text-left ${u.status === "banned" ? "border-red-100" : u.status === "disabled" ? "border-amber-100" : "border-slate-100"}`}>
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
                    {u.username && <p className="text-[10px] font-semibold text-blue-500 truncate">@{u.username}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-emerald-600">${Number(u.walletBalance).toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0 ml-1" />
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
    resendApiKey: "",
    whatsappContact: "",
    supportPhone: "",
    supportEmail: "",
    googleClientId: "",
    googleClientSecret: "",
    paymentMethods: [{ method: "BTC", walletAddress: "", network: "", label: "", enabled: true }],
    otsApiToken: "",
    otsSenderId: "",
    otsAdminPhone: "",
    openaiApiKey: "",
    imeiInfoApiToken: "",
    botSystemPrompt: "",
  });
  const [testingOts, setTestingOts] = useState(false);
  const [cascadeStatus, setCascadeStatus] = useState<{ models: string[]; updatedAt: string | null; isDefault: boolean } | null>(null);
  const [cascadeRefreshing, setCascadeRefreshing] = useState(false);

  async function refreshCascade() {
    setCascadeRefreshing(true);
    try {
      const r = await adminFetch(apiPath("/api/admin/cascade/refresh"), pwd, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setCascadeStatus({ models: d.working, updatedAt: new Date().toISOString(), isDefault: false });
        toast({ title: `Model health refreshed — ${d.working.length} of ${d.tested} models working` });
      } else {
        toast({ variant: "destructive", title: d.error ?? "Refresh failed" });
      }
    } catch { toast({ variant: "destructive", title: "Refresh failed" }); }
    finally { setCascadeRefreshing(false); }
  }

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
          resendApiKey: "",
          whatsappContact: d.whatsappContact ?? "",
          supportPhone: d.supportPhone ?? "",
          supportEmail: d.supportEmail ?? "",
          googleClientId: "",
          googleClientSecret: "",
          paymentMethods: d.paymentMethods?.length ? d.paymentMethods.map(m => ({ method: m.method ?? "", walletAddress: m.walletAddress ?? "", network: m.network ?? "", label: m.label ?? "", enabled: m.enabled !== false })) : [{ method: "BTC", walletAddress: "", network: "", label: "", enabled: true }],
          otsApiToken: "",
          otsSenderId: d.otsSenderId ?? "",
          otsAdminPhone: d.otsAdminPhone ?? "",
          openaiApiKey: "",
          imeiInfoApiToken: "",
          botSystemPrompt: d.botSystemPromptOverride ?? "",
        });
        setLoading(false);
        // also fetch cascade status (best-effort — don't block settings load)
        adminFetch(apiPath("/api/admin/cascade/status"), pwd)
          .then(r => r.ok ? r.json() : null)
          .then((d: { models: string[]; updatedAt: string | null; isDefault: boolean } | null) => {
            if (d) setCascadeStatus(d);
          })
          .catch(() => { /* ignore — cascade status is optional */ });
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
        supportPhone: form.supportPhone,
        supportEmail: form.supportEmail,
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
      if (form.resendApiKey) body.resendApiKey = form.resendApiKey;
      if (form.whatsappContact) body.whatsappContact = form.whatsappContact;
      if (form.googleClientId) body.googleClientId = form.googleClientId;
      if (form.googleClientSecret) body.googleClientSecret = form.googleClientSecret;
      if (form.otsApiToken) body.otsApiToken = form.otsApiToken;
      if (form.otsSenderId) body.otsSenderId = form.otsSenderId;
      if (form.otsAdminPhone) body.otsAdminPhone = form.otsAdminPhone;
      if (form.openaiApiKey) body.openaiApiKey = form.openaiApiKey;
      if (form.imeiInfoApiToken) body.imeiInfoApiToken = form.imeiInfoApiToken;
      body.botSystemPromptOverride = form.botSystemPrompt;

      const r = await adminFetch(apiPath("/api/admin/settings/update"), pwd, { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      const updated = await r.json() as AdminSettings;
      setSettings(updated);
      setForm(f => ({
        ...f,
        mpesaConsumerKey: "", mpesaConsumerSecret: "", mpesaPasskey: "",
        nowpaymentsApiKey: "", coingateApiKey: "",
        smtpPass: "", resendApiKey: "",
        googleClientId: "", googleClientSecret: "",
        otsApiToken: "", openaiApiKey: "", imeiInfoApiToken: "", botSystemPrompt: f.botSystemPrompt,
        paymentMethods: updated.paymentMethods?.length
          ? updated.paymentMethods.map(m => ({ method: m.method, walletAddress: m.walletAddress, network: m.network ?? "", label: m.label ?? "", enabled: m.enabled !== false }))
          : f.paymentMethods,
      }));
      toast({ title: "Settings saved", description: "Payment configuration updated." });
    } catch { toast({ variant: "destructive", title: "Failed to save settings" }); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} h="h-40" />)}</div>;

  async function testSms() {
    setTestingOts(true);
    try {
      const apiToken = form.otsApiToken || (settings?.otsApiToken === "***" ? "__saved__" : "");
      const adminPhone = form.otsAdminPhone || settings?.otsAdminPhone || "";
      const senderId = form.otsSenderId || settings?.otsSenderId || "";
      if (!apiToken || !adminPhone) {
        toast({ variant: "destructive", title: "OTS not configured", description: "Enter API token and admin phone first." });
        return;
      }
      const r = await fetch(apiPath("/api/chat/sms/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken, senderId, adminPhone }),
      });
      const d = await r.json() as { ok?: boolean; message?: string; error?: string };
      if (d.ok) toast({ title: "Test SMS sent!", description: d.message });
      else toast({ variant: "destructive", title: "SMS failed", description: d.error ?? "Check your OTS credentials." });
    } catch { toast({ variant: "destructive", title: "Network error" }); }
    finally { setTestingOts(false); }
  }

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
        <PlainInput label="Support Phone" value={form.supportPhone ?? ""} onChange={v => setForm(f => ({ ...f, supportPhone: v }))} placeholder="+254 700 000 000" hint="Displayed in order emails and support pages." />
        <PlainInput label="Support Email" value={form.supportEmail ?? ""} onChange={v => setForm(f => ({ ...f, supportEmail: v }))} placeholder="support@gsmworld.com" hint="Customer-facing support email address." />
      </div>

      {/* ── OTS SMS ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-800">OTS SMS Notifications</p>
          <p className="text-[10px] font-semibold text-slate-400">Send SMS alerts when customers request human support via GSMBot</p>
        </div>
        <MaskedInput label="OTS API Token" value={form.otsApiToken}
          onChange={v => setForm(f => ({ ...f, otsApiToken: v }))}
          placeholder={saved(settings?.otsApiToken ?? null) ? "Saved — enter new to replace" : "Bearer token from OTS dashboard"} />
        <PlainInput label="Sender ID" value={form.otsSenderId} onChange={v => setForm(f => ({ ...f, otsSenderId: v }))} placeholder="GSMSUPPORT" hint="Alphanumeric sender name, max 11 characters" />
        <PlainInput label="Admin Phone" value={form.otsAdminPhone} onChange={v => setForm(f => ({ ...f, otsAdminPhone: v }))} placeholder="254712345678" hint="Phone that receives support SMS notifications (with country code)" />
        <button onClick={testSms} disabled={testingOts || (!form.otsApiToken && !settings?.otsApiToken) || (!form.otsAdminPhone && !settings?.otsAdminPhone)}
          className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {testingOts ? <RefreshCw size={13} className="animate-spin" /> : <Phone size={13} />}
          Send test SMS
        </button>
      </div>

      {/* ── GSMBot AI ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-800">GSMBot AI</p>
          <p className="text-[10px] font-semibold text-slate-400">OpenAI key for the AI chat assistant. Leave blank to disable the bot.</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 text-[11px] text-blue-700 leading-relaxed">
          Get a key at{" "}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="font-bold underline">platform.openai.com</a>
          {" "}→ API keys. For OpenRouter keys, GSMBot uses free models at no cost. For direct OpenAI keys, it uses <strong>gpt-4o-mini</strong>.
        </div>
        <MaskedInput label="OpenAI API Key" value={form.openaiApiKey}
          onChange={v => setForm(f => ({ ...f, openaiApiKey: v }))}
          placeholder={saved(settings?.openaiApiKey ?? null) ? "Saved — enter new to replace" : "sk-..."} />
        {settings?.openaiApiKey && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            GSMBot is active
          </div>
        )}
        <div className="space-y-1.5 pt-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Custom System Prompt Instructions</label>
          <p className="text-[10px] text-slate-400">Optional extra instructions appended to the bot's system prompt. Use this to override behaviour, add product notes, or set custom tone.</p>
          <textarea
            value={form.botSystemPrompt}
            onChange={e => setForm(f => ({ ...f, botSystemPrompt: e.target.value }))}
            rows={5}
            placeholder={"e.g. Always greet users in Swahili.\nAlways recommend the Express Order for urgent requests.\nOur newest service is XYZ — mention it proactively."}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y font-mono text-slate-700 placeholder:text-slate-300 placeholder:font-sans"
          />
          {settings?.botSystemPromptOverride && (
            <p className="text-[10px] text-emerald-600 font-semibold">Custom instructions saved ✓</p>
          )}
        </div>
      </div>

      {/* ── AI Model Health ── */}
      {settings?.openaiApiKey && (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">AI Model Health</p>
              <p className="text-[10px] font-semibold text-slate-400">
                Working free models used by GSMBot and the email generator.
                Auto-refreshes weekly — or check now if something seems broken.
              </p>
            </div>
            <button
              onClick={refreshCascade}
              disabled={cascadeRefreshing}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition-colors shrink-0"
            >
              <RefreshCw size={11} className={cascadeRefreshing ? "animate-spin" : ""} />
              {cascadeRefreshing ? "Checking…" : "Check Now"}
            </button>
          </div>

          {cascadeStatus ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {cascadeStatus.models.map((m) => (
                  <span key={m} className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    {m.split("/")[1]?.replace(":free", "") ?? m}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                {cascadeStatus.isDefault
                  ? "Using built-in defaults — click Check Now to discover the best live models."
                  : cascadeStatus.updatedAt
                    ? `Last checked ${new Date(cascadeStatus.updatedAt).toLocaleString()} · ${cascadeStatus.models.length} model${cascadeStatus.models.length !== 1 ? "s" : ""} active · refreshes automatically every Sunday`
                    : `${cascadeStatus.models.length} model${cascadeStatus.models.length !== 1 ? "s" : ""} active`
                }
              </p>
            </>
          ) : (
            <p className="text-[10px] text-slate-400">Loading model status…</p>
          )}
        </div>
      )}

      {/* ── IMEI.info API Token ── */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-800">IMEI Check — SimLock API</p>
          <p className="text-[10px] font-semibold text-slate-400">
            Enables real SimLock status, carrier network, and blacklist data on the free IMEI checker.
            Without this key the checker still works — device info from the free TAC database is always shown.
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5 text-[11px] text-emerald-700 leading-relaxed">
          Get a token at{" "}
          <a href="https://imei.info/imei-api/" target="_blank" rel="noreferrer" className="font-bold underline">imei.info/imei-api</a>
          {" "}→ register → copy your API token. Paste it below and save. SimLock, carrier &amp; blacklist will appear instantly on every check.
        </div>
        <MaskedInput
          label="IMEI.info API Token"
          value={form.imeiInfoApiToken ?? ""}
          onChange={v => setForm(f => ({ ...f, imeiInfoApiToken: v }))}
          placeholder={saved(settings?.imeiInfoApiToken ?? null) ? "Saved — enter new to replace" : "Paste your IMEI.info API token…"}
        />
        {settings?.imeiInfoApiToken ? (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            Enhanced SimLock check active — real unlock &amp; blacklist status will show
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            Basic mode — device info only, no SimLock data
          </div>
        )}
      </div>

      {/* Email provider – SMTP (Zoho, Gmail, etc.) or optional Resend API key */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Resend API Key <span className="text-xs font-normal text-slate-400">(optional — leave blank to use SMTP below)</span></p>
          <p className="text-[10px] font-semibold text-slate-400">Recommended for Vercel — HTTP-based, no SMTP port blocking. Takes priority over SMTP.</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-[11px] text-blue-700 leading-relaxed">
          Get a free key at{" "}
          <a href="https://resend.com" target="_blank" rel="noreferrer" className="font-bold underline">resend.com</a>
          {" "}→ verify your sending domain → add the key below. The <em>From Email</em> must be on that verified domain.
        </div>
        <MaskedInput
          label="Resend API Key"
          value={form.resendApiKey ?? ""}
          onChange={v => setForm(f => ({ ...f, resendApiKey: v }))}
          placeholder={settings?.resendApiKey ? "Saved — enter new to replace" : "re_xxxxxxxxxxxxxxxxx"}
        />
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Email SMTP</p>
          <p className="text-[10px] font-semibold text-slate-400">SMTP settings (Zoho, Gmail, etc.) — used for all outgoing mail</p>
        </div>
        <PlainInput label="From Email" value={form.emailFrom} onChange={v => setForm(f => ({ ...f, emailFrom: v }))} placeholder="no-reply@yourdomain.com" />
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
// ─── Fingerprint Setup Modal ──────────────────────────────────────────────────
function FingerprintSetupModal({ pwd, onDismiss }: { pwd: string; onDismiss: () => void }) {
  const { toast } = useToast();
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(apiPath("/api/admin/webauthn/status"))
      .then(r => r.json())
      .then((d: { registered: boolean }) => setRegistered(d.registered))
      .catch(() => setRegistered(false));
  }, []);

  async function handleRegister() {
    setLoading(true); setError("");
    try {
      const optRes = await adminFetch(apiPath("/api/admin/webauthn/register-challenge"), pwd, { method: "POST" });
      if (!optRes.ok) { setError((await optRes.json() as { error?: string }).error ?? "Failed to start registration."); return; }
      const options = await optRes.json();
      const attResp = await startRegistration({ optionsJSON: options });
      const verRes = await adminFetch(apiPath("/api/admin/webauthn/register"), pwd, {
        method: "POST", body: JSON.stringify(attResp),
      });
      if (!verRes.ok) { setError((await verRes.json() as { error?: string }).error ?? "Registration failed."); return; }
      toast({ title: "Fingerprint registered", description: "You can now log in with your fingerprint." });
      setRegistered(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("cancelled") || msg.includes("abort") ? "Fingerprint scan cancelled." : "Registration failed. Please try again.");
    } finally { setLoading(false); }
  }

  async function handleRemove() {
    setLoading(true); setError("");
    try {
      const r = await adminFetch(apiPath("/api/admin/webauthn/credential"), pwd, { method: "DELETE" });
      if (!r.ok) { setError("Failed to remove fingerprint."); return; }
      toast({ title: "Fingerprint removed", description: "Password-only login is now required." });
      setRegistered(false);
    } catch { setError("Failed to remove fingerprint."); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Fingerprint size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Fingerprint Login</p>
              <p className="text-slate-500 text-xs">Biometric authentication</p>
            </div>
          </div>
          <button onClick={onDismiss} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2">
            <XCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {registered === null ? (
          <div className="text-center text-slate-500 text-sm py-4">Loading…</div>
        ) : registered ? (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-3 flex items-center gap-2.5">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <p className="text-emerald-400 text-xs font-medium">Fingerprint is active on this device</p>
            </div>
            <p className="text-slate-400 text-xs">You can log in using your device's biometric sensor instead of a password.</p>
            <button onClick={handleRemove} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold py-3 rounded-xl text-sm disabled:opacity-40 transition-colors">
              <Trash2 size={14} />
              {loading ? "Removing…" : "Remove Fingerprint"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-400 text-xs leading-relaxed">
              Register your device's fingerprint or Face ID to log in without typing your password.
              Works with Touch ID, Windows Hello, and Android fingerprint sensors.
            </p>
            <button onClick={handleRegister} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-40 transition-colors">
              <Fingerprint size={15} />
              {loading ? "Scanning…" : "Register Fingerprint"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (pwd: string, isDefault: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [error, setError] = useState("");
  const [fpAvailable, setFpAvailable] = useState(false);

  useEffect(() => {
    fetch(apiPath("/api/admin/webauthn/status"))
      .then(r => r.json())
      .then((d: { registered: boolean }) => setFpAvailable(d.registered))
      .catch(() => {});
  }, []);

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

  async function loginWithFingerprint() {
    setFpLoading(true); setError("");
    try {
      const chalRes = await fetch(apiPath("/api/admin/webauthn/auth-challenge"), { method: "POST" });
      if (!chalRes.ok) { setError((await chalRes.json() as { error?: string }).error ?? "Could not start fingerprint login."); return; }
      const options = await chalRes.json();
      const authResp = await startAuthentication({ optionsJSON: options });
      const verRes = await fetch(apiPath("/api/admin/webauthn/auth"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResp),
      });
      if (!verRes.ok) { setError((await verRes.json() as { error?: string }).error ?? "Fingerprint not recognized."); return; }
      const { token } = await verRes.json() as { ok: boolean; token: string };
      _setWaToken(token);
      onLogin("", false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("cancelled") || msg.includes("abort") ? "Fingerprint scan cancelled." : "Fingerprint login failed.");
    } finally { setFpLoading(false); }
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
            {fpAvailable && (
              <button onClick={loginWithFingerprint} disabled={fpLoading || loading}
                className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-40 transition-colors">
                <Fingerprint size={17} />
                {fpLoading ? "Scanning…" : "Login with Fingerprint"}
              </button>
            )}
            {fpAvailable && (
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-slate-600 text-xs">or use password</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            )}
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
              className="w-full bg-white/10 hover:bg-white/15 text-white font-bold py-4 rounded-2xl text-sm disabled:opacity-40 transition-colors">
              {loading ? "Verifying…" : "Sign In →"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────
// ─── Live Chats Panel ─────────────────────────────────────────────────────────
function LiveChatsPanel({ pwd }: { pwd: string }) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<LiveChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LiveChatSession | null>(null);
  const [msgs, setMsgs] = useState<LiveChatMsg[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const bottomRef = useRef<HTMLDivElement>(null);
  // Refs to always have the latest values inside setInterval without recreating it
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const knownIds = useRef<Set<number>>(new Set());

  const loadSessions = useCallback(() => {
    const statusParam = showClosed ? "waiting,active,closed" : "waiting,active";
    adminFetch(apiPath(`/api/chat/live?status=${statusParam}`), pwd)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: LiveChatSession[]) => {
        setSessions(data);
        setLoading(false);
        // Notify admin when a NEW waiting session arrives
        if (knownIds.current.size > 0) {
          const newWaiting = data.filter(s => s.status === "waiting" && !knownIds.current.has(s.id));
          if (newWaiting.length > 0) {
            const v = newWaiting[0];
            toast({
              title: "New chat request",
              description: `${v.visitorName || `Visitor #${v.id}`} is waiting for support.`,
            });
          }
        }
        data.forEach(s => knownIds.current.add(s.id));
      })
      .catch(() => setLoading(false));
  }, [pwd, showClosed, toast]);

  const loadMessages = useCallback((sess: LiveChatSession) => {
    adminFetch(apiPath(`/api/chat/live/${sess.id}/messages`), pwd)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: LiveChatMsg[]) => setMsgs(data))
      .catch(() => {});
  }, [pwd]);

  // Initial load + reload when filter/pwd changes
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Continuous polling — single stable interval, uses refs for latest state
  useEffect(() => {
    const t = setInterval(() => {
      loadSessions();
      if (selectedRef.current) loadMessages(selectedRef.current);
    }, 3000);
    return () => clearInterval(t);
  }, [loadSessions, loadMessages]);

  useEffect(() => {
    if (selected) { setMsgs([]); loadMessages(selected); }
  }, [selected?.id, loadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    try {
      const r = await adminFetch(
        apiPath(`/api/chat/live/${selected.id}/messages`), pwd,
        { method: "POST", body: JSON.stringify({ message: reply.trim() }) }
      );
      if (!r.ok) throw new Error();
      const msg = await r.json() as LiveChatMsg;
      setMsgs(prev => [...prev, msg]);
      setReply("");
    } catch { toast({ variant: "destructive", title: "Failed to send reply" }); }
    finally { setSending(false); }
  }

  async function closeSession(sess: LiveChatSession) {
    try {
      await adminFetch(apiPath(`/api/chat/live/${sess.id}`), pwd,
        { method: "PATCH", body: JSON.stringify({ status: "closed" }) });
      toast({ title: "Chat closed" });
      setSessions(prev => prev.map(s => s.id === sess.id ? { ...s, status: "closed" } : s));
      if (selected?.id === sess.id) setSelected(s => s ? { ...s, status: "closed" } : s);
    } catch { toast({ variant: "destructive", title: "Failed to close chat" }); }
  }

  const statusColor = (s: string) => ({
    waiting: "bg-amber-50 text-amber-700 border-amber-200",
    active:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    closed:  "bg-slate-100 text-slate-500 border-slate-200",
  }[s] ?? "bg-slate-100 text-slate-500 border-slate-200");

  if (loading) return <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} h="h-16" />)}</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-slate-800">Live Chat Sessions</p>
          <p className="text-xs text-slate-400 mt-0.5">{sessions.filter(s => s.status !== "closed").length} active · auto-refreshes every 3s</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowClosed(s => !s)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-colors ${showClosed ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"}`}>
            {showClosed ? "Hide Closed" : "Show Closed"}
          </button>
          <button onClick={loadSessions}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {sessions.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <Headphones size={32} className="mx-auto text-slate-200 mb-2" />
          <p className="text-sm font-bold text-slate-400">No live chat sessions</p>
          <p className="text-xs text-slate-300 mt-1">Sessions appear here when customers click "Talk to a human agent"</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {/* Session list — hidden on mobile when chat is open */}
        <div className={`space-y-2 ${mobileView === "chat" ? "hidden md:block" : "block"}`}>
          {sessions.map(sess => (
            <button key={sess.id} onClick={() => { setSelected(sess); setMobileView("chat"); }}
              className={`w-full text-left bg-white rounded-2xl border p-3.5 transition-colors hover:border-blue-300 ${selected?.id === sess.id ? "border-blue-400 shadow-sm" : "border-slate-100"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <UserCheck size={13} className="text-slate-500" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                    {sess.visitorName || `Visitor #${sess.id}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {sess.unreadAdmin > 0 && (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">{sess.unreadAdmin}</span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(sess.status)}`}>
                    {sess.status}
                  </span>
                </div>
              </div>
              {sess.lastMessage && (
                <p className="text-[11px] text-slate-400 truncate pl-9">{sess.lastMessage}</p>
              )}
              <p className="text-[9px] text-slate-300 pl-9 mt-0.5">
                {new Date(sess.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
          ))}
        </div>

        {/* Selected session */}
        {selected ? (
          <div className={`bg-white rounded-2xl border border-slate-100 flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`} style={{ maxHeight: "500px" }}>
            {/* Chat header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                {/* Back button — mobile only */}
                <button onClick={() => setMobileView("list")}
                  className="md:hidden w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0">
                  <ChevronLeft size={14} />
                </button>
                <div>
                  <p className="text-xs font-black text-slate-800">{selected.visitorName || `Visitor #${selected.id}`}</p>
                  <p className="text-[10px] text-slate-400">{selected.visitorId.slice(0, 12)}…</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(selected.status)}`}>{selected.status}</span>
                {selected.status !== "closed" && (
                  <button onClick={() => closeSession(selected)}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-700 px-2 py-1 border border-red-200 rounded-xl transition-colors">
                    Close chat
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {msgs.length === 0 && (
                <p className="text-center text-xs text-slate-300 py-4">No messages yet</p>
              )}
              {msgs.map(m => {
                const isAdmin = m.senderType === "admin";
                return (
                  <div key={m.id} className={`flex flex-col gap-0.5 ${isAdmin ? "items-end" : "items-start"}`}>
                    <div className={`flex gap-1.5 ${isAdmin ? "justify-end" : "justify-start"} w-full`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                        isAdmin ? "bg-blue-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
                      }`}>
                        <p className={`text-[9px] font-bold mb-0.5 ${isAdmin ? "text-blue-200" : "text-slate-400"}`}>
                          {isAdmin ? "You (Admin)" : (selected.visitorName || "Visitor")}
                        </p>
                        <p className="leading-relaxed whitespace-pre-wrap break-words">{m.message}</p>
                        {m.fileUrl && (
                          <a href={m.fileUrl} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-1 mt-1 text-[9px] font-semibold underline ${isAdmin ? "text-blue-200" : "text-blue-600"}`}>
                            📎 View attachment
                          </a>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 pr-1">
                        {m.readAt ? (
                          <>
                            <svg width="14" height="8" viewBox="0 0 14 8" fill="none" className="text-blue-500">
                              <path d="M1 4L4 7L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M5 4L8 7L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="text-[9px] text-blue-500 font-semibold">
                              Read {new Date(m.readAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </>
                        ) : (
                          <>
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-slate-300">
                              <path d="M1 4L3.5 6.5L7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="text-[9px] text-slate-300 font-medium">Delivered</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply area */}
            {selected.status !== "closed" ? (
              <div className="px-3 pb-3 pt-2 border-t border-slate-100 shrink-0">
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    placeholder="Reply to visitor…"
                    disabled={sending}
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                  <button onClick={sendReply} disabled={sending || !reply.trim()}
                    className="w-9 h-9 bg-[#1a2332] hover:bg-[#253246] disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center shrink-0 transition-colors">
                    {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3 pb-3 pt-2 border-t border-slate-100 shrink-0 flex items-center justify-center gap-2 text-xs text-slate-400">
                <WifiOff size={12} /> Chat ended by {selected.closedBy || "system"}
              </div>
            )}
          </div>
        ) : (
          <div className="hidden md:flex bg-white rounded-2xl border border-slate-100 items-center justify-center p-8 text-center">
            <div>
              <Headphones size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-xs text-slate-400 font-semibold">Select a session</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── IMEI Logs Panel ──────────────────────────────────────────────────────────
interface ImeiLog {
  id: number;
  imei: string;
  brand: string | null;
  model: string | null;
  marketingName: string | null;
  simLock: string | null;
  carrier: string | null;
  blacklist: string | null;
  enhanced: boolean;
  source: string | null;
  checkedAt: string;
}

function AnnouncementsPanel({ pwd }: { pwd: string }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ count: number } | null>(null);
  const [allProducts, setAllProducts] = useState<AdminProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<AdminProduct[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    adminFetch(apiPath("/api/admin/products?limit=100&inStock=true"), pwd)
      .then(r => r.json())
      .then((d: unknown) => {
        if (d && typeof d === "object" && "products" in d) {
          setAllProducts((d as { products: AdminProduct[] }).products);
        }
      })
      .catch(() => {});
  }, [pwd]);

  async function generateWithAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const r = await adminFetch(apiPath("/api/admin/announcements/ai-generate"), pwd, {
        method: "POST",
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const d = await r.json() as { subject?: string; body?: string; error?: string };
      if (!r.ok) { toast({ variant: "destructive", title: d.error ?? "AI generation failed" }); return; }
      if (d.subject) setSubject(d.subject);
      if (d.body) setBody(d.body);
    } catch {
      toast({ variant: "destructive", title: "AI generation failed" });
    } finally {
      setAiLoading(false);
    }
  }

  async function sendAnnouncement() {
    if (!subject.trim() || !body.trim()) {
      toast({ variant: "destructive", title: "Subject and body are required" }); return;
    }
    setSending(true);
    try {
      const r = await adminFetch(apiPath("/api/admin/announcements/send"), pwd, {
        method: "POST",
        body: JSON.stringify({ subject, body, productIds: selectedProducts.map(p => p.id) }),
      });
      const d = await r.json() as { ok?: boolean; recipientCount?: number; error?: string };
      if (r.ok && d.ok) {
        setSent({ count: d.recipientCount ?? 0 });
        toast({ title: `✅ Sent to ${d.recipientCount ?? 0} users!` });
        setSubject(""); setBody(""); setAiPrompt(""); setSelectedProducts([]); setShowPicker(false);
      } else {
        toast({ variant: "destructive", title: d.error ?? "Failed to send" });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="px-4 md:px-6 py-5 space-y-4">
      <div>
        <h2 className="font-black text-slate-900 text-xl">Announcements</h2>
        <p className="text-xs text-slate-400 mt-0.5">Broadcast an email to all active users</p>
      </div>

      {/* AI Generator */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <p className="text-sm font-bold text-purple-900">AI Email Generator</p>
          <span className="text-[10px] bg-purple-200 text-purple-700 font-bold px-1.5 py-0.5 rounded-full">Free AI</span>
        </div>
        <textarea
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="Describe your announcement (e.g. 'New Samsung tools are available at 20% off for 48 hours')"
          rows={2}
          className="w-full border border-purple-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
        />
        <button onClick={generateWithAI} disabled={!aiPrompt.trim() || aiLoading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
          {aiLoading ? <><RefreshCw size={13} className="animate-spin" /> Generating…</> : <><Zap size={13} /> Generate with AI</>}
        </button>
      </div>

      {/* Compose */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
        <p className="text-sm font-bold text-slate-700">Compose Email</p>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1.5">Subject</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. 🎉 New Products Available at GSM World!"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1.5">Message Body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your announcement here…"
            rows={7}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        {/* ── Featured products picker ─────────────────────────────────────── */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Featured Products <span className="font-normal text-slate-300">(optional · shown as product cards in email)</span>
            </p>
            <button
              onClick={() => setShowPicker(v => !v)}
              className="text-xs text-blue-600 font-bold hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              <Package size={11} /> {showPicker ? "Close" : "+ Add"}
            </button>
          </div>

          {/* Selected product chips */}
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProducts.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-2 py-1">
                  {p.imageUrl
                    ? <img src={p.imageUrl} className="w-6 h-6 rounded-md object-cover shrink-0" alt="" />
                    : <div className="w-6 h-6 rounded-md bg-slate-200 shrink-0 flex items-center justify-center"><Package size={10} className="text-slate-400" /></div>
                  }
                  <span className="text-[10px] font-bold text-blue-800 max-w-[90px] truncate">{p.name}</span>
                  <span className="text-[10px] font-black text-blue-600">${Number(p.price).toFixed(2)}</span>
                  <button
                    onClick={() => setSelectedProducts(prev => prev.filter(x => x.id !== p.id))}
                    className="text-blue-200 hover:text-red-400 transition-colors leading-none"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Product picker dropdown */}
          {showPicker && (
            <div className="border border-slate-200 rounded-2xl bg-white shadow-lg p-3 space-y-2">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full pl-8 pr-3 border border-slate-200 rounded-xl py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Select up to 6 products to feature in the email carousel</p>
              <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
                {allProducts
                  .filter(p => p.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                  .slice(0, 30)
                  .map(p => {
                    const isSel = selectedProducts.some(s => s.id === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (isSel) {
                            setSelectedProducts(prev => prev.filter(x => x.id !== p.id));
                          } else if (selectedProducts.length >= 6) {
                            toast({ title: "Max 6 products" });
                          } else {
                            setSelectedProducts(prev => [...prev, p]);
                          }
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${isSel ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}`}
                      >
                        {p.imageUrl
                          ? <img src={p.imageUrl} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
                          : <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center"><Package size={14} className="text-slate-300" /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400">
                            ${Number(p.price).toFixed(2)}
                            {p.originalPrice && <span className="line-through ml-1 text-slate-300">${Number(p.originalPrice).toFixed(2)}</span>}
                            {!p.inStock && <span className="ml-1 text-amber-500 font-semibold">· Out of stock</span>}
                          </p>
                        </div>
                        {isSel && <CheckCircle2 size={15} className="text-blue-500 shrink-0" />}
                      </button>
                    );
                  })
                }
                {allProducts.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No products found</p>
                )}
              </div>
              <button onClick={() => setShowPicker(false)} className="w-full py-2 text-xs text-slate-500 font-bold border border-slate-200 rounded-xl hover:bg-slate-50">Done ({selectedProducts.length}/6 selected)</button>
            </div>
          )}
        </div>

        <button onClick={sendAnnouncement} disabled={!subject.trim() || !body.trim() || sending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-colors shadow-sm">
          {sending ? <><RefreshCw size={13} className="animate-spin" /> Sending…</> : <><Send size={13} /> Send to All Users</>}
        </button>
      </div>

      {sent && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-emerald-800">Broadcast sent!</p>
          <p className="text-sm text-emerald-600">Email delivered to {sent.count} users</p>
        </div>
      )}

      {/* ── In-App Broadcast ──────────────────────────────────────────────── */}
      <InAppBroadcastPanel pwd={pwd} />
    </div>
  );
}

function InAppBroadcastPanel({ pwd }: { pwd: string }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "success" | "warning" | "error">("info");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const { toast } = useToast();

  async function sendBroadcast() {
    if (!title.trim() || !message.trim()) {
      toast({ variant: "destructive", title: "Title and message are required" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const r = await adminFetch(apiPath("/api/admin/notify-all"), pwd, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), message: message.trim(), type }),
      });
      const d = await r.json() as { ok?: boolean; count?: number; error?: string };
      if (r.ok && d.ok) {
        setResult({ count: d.count ?? 0 });
        toast({ title: `🔔 Sent to ${d.count ?? 0} users!` });
        setTitle(""); setMessage("");
      } else {
        toast({ variant: "destructive", title: d.error ?? "Failed to send" });
      }
    } catch {
      toast({ variant: "destructive", title: "Network error" });
    } finally {
      setSending(false);
    }
  }

  const typeOptions: Array<{ value: typeof type; label: string; dot: string }> = [
    { value: "info",    label: "ℹ️ Info",    dot: "bg-blue-400" },
    { value: "success", label: "✅ Success", dot: "bg-emerald-400" },
    { value: "warning", label: "⚠️ Warning", dot: "bg-amber-400" },
    { value: "error",   label: "🚨 Error",   dot: "bg-red-400" },
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
          <Bell size={12} className="text-white" />
        </div>
        <p className="text-sm font-bold text-slate-700">Notify All Users (In-App)</p>
        <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">instant</span>
      </div>
      <p className="text-xs text-slate-400">Appears as a bell notification inside the GSMWorld app — no email required.</p>

      <div>
        <label className="text-xs font-semibold text-slate-500 block mb-1.5">Notification Type</label>
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(o => (
            <button key={o.value} type="button" onClick={() => setType(o.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${type === o.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <span className={`w-2 h-2 rounded-full ${o.dot}`} />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 block mb-1.5">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. 🎉 New Samsung Tools Available!"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 block mb-1.5">Message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Write a short message users will see in their notification bell…"
          rows={3}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      <button onClick={sendBroadcast} disabled={!title.trim() || !message.trim() || sending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-colors shadow-sm">
        {sending ? <><RefreshCw size={13} className="animate-spin" /> Sending…</> : <><Bell size={13} /> Notify All Users</>}
      </button>

      {result && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
          <CheckCircle2 size={20} className="text-blue-500 mx-auto mb-1" />
          <p className="font-bold text-blue-800 text-sm">Notification sent!</p>
          <p className="text-xs text-blue-600">Delivered to {result.count} users</p>
        </div>
      )}
    </div>
  );
}

function ImeiLogsPanel({ pwd }: { pwd: string }) {
  const [logs, setLogs] = useState<ImeiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    adminFetch(apiPath("/api/admin/imei-logs"), pwd)
      .then(r => r.json())
      .then((d: unknown) => { setLogs(Array.isArray(d) ? (d as ImeiLog[]) : []); setLoading(false); })
      .catch(() => { toast({ variant: "destructive", title: "Failed to load IMEI logs" }); setLoading(false); });
  }, [pwd, toast]);

  const filtered = search.trim()
    ? logs.filter(l =>
        l.imei.includes(search) ||
        (l.brand ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.marketingName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.carrier ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  function simLockColor(v: string | null) {
    if (!v) return "text-slate-400";
    const lc = v.toLowerCase();
    if (lc.includes("unlock") || lc.includes("clean")) return "text-emerald-600";
    if (lc.includes("lock") || lc.includes("black")) return "text-red-500";
    return "text-amber-500";
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">IMEI Lookup History</p>
          <p className="text-[11px] text-slate-400">{logs.length} check{logs.length !== 1 ? "s" : ""} recorded</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search IMEI, brand, carrier…"
            className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Smartphone size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">{search ? "No matches found" : "No IMEI checks yet"}</p>
          <p className="text-[11px] mt-1">{search ? "Try a different search term" : "Checks will appear here as users use the IMEI checker"}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">IMEI</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Device</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">SimLock</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Carrier</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Blacklist</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">{log.imei}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <p className="font-semibold text-slate-800">{log.brand ?? "—"}</p>
                      <p className="text-slate-400 text-[10px]">{log.marketingName ?? log.model ?? ""}</p>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {log.simLock ? (
                        <span className={`font-bold ${simLockColor(log.simLock)}`}>{log.simLock}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{log.carrier ?? "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {log.blacklist ? (
                        <span className={`font-semibold ${log.blacklist.toLowerCase().includes("clean") || log.blacklist === "0" || log.blacklist.toLowerCase() === "no" ? "text-emerald-600" : "text-red-500"}`}>
                          {log.blacklist}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-400">
                      {new Date(log.checkedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 500 && (
            <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 text-center">
              Showing last 500 checks
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminPage() {
  const ADMIN_KEY = "gsm_admin_session";
  const [pwd, setPwd] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_KEY + "_pwd") ?? ""; } catch { return ""; }
  });
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_KEY + "_ok") === "1"; } catch { return false; }
  });
  const [location, navigate] = useLocation();
  const tabFromUrl = location.match(/^\/admin\/([^/]+)/)?.[1] ?? "overview";
  const tabAliasMap: Record<string, string> = { imei: "imei_logs", chat: "live_chat", announce: "announcements" };
  const resolvedTab = tabAliasMap[tabFromUrl] ?? tabFromUrl;
  const tab = (NAV.find(n => n.id === resolvedTab)?.id ?? "overview") as Tab;
  function setTab(newTab: Tab) { navigate(`/admin/${newTab}`); }
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [isDefaultWarn, setIsDefaultWarn] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showFingerprintSetup, setShowFingerprintSetup] = useState(false);
  const [paymentUnread, setPaymentUnread] = useState(0);
  const lastNotifTs = useRef(0);
  const mainRef = useRef<HTMLElement>(null);
  const { toast } = useToast();
  const [headerApkVersion, setHeaderApkVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiPath("/api/app/version"))
      .then(r => r.ok ? r.json() : null)
      .then((d: { version: string } | null) => {
        if (d?.version) setHeaderApkVersion(d.version.replace(/^admin-apk-/, ""));
      })
      .catch(() => {});
  }, []);

  // Auto-reload when a new Vercel deploy is detected (WebView only).
  // The user app does this in layout.tsx for GSMWorldApp; the admin WebView
  // uses GSMAdminApp/1.0 and had no equivalent — so after a deploy the
  // WebView would keep serving the old cached JS bundle indefinitely.
  useEffect(() => {
    const isAdminWebView = navigator.userAgent.includes("GSMAdminApp");
    if (!isAdminWebView) return;

    let knownBuildId: string | null = null;
    const base = apiPath("");

    async function checkWebVersion() {
      try {
        const r = await fetch(`${base}/api/web-version`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json() as { buildId?: string };
        if (!d.buildId) return;
        if (knownBuildId === null) {
          knownBuildId = d.buildId; // first poll — record current build, don't reload
          return;
        }
        if (d.buildId !== knownBuildId) {
          // New Vercel deployment detected — reload with cache-busting param
          const url = new URL(window.location.href);
          url.searchParams.set("_v", String(Date.now()));
          window.location.replace(url.toString());
        }
      } catch { /* ignore network errors */ }
    }

    checkWebVersion();
    const interval = setInterval(checkWebVersion, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Prevent Android SwipeRefreshLayout from firing when the user is scrolled
  // down and swipes downward to go back to the top.
  //
  // Root cause: SwipeRefreshLayout checks webView.getScrollY(), but the admin
  // page scrolls inside a CSS overflow <main> element — so getScrollY() is
  // always 0 and Android always thinks the page is at the very top.
  //
  // Fix 1 (primary): The Android app injects a JS tracker that calls
  //   AdminScrollBridge.setScrolled(main.scrollTop > 0)
  // on every scroll event, and the native setOnChildScrollUpCallback reads
  // that flag — correctly blocking pull-to-refresh when scrolled down.
  //
  // Fix 2 (belt-and-suspenders): We also notify the bridge directly from
  // React so there is no gap between mount and the injected script running,
  // and we call e.preventDefault() on touchmove as a last-resort block.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    // Notify the Android bridge about current scroll position
    function notifyBridge(scrolled: boolean) {
      try {
        const w = window as unknown as { AdminScrollBridge?: { setScrolled: (v: boolean) => void } };
        w.AdminScrollBridge?.setScrolled(scrolled);
      } catch { /* non-Android environment — ignore */ }
    }

    // Sync bridge state whenever the element scrolls
    const onScroll = () => notifyBridge(el.scrollTop > 0);
    el.addEventListener("scroll", onScroll, { passive: true });

    // Immediately report current state on mount
    notifyBridge(el.scrollTop > 0);

    // NOTE: We intentionally do NOT call e.preventDefault() on touchmove.
    // The AdminScrollBridge.setScrolled() flag (set above via onScroll) is
    // sufficient for the Android app's setOnChildScrollUpCallback to block
    // SwipeRefreshLayout pull-to-refresh when the user is scrolled down.
    // Any touchmove preventDefault() call — even gated on AdminScrollBridge —
    // cancels the browser's native scroll gesture and locks the page.

    return () => {
      el.removeEventListener("scroll", onScroll);
      notifyBridge(false);
    };
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const poll = async () => {
      try {
        const r = await fetch("/api/admin/notifications");
        if (!r.ok) return;
        const data = await r.json() as { notifications: PaymentNotification[] };
        const newOnes = data.notifications.filter(n => !n.read && n.ts > lastNotifTs.current);
        if (newOnes.length > 0) {
          lastNotifTs.current = Math.max(...newOnes.map(n => n.ts));
          setPaymentUnread(prev => prev + newOnes.length);
          newOnes.forEach(n => {
            toast({
              title: "💰 Payment confirmed",
              description: `Order #${n.orderId} · $${n.amount} via ${n.method} · ${n.customerEmail}`,
            });
          });
        }
      } catch { /* non-fatal */ }
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, [authed, toast]);

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
    live_chat: "Live Chat", resellers: "Resellers", imei_logs: "IMEI Logs",
    announcements: "Announcements",
  };

  return (
    <>
      {showChangePwd && (
        <ChangePasswordModal pwd={pwd} isForced={isDefaultWarn}
          onSuccess={np => { setPwd(np); setShowChangePwd(false); setIsDefaultWarn(false); try { sessionStorage.setItem("gsm_admin_session_pwd", np); } catch {} }}
          onDismiss={() => { setShowChangePwd(false); setIsDefaultWarn(false); }}
        />
      )}
      {showFingerprintSetup && (
        <FingerprintSetupModal pwd={pwd} onDismiss={() => setShowFingerprintSetup(false)} />
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
            <button onClick={() => setShowFingerprintSetup(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
              <Fingerprint size={15} />
              <span className="text-sm font-medium">Fingerprint Login</span>
            </button>
            <button onClick={() => { setAuthed(false); setPwd(""); _setWaToken(null); try { sessionStorage.removeItem("gsm_admin_session_pwd"); sessionStorage.removeItem("gsm_admin_session_ok"); } catch {} }}
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
                <button onClick={() => setMobileSidebarOpen(true)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors mr-1">
                  <Menu size={15} />
                </button>
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Shield size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-sm leading-none">GSM World</p>
                  <p className="text-slate-500 text-[10px]">Admin Console</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => { setPaymentUnread(0); await fetch("/api/admin/notifications/mark-read", { method: "POST" }).catch(() => {}); }}
                  className="relative w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors">
                  <Bell size={13} />
                  {paymentUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                      {paymentUnread > 9 ? "9+" : paymentUnread}
                    </span>
                  )}
                </button>
                <button onClick={() => { setAuthed(false); setPwd(""); _setWaToken(null); try { sessionStorage.removeItem("gsm_admin_session_pwd"); sessionStorage.removeItem("gsm_admin_session_ok"); } catch {} }}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold px-3 h-8 rounded-xl transition-colors">
                  <LogOut size={12} />
                </button>
              </div>
            </div>
            {/* Page title row */}
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-white font-black text-lg">{pageTitle[tab]}</h1>
                {headerApkVersion && (
                  <span className="hidden md:inline-flex items-center gap-1 bg-blue-900/40 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-700/40">
                    <Tag size={9} />
                    APK {headerApkVersion}
                  </span>
                )}
              </div>
              {/* Desktop: actions in header */}
              <div className="hidden md:flex items-center gap-1">
                <button
                  onClick={async () => { setPaymentUnread(0); await fetch("/api/admin/notifications/mark-read", { method: "POST" }).catch(() => {}); }}
                  className="relative w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors">
                  <Bell size={13} />
                  {paymentUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                      {paymentUnread > 9 ? "9+" : paymentUnread}
                    </span>
                  )}
                </button>
                <button onClick={() => { setShowChangePwd(true); setIsDefaultWarn(false); }}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <KeyRound size={13} />
                </button>
                <button onClick={() => { setAuthed(false); setPwd(""); _setWaToken(null); try { sessionStorage.removeItem("gsm_admin_session_pwd"); sessionStorage.removeItem("gsm_admin_session_ok"); } catch {} }}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold px-3 h-8 rounded-xl transition-colors">
                  <LogOut size={12} />
                  Logout
                </button>
              </div>
            </div>
          </header>

          {/* ── scrollable content ── */}
          <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain pb-16 md:pb-0" style={{ overscrollBehavior: "contain" }}>
            {tab === "overview"   && <OverviewPanel   pwd={pwd} onNavigate={setTab} />}
            {tab === "orders"     && <OrdersPanel     pwd={pwd} />}
            {tab === "products"   && <ProductsPanel   pwd={pwd} />}
            {tab === "users"      && <UsersPanel      pwd={pwd} />}
            {tab === "resellers"  && <ResellersPanel  pwd={pwd} />}
            {tab === "payments"   && <PaymentsPanel   pwd={pwd} />}
            {tab === "live_chat"  && <LiveChatsPanel  pwd={pwd} />}
            {tab === "announcements" && <AnnouncementsPanel pwd={pwd} />}
            {tab === "imei_logs"  && <ImeiLogsPanel   pwd={pwd} />}
          </main>

          {/* ── Mobile hybrid bottom nav ── */}
          <nav
            className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-slate-900 border-t border-white/10 flex safe-bottom"
            style={{ transform: "translateZ(0)", touchAction: "manipulation" }}
          >
            {BOTTOM_NAV.map(item => {
              const active = tab === item.id;
              return (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 transition-colors ${
                    active ? "text-blue-400" : "text-slate-500 hover:text-slate-300"
                  }`}>
                  <item.icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                  <span className="text-[9px] font-bold leading-none truncate">{item.label}</span>
                </button>
              );
            })}
            <button onClick={() => setMobileSidebarOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-slate-500 hover:text-slate-300 transition-colors">
              <Menu size={18} strokeWidth={1.8} />
              <span className="text-[9px] font-bold leading-none">More</span>
            </button>
          </nav>

          {/* ── Mobile slide-over sidebar ── */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              {/* backdrop */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
              {/* panel */}
              <aside className="relative w-64 bg-slate-900 flex flex-col h-full shadow-2xl">
                {/* Brand */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                      <Shield size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-black text-sm leading-none">GSM World</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">Admin Console</p>
                    </div>
                  </div>
                  <button onClick={() => setMobileSidebarOpen(false)}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-slate-400 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
                {/* Nav links */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                  {NAV.map(item => {
                    const active = tab === item.id;
                    return (
                      <button key={item.id} onClick={() => { setTab(item.id); setMobileSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${
                          active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
                        }`}>
                        <item.icon size={17} strokeWidth={active ? 2.5 : 1.8} />
                        <span className="text-sm font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
                {/* Footer */}
                <div className="p-3 border-t border-white/10 space-y-1">
                  <button onClick={() => { setShowChangePwd(true); setIsDefaultWarn(false); setMobileSidebarOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                    <KeyRound size={15} />
                    <span className="text-sm font-medium">Change Password</span>
                  </button>
                  <button onClick={() => { setShowFingerprintSetup(true); setMobileSidebarOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                    <Fingerprint size={15} />
                    <span className="text-sm font-medium">Fingerprint Login</span>
                  </button>
                  <button onClick={() => { setAuthed(false); setPwd(""); _setWaToken(null); setMobileSidebarOpen(false); try { sessionStorage.removeItem("gsm_admin_session_pwd"); sessionStorage.removeItem("gsm_admin_session_ok"); } catch {} }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors">
                    <LogOut size={15} />
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                </div>
              </aside>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
