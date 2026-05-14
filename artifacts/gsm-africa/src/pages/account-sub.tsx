import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, User, ShieldCheck, Cpu, DollarSign, FileText, BookOpen, ShoppingBag, BarChart2, ShoppingCart, Zap, Copy, Check, Smartphone, KeyRound, Shield, Eye, EyeOff, CheckCircle, RefreshCw, ChevronRight, MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useState, useEffect } from "react";
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
    <div className="flex flex-col min-h-full bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <Link href="/account" className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-gray-500">{page.icon}</span>
        <h1 className="font-bold text-[15px] text-gray-800">{page.title}</h1>
      </div>

      <div className="flex-1 px-4 py-5 pb-24">
        {sub === "dashboard" && <DashboardContent user={user} />}
        {sub === "orders"    && <OrdersContent />}
        {sub === "profile"   && <ProfileContent user={user} />}
        {sub === "security"  && <SecurityContent user={user} />}
        {sub === "add-fund"  && <AddFundContent token={token} />}
        {(sub === "api" || sub === "invoices" || sub === "ledger") && <ComingSoon title={page.title} />}
      </div>
    </div>
  );
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
  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const zeroBalance = !isLoading && Number(balance) <= 0;

  useEffect(() => {
    if (!token) { setOrdersLoading(false); return; }
    fetch("/api/orders/my", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOrders(data); })
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, [token]);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.paymentStatus === "pending").length;
  const completedOrders = orders.filter(o => o.paymentStatus === "paid").length;

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
                <div key={order.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-black text-gray-700">Order #{order.id}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.paymentStatus === "paid" ? "bg-green-100 text-green-700"
                      : order.paymentStatus === "pending" ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                    }`}>{order.paymentStatus}</span>
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

  const otpauthUrl = `otpauth://totp/GSMAfrica:${encodeURIComponent(user?.email ?? "user")}?secret=${secret}&issuer=GSMAfrica`;

  return (
    <div className="space-y-6 pb-4">

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
                <p className="mt-0.5">Open your authenticator app and enter the current code for GSMAfrica.</p>
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

      {/* ── Change Password section ── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <KeyRound size={18} className="text-gray-500" />
          <div>
            <p className="font-bold text-sm text-gray-800">Change Password</p>
            <p className="text-xs text-gray-500">Update your account password</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "Current Password", val: cur, set: setCur, show: showCur, setShow: setShowCur },
            { label: "New Password",     val: nw,  set: setNw,  show: showNw,  setShow: setShowNw  },
            { label: "Confirm Password", val: conf, set: setConf, show: showConf, setShow: setShowConf },
          ].map(({ label, val, set, show, setShow }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={handlePasswordChange}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm mt-1 transition-colors"
          >
            Update Password
          </button>
        </div>
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
              <p className="text-sm text-gray-500 max-w-xs mx-auto">Our team verifies your payment and credits your wallet within <strong>24 hours</strong>.</p>
              <button onClick={() => { setManualSent(false); setManualAmount(""); }}
                className="px-6 py-2.5 border-2 border-green-400 rounded-xl text-sm font-bold text-green-700 bg-green-50">
                Add More Funds
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3.5 border-b border-yellow-100 bg-yellow-50">
                <p className="text-xs font-bold text-yellow-800 uppercase tracking-wider">Manual Payment — Admin Verification</p>
                <p className="text-[10px] text-yellow-700 mt-0.5">Send payment first, then notify us. We verify within 24 hours.</p>
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
                    toast({ title: "Request submitted!", description: "Our team will credit your wallet within 24 hours." });
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

function OrderDetailPanel({ order, token, onBack }: { order: MyOrder; token: string; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 mb-2">
        <ArrowLeft size={14} /> Back to Orders
      </button>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="font-black text-gray-800">Order #{order.id}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            order.paymentStatus === "paid" ? "bg-green-100 text-green-700"
            : order.paymentStatus === "completed" ? "bg-emerald-100 text-emerald-700"
            : order.paymentStatus === "processing" ? "bg-blue-100 text-blue-700"
            : order.paymentStatus === "pending" ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700"
          }`}>{order.paymentStatus}</span>
        </div>
        <div className="space-y-2 mb-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-gray-600">
              <span>{item.productName} × {item.quantity}</span>
              <span className="font-semibold">${parseFloat(item.price).toFixed(2)}</span>
            </div>
          ))}
        </div>
        {order.deviceIdentifier && (
          <p className="text-[10px] text-gray-400 font-mono mb-2">IMEI/ID: {order.deviceIdentifier}</p>
        )}
        <div className="flex items-center justify-between border-t border-gray-50 pt-2">
          <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()} · {order.paymentMethod}</p>
          <p className="text-base font-black text-blue-700">${parseFloat(order.total).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

// ── My Orders ────────────────────────────────────────────────────────────────
function OrdersContent() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<MyOrder | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch("/api/orders/my", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setOrders(Array.isArray(data) ? data : []); })
      .catch(() => toast({ title: "Could not load orders", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="text-center py-10 text-gray-400">Loading orders…</div>;

  if (!token) return (
    <div className="text-center py-10">
      <ShoppingBag size={40} className="mx-auto text-gray-200 mb-3" />
      <p className="font-semibold text-gray-500">Please sign in to view your orders</p>
      <Link href="/login"><button className="mt-4 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg text-sm">Sign In</button></Link>
    </div>
  );

  if (selectedOrder) {
    return <OrderDetailPanel order={selectedOrder} token={token} onBack={() => setSelectedOrder(null)} />;
  }

  if (orders.length === 0) return (
    <div className="text-center py-10">
      <ShoppingBag size={40} className="mx-auto text-gray-200 mb-3" />
      <p className="font-semibold text-gray-500">No orders yet</p>
      <p className="text-sm text-gray-400 mt-1">Your orders will appear here after you make a purchase.</p>
      <Link href="/products"><button className="mt-4 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg text-sm">Shop Now</button></Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <button
          key={order.id}
          onClick={() => setSelectedOrder(order)}
          className="w-full bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-left hover:shadow-md hover:border-blue-100 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-black text-gray-700">Order #{order.id}</p>
              {order.orderType === "unlock" && (
                <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">UNLOCK</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                order.paymentStatus === "paid" ? "bg-green-100 text-green-700"
                : order.paymentStatus === "pending" ? "bg-yellow-100 text-yellow-700"
                : order.paymentStatus === "processing" ? "bg-blue-100 text-blue-700"
                : order.paymentStatus === "completed" ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
              }`}>{order.paymentStatus}</span>
              <ChevronRight size={12} className="text-gray-300" />
            </div>
          </div>
          <div className="space-y-1 mb-2">
            {order.items.slice(0, 2).map((item) => (
              <div key={item.id} className="flex justify-between text-xs text-gray-600">
                <span className="truncate max-w-[65%]">{item.productName} × {item.quantity}</span>
                <span className="font-semibold ml-2">${parseFloat(item.price).toFixed(2)}</span>
              </div>
            ))}
            {order.items.length > 2 && <p className="text-[10px] text-gray-400">+{order.items.length - 2} more items</p>}
          </div>
          {order.deviceIdentifier && (
            <p className="text-[10px] text-gray-400 font-mono mb-1">IMEI: {order.deviceIdentifier}</p>
          )}
          <div className="flex items-center justify-between border-t border-gray-50 pt-2">
            <p className="text-[11px] text-gray-400">{new Date(order.createdAt).toLocaleDateString()} · {order.paymentMethod}</p>
            <p className="text-sm font-black text-blue-700">${parseFloat(order.total).toFixed(2)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Profile ──────────────────────────────────────────────────────────────────
function ProfileContent({ user }: { user: { id?: number; name: string | null; email: string } | null }) {
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { token, updateUser } = useAuth();

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
      toast({ title: "Profile saved!", description: "Your name has been updated." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
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
