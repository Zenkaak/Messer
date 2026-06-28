import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  User, BarChart2, ShoppingBag, ShoppingCart, Zap,
  UserCircle, ShieldCheck, Cpu, DollarSign, FileText,
  BookOpen, LogOut, ChevronRight, Plus, Server, KeyRound, Store,
  Wallet, Settings, TrendingUp, ArrowLeftRight, Fingerprint, Loader2, Trash2,
} from "lucide-react";

export function AccountPage() {
  const { user, isAuthenticated, logout, token } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: balance = 0 } = useWalletBalance();
  const [fpRegistered, setFpRegistered] = useState<boolean | null>(null);
  const [fpLoading, setFpLoading] = useState(false);
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

  const isNativeApp = /GSMWorldApp|GSMAdminApp/.test(navigator.userAgent);
  type BioBridge = { saveCredential:(d:string)=>void; hasCredential:()=>string; clearCredential:()=>void; authenticate:(cb:string)=>void };
  const bioBridge = (): BioBridge | null => {
    const b = (window as Record<string, unknown>).AndroidBiometric;
    return (b && typeof (b as BioBridge).hasCredential === "function") ? b as BioBridge : null;
  };

  useEffect(() => {
    const bridge = bioBridge();
    if (isNativeApp && bridge) {
      setFpRegistered(bridge.hasCredential() === "true");
      return;
    }
    if (!token) return;
    fetch(`${base}/api/auth/webauthn/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json() as Promise<{ registered?: boolean }>)
      .then(d => setFpRegistered(Boolean(d.registered)))
      .catch(() => setFpRegistered(false));
  }, [token, base]);

  async function handleFingerprintSetup() {
    if (!token || !user) return;
    setFpLoading(true);

    const bridge = bioBridge();
    if (isNativeApp && bridge) {
      try {
        bridge.saveCredential(JSON.stringify({ email: user.email, token }));
        setFpRegistered(true);
        toast({ title: "Fingerprint registered!", description: "You can now sign in with your fingerprint." });
      } catch {
        toast({ title: "Fingerprint setup failed. Please try again.", variant: "destructive" });
      } finally {
        setFpLoading(false);
      }
      return;
    }

    try {
      const challengeRes = await fetch(`${base}/api/auth/webauthn/register-challenge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const options = await challengeRes.json() as { error?: string; [k: string]: unknown };
      if (!challengeRes.ok) {
        toast({ title: options.error ?? "Failed to start fingerprint setup", variant: "destructive" });
        return;
      }
      const attResp = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]["optionsJSON"] });
      const verifyRes = await fetch(`${base}/api/auth/webauthn/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(attResp),
      });
      const result = await verifyRes.json() as { success?: boolean; error?: string };
      if (!verifyRes.ok || !result.success) {
        toast({ title: result.error ?? "Fingerprint setup failed", variant: "destructive" });
        return;
      }
      setFpRegistered(true);
      toast({ title: "Fingerprint registered!", description: "You can now sign in with your fingerprint." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotAllowedError") || msg.toLowerCase().includes("cancel")) {
        toast({ title: "Fingerprint setup cancelled", variant: "destructive" });
      } else {
        toast({ title: "Fingerprint setup failed. Please try again.", variant: "destructive" });
      }
    } finally {
      setFpLoading(false);
    }
  }

  async function handleFingerprintRemove() {
    if (!token) return;
    setFpLoading(true);

    const bridge = bioBridge();
    if (isNativeApp && bridge) {
      try {
        bridge.clearCredential();
        setFpRegistered(false);
        toast({ title: "Fingerprint removed" });
      } catch {
        toast({ title: "Failed to remove fingerprint", variant: "destructive" });
      } finally {
        setFpLoading(false);
      }
      return;
    }

    try {
      await fetch(`${base}/api/auth/webauthn/credential`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setFpRegistered(false);
      toast({ title: "Fingerprint removed" });
    } catch {
      toast({ title: "Failed to remove fingerprint", variant: "destructive" });
    } finally {
      setFpLoading(false);
    }
  }

  function handleLogout() {
    logout();
    toast({ title: "Signed out successfully" });
    navigate("/");
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#0d1623]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl">
            <User size={40} className="text-white/40" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Welcome Back</h2>
          <p className="text-slate-400 text-sm max-w-[220px] leading-relaxed">
            Sign in to manage your orders, wallet &amp; settings
          </p>
        </div>

        <div className="px-5 pb-12 space-y-3">
          <Link href="/login">
            <button className="w-full py-4 text-base font-black bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-900/40 transition-colors">
              Sign In
            </button>
          </Link>
          <Link href="/signup">
            <button className="w-full py-4 text-base font-bold border border-white/10 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors">
              Create Account
            </button>
          </Link>
          <p className="text-center text-xs text-slate-600 pt-1">
            Trusted by thousands worldwide since 2016
          </p>
        </div>
      </div>
    );
  }

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col min-h-full bg-[#060b15]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(155deg,#0d1623 0%,#0f2744 60%,#0a3260 100%)" }} className="px-5 pt-8 pb-6">

        {/* Top row: avatar + info + edit */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative shrink-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="w-16 h-16 rounded-2xl object-cover shadow-xl shadow-blue-900/50"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-900/50">
                <span className="text-white font-black text-xl tracking-tight">{initials}</span>
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-[#0d1623] rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-lg leading-tight truncate">{displayName}</p>
            <p className="text-blue-300/60 text-xs mt-0.5 truncate">{user?.email}</p>
          </div>
          <Link href="/account/profile">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/20 transition-colors">
              <Settings size={15} className="text-white/70" />
            </div>
          </Link>
        </div>

        {/* Wallet card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0.04) 100%)", border: "1px solid rgba(255,255,255,0.10)" }}>
          <div className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-blue-300/60 text-[10px] font-bold uppercase tracking-[0.12em] mb-1">Wallet Balance</p>
                <p className="text-white font-black text-3xl leading-none tracking-tight">
                  ${balance.toFixed(2)}
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
                  <Plus size={15} strokeWidth={2.5} />
                  Add Funds
                </button>
              </Link>
              <Link href="/account/transfer" className="flex-1">
                <button className="w-full bg-blue-500/20 hover:bg-blue-500/30 active:bg-blue-500/40 text-white font-bold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 border border-blue-400/30">
                  <ArrowLeftRight size={15} strokeWidth={2.5} />
                  Transfer
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Menu sections ────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-10 space-y-4">

        {/* Orders */}
        <Section label="Orders">
          <MenuItem icon={<BarChart2 size={16} />}   gradient="from-blue-500 to-blue-600"   label="Dashboard"     href="/account/dashboard" />
          <MenuItem icon={<ShoppingBag size={16} />}  gradient="from-indigo-500 to-indigo-600" label="My Orders"  href="/account/orders" />
          <MenuItem icon={<ShoppingCart size={16} />} gradient="from-cyan-500 to-cyan-600"   label="Bulk Order"    href="/account/bulk-order" />
          <MenuItem icon={<Zap size={16} />}          gradient="from-orange-400 to-orange-500" label="Express Order" href="/account/express-order" />
        </Section>

        {/* Account */}
        <Section label="Account">
          <MenuItem icon={<UserCircle size={16} />}  gradient="from-slate-500 to-slate-600"   label="Profile"          href="/account/profile" />
          <MenuItem icon={<ShieldCheck size={16} />} gradient="from-emerald-500 to-emerald-600" label="Account Security" href="/account/security" />
          <MenuItem icon={<Cpu size={16} />}         gradient="from-violet-500 to-violet-600"  label="API Settings"     href="/account/api" />
        </Section>

        {/* Fingerprint Login */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 mb-2">Quick Access</p>
          <div className="rounded-2xl overflow-hidden p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
                <Fingerprint size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/90 text-[14px] font-semibold">Fingerprint Login</p>
                <p className="text-white/40 text-[11px]">
                  {fpRegistered === null ? "Checking status…" : fpRegistered ? "Active — tap to remove" : "Not set up — sign in faster with fingerprint"}
                </p>
              </div>
              {fpRegistered && (
                <span className="text-[10px] font-bold text-green-400 px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>ON</span>
              )}
            </div>
            {fpRegistered ? (
              <button
                onClick={handleFingerprintRemove}
                disabled={fpLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                style={{ border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)" }}
              >
                {fpLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remove Fingerprint
              </button>
            ) : (
              <button
                onClick={handleFingerprintSetup}
                disabled={fpLoading || fpRegistered === null}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: fpLoading || fpRegistered === null ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#6366f1 0%,#7c3aed 100%)" }}
              >
                {fpLoading ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
                {fpLoading ? "Setting up…" : "Set Up Fingerprint Login"}
              </button>
            )}
          </div>
        </div>

        {/* Services */}
        <Section label="Services">
          <MenuItem icon={<Server size={16} />}   gradient="from-rose-500 to-orange-500"  label="Server Credits"  href="/credits" />
          <MenuItem icon={<KeyRound size={16} />} gradient="from-amber-500 to-yellow-500" label="Tool Activation" href="/activate" />
        </Section>

        {/* Reseller banner */}
        <div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 mb-2">Earn Money</p>
          <Link href="/reseller">
            <div className="relative overflow-hidden rounded-2xl p-4 flex items-center gap-3"
              style={{ background: "linear-gradient(135deg,#0d9488 0%,#0f766e 100%)" }}>
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5" />
              <div className="absolute -right-2 -bottom-6 w-20 h-20 rounded-full bg-white/5" />
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 z-10">
                <TrendingUp size={18} className="text-white" />
              </div>
              <div className="flex-1 z-10">
                <span className="text-white text-sm font-black block leading-tight">Reseller Program</span>
                <span className="text-teal-100/80 text-[11px] font-medium">Earn 10% commission on every sale</span>
              </div>
              <ChevronRight size={16} className="text-white/50 z-10 shrink-0" />
            </div>
          </Link>
        </div>

        {/* Billing */}
        <Section label="Billing">
          <MenuItem icon={<DollarSign size={16} />} gradient="from-green-500 to-emerald-600"  label="Add Fund"       href="/account/add-fund" />
          <MenuItem icon={<FileText size={16} />}   gradient="from-yellow-500 to-amber-500"   label="Invoices"       href="/account/invoices" />
          <MenuItem icon={<BookOpen size={16} />}   gradient="from-pink-500 to-rose-500"      label="Account Ledger" href="/account/ledger" />
        </Section>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm text-red-400 rounded-2xl transition-colors hover:bg-red-500/10"
          style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)" }}
        >
          <LogOut size={16} />
          Sign Out
        </button>

        <p className="text-center text-[10px] text-white/20 pb-1">GSM World · Since 2016</p>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 mb-2">{label}</p>
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  icon, gradient, label, href,
}: {
  icon: React.ReactNode;
  gradient: string;
  label: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-white/5 active:bg-white/10" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
        <span className="text-white">{icon}</span>
      </div>
      <span className="text-white/90 text-[14px] font-semibold flex-1">{label}</span>
      <ChevronRight size={14} className="text-white/20" />
    </Link>
  );
}
