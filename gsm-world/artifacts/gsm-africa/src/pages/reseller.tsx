import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Store, CheckCircle2, Clock, XCircle, Copy, ExternalLink,
  ChevronRight, DollarSign, Percent, ShoppingBag, ArrowRight,
  CreditCard, Shield, Users, Zap, AlertCircle, Wallet, Plus, History,
  X, TrendingUp, BanknoteIcon, ArrowUpRight, Star, ChevronLeft,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PaymentMethod = { method: string; walletAddress: string; network: string | null; label: string | null };
type ResellerStatus = {
  status: "none" | "pending_payment" | "pending_approval" | "approved" | "rejected";
  storeSlug?: string;
  storeName?: string;
  commissionRate?: string;
  totalEarned?: string;
  totalOrders?: number;
  rejectionReason?: string;
  paymentMethods?: PaymentMethod[];
  securityFeeUsd?: number;
  createdAt?: string;
  approvedAt?: string;
  pendingWithdrawals?: string;
  availableBalance?: string;
};

type Withdrawal = {
  id: number;
  amount: string;
  status: "pending" | "approved" | "rejected";
  paymentMethod: string;
  paymentAddress: string;
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
  processedAt: string | null;
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text; document.body.appendChild(el); el.select();
    document.execCommand("copy"); document.body.removeChild(el);
  });
}

function WithdrawalStatusBadge({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
      <CheckCircle2 size={9} /> Paid
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
      <XCircle size={9} /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
      <Clock size={9} /> Pending
    </span>
  );
}

