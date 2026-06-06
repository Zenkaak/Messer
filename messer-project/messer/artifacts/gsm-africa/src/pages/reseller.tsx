import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Store, CheckCircle2, Clock, XCircle, Copy, ExternalLink,
  ChevronRight, DollarSign, Percent, ShoppingBag, ArrowRight,
  CreditCard, Shield, Users, Zap, AlertCircle, Wallet, Plus, History,
  X, TrendingUp, BanknoteIcon,
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
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
      <CheckCircle2 size={8} /> Paid
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
      <XCircle size={8} /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
      <Clock size={8} /> Pending
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
  // NOWPayments (crypto) state
  const [npMode, setNpMode] = useState(false);
  const [npCurrency, setNpCurrency] = useState("usdttrc20");
  const [npPayment, setNpPayment] = useState<{ paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string } | null>(null);
  const [npCreating, setNpCreating] = useState(false);
  const [npPollCount, setNpPollCount] = useState(0);

  // Withdrawal state
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

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (status?.status === "approved") fetchWithdrawals();
  }, [status?.status, fetchWithdrawals]);

  // When the API tells us the user already has a pending_payment application,
  // jump straight to the payment step (so they don't land on the info page).
  useEffect(() => {
    if (status?.status === "pending_payment") {
      setStep("pay");
      // Auto-select first available payment method if none chosen yet
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
      const data = await res.json() as { ok?: boolean; error?: string; status?: string; paymentMethods?: PaymentMethod[]; securityFeeUsd?: number; application?: { storeSlug: string; storeName: string } };
      if (!res.ok) { toast({ title: data.error ?? "Application failed", variant: "destructive" }); return; }
      setStatus({
        status: "pending_payment",
        storeSlug: data.application?.storeSlug,
        storeName: data.application?.storeName,
        paymentMethods: data.paymentMethods,
        securityFeeUsd: data.securityFeeUsd,
      });
      setStep("pay");
      if (data.paymentMethods?.[0]) setSelectedMethod(data.paymentMethods[0]);
    } catch (err) {
      toast({ title: "Connection error", description: "Check your internet and try again.", variant: "destructive" });
      console.error("reseller/apply error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNpCreate() {
    setNpCreating(true);
    try {
      const res = await fetch(`${BASE}/api/wallet/add-fund/nowpayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: SECURITY_FEE_USD, payCurrency: npCurrency }),
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
        // Deduct $15 from wallet and mark reseller as pending_approval
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

  // NOWPayments: auto-poll every 30s
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
          if (pr.ok) {
            setStatus(prev => prev ? { ...prev, status: "pending_approval" } : prev);
            setStep("submitted");
            toast({ title: "Crypto payment confirmed! Application submitted automatically." });
          }
        } else if (d.status === "failed") {
          setNpPayment(null);
          toast({ title: "Crypto payment failed or expired", variant: "destructive" });
        } else { setNpPollCount(c => c + 1); }
      } catch { setNpPollCount(c => c + 1); }
    }, 30_000);
    return () => clearTimeout(t);
  }, [npPayment, npPollCount, token]);

  async function handleMpesaSTK() {
    if (!mpesaPhone.trim()) {
      toast({ title: "Enter your M-Pesa phone number", variant: "destructive" }); return;
    }
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
      toast({ title: "STK Push Sent!", description: "Enter your M-Pesa PIN to complete the $15 payment." });
      // Poll every 5s for up to 2 minutes
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
          if (qd.status === "paid") {
            clearInterval(poll);
            setStatus(prev => prev ? { ...prev, status: "pending_approval" } : prev);
            setStep("submitted");
          } else if (qd.status === "failed") {
            clearInterval(poll);
            setMpesaSent(false);
            toast({ title: "Payment failed", description: qd.message ?? "M-Pesa payment was cancelled or failed.", variant: "destructive" });
          }
        } catch { /* ignore poll errors */ }
      }, 5000);
    } catch (err) {
      toast({ title: "Connection error", description: "Check your internet and try again.", variant: "destructive" });
    } finally {
      setMpesaSending(false);
    }
  }

  async function handleSubmitPayment() {
    if (!selectedMethod || !paymentRef.trim()) {
      toast({ title: "Enter your payment reference", variant: "destructive" }); return;
    }
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
    } catch (err) {
      toast({ title: "Connection error", description: "Check your internet and try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 10) {
      toast({ title: "Minimum withdrawal is $10", variant: "destructive" }); return;
    }
    const available = parseFloat(status?.availableBalance ?? "0");
    if (amount > available) {
      toast({ title: `Insufficient balance. Available: $${available.toFixed(2)}`, variant: "destructive" }); return;
    }
    if (!withdrawMethod.trim() || !withdrawAddress.trim()) {
      toast({ title: "Enter your payment method and address", variant: "destructive" }); return;
    }
    setWithdrawing(true);
    try {
      const res = await fetch(`${BASE}/api/reseller/withdrawal/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount,
          paymentMethod: withdrawMethod.trim(),
          paymentAddress: withdrawAddress.trim(),
          notes: withdrawNotes.trim() || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { toast({ title: data.error ?? "Failed", variant: "destructive" }); return; }
      toast({ title: "Withdrawal request submitted!" });
      setShowWithdrawForm(false);
      setWithdrawAmount(""); setWithdrawAddress(""); setWithdrawNotes("");
      await Promise.all([fetchStatus(), fetchWithdrawals()]);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center mb-5">
          <Store size={36} className="text-teal-600" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Reseller Program</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-xs">Sign in to apply and start earning 10% commission on every sale through your store.</p>
        <button onClick={() => navigate("/login")}
          className="px-8 py-3 bg-[#1a2332] text-white font-bold rounded-2xl">
          Sign In to Apply
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
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
    return (
      <div className="flex flex-col min-h-full pb-24">
        {/* Header */}
        <div className="px-5 pt-7 pb-4" style={{ background: "linear-gradient(135deg,#0d4f3c 0%,#1a7a5e 100%)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black text-lg leading-tight">{status?.storeName}</p>
              <p className="text-green-200/70 text-xs">Active Reseller</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Commission", value: `${status?.commissionRate ?? 10}%`, icon: <Percent size={14} /> },
              { label: "Total Earned", value: `$${totalEarned.toFixed(2)}`, icon: <DollarSign size={14} /> },
              { label: "Orders", value: String(status?.totalOrders ?? 0), icon: <ShoppingBag size={14} /> },
            ].map(item => (
              <div key={item.label} className="bg-white/10 rounded-xl p-2.5 text-center border border-white/10">
                <div className="flex justify-center text-white/60 mb-1">{item.icon}</div>
                <p className="text-white font-black text-base">{item.value}</p>
                <p className="text-white/50 text-[9px] mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-black/20 rounded-xl p-1">
            <button onClick={() => setActiveTab("overview")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "overview" ? "bg-white text-gray-800" : "text-white/70"
              }`}>
              Overview
            </button>
            <button onClick={() => setActiveTab("withdrawals")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "withdrawals" ? "bg-white text-gray-800" : "text-white/70"
              }`}>
              Withdrawals {withdrawals.filter(w => w.status === "pending").length > 0 && (
                <span className="ml-1 inline-flex w-4 h-4 items-center justify-center text-[9px] bg-amber-400 text-white rounded-full">
                  {withdrawals.filter(w => w.status === "pending").length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="px-4 pt-4 space-y-4">
            {/* Balance card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center">
                    <Wallet size={16} className="text-teal-600" />
                  </div>
                  <p className="font-black text-gray-800 text-sm">Available Balance</p>
                </div>
                <p className="text-2xl font-black text-teal-600">${availableBalance.toFixed(2)}</p>
              </div>
              {pendingWithdrawals > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                  <span className="flex items-center gap-1"><Clock size={10} /> Pending payout</span>
                  <span className="font-bold">${pendingWithdrawals.toFixed(2)}</span>
                </div>
              )}
              {availableBalance >= 10 ? (
                <button
                  onClick={() => setShowWithdrawForm(true)}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <BanknoteIcon size={16} /> Request Payout
                </button>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-400">
                    {availableBalance > 0
                      ? `$${(10 - availableBalance).toFixed(2)} more to reach minimum payout`
                      : "Earn $10 to request your first payout"}
                  </p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${Math.min(100, (availableBalance / 10) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-300 mt-1">Minimum: $10</p>
                </div>
              )}
            </div>

            {/* Store link */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Your Store Link</p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">Share this link with customers:</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <p className="flex-1 text-xs text-gray-700 font-mono truncate">{storeUrl}</p>
                  <button onClick={() => handleCopy(storeUrl, "link")}
                    className={`shrink-0 transition-colors ${copied === "link" ? "text-green-500" : "text-gray-400 hover:text-gray-700"}`}>
                    {copied === "link" ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => window.open(storeUrl, "_blank")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1a2332] text-white text-xs font-bold rounded-xl">
                    <ExternalLink size={12} /> View Store
                  </button>
                  <button onClick={() => handleCopy(storeUrl, "link")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl">
                    <Copy size={12} /> Copy Link
                  </button>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">How It Works</p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {[
                  { n: "1", t: "Share your link", d: "Customers click your store link and browse all products" },
                  { n: "2", t: "Customer purchases", d: "They complete checkout normally through GSM World" },
                  { n: "3", t: "Earn 10% commission", d: "You earn 10% of every sale made through your link" },
                  { n: "4", t: "Withdraw earnings", d: "Request payout when your balance reaches $10" },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">{s.n}</div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{s.t}</p>
                      <p className="text-xs text-gray-500">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── WITHDRAWALS TAB ───────────────────────────────────────────── */}
        {activeTab === "withdrawals" && (
          <div className="px-4 pt-4 space-y-4">
            {/* Balance summary + request button */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Available to withdraw</p>
                  <p className="text-2xl font-black text-gray-900">${availableBalance.toFixed(2)}</p>
                  {pendingWithdrawals > 0 && (
                    <p className="text-[11px] text-amber-500 mt-0.5">${pendingWithdrawals.toFixed(2)} pending</p>
                  )}
                </div>
                <button
                  onClick={() => setShowWithdrawForm(true)}
                  disabled={availableBalance < 10}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-colors">
                  <Plus size={13} /> Request
                </button>
              </div>
              {availableBalance < 10 && (
                <p className="text-[11px] text-gray-400 mt-2">Minimum payout is $10</p>
              )}
            </div>

            {/* History */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Withdrawal History</p>
              {withdrawals.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-300">
                  <History size={28} className="mb-2" />
                  <p className="text-sm font-semibold">No withdrawals yet</p>
                  <p className="text-xs mt-1">Request your first payout once you hit $10</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map(w => (
                    <div key={w.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5">
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <p className="font-black text-gray-800 text-base">${parseFloat(w.amount).toFixed(2)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {w.paymentMethod} · <span className="font-mono">{w.paymentAddress}</span>
                          </p>
                        </div>
                        <WithdrawalStatusBadge status={w.status} />
                      </div>
                      <p className="text-[10px] text-gray-300">
                        Requested {new Date(w.createdAt).toLocaleDateString()}
                        {w.processedAt && ` · Processed ${new Date(w.processedAt).toLocaleDateString()}`}
                      </p>
                      {w.adminNotes && (
                        <p className="text-[11px] text-gray-500 mt-1 italic">Note: {w.adminNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── WITHDRAWAL REQUEST MODAL ──────────────────────────────────── */}
        {showWithdrawForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div className="bg-white w-full max-w-sm rounded-t-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-900">Request Payout</h3>
                <button onClick={() => setShowWithdrawForm(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                  <X size={15} />
                </button>
              </div>

              <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 flex justify-between text-sm">
                <span className="text-teal-600 font-medium">Available</span>
                <span className="font-black text-teal-700">${availableBalance.toFixed(2)}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Amount (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    min="10"
                    step="0.01"
                    max={availableBalance}
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="10.00"
                    className="w-full pl-7 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Minimum $10</p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Payment Method *</label>
                <select
                  value={withdrawMethod}
                  onChange={e => setWithdrawMethod(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-teal-400 bg-white">
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="USDT TRC20">USDT (TRC20)</option>
                  <option value="USDT ERC20">USDT (ERC20)</option>
                  <option value="Binance Pay">Binance Pay</option>
                  <option value="Bitcoin">Bitcoin</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  {withdrawMethod === "M-Pesa" ? "Phone Number *" : "Wallet Address *"}
                </label>
                <input
                  value={withdrawAddress}
                  onChange={e => setWithdrawAddress(e.target.value)}
                  placeholder={withdrawMethod === "M-Pesa" ? "e.g. 0712345678" : "Your wallet address"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Notes (optional)</label>
                <input
                  value={withdrawNotes}
                  onChange={e => setWithdrawNotes(e.target.value)}
                  placeholder="Any additional info..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmount || !withdrawAddress.trim()}
                className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-colors">
                {withdrawing
                  ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  : <><BanknoteIcon size={16} /> Submit Request</>}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PENDING APPROVAL ──────────────────────────────────────────────────────
  if (currentStatus === "pending_approval") {
    return (
      <div className="flex flex-col items-center px-5 pt-12 pb-24 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
          <Clock size={36} className="text-amber-500" />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">Under Review</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-xs">Your payment has been submitted. We're reviewing your application and will activate your store within 24 hours.</p>
        <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
          <p className="text-xs font-bold text-amber-700">Application Details</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Store name</span>
            <span className="font-semibold text-gray-800">{status?.storeName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Store slug</span>
            <span className="font-mono text-xs text-gray-700">{status?.storeSlug}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-6">Questions? Contact support via live chat.</p>
      </div>
    );
  }

  // ── REJECTED ──────────────────────────────────────────────────────────────
  if (currentStatus === "rejected") {
    return (
      <div className="flex flex-col items-center px-5 pt-12 pb-24 text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-5">
          <XCircle size={36} className="text-red-500" />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">Application Rejected</h2>
        {status?.rejectionReason && (
          <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-left">
            <p className="text-xs font-bold text-red-600 mb-1">Reason:</p>
            <p className="text-sm text-red-800">{status.rejectionReason}</p>
          </div>
        )}
        <p className="text-gray-500 text-sm">Contact our support team to discuss your application or reapply.</p>
      </div>
    );
  }

  // ── PAYMENT STEP ──────────────────────────────────────────────────────────
  if (currentStatus === "pending_payment" && (step === "pay" || step === "submitted")) {
    if (step === "submitted") {
      return (
        <div className="flex flex-col items-center px-5 pt-12 pb-24 text-center">
          <div className="w-20 h-20 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mb-5">
            <CheckCircle2 size={36} className="text-green-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Payment Submitted!</h2>
          <p className="text-gray-500 text-sm max-w-xs">We received your payment reference. Your store will be activated within 24 hours once verified.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-full pb-24">
        <div className="px-5 pt-6 pb-5" style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
          <button onClick={() => setStep("apply")} className="text-white/50 text-xs mb-3 flex items-center gap-1">
            ← Back
          </button>
          <p className="text-white font-black text-lg">Security Fee Payment</p>
          <p className="text-blue-300/70 text-sm mt-1">One-time $15 USD to activate your reseller account</p>
        </div>

        <div className="px-4 pt-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Select Payment Method</p>
            <div className="space-y-2">
              {paymentMethods.filter(pm => pm.method !== "nowpayments").map(pm => (
                <button key={pm.method} onClick={() => { setSelectedMethod(pm); setNpMode(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-colors ${
                    selectedMethod?.method === pm.method
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedMethod?.method === pm.method ? "border-teal-500 bg-teal-500" : "border-gray-300"
                  }`}>
                    {selectedMethod?.method === pm.method && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-800">{pm.label ?? pm.method}</p>
                    {pm.network && <p className="text-xs text-gray-400">{pm.network}</p>}
                  </div>
                </button>
              ))}
              {/* NOWPayments (crypto) — always shown */}
              <button onClick={() => { setNpMode(true); setSelectedMethod(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-colors ${
                  npMode ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  npMode ? "border-purple-500 bg-purple-500" : "border-gray-300"
                }`}>
                  {npMode && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800">Crypto (NOWPayments)</p>
                  <p className="text-xs text-gray-400">USDT, BTC, ETH, TRX and more — auto confirmed</p>
                </div>
                <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">AUTO</span>
              </button>

              {paymentMethods.length === 0 && !npMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-2">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">No manual payment methods configured. Use crypto above.</p>
                </div>
              )}
            </div>
          </div>

          {npMode ? (
            /* ── NOWPayments crypto panel ── */
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-purple-800 mb-1">Pay $15 USD with Crypto</p>
                <p className="text-xs text-purple-600">Choose a currency. We'll generate a payment address — confirmed automatically once funds arrive.</p>
              </div>

              {!npPayment ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Select Cryptocurrency</p>
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
                          className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl border-2 text-center transition-colors ${
                            npCurrency === c.id ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white"
                          }`}>
                          <span className="text-xs font-black text-gray-800">{c.label}</span>
                          <span className="text-[9px] text-gray-400">{c.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleNpCreate}
                    disabled={npCreating}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-colors">
                    {npCreating
                      ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      : <><ArrowRight size={18} /> Generate Payment Address</>}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white border border-purple-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="bg-white p-3 rounded-xl border border-purple-100">
                        <QRCodeSVG value={npPayment.payAddress} size={140} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Send exactly</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-base font-black font-mono bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-purple-900 break-all">{npPayment.payAmount} {npPayment.payCurrency.toUpperCase()}</code>
                        <button onClick={() => { navigator.clipboard.writeText(String(npPayment.payAmount)); setCopied("amount"); setTimeout(() => setCopied(""), 2000); }}
                          className={`shrink-0 p-2 rounded-xl border transition-colors ${copied === "amount" ? "border-green-300 bg-green-50 text-green-600" : "border-gray-200 text-gray-400"}`}>
                          {copied === "amount" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">To address</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 break-all">{npPayment.payAddress}</code>
                        <button onClick={() => { navigator.clipboard.writeText(npPayment.payAddress); setCopied("npaddr"); setTimeout(() => setCopied(""), 2000); }}
                          className={`shrink-0 p-2 rounded-xl border transition-colors ${copied === "npaddr" ? "border-green-300 bg-green-50 text-green-600" : "border-gray-200 text-gray-400"}`}>
                          {copied === "npaddr" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    {npPayment.expiresAt && (
                      <p className="text-[10px] text-amber-600 text-center">Expires: {new Date(npPayment.expiresAt).toLocaleTimeString()}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setNpPayment(null)}
                      className="py-3 border border-gray-200 text-gray-600 font-bold rounded-2xl text-sm">
                      ← New Address
                    </button>
                    <button onClick={handleNpCheck}
                      className="py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-sm transition-colors">
                      <CheckCircle2 size={14} /> Check Payment
                    </button>
                  </div>
                  <p className="text-center text-[10px] text-gray-400">Auto-confirms every 30 seconds · Do not close this page</p>
                </div>
              )}
            </div>
          ) : selectedMethod && selectedMethod.method.toLowerCase().includes("mpesa") ? (
            <div className="space-y-3">
              {!mpesaSent ? (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                    <p className="text-sm font-bold text-green-800 mb-1">M-Pesa STK Push — $15 USD</p>
                    <p className="text-xs text-green-600">We'll send a payment prompt to your phone. Enter your PIN to complete.</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Your M-Pesa Phone Number</p>
                    <input
                      value={mpesaPhone}
                      onChange={e => setMpesaPhone(e.target.value)}
                      placeholder="e.g. 0712345678"
                      type="tel"
                      className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                    />
                  </div>
                  <button
                    onClick={handleMpesaSTK}
                    disabled={mpesaSending || !mpesaPhone.trim()}
                    className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-colors">
                    {mpesaSending
                      ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      : <><ArrowRight size={18} /> Send STK Push — $15</>}
                  </button>
                </>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={28} className="text-green-500" />
                  </div>
                  <p className="font-black text-green-800">STK Push Sent!</p>
                  <p className="text-sm text-green-700">Check your phone for the M-Pesa PIN prompt.<br/>Enter your PIN to complete the $15 payment.</p>
                  <p className="text-xs text-green-600 opacity-75">Confirming automatically — this may take up to 30 seconds.</p>
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {selectedMethod && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-blue-700">Send exactly <span className="text-base font-black">$15 USD</span> to:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-white border border-blue-200 rounded-xl px-3 py-2 break-all">{selectedMethod.walletAddress}</code>
                    <button onClick={() => handleCopy(selectedMethod.walletAddress, "addr")}
                      className={`shrink-0 p-2 rounded-xl border transition-colors ${copied === "addr" ? "border-green-300 bg-green-50 text-green-600" : "border-gray-200 bg-white text-gray-400"}`}>
                      {copied === "addr" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  {selectedMethod.network && (
                    <p className="text-[11px] text-blue-600 font-semibold">Network: {selectedMethod.network}</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Payment Reference / TX ID</p>
                <input
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="Enter transaction ID or reference..."
                  className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                />
              </div>
              <button
                onClick={handleSubmitPayment}
                disabled={submitting || !selectedMethod || !paymentRef.trim()}
                className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-colors">
                {submitting ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <><ArrowRight size={18} /> Submit Payment</>}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── INFO / APPLY FORM ─────────────────────────────────────────────────────
  if (step === "apply" || currentStatus === "none") {
    const isApplyStep = step === "apply" || currentStatus === "none";
    if (isApplyStep && step !== "info") {
      return (
        <div className="flex flex-col min-h-full pb-24">
          {/* Header */}
          <div className="px-5 pt-6 pb-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0d1f35 0%,#1a3a5f 60%,#0d4f3c 100%)" }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #0ea5e9 0%, transparent 60%)" }} />
            <button onClick={() => setStep("info")} className="relative text-white/50 text-xs mb-4 flex items-center gap-1 hover:text-white/80 transition-colors">
              ← Back
            </button>
            <div className="relative flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
                <Store size={20} className="text-teal-300" />
              </div>
              <div>
                <p className="text-white font-black text-lg leading-tight">Create Your Store</p>
                <p className="text-teal-300/70 text-xs">Step 1 of 2 — Store details</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <div className="h-full bg-teal-500 transition-all" style={{ width: "50%" }} />
          </div>

          <div className="px-4 pt-5 space-y-4">
            {/* Store name input */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Store Name *</label>
                <input
                  value={storeName}
                  onChange={e => { setStoreName(e.target.value); setStoreSlug(slugify(e.target.value)); }}
                  placeholder="e.g. John's GSM Solutions"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 focus:bg-white transition-colors"
                />
                <p className="text-[11px] text-gray-400 mt-1.5 px-0.5">This is your brand name — customers will see it on your store page.</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Store URL</label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-400 transition-colors">
                  <span className="text-[11px] text-gray-400 font-mono px-3 py-3 bg-gray-100 border-r border-gray-200 shrink-0 whitespace-nowrap">/store/</span>
                  <input
                    value={storeSlug}
                    onChange={e => setStoreSlug(slugify(e.target.value))}
                    placeholder="your-store"
                    className="flex-1 bg-transparent px-3 py-3 text-sm focus:outline-none font-mono text-teal-700"
                  />
                </div>
                {storeSlug && (
                  <div className="flex items-center gap-1.5 mt-1.5 px-0.5">
                    <CheckCircle2 size={11} className="text-teal-500 shrink-0" />
                    <p className="text-[11px] text-teal-600 font-medium font-mono truncate">/store/{storeSlug}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Security fee notice */}
            <div className="rounded-2xl overflow-hidden border border-amber-200">
              <div className="bg-amber-50 px-4 py-2.5 flex items-center gap-2 border-b border-amber-200">
                <Shield size={13} className="text-amber-600 shrink-0" />
                <p className="text-xs font-black text-amber-700">One-time Security Fee Required</p>
              </div>
              <div className="bg-white px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black text-gray-900">$15 <span className="text-sm font-semibold text-gray-400">USD</span></p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Fully refundable if your application is rejected</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Accept via</p>
                  <p className="text-xs font-bold text-gray-600 mt-0.5">M-Pesa · USDT · Crypto</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleApply}
              disabled={submitting || !storeName.trim()}
              className="w-full py-4 font-black rounded-2xl flex items-center justify-center gap-2 transition-all text-white"
              style={{ background: storeName.trim() ? "linear-gradient(135deg,#0d4f3c 0%,#0ea5e9 100%)" : undefined, backgroundColor: storeName.trim() ? undefined : "#e5e7eb", color: storeName.trim() ? "white" : "#9ca3af" }}
            >
              {submitting
                ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                : <><ArrowRight size={18} /> Continue to Payment</>}
            </button>

            <p className="text-center text-[11px] text-gray-400">By applying you agree to our reseller terms. Your store activates within 24 hours after payment verification.</p>
          </div>
        </div>
      );
    }
  }

  // ── INFO PAGE ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0d1f35 0%,#1a3a5f 60%,#0d4f3c 100%)" }}>
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 75% 40%, rgba(14,165,233,0.15) 0%, transparent 55%), radial-gradient(circle at 25% 80%, rgba(20,184,166,0.1) 0%, transparent 45%)" }} />
        <div className="relative px-5 pt-8 pb-7 text-center">
          <div className="inline-flex items-center gap-1.5 bg-teal-500/15 border border-teal-400/20 rounded-full px-3 py-1 mb-4">
            <TrendingUp size={11} className="text-teal-300" />
            <span className="text-[10px] font-black text-teal-300 uppercase tracking-wider">Earn with GSM World</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 leading-tight">Reseller Program</h1>
          <p className="text-blue-200/70 text-sm max-w-xs mx-auto leading-relaxed">
            Get your own branded store. Earn 10% commission on every sale — no inventory, no risk.
          </p>
          <div className="flex items-center justify-center gap-4 mt-5">
            {[
              { value: "10%", label: "Commission" },
              { value: "24h", label: "Setup" },
              { value: "$10", label: "Min Payout" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-[10px] text-blue-300/60 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: <Percent size={18} className="text-teal-600" />, label: "10% Per Sale", sub: "Instant commission on every order", bg: "bg-teal-50", border: "border-teal-100" },
            { icon: <Store size={18} className="text-blue-600" />, label: "Your Own Store", sub: "Branded URL you can share anywhere", bg: "bg-blue-50", border: "border-blue-100" },
            { icon: <Zap size={18} className="text-amber-600" />, label: "Fast Activation", sub: "Live within 24 hours of payment", bg: "bg-amber-50", border: "border-amber-100" },
            { icon: <DollarSign size={18} className="text-green-600" />, label: "Easy Payouts", sub: "Withdraw via M-Pesa or USDT", bg: "bg-green-50", border: "border-green-100" },
          ].map(f => (
            <div key={f.label} className={`rounded-2xl border ${f.border} ${f.bg} p-3.5`}>
              <div className="w-8 h-8 rounded-xl bg-white/80 flex items-center justify-center mb-2 shadow-sm">{f.icon}</div>
              <p className="text-[12.5px] font-black text-gray-800 leading-tight">{f.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{f.sub}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">How It Works</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {[
              { step: "1", icon: <Store size={14} />, title: "Create your store", desc: "Pick a store name and unique URL slug", color: "bg-blue-100 text-blue-700" },
              { step: "2", icon: <Shield size={14} />, title: "Pay $15 security fee", desc: "One-time activation fee, refundable if rejected", color: "bg-amber-100 text-amber-700" },
              { step: "3", icon: <Users size={14} />, title: "Share your link", desc: "Send customers to your branded store page", color: "bg-purple-100 text-purple-700" },
              { step: "4", icon: <DollarSign size={14} />, title: "Earn 10% commission", desc: "Get paid for every sale through your link", color: "bg-green-100 text-green-700" },
            ].map((s, i, arr) => (
              <div key={s.step} className={`flex items-start gap-3 px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-gray-50" : ""}`}>
                <div className={`w-7 h-7 rounded-full ${s.color} flex items-center justify-center shrink-0 mt-0.5`}>{s.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 leading-tight">{s.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.desc}</p>
                </div>
                <span className="text-[10px] font-black text-gray-300 shrink-0 mt-1">0{s.step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0d4f3c 0%,#0ea5e9 100%)" }}>
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
                <span className="text-white text-xs font-black">
                  {(user?.name?.[0] ?? user?.email?.[0] ?? "G").toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white font-black text-sm leading-none">{user?.name?.split(" ")[0] ?? "Welcome"}!</p>
                <p className="text-white/60 text-[10px] mt-0.5 leading-none">{user?.email}</p>
              </div>
              <div className="ml-auto flex items-center gap-1 bg-white/15 border border-white/20 rounded-full px-2 py-0.5">
                <CheckCircle2 size={9} className="text-green-300" />
                <span className="text-[9px] text-white/80 font-bold">Eligible</span>
              </div>
            </div>
          </div>
          <div className="px-4 pb-5">
            <button
              onClick={() => setStep("apply")}
              className="w-full py-3.5 bg-white text-gray-900 font-black rounded-xl flex items-center justify-center gap-2 shadow-lg hover:bg-gray-50 transition-colors"
            >
              <Store size={16} className="text-teal-600" />
              Apply Now — it's free to apply
              <ArrowRight size={16} className="text-gray-400" />
            </button>
            <p className="text-center text-[10px] text-white/50 mt-2.5">Only $15 security fee required · Refundable if rejected</p>
          </div>
        </div>
      </div>
    </div>
  );
}
