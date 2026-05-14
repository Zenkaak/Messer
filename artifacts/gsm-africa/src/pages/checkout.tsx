import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetCart, useCreateCheckout, useQueryMpesaPayment, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail, Edit2, Check, ShieldCheck, Lock, Copy, ArrowRight,
  Smartphone, CreditCard, Zap, BadgeCheck, Package
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance } from "@/hooks/use-wallet";
import { QRCodeSVG } from "qrcode.react";

type PaymentStep =
  | { type: "form" }
  | { type: "mpesa_pending"; checkoutRequestId: string; orderId: number }
  | { type: "nowpayments_pending"; orderId: number; paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string }
  | { type: "done"; orderId: number }
  | { type: "manual_pending"; orderId: number; paymentMethod: string; details: Record<string, unknown>; total: number };

type PayMethod = "wallet" | "nowpayments" | "mpesa" | "binance_pay" | "usdt_manual";
type CheckoutPaymentMethod = "mpesa" | "usdt" | "wallet" | "nowpayments" | "binance_pay" | "usdt_manual";
type CheckoutResult = {
  orderId: number;
  paymentMethod: string;
  status: string;
  total: number;
  currency: string;
  mpesa?: { checkoutRequestId: string; message: string } | null;
  nowpayments?: { paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string } | null;
  custom?: Record<string, unknown> | null;
};

const ACTIVATION_FEE_USD = 5;
const SUPPORT_WHATSAPP = "254700000000";