export function ResellerPage() {
  const { user, isAuthenticated, token } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<ResellerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"info" | "apply" | "pay" | "submitted">("info");
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [copied, setCopied] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaSending, setMpesaSending] = useState(false);
  const [mpesaSent, setMpesaSent] = useState(false);
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState("");
  const [npMode, setNpMode] = useState(false);
  const [npCurrency, setNpCurrency] = useState("usdttrc20");
  const [npPayment, setNpPayment] = useState<{ paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string } | null>(null);
  const [npCreating, setNpCreating] = useState(false);
  const [npPollCount, setNpPollCount] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("M-Pesa");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "withdrawals">("overview");

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const r = await fetch(`${BASE}/api/reseller/status`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json() as ResellerStatus;
      setStatus(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [isAuthenticated, token]);

  const fetchWithdrawals = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    try {
      const r = await fetch(`${BASE}/api/reseller/withdrawals`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json() as { withdrawals: Withdrawal[] };
      setWithdrawals(d.withdrawals ?? []);
    } catch { /* ignore */ }
  }, [isAuthenticated, token]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { if (status?.status === "approved") fetchWithdrawals(); }, [status?.status, fetchWithdrawals]);
  useEffect(() => {
    if (status?.status === "pending_payment") {
      setStep("pay");
      setSelectedMethod(prev => prev ?? (status.paymentMethods?.[0] ?? null));
    }
  }, [status]);

  function handleCopy(text: string, key: string) {
    copyToClipboard(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  }

  function slugify(str: string) {
    return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  }

  async function handleApply() {
    if (!storeName.trim()) { toast({ title: "Enter a store name", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/reseller/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeName: storeName.trim(), storeSlug: storeSlug.trim() || undefined }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; status?: string; paymentMethods?: PaymentMethod[]; securityFeeUsd?: number; application?: { storeSlug: string; storeName: string; status?: string } };
      if (!res.ok) { toast({ title: data.error ?? "Application failed", variant: "destructive" }); return; }
      if ((data.securityFeeUsd ?? 0) === 0 || data.application?.status === "pending_approval") {
        toast({ title: "Application submitted!", description: "Your store will be reviewed and activated within 24 hours." });
        await fetchStatus(); return;
      }
      setStatus({ status: "pending_payment", storeSlug: data.application?.storeSlug, storeName: data.application?.storeName, paymentMethods: data.paymentMethods, securityFeeUsd: data.securityFeeUsd });
      setStep("pay");
      if (data.paymentMethods?.[0]) setSelectedMethod(data.paymentMethods[0]);
    } catch (err) {
      toast({ title: "Connection error", description: "Check your internet and try again.", variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  async function handleNpCreate() {
    setNpCreating(true);
    try {
      const res = await fetch(`${BASE}/api/wallet/add-fund/nowpayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 15, payCurrency: npCurrency }),
      });
      const d = await res.json() as { error?: string; paymentId?: string; payAddress?: string; payAmount?: number; payCurrency?: string; expiresAt?: string };
      if (!res.ok) throw new Error(d.error || "Failed to create payment");
      setNpPayment({ paymentId: d.paymentId!, payAddress: d.payAddress!, payAmount: d.payAmount!, payCurrency: d.payCurrency!, expiresAt: d.expiresAt });
      setNpPollCount(0);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setNpCreating(false); }
  }

  async function handleNpCheck() {
    if (!npPayment) return;
    try {
      const res = await fetch(`${BASE}/api/wallet/add-fund/nowpayments/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: npPayment.paymentId }),
      });
      const d = await res.json() as { status: string };
      if (d.status === "paid") {
        const pr = await fetch(`${BASE}/api/reseller/pay-wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ paymentReference: npPayment.paymentId, paymentMethod: "nowpayments" }),
        });
        if (pr.ok) {
          setStatus(prev => prev ? { ...prev, status: "pending_approval" } : prev);
          setStep("submitted");
          toast({ title: "Crypto payment confirmed! Application submitted." });
        } else {
          toast({ title: "Payment confirmed but wallet deduction failed — contact support", variant: "destructive" });
        }
      } else if (d.status === "failed") {
        toast({ title: "Payment failed or expired", variant: "destructive" });
        setNpPayment(null);
      } else {
        toast({ title: "Payment not confirmed yet", description: "Try again in a moment." });
      }
    } catch { toast({ title: "Could not check status", variant: "destructive" }); }
  }

  useEffect(() => {
    if (!npPayment || npPollCount >= 30) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/wallet/add-fund/nowpayments/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ paymentId: npPayment.paymentId }),
        });
        const d = await res.json() as { status: string };
        if (d.status === "paid") {
          const pr = await fetch(`${BASE}/api/reseller/pay-wallet`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ paymentReference: npPayment.paymentId, paymentMethod: "nowpayments" }),
          });
          if (pr.ok) { setStatus(prev => prev ? { ...prev, status: "pending_approval" } : prev); setStep("submitted"); toast({ title: "Crypto payment confirmed! Application submitted automatically." }); }
        } else if (d.status === "failed") { setNpPayment(null); toast({ title: "Crypto payment failed or expired", variant: "destructive" }); }
        else { setNpPollCount(c => c + 1); }
      } catch { setNpPollCount(c => c + 1); }
    }, 30_000);
    return () => clearTimeout(t);
  }, [npPayment, npPollCount, token]);

  async function handleMpesaSTK() {
    if (!mpesaPhone.trim()) { toast({ title: "Enter your M-Pesa phone number", variant: "destructive" }); return; }
    setMpesaSending(true);
    try {
      const res = await fetch(`${BASE}/api/reseller/mpesa/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: mpesaPhone.trim() }),
      });
      const data = await res.json() as { success?: boolean; checkoutRequestId?: string; error?: string };
      if (!res.ok) { toast({ title: data.error ?? "STK push failed", variant: "destructive" }); return; }
      setMpesaCheckoutId(data.checkoutRequestId ?? "");
      setMpesaSent(true);
      toast({ title: "STK Push Sent!", description: "Enter your M-Pesa PIN to complete the payment." });
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        if (tries > 24) { clearInterval(poll); return; }
        try {
          const qr = await fetch(`${BASE}/api/reseller/mpesa/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ checkoutRequestId: data.checkoutRequestId }),
          });
          const qd = await qr.json() as { status?: string; message?: string };
          if (qd.status === "paid") { clearInterval(poll); setStatus(prev => prev ? { ...prev, status: "pending_approval" } : prev); setStep("submitted"); }
          else if (qd.status === "failed") { clearInterval(poll); setMpesaSent(false); toast({ title: "Payment failed", description: qd.message ?? "M-Pesa payment was cancelled or failed.", variant: "destructive" }); }
        } catch { /* ignore */ }
      }, 5000);
    } catch { toast({ title: "Connection error", description: "Check your internet and try again.", variant: "destructive" }); }
    finally { setMpesaSending(false); }
  }

  async function handleSubmitPayment() {
    if (!selectedMethod || !paymentRef.trim()) { toast({ title: "Enter your payment reference", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/reseller/submit-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentMethod: selectedMethod.method, paymentReference: paymentRef.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { toast({ title: data.error ?? "Failed", variant: "destructive" }); return; }
      setStatus(prev => prev ? { ...prev, status: "pending_approval" } : prev);
      setStep("submitted");
    } catch { toast({ title: "Connection error", description: "Check your internet and try again.", variant: "destructive" }); }
    finally { setSubmitting(false); }
  }

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 10) { toast({ title: "Minimum withdrawal is $10", variant: "destructive" }); return; }
    const available = parseFloat(status?.availableBalance ?? "0");
    if (amount > available) { toast({ title: `Insufficient balance. Available: $${available.toFixed(2)}`, variant: "destructive" }); return; }
    if (!withdrawMethod.trim() || !withdrawAddress.trim()) { toast({ title: "Enter your payment method and address", variant: "destructive" }); return; }
    setWithdrawing(true);
    try {
      const res = await fetch(`${BASE}/api/reseller/withdrawal/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, paymentMethod: withdrawMethod.trim(), paymentAddress: withdrawAddress.trim(), notes: withdrawNotes.trim() || undefined }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { toast({ title: data.error ?? "Failed", variant: "destructive" }); return; }
      toast({ title: "Withdrawal request submitted!" });
      setShowWithdrawForm(false);
      setWithdrawAmount(""); setWithdrawAddress(""); setWithdrawNotes("");
      await Promise.all([fetchStatus(), fetchWithdrawals()]);
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    finally { setWithdrawing(false); }
  }

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen pb-24" style={{ background: "#070d1a" }}>
        <div className="flex-1 flex flex-col justify-center px-6 pt-16 pb-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5" style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)", boxShadow: "0 0 40px rgba(14,165,233,0.3)" }}>
              <Store size={34} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Reseller Program</h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>Earn <span className="text-sky-400 font-bold">10% commission</span> on every sale<br />through your personal store link.</p>
          </div>

          <div className="space-y-3 mb-8">
            {[
              { icon: <Percent size={18} />, title: "10% Commission", desc: "On every successful sale through your link", color: "#0ea5e9" },
              { icon: <Zap size={18} />, title: "Instant Setup", desc: "Your store is live within 24 hours", color: "#8b5cf6" },
              { icon: <BanknoteIcon size={18} />, title: "Easy Payouts", desc: "Withdraw via USDT, M-Pesa or Binance Pay", color: "#10b981" },
            ].map(f => (
              <div key={f.title} className="flex items-center gap-4 rounded-2xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${f.color}20`, color: f.color }}>
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/login")}
            className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
            Sign In to Apply <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#070d1a" }}>
        <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(14,165,233,0.3)", borderTopColor: "#0ea5e9" }} />
      </div>
    );
  }

  const currentStatus = status?.status ?? "none";
  const paymentMethods = status?.paymentMethods ?? [];
  const storeUrl = status?.storeSlug ? `${window.location.origin}${BASE}/store/${status.storeSlug}` : "";
  const availableBalance = parseFloat(status?.availableBalance ?? "0");
  const totalEarned = parseFloat(status?.totalEarned ?? "0");
  const pendingWithdrawals = parseFloat(status?.pendingWithdrawals ?? "0");

  // ── APPROVED ──────────────────────────────────────────────────────────────
  if (currentStatus === "approved") {
    const pendingCount = withdrawals.filter(w => w.status === "pending").length;

    return (
      <div className="flex flex-col min-h-full pb-28" style={{ background: "#070d1a" }}>

        {/* ── Top hero ── */}
        <div className="relative px-5 pt-8 pb-0 overflow-hidden">
          {/* Glow blobs */}
          <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle,#0ea5e9,transparent 70%)", transform: "translate(-30%,-30%)" }} />
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle,#8b5cf6,transparent 70%)", transform: "translate(30%,-30%)" }} />

          {/* Store identity */}
          <div className="relative flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl" style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
                {(status?.storeName ?? "R")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-black text-base leading-tight">{status?.storeName}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.18)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <CheckCircle2 size={9} /> Active Reseller
                </span>
              </div>
            </div>
            <button onClick={() => window.open(storeUrl, "_blank")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "rgba(14,165,233,0.15)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.25)" }}>
              <ExternalLink size={12} /> Store
            </button>
          </div>

          {/* Balance hero card */}
          <div className="relative rounded-3xl p-5 mb-5 overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(14,165,233,0.15) 0%,rgba(99,102,241,0.1) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ background: "linear-gradient(135deg,rgba(14,165,233,0.07),transparent)" }} />
            <p className="text-xs font-bold mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>AVAILABLE BALANCE</p>
            <p className="text-5xl font-black text-white tracking-tight mb-1">${availableBalance.toFixed(2)}</p>
            {pendingWithdrawals > 0 && (
              <p className="text-xs" style={{ color: "rgba(245,158,11,0.9)" }}>+ ${pendingWithdrawals.toFixed(2)} pending payout</p>
            )}
            <div className="mt-4">
              {availableBalance >= 10 ? (
                <button
                  onClick={() => { setShowWithdrawForm(true); setActiveTab("withdrawals"); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white"
                  style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
                  <ArrowUpRight size={15} /> Request Payout
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Progress to min. payout ($10)</p>
                    <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>${availableBalance.toFixed(2)} / $10</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (availableBalance / 10) * 100)}%`, background: "linear-gradient(90deg,#0ea5e9,#6366f1)" }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {[
              { label: "Commission", value: `${status?.commissionRate ?? 10}%`, color: "#0ea5e9", icon: <Percent size={13} /> },
              { label: "Total Earned", value: `$${totalEarned.toFixed(0)}`, color: "#10b981", icon: <TrendingUp size={13} /> },
              { label: "Orders", value: String(status?.totalOrders ?? 0), color: "#8b5cf6", icon: <ShoppingBag size={13} /> },
            ].map(k => (
              <div key={k.label} className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex justify-center mb-1.5" style={{ color: k.color }}>{k.icon}</div>
                <p className="text-lg font-black text-white leading-none mb-0.5">{k.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-2xl p-1 mb-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["overview", "withdrawals"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 rounded-xl text-xs font-black capitalize transition-all flex items-center justify-center gap-1.5"
                style={activeTab === tab
                  ? { background: "linear-gradient(135deg,#0ea5e9,#6366f1)", color: "#fff", boxShadow: "0 4px 12px rgba(14,165,233,0.3)" }
                  : { color: "rgba(255,255,255,0.45)" }}>
                {tab === "withdrawals" && pendingCount > 0 && (
                  <span className="w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center" style={{ background: "#f59e0b", color: "#fff" }}>{pendingCount}</span>
                )}
                {tab === "overview" ? "Overview" : "Withdrawals"}
              </button>
            ))}
          </div>
        </div>

        {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="px-5 pt-4 space-y-4">

            {/* Store URL card */}
            <div className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(14,165,233,0.15)", color: "#0ea5e9" }}>
                  <Store size={14} />
                </div>
                <p className="text-xs font-black text-white uppercase tracking-wider">Your Store Link</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="flex-1 text-xs font-mono truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{storeUrl}</p>
                <button onClick={() => handleCopy(storeUrl, "link")} style={{ color: copied === "link" ? "#10b981" : "rgba(255,255,255,0.35)" }} className="shrink-0 transition-colors">
                  {copied === "link" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => window.open(storeUrl, "_blank")}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white"
                  style={{ background: "rgba(14,165,233,0.2)", border: "1px solid rgba(14,165,233,0.3)" }}>
                  <ExternalLink size={12} /> View Store
                </button>
                <button onClick={() => handleCopy(storeUrl, "link2")}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                  {copied === "link2" ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {copied === "link2" ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* How it works */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest px-1 mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>How It Works</p>
              <div className="space-y-2">
                {[
                  { n: "01", t: "Share your link", d: "Customers click your store link and browse all products", color: "#0ea5e9" },
                  { n: "02", t: "Customer purchases", d: "They complete checkout normally through GSM World", color: "#8b5cf6" },
                  { n: "03", t: "Earn 10% commission", d: "You earn 10% of every sale made through your link", color: "#10b981" },
                  { n: "04", t: "Withdraw earnings", d: "Request payout when your balance reaches $10", color: "#f59e0b" },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-3 rounded-2xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-xs font-black shrink-0 mt-0.5 w-6 text-right" style={{ color: s.color }}>{s.n}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{s.t}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── WITHDRAWALS TAB ─────────────────────────────────────────────── */}
        {activeTab === "withdrawals" && (
          <div className="px-5 pt-4 space-y-4">
            {/* Balance + request */}
            <div className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] mb-1 font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Available to Withdraw</p>
                  <p className="text-3xl font-black text-white">${availableBalance.toFixed(2)}</p>
                  {pendingWithdrawals > 0 && (
                    <p className="text-xs mt-1 font-medium" style={{ color: "#f59e0b" }}>${pendingWithdrawals.toFixed(2)} pending</p>
                  )}
                </div>
                <button
                  onClick={() => setShowWithdrawForm(true)}
                  disabled={availableBalance < 10}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: availableBalance >= 10 ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "rgba(255,255,255,0.1)" }}>
                  <Plus size={14} /> Withdraw
                </button>
              </div>
              {availableBalance < 10 && (
                <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>Minimum payout amount is $10.00</p>
              )}
            </div>

            {/* History */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest px-1 mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Withdrawal History</p>
              {withdrawals.length === 0 ? (
                <div className="flex flex-col items-center py-14 rounded-3xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <History size={28} className="mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
                  <p className="text-sm font-bold text-white opacity-40">No withdrawals yet</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Request your first payout once you hit $10</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map(w => (
                    <div key={w.id} className="rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-xl font-black text-white">${parseFloat(w.amount).toFixed(2)}</p>
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                            {w.paymentMethod} · <span className="font-mono">{w.paymentAddress.slice(0, 20)}{w.paymentAddress.length > 20 ? "…" : ""}</span>
                          </p>
                        </div>
                        <WithdrawalStatusBadge status={w.status} />
                      </div>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                        Requested {new Date(w.createdAt).toLocaleDateString()}
                        {w.processedAt && ` · Processed ${new Date(w.processedAt).toLocaleDateString()}`}
                      </p>
                      {w.adminNotes && (
                        <p className="text-xs mt-1.5 italic" style={{ color: "rgba(255,255,255,0.5)" }}>"{w.adminNotes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── WITHDRAWAL MODAL ────────────────────────────────────────────── */}
        {showWithdrawForm && (
          <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
            <div className="w-full rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: "#0e1629", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-black text-white">Request Payout</h3>
                <button onClick={() => setShowWithdrawForm(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <X size={16} className="text-white" />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.2)" }}>
                <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>Available</span>
                <span className="text-lg font-black text-white">${availableBalance.toFixed(2)}</span>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>Amount (USD) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-white opacity-60">$</span>
                  <input type="number" min="10" step="0.01" max={availableBalance} value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)} placeholder="10.00"
                    className="w-full pl-8 pr-4 py-3.5 rounded-xl text-white font-bold focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Minimum $10</p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>Payout Method *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "USDT (TRC20)", label: "USDT", sub: "TRC20 wallet address" },
                    { value: "Binance Pay", label: "Binance Pay", sub: "Pay ID" },
                    { value: "Credits", label: "Credits", sub: "Account email" },
                    { value: "GSM Wallet", label: "GSM Wallet", sub: "Account email" },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => { setWithdrawMethod(opt.value); setWithdrawAddress(""); }}
                      className="flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-left transition-all"
                      style={withdrawMethod === opt.value
                        ? { borderColor: "#0ea5e9", background: "rgba(14,165,233,0.12)" }
                        : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
                      <span className="text-xs font-black text-white">{opt.label}</span>
                      <span className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {withdrawMethod === "USDT (TRC20)" ? "USDT Wallet Address (TRC20) *" :
                   withdrawMethod === "Binance Pay" ? "Binance Pay ID *" :
                   "Account Email *"}
                </label>
                <input value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)}
                  placeholder={withdrawMethod === "USDT (TRC20)" ? "T... wallet address" : withdrawMethod === "Binance Pay" ? "e.g. 490759406" : "your@email.com"}
                  className="w-full px-4 py-3.5 rounded-xl text-white font-medium focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>Notes (optional)</label>
                <input value={withdrawNotes} onChange={e => setWithdrawNotes(e.target.value)} placeholder="Any additional info..."
                  className="w-full px-4 py-3.5 rounded-xl text-white font-medium focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>

              <button onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount || !withdrawAddress.trim()}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
                {withdrawing
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><ArrowUpRight size={18} /> Submit Request</>}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PENDING APPROVAL ────────────────────────────────────────────────────────
  if (currentStatus === "pending_approval") {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 pt-20 pb-24 text-center" style={{ background: "#070d1a" }}>
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <Clock size={40} style={{ color: "#f59e0b" }} />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#070d1a" }}>
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#f59e0b" }} />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Under Review</h2>
        <p className="text-sm mb-8 max-w-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>Your payment has been submitted. We're reviewing your application and will activate your store within 24 hours.</p>
        <div className="w-full rounded-3xl p-4 text-left space-y-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#f59e0b" }}>Application Details</p>
          <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>Store name</span>
            <span className="font-bold text-white text-sm">{status?.storeName}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>Store URL</span>
            <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>/{status?.storeSlug}</span>
          </div>
        </div>
        <p className="text-xs mt-6" style={{ color: "rgba(255,255,255,0.25)" }}>Questions? Contact support via live chat.</p>
      </div>
    );
  }

  // ── REJECTED ────────────────────────────────────────────────────────────────
  if (currentStatus === "rejected") {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 pt-20 pb-24 text-center" style={{ background: "#070d1a" }}>
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <XCircle size={40} style={{ color: "#ef4444" }} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Application Rejected</h2>
        <p className="text-sm mb-6 max-w-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Contact our support team to discuss your application or reapply.</p>
        {status?.rejectionReason && (
          <div className="w-full rounded-3xl p-4 text-left" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#ef4444" }}>Reason</p>
            <p className="text-sm text-white">{status.rejectionReason}</p>
          </div>
        )}
      </div>
    );
  }

  // ── PAYMENT STEP ────────────────────────────────────────────────────────────
  if (currentStatus === "pending_payment" && (step === "pay" || step === "submitted")) {
    if (step === "submitted") {
      return (
        <div className="flex flex-col items-center min-h-screen px-6 pt-20 pb-24 text-center" style={{ background: "#070d1a" }}>
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <CheckCircle2 size={40} style={{ color: "#10b981" }} />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Payment Submitted!</h2>
          <p className="text-sm max-w-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>We received your payment reference. Your store will be activated within 24 hours once verified.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-full pb-24" style={{ background: "#070d1a" }}>
        <div className="px-5 pt-8 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <button onClick={() => setStep("apply")} className="flex items-center gap-1.5 text-xs font-bold mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
            <ChevronLeft size={14} /> Back
          </button>
          <h1 className="text-2xl font-black text-white">Security Fee</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>One-time $15 USD to activate your reseller account</p>
        </div>

        <div className="px-5 pt-5 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Select Payment Method</p>
          <div className="space-y-2">
            {paymentMethods.filter(pm => pm.method !== "nowpayments").map(pm => (
              <button key={pm.method} onClick={() => { setSelectedMethod(pm); setNpMode(false); }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all"
                style={selectedMethod?.method === pm.method
                  ? { background: "rgba(14,165,233,0.12)", border: "2px solid #0ea5e9" }
                  : { background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)" }}>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                  style={selectedMethod?.method === pm.method ? { borderColor: "#0ea5e9", background: "#0ea5e9" } : { borderColor: "rgba(255,255,255,0.2)" }}>
                  {selectedMethod?.method === pm.method && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">{pm.label ?? pm.method}</p>
                  {pm.network && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{pm.network}</p>}
                </div>
              </button>
            ))}
            {/* NOWPayments */}
            <button onClick={() => { setNpMode(true); setSelectedMethod(null); }}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all"
              style={npMode
                ? { background: "rgba(139,92,246,0.12)", border: "2px solid #8b5cf6" }
                : { background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)" }}>
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                style={npMode ? { borderColor: "#8b5cf6", background: "#8b5cf6" } : { borderColor: "rgba(255,255,255,0.2)" }}>
                {npMode && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Crypto (NOWPayments)</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>USDT, BTC, ETH, TRX and more</p>
              </div>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.2)", color: "#8b5cf6" }}>AUTO</span>
            </button>
          </div>

          {/* NOWPayments crypto panel */}
          {npMode && (
            <div className="space-y-3">
              {!npPayment ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest pt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Select Cryptocurrency</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "usdttrc20", label: "USDT", sub: "TRC-20" },
                      { id: "usdterc20", label: "USDT", sub: "ERC-20" },
                      { id: "btc", label: "BTC", sub: "Bitcoin" },
                      { id: "eth", label: "ETH", sub: "Ethereum" },
                      { id: "ltc", label: "LTC", sub: "Litecoin" },
                      { id: "trx", label: "TRX", sub: "TRON" },
                    ].map(c => (
                      <button key={c.id} onClick={() => setNpCurrency(c.id)}
                        className="flex flex-col items-center gap-0.5 py-3 rounded-2xl transition-all"
                        style={npCurrency === c.id
                          ? { background: "rgba(139,92,246,0.15)", border: "2px solid #8b5cf6" }
                          : { background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)" }}>
                        <span className="text-xs font-black text-white">{c.label}</span>
                        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{c.sub}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={handleNpCreate} disabled={npCreating}
                    className="w-full py-4 rounded-2xl text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>
                    {npCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight size={18} /> Generate Payment Address</>}
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                    <div className="flex justify-center">
                      <div className="p-3 rounded-2xl bg-white">
                        <QRCodeSVG value={npPayment.payAddress} size={130} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>Send exactly</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-base font-black font-mono px-3 py-2 rounded-xl break-all" style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd" }}>
                          {npPayment.payAmount} {npPayment.payCurrency.toUpperCase()}
                        </code>
                        <button onClick={() => { navigator.clipboard.writeText(String(npPayment.payAmount)); setCopied("amount"); setTimeout(() => setCopied(""), 2000); }}
                          className="shrink-0 p-2 rounded-xl transition-all"
                          style={copied === "amount" ? { background: "rgba(16,185,129,0.15)", color: "#10b981" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                          {copied === "amount" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>To address</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono px-3 py-2 rounded-xl break-all" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                          {npPayment.payAddress}
                        </code>
                        <button onClick={() => { navigator.clipboard.writeText(npPayment.payAddress); setCopied("npaddr"); setTimeout(() => setCopied(""), 2000); }}
                          className="shrink-0 p-2 rounded-xl transition-all"
                          style={copied === "npaddr" ? { background: "rgba(16,185,129,0.15)", color: "#10b981" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                          {copied === "npaddr" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    {npPayment.expiresAt && (
                      <p className="text-[10px] text-center font-medium" style={{ color: "#f59e0b" }}>Expires: {new Date(npPayment.expiresAt).toLocaleTimeString()}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setNpPayment(null)} className="py-3 rounded-2xl text-sm font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      ← New Address
                    </button>
                    <button onClick={handleNpCheck} className="py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>
                      <CheckCircle2 size={14} /> Check Payment
                    </button>
                  </div>
                  <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>Auto-confirms every 30 seconds · Do not close this page</p>
                </div>
              )}
            </div>
          )}

          {/* M-Pesa panel */}
          {!npMode && selectedMethod && selectedMethod.method.toLowerCase().includes("mpesa") && (
            <div className="space-y-3">
              <div className="rounded-2xl p-4" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <p className="text-sm font-bold text-white mb-1">M-Pesa STK Push — $15 USD</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>We'll send a payment prompt to your phone. Enter your PIN to complete.</p>
              </div>
              {!mpesaSent ? (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>M-Pesa Phone Number *</label>
                    <input value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} placeholder="e.g. 0712345678"
                      className="w-full px-4 py-3.5 rounded-xl text-white font-medium focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                  <button onClick={handleMpesaSTK} disabled={mpesaSending}
                    className="w-full py-4 rounded-2xl text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                    {mpesaSending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Zap size={18} /> Send STK Push</>}
                  </button>
                </>
              ) : (
                <div className="rounded-2xl p-4 text-center space-y-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1" style={{ background: "rgba(16,185,129,0.2)" }}>
                    <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#10b981" }} />
                  </div>
                  <p className="text-sm font-black text-white">STK Push Sent!</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Check your phone at <strong className="text-white">{mpesaPhone}</strong> and enter your M-Pesa PIN. Confirming automatically…</p>
                </div>
              )}
            </div>
          )}

          {/* Manual payment panel */}
          {!npMode && selectedMethod && !selectedMethod.method.toLowerCase().includes("mpesa") && selectedMethod.walletAddress && (
            <div className="space-y-3">
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Send $15 USD to</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all" style={{ color: "rgba(255,255,255,0.8)" }}>{selectedMethod.walletAddress}</code>
                  <button onClick={() => handleCopy(selectedMethod.walletAddress, "wallet")}
                    className="shrink-0 p-2 rounded-xl" style={copied === "wallet" ? { background: "rgba(16,185,129,0.15)", color: "#10b981" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                    {copied === "wallet" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                {selectedMethod.network && (
                  <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Network: {selectedMethod.network}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>Transaction Reference / ID *</label>
                <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="e.g. TX123456789 or MPESA ref"
                  className="w-full px-4 py-3.5 rounded-xl text-white font-medium focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
              <button onClick={handleSubmitPayment} disabled={submitting || !paymentRef.trim()}
                className="w-full py-4 rounded-2xl text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
                {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 size={18} /> Confirm Payment Sent</>}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LANDING / INFO ──────────────────────────────────────────────────────────
  if (step === "info" || step === "apply") {
    return (
      <div className="flex flex-col min-h-full pb-24" style={{ background: "#070d1a" }}>

        {/* Hero */}
        <div className="relative px-6 pt-10 pb-8 overflow-hidden">
          <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle,#0ea5e9,transparent 70%)", transform: "translate(-30%,-30%)" }} />
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle,#8b5cf6,transparent 70%)", transform: "translate(30%,-30%)" }} />

          <div className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.25)" }}>
            <Star size={12} style={{ color: "#0ea5e9" }} />
            <span className="text-xs font-bold" style={{ color: "#0ea5e9" }}>Reseller Program</span>
          </div>

          <h1 className="text-3xl font-black text-white mb-3 leading-tight">
            Earn Money<br />Selling GSM Tools
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Share your personal store link. Earn <span className="text-sky-400 font-bold">10% commission</span> on every order placed through your link. Payouts via USDT, M-Pesa, or Binance Pay.
          </p>
        </div>

        {step === "info" && (
          <>
            <div className="px-5 pb-4 space-y-2">
              {[
                { icon: <Percent size={16} />, title: "10% on every sale", desc: "Automatically credited after order completion", color: "#0ea5e9" },
                { icon: <Store size={16} />, title: "Your own store page", desc: "Branded with your store name and URL", color: "#8b5cf6" },
                { icon: <BanknoteIcon size={16} />, title: "Flexible payouts", desc: "Withdraw to USDT, M-Pesa or Binance Pay", color: "#10b981" },
                { icon: <Shield size={16} />, title: "One-time $15 security fee", desc: "Refundable if application is not approved", color: "#f59e0b" },
              ].map(f => (
                <div key={f.title} className="flex items-center gap-4 rounded-2xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${f.color}18`, color: f.color }}>
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{f.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 mt-2">
              <button onClick={() => setStep("apply")}
                className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)", boxShadow: "0 8px 24px rgba(14,165,233,0.25)" }}>
                Apply Now <ArrowRight size={18} />
              </button>
              <p className="text-center text-xs mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>Takes less than 2 minutes · 24-hour approval</p>
            </div>
          </>
        )}

        {step === "apply" && (
          <div className="px-5 space-y-4">
            <button onClick={() => setStep("info")} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
              <ChevronLeft size={14} /> Back
            </button>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>Store Name *</label>
              <input value={storeName} onChange={e => { setStoreName(e.target.value); setStoreSlug(slugify(e.target.value)); }} placeholder="e.g. TechHub Nairobi"
                className="w-full px-4 py-3.5 rounded-xl text-white font-medium focus:outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>Store URL Slug</label>
              <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="px-3 py-3.5 text-xs font-mono shrink-0" style={{ color: "rgba(255,255,255,0.3)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>/store/</span>
                <input value={storeSlug} onChange={e => setStoreSlug(slugify(e.target.value))} placeholder="your-store"
                  className="flex-1 px-3 py-3.5 bg-transparent text-white font-mono text-sm focus:outline-none" />
              </div>
              <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Auto-generated from store name. Lowercase letters, numbers, hyphens only.</p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <div className="flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                  A one-time <strong className="text-white">$15 security fee</strong> is required to activate your store. You'll be guided to pay after submitting.
                </p>
              </div>
            </div>

            <button onClick={handleApply} disabled={submitting || !storeName.trim()}
              className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}>
              {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ChevronRight size={18} /> Submit Application</>}
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