export function CheckoutPage() {
  const [, navigate] = useLocation();
  const { data: cart, isLoading } = useGetCart();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createCheckout = useCreateCheckout();
  const queryMpesa = useQueryMpesaPayment();
  const { data: walletBalance = 0 } = useWalletBalance();

  const [step, setStep] = useState<PaymentStep>({ type: "form" });
  const [email, setEmail] = useState(user?.email ?? "");
  const [editingEmail, setEditingEmail] = useState(!user?.email);
  const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("mpesa");
  const [coupon, setCoupon] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [npCurrency, setNpCurrency] = useState("usdttrc20");
  const isWalletSelected = payMethod === "wallet";

  useEffect(() => { if (user?.email && !email) setEmail(user.email); }, [user]);

  // M-Pesa polling
  useEffect(() => {
    if (step.type !== "mpesa_pending") return;
    const interval = setInterval(async () => {
      const result = await queryMpesa.mutateAsync({ data: { orderId: step.orderId, checkoutRequestId: step.checkoutRequestId } });
      if (result.paymentStatus === "paid") {
        clearInterval(interval);
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        setStep({ type: "done", orderId: step.orderId });
      } else if (result.paymentStatus === "failed") {
        clearInterval(interval);
        toast({ title: "Payment failed", description: result.message, variant: "destructive" });
        setStep({ type: "form" });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step]);

  // NOWPayments polling
  useEffect(() => {
    if (step.type !== "nowpayments_pending") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/payments/nowpayments/query", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ orderId: step.orderId, paymentId: step.paymentId }),
        });
        const d = await res.json() as { paymentStatus: string };
        if (d.paymentStatus === "paid") {
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          setStep({ type: "done", orderId: step.orderId });
        } else if (d.paymentStatus === "failed") {
          clearInterval(interval);
          toast({ title: "Payment failed or expired", variant: "destructive" });
          setStep({ type: "form" });
        }
      } catch { /* retry on next tick */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [step]);

  async function handlePayNow() {
    if (!cart || cart.itemCount === 0) return;
    if (!email) { toast({ title: "Please enter your email address", variant: "destructive" }); return; }
    if (payMethod === "mpesa" && !phone) { toast({ title: "Please enter your M-Pesa phone number", variant: "destructive" }); return; }
    if (!payMethod) { toast({ title: "Select a payment method", variant: "destructive" }); return; }
    if (payMethod === "wallet") {
      const total = cart.total ?? 0;
      if (walletBalance < total) {
        const needed = (total - walletBalance).toFixed(2);
        toast({
          title: "Insufficient wallet balance",
          description: `Your balance (${walletBalance.toFixed(2)}) is ${needed} short. Please top up your wallet first.`,
          variant: "destructive",
        });
        return;
      }
    }
    if (payMethod === "nowpayments") {
      const total = cart.total ?? 0;
      if (total < 13) {
        toast({
          title: "Order total too low for crypto payment",
          description: "NOWPayments requires a minimum of $13.00. Please add more items or choose another payment method.",
          variant: "destructive",
        });
        return;
      }
    }
    const apiMethodMap: Record<PayMethod, CheckoutPaymentMethod> = { wallet: "wallet", mpesa: "mpesa", nowpayments: "nowpayments", binance_pay: "binance_pay", usdt_manual: "usdt_manual" };
    const apiMethod = apiMethodMap[payMethod];
    if (!apiMethod) { toast({ title: "Select a valid payment method", variant: "destructive" }); return; }
    try {
      const guestSessionId = !user ? (localStorage.getItem("gsm_session_id") ?? undefined) : undefined;
      const result = await createCheckout.mutateAsync({ data: {
        customerEmail: email,
        customerPhone: phone || undefined,
        customerName: user?.name || undefined,
        paymentMethod: apiMethod,
        ...(payMethod === "nowpayments" ? { payCurrency: npCurrency } : {}),
        ...(guestSessionId ? { sessionId: guestSessionId } : {}),
      } as Parameters<typeof createCheckout.mutateAsync>[0]["data"] }) as CheckoutResult;
      if (result.status === "pending_payment_confirmation" && result.custom) {
        setStep({ type: "manual_pending", orderId: result.orderId, paymentMethod: result.paymentMethod, details: result.custom as Record<string, unknown>, total: result.total });
      } else if (result.paymentMethod === "wallet" || result.status === "paid") {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        setStep({ type: "done", orderId: result.orderId });
      } else if (payMethod === "mpesa" && result.mpesa) {
        setStep({ type: "mpesa_pending", checkoutRequestId: result.mpesa.checkoutRequestId, orderId: result.orderId });
        toast({ title: "STK Push sent!", description: result.mpesa.message });
      } else if (result.nowpayments) {
        setStep({ type: "nowpayments_pending", orderId: result.orderId, paymentId: result.nowpayments.paymentId, payAddress: result.nowpayments.payAddress, payAmount: result.nowpayments.payAmount, payCurrency: result.nowpayments.payCurrency, expiresAt: result.nowpayments.expiresAt });
      }
    } catch (err: unknown) {
      toast({ title: "Payment Error", description: err instanceof Error ? err.message : "Checkout failed. Please try again.", variant: "destructive" });
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-3 max-w-5xl mx-auto">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  // ── Login gate ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
          <div style={{ background: "linear-gradient(160deg,#1a2332 0%,#1e3a5f 100%)" }} className="flex flex-col items-center justify-center pt-12 pb-8 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-4">
              <Lock size={28} className="text-white/70" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Sign In to Checkout</h2>
            <p className="text-blue-300/70 text-sm max-w-[260px]">Create an account or sign in to complete your purchase and track your order.</p>
          </div>
          <div className="px-6 py-6 space-y-3">
            {cart && cart.itemCount > 0 && (
              <p className="text-center text-sm text-gray-500">{cart.itemCount} item{cart.itemCount !== 1 ? "s" : ""} in your cart — sign in to continue.</p>
            )}
            <button onClick={() => navigate("/login?returnTo=/checkout")} className="w-full py-3.5 bg-[#1a2332] text-white font-black text-base rounded-2xl flex items-center justify-center gap-2">
              Sign In <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate("/signup?returnTo=/checkout")} className="w-full py-3.5 border-2 border-gray-200 text-gray-700 font-bold text-base rounded-2xl">
              Create Account
            </button>
            <button onClick={() => navigate("/cart")} className="w-full py-2.5 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors">
              ← Back to Cart
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (!cart || cart.itemCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Package size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-600 font-semibold mb-1">Your cart is empty</p>
        <p className="text-gray-400 text-sm mb-6">Add some products to proceed to checkout.</p>
        <button onClick={() => navigate("/products")} className="px-6 py-3 bg-[#1a2332] text-white rounded-2xl font-bold">Browse Products</button>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step.type === "done") {
    return (
      <div className="flex flex-col min-h-[80vh] items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
          <div style={{ background: "linear-gradient(160deg,#1a2332 0%,#1e3a5f 100%)" }} className="flex flex-col items-center justify-center pt-14 pb-10 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 shadow-lg shadow-green-900/40">
              <Check size={36} className="text-white" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Payment Confirmed!</h2>
            <p className="text-blue-300/70 text-sm">Order #{step.orderId} placed successfully</p>
          </div>
          <div className="px-6 py-6 space-y-3">
            <p className="text-sm text-gray-500 text-center">Service details will be sent to your email shortly.</p>
            <button onClick={() => navigate(`/orders/${step.orderId}`)} className="w-full py-3.5 bg-[#1a2332] text-white font-black text-base rounded-2xl flex items-center justify-center gap-2">
              View Order <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate("/")} className="w-full py-3.5 border-2 border-gray-200 text-gray-700 font-bold text-base rounded-2xl">
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── NOWPayments pending ───────────────────────────────────────────────────
  if (step.type === "nowpayments_pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
          <div style={{ background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)" }} className="px-6 pt-6 pb-6">
            <p className="text-blue-200/70 text-xs font-semibold uppercase tracking-widest mb-1">Crypto Payment</p>
            <p className="text-white font-black text-2xl leading-none">{step.payAmount} {step.payCurrency.toUpperCase()}</p>
            {step.expiresAt && <p className="text-blue-200/60 text-xs mt-1">⏱ Expires: {new Date(step.expiresAt).toLocaleTimeString()}</p>}
          </div>
          <div className="px-6 py-5 space-y-3">
            {/* QR code for easy scanning */}
            <div className="flex flex-col items-center gap-2 py-2">
              <QRCodeSVG value={step.payAddress} size={148} level="M" className="rounded-xl border-4 border-gray-100 shadow-md" />
              <p className="text-[10px] text-gray-400">Scan QR code or copy address below</p>
            </div>
            {[
              { label: "Payment Address", value: step.payAddress, key: "addr" },
              { label: `Amount (${step.payCurrency.toUpperCase()})`, value: `${step.payAmount}`, key: "amt" },
            ].map(({ label, value, key }) => (
              <div key={key}>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono text-gray-700 break-all">{value}</div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); }}
                    className={`shrink-0 px-4 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors ${copiedKey === key ? "bg-green-600 text-white" : "bg-[#1a2332] text-white"}`}
                  >
                    {copiedKey === key ? <><Check size={13} strokeWidth={3} /> Done</> : <><Copy size={13} /> Copy</>}
                  </button>
                </div>
              </div>
            ))}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <p className="text-xs text-blue-700 font-medium">Checking every 30s for payment confirmation…</p>
            </div>
            <button onClick={() => setStep({ type: "form" })} className="w-full py-3.5 border-2 border-gray-200 text-gray-700 font-bold text-base rounded-2xl">
              Cancel &amp; Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Manual payment pending ──────────────────────────────────────────────────
  if (step.type === "manual_pending") {
    const isBinance = step.paymentMethod === "binance_pay";
    const BINANCE_ID = "490759406";
    const USDT_ADDR = "TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5";
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
          <div style={{ background: "linear-gradient(160deg,#1a2332 0%,#1e3a5f 100%)" }} className="flex flex-col items-center justify-center pt-12 pb-8 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center mb-4">
              <span className="text-4xl">{isBinance ? "🟡" : "💲"}</span>
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Order #{step.orderId} Placed!</h2>
            <p className="text-blue-300/70 text-sm">Now send payment — we verify within 24 hours.</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Amount Due</span>
                <span className="font-black text-xl text-gray-900">${step.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Method</span>
                <span className="font-bold text-gray-700">{isBinance ? "Binance Pay" : "USDT TRC20"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Reference</span>
                <span className="font-black text-blue-600">ORDER-{step.orderId}</span>
              </div>
            </div>
            {isBinance ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest">Binance ID</p>
                <p className="text-3xl font-black text-gray-900 tracking-widest">{BINANCE_ID}</p>
                <p className="text-[10px] text-yellow-700">Label: GSM World — Manual Confirmation</p>
                <p className="text-[10px] text-yellow-600">Include <strong>ORDER-{step.orderId}</strong> in your payment note.</p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-green-800 uppercase tracking-widest">USDT TRC20 Address</p>
                <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-2 py-2">
                  <span className="font-mono text-[10px] text-gray-700 break-all flex-1">{USDT_ADDR}</span>
                  <button onClick={() => { navigator.clipboard.writeText(USDT_ADDR); setCopiedKey("addr"); setTimeout(() => setCopiedKey(null), 2000); }}
                    className={`shrink-0 px-2 py-1 rounded text-xs font-bold ${copiedKey === "addr" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                    {copiedKey === "addr" ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="text-[10px] font-bold text-green-800">Network: TRON (TRC20) only</p>
                <p className="text-[10px] text-green-700">Include <strong>ORDER-{step.orderId}</strong> as memo.</p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
              <p className="text-xs text-blue-700">Payment instructions also sent to your email. Our team verifies within <strong>24 hours</strong>.</p>
            </div>
            <button onClick={() => navigate(`/orders/${step.orderId}`)} className="w-full py-3.5 bg-[#1a2332] text-white font-black text-base rounded-2xl flex items-center justify-center gap-2">
              View Order <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate("/")} className="w-full py-3.5 border-2 border-gray-200 text-gray-700 font-bold text-base rounded-2xl">
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── M-Pesa pending ─────────────────────────────────────────────────────────
  if (step.type === "mpesa_pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
          <div style={{ background: "linear-gradient(160deg,#14532d 0%,#166534 100%)" }} className="flex flex-col items-center justify-center pt-12 pb-10 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center mb-4 border-4 border-green-400/30">
              <Smartphone size={34} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Check Your Phone</h2>
            <p className="text-green-200/80 text-sm max-w-[240px]">An M-Pesa STK push has been sent. Enter your PIN to complete payment.</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-sm text-green-700 font-medium">Waiting for payment confirmation…</p>
            </div>
            <button onClick={() => setStep({ type: "form" })} className="w-full py-3.5 border-2 border-gray-200 text-gray-700 font-bold text-base rounded-2xl">
              Cancel &amp; Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cartKES = Math.ceil((cart?.items ?? []).reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) * 130);

  // ── Main checkout form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-gray-50">

      {/* Page header */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="px-5 md:px-10 pt-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-blue-300/70 text-xs font-semibold uppercase tracking-widest mb-1">Secure Checkout</p>
          <div className="flex items-end justify-between">
            <h1 className="text-white font-black text-2xl md:text-3xl leading-none">
              {cart.itemCount} {cart.itemCount === 1 ? "Item" : "Items"}
            </h1>
            <p className="text-blue-200/70 text-sm">
              Total: <span className="text-white font-black text-xl">${cart.total.toFixed(2)}</span>
            </p>
          </div>
          <div className="flex items-center gap-4 mt-3">
            {[
              { icon: <ShieldCheck size={12} />, label: "SSL Secured" },
              { icon: <Lock size={12} />, label: "Encrypted" },
              { icon: <BadgeCheck size={12} />, label: "Verified" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1 text-[11px] text-blue-200/60 font-medium">
                {icon} {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-6 md:items-start">

          {/* ── LEFT COLUMN: Form ── */}
          <div className="space-y-4">

            {/* Email */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                <Mail size={14} className="text-gray-400" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delivery Email</p>
              </div>
              <div className="px-4 py-4">
                <div className="flex items-center gap-2">
                  {editingEmail ? (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoFocus
                      onBlur={() => { if (email) setEditingEmail(false); }}
                      className="flex-1 text-sm text-gray-800 focus:outline-none font-medium border border-blue-200 rounded-xl px-3 py-2.5 bg-blue-50/30 focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <span className="flex-1 text-sm text-gray-800 font-semibold">{email || <span className="text-gray-400 font-normal">Add email address</span>}</span>
                  )}
                  <button onClick={() => setEditingEmail(true)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                    <Edit2 size={14} />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">Order &amp; service details will be sent here</p>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
                <CreditCard size={14} className="text-gray-400" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Method</p>
              </div>
              <div className="p-3 space-y-2">

                {/* M-Pesa */}
                <PayMethodCard
                  selected={payMethod === "mpesa"}
                  onSelect={() => setPayMethod("mpesa")}
                  left={
                    <div className="w-11 h-10 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-white font-black text-[10px] leading-none text-center">M<br />PESA</span>
                    </div>
                  }
                  title="M-Pesa"
                  subtitle="STK Push · Kenya"
                  badge={<span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">POPULAR</span>}
                />
                {payMethod === "mpesa" && (
                  <div className="px-3 pb-1 space-y-2">
                    <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700">
                      You'll be charged in KES via M-Pesa. Approximate: <strong>KES {cartKES.toLocaleString()}</strong>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">M-Pesa Phone Number</label>
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-green-400 focus-within:border-green-400 transition-all">
                        <span className="px-3 py-2.5 bg-gray-50 text-sm text-gray-600 font-medium border-r border-gray-200">+254</span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="7XX XXX XXX"
                          className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* GSM Wallet */}
                <PayMethodCard
                  selected={payMethod === "wallet"}
                  onSelect={() => setPayMethod("wallet")}
                  left={
                    <div className="w-11 h-10 bg-[#1a2332] rounded-xl flex items-center justify-center shrink-0">
                      <svg width="22" height="18" viewBox="0 0 24 20" fill="none">
                        <rect x="1" y="4" width="22" height="14" rx="2" fill="#2563eb" />
                        <rect x="14" y="9" width="8" height="6" rx="1.5" fill="#60a5fa" />
                        <circle cx="18" cy="12" r="1.5" fill="#1d4ed8" />
                        <path d="M1 8h22" stroke="#1d4ed8" strokeWidth="1.5" />
                      </svg>
                    </div>
                  }
                  title="GSM World Wallet"
                  subtitle="Instant · No fees"
                  right={<span className="text-sm font-black text-gray-700">${walletBalance.toFixed(2)}</span>}
                />
                {isWalletSelected && (
                  <div className="px-3 pb-1">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-bold text-slate-900">Balance: ${walletBalance.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">Activation fee: ${ACTIVATION_FEE_USD.toFixed(2)}.</p>
                      <button
                        onClick={() => navigate("/account/add-fund")}
                        className="mt-1 w-full rounded-xl bg-blue-600 text-white font-bold text-sm py-2.5"
                      >
                        Add Top Up
                      </button>
                    </div>
                  </div>
                )}

                {/* NOWPayments (Crypto) */}
                <PayMethodCard
                  selected={payMethod === "nowpayments"}
                  onSelect={() => setPayMethod("nowpayments")}
                  left={
                    <div className="w-11 h-10 bg-[#1a1a2e] rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-white font-black text-base">₿</span>
                    </div>
                  }
                  title="Crypto (NOWPayments)"
                  subtitle="BTC · ETH · USDT · 100+ coins"
                  badge={<span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full">CRYPTO</span>}
                />
                {payMethod === "nowpayments" && (
                  <div className="px-3 pb-1 space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Pay with</label>
                    <select value={npCurrency} onChange={e => setNpCurrency(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                      <option value="usdttrc20">USDT (TRC20 / TRON)</option>
                      <option value="usdterc20">USDT (ERC20 / Ethereum)</option>
                      <option value="btc">Bitcoin (BTC)</option>
                      <option value="eth">Ethereum (ETH)</option>
                      <option value="ltc">Litecoin (LTC)</option>
                      <option value="xrp">Ripple (XRP)</option>
                      <option value="bnbbsc">BNB (BSC)</option>
                      <option value="trx">TRON (TRX)</option>
                      <option value="doge">Dogecoin (DOGE)</option>
                    </select>
                    {(cart?.total ?? 0) < 13 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 font-medium">
                        ⚠️ <strong>Minimum amount:</strong> NOWPayments requires a minimum of <strong>$13.00 USD</strong>. Your current total is below this threshold.
                      </div>
                    )}
                  </div>
                )}

                {/* Binance Pay */}
                <PayMethodCard
                  selected={payMethod === "binance_pay"}
                  onSelect={() => setPayMethod("binance_pay")}
                  left={<div className="w-11 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shrink-0"><span className="text-white font-black text-xs">BNB</span></div>}
                  title="Binance Pay"
                  subtitle="Manual — Admin confirms within 24h"
                  badge={<span className="text-[9px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded-full">MANUAL</span>}
                />
                {payMethod === "binance_pay" && (
                  <div className="px-3 pb-1">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest">Binance ID</p>
                      <p className="text-2xl font-black text-gray-900 tracking-widest">490759406</p>
                      <p className="text-[10px] text-yellow-700">Label: GSM World — Manual Confirmation</p>
                      <p className="text-[10px] text-gray-500">After placing order, send exact amount. Team verifies within 24h.</p>
                    </div>
                  </div>
                )}

                {/* USDT TRC20 Manual */}
                <PayMethodCard
                  selected={payMethod === "usdt_manual"}
                  onSelect={() => setPayMethod("usdt_manual")}
                  left={<div className="w-11 h-10 bg-green-700 rounded-xl flex items-center justify-center shrink-0"><span className="text-white font-black text-sm">₮</span></div>}
                  title="USDT TRC20 (Manual)"
                  subtitle="Manual transfer — Admin confirms within 24h"
                  badge={<span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">MANUAL</span>}
                />
                {payMethod === "usdt_manual" && (
                  <div className="px-3 pb-1">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] font-bold text-green-800 uppercase tracking-widest">USDT TRC20 Address</p>
                      <p className="font-mono text-[9px] text-gray-700 break-all bg-white border border-green-200 rounded-lg px-2 py-1.5">TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5</p>
                      <p className="text-[10px] font-bold text-green-800">Network: TRON (TRC20) only</p>
                      <p className="text-[10px] text-gray-500">Send exact amount. Team verifies within 24h.</p>
                    </div>
                  </div>
                )}

                {/* Support note */}
                <div className="px-1 pt-1">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs shadow-sm">
                    <span className="font-bold text-amber-700">Need a different method?</span>
                    <a
                      href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Hi, I need help with a payment method on GSM World.")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-black text-green-700"
                    >
                      Contact support →
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Coupon */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Coupon Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Enter promo code"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={() => toast({ title: "Invalid coupon code", variant: "destructive" })}
                  className="px-5 py-2.5 bg-gray-800 text-white font-bold text-sm rounded-xl hover:bg-gray-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Order Summary + Pay ── */}
          <div className="space-y-4">

            {/* Order summary */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Order Summary</p>
              </div>
              <div className="divide-y divide-gray-50">
                {cart.items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 to-teal-900 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={item.imageUrl || ""}
                        alt={item.productName}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800 line-clamp-1">{item.productName}</p>
                      <p className="text-[11px] text-gray-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-black text-gray-800">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/40 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})</span>
                  <span>${cart.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Delivery</span>
                  <span className="text-green-600 font-semibold">Free</span>
                </div>
                <div className="flex justify-between font-black text-base text-gray-900 pt-1 border-t border-gray-100 mt-1">
                  <span>Total</span>
                  <span>${cart.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Pay Now card */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-5 space-y-4">
                {/* Total display */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Amount Due</p>
                    <p className="text-3xl font-black text-gray-900 leading-none mt-0.5">${cart.total.toFixed(2)}</p>
                    {payMethod === "mpesa" && (
                      <p className="text-xs text-green-600 font-semibold mt-1">≈ KES {cartKES.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-[#1a2332] flex items-center justify-center shadow-lg shadow-slate-900/20">
                    <Zap size={24} className="text-blue-400" />
                  </div>
                </div>

                {/* Pay button */}
                <button
                  onClick={handlePayNow}
                  disabled={createCheckout.isPending}
                  className="w-full relative overflow-hidden rounded-2xl font-black text-base transition-all shadow-lg shadow-slate-900/25 disabled:opacity-60 disabled:cursor-not-allowed group"
                  style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 50%,#1a2332 100%)" }}
                >
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-center gap-2.5 py-4 px-6 text-white">
                    {createCheckout.isPending ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Processing…</span>
                      </>
                    ) : (
                      <>
                        <Lock size={16} className="text-blue-300" />
                        <span>Pay Now · ${cart.total.toFixed(2)}</span>
                        <ArrowRight size={18} className="text-blue-300" />
                      </>
                    )}
                  </div>
                </button>

                {/* Trust row */}
                <div className="flex items-center justify-center gap-4">
                  {[
                    { icon: <ShieldCheck size={12} className="text-green-500" />, label: "SSL Secure" },
                    { icon: <Lock size={12} className="text-blue-500" />, label: "Encrypted" },
                    { icon: <BadgeCheck size={12} className="text-purple-500" />, label: "Verified" },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                      {icon} {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile-only pay bar */}
            <div className="md:hidden fixed bottom-[4rem] left-0 w-full z-40 pb-[env(safe-area-inset-bottom)]">
              <div className="bg-white/95 border-t border-gray-100 shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.12)] backdrop-blur px-4 pt-3 pb-4 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-gray-500 font-medium">Order Total</p>
                  <p className="text-2xl font-black text-gray-900">${cart.total.toFixed(2)}</p>
                </div>
                <button
                  onClick={handlePayNow}
                  disabled={createCheckout.isPending}
                  style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}
                  className="w-full py-4 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-gray-900/20 disabled:opacity-60"
                >
                  {createCheckout.isPending ? (
                    <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
                  ) : (
                    <><Lock size={16} className="text-blue-300" /> Pay Now · ${cart.total.toFixed(2)} <ArrowRight size={18} /></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacer for mobile fixed bar */}
      <div className="md:hidden h-32" />
    </div>
  );
}

function PayMethodCard({
  selected, onSelect, left, title, subtitle, right, badge,
}: {
  selected: boolean;
  onSelect: () => void;
  left: React.ReactNode;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selected ? "border-blue-500 bg-blue-50/50 shadow-sm" : "border-gray-100 bg-gray-50/30 hover:border-gray-200 hover:bg-gray-50"}`}
    >
      {left}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-bold text-gray-800 leading-none">{title}</p>
          {badge}
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {right}
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
        {selected && <Check size={10} className="text-white" strokeWidth={3} />}
      </div>
    </button>
  );
}
