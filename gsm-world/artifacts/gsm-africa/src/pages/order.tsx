import { useState, useRef, useEffect, useCallback } from "react";
import { useGetOrder } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, Paperclip, Send, X, ShieldCheck, XCircle, Clock, Wallet, CreditCard, ArrowRight, Copy, Check, Zap, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function useOrderWebSocket(
  orderId: number,
  onStatusUpdate: (status: string) => void,
  onNewMessage: (msg: OrderMessage) => void,
) {
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const retryDelayRef = useRef(1000);

  useEffect(() => {
    mountedRef.current = true;
    retryDelayRef.current = 1000;

    function connect() {
      if (!mountedRef.current) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/api/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        ws.send(JSON.stringify({ type: "subscribe", orderId }));
        setWsReady(true);
        retryDelayRef.current = 1000;
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as {
            type: string;
            paymentStatus?: string;
            message?: OrderMessage;
          };
          if (data.type === "status_update" && data.paymentStatus) {
            onStatusUpdate(data.paymentStatus);
          } else if (data.type === "new_message" && data.message) {
            onNewMessage(data.message);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setWsReady(false);
        if (!mountedRef.current) return;
        timerRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
          connect();
        }, retryDelayRef.current);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [orderId]);

  return wsReady;
}

// ── M-Pesa Resend Block ───────────────────────────────────────────────────────
interface MpesaOrder {
  id: number;
  customerPhone: string | null;
}
function MpesaResendBlock({ order, token }: { order: MpesaOrder; token: string | null }) {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [phone, setPhone] = useState(order.customerPhone ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function resend() {
    if (!phone.trim() || sending || cooldown > 0) return;
    setSending(true);
    setError(null);
    setSent(false);
    try {
      const r = await fetch(`${baseUrl}/api/orders/${order.id}/mpesa/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const d = await r.json() as { success?: boolean; message?: string; error?: string };
      if (r.ok && d.success) {
        setSent(true);
        setCooldown(30);
      } else {
        setError(d.error ?? "Failed to send M-Pesa request. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
      <div className="flex items-center gap-2">
        <Smartphone size={16} className="text-green-400 shrink-0" />
        <p className="text-sm font-bold text-green-300">Resend M-Pesa STK Push</p>
      </div>
      <p className="text-xs text-green-400/70">
        Didn't receive the M-Pesa prompt? Confirm your Safaricom number below and tap <strong className="text-green-300">Send Request</strong>.
      </p>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="e.g. 0712345678 or 254712345678"
          className="flex-1 min-w-0 text-sm px-3 py-2.5 rounded-xl focus:outline-none text-white/80 placeholder-white/20"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(34,197,94,0.25)" }}
        />
        <button
          onClick={resend}
          disabled={sending || cooldown > 0 || !phone.trim()}
          className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
          style={{ background: "rgba(34,197,94,0.3)", border: "1px solid rgba(34,197,94,0.4)" }}
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Zap size={14} />}
          {sending ? "Sending…" : cooldown > 0 ? `Retry in ${cooldown}s` : "Send Request"}
        </button>
      </div>
      {sent && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <CheckCircle2 size={14} className="text-green-400 shrink-0" />
          <p className="text-xs text-green-300 font-medium">M-Pesa prompt sent! Check your phone and enter your PIN.</p>
        </div>
      )}
      {error && (
        <p className="text-xs text-red-400 rounded-xl px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</p>
      )}
    </div>
  );
}

// ── Pay Now Block ─────────────────────────────────────────────────────────────
interface OrderSummary {
  id: number;
  paymentMethod: string | null;
  total: string;
}
function PayNowBlock({ order, token, onSuccess }: { order: OrderSummary; token: string | null; onSuccess: () => void }) {
  const pm = order.paymentMethod ?? "";
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [loading, setLoading] = useState(false);
  const [nowPayAddr, setNowPayAddr] = useState<{ address: string; amount: number; currency: string } | null>(null);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [payConfig, setPayConfig] = useState<{ binancePayId?: string; usdtAddress?: string; usdtNetwork?: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (pm === "binance_pay" || pm === "usdt_manual") {
      fetch(`${baseUrl}/api/orders/payment-config`)
        .then(r => r.json() as Promise<{ binancePayId?: string; usdtAddress?: string; usdtNetwork?: string }>)
        .then(d => setPayConfig(d))
        .catch(() => {});
    }
  }, [pm, baseUrl]);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function payWithWallet() {
    setLoading(true); setWalletErr(null); setWalletMsg(null);
    try {
      const r = await fetch(`${baseUrl}/api/orders/${order.id}/pay-wallet`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      });
      const d = await r.json() as { success?: boolean; message?: string; error?: string };
      if (r.ok && d.success) { setWalletMsg(d.message ?? "Payment successful!"); onSuccess(); }
      else setWalletErr(d.error ?? "Payment failed");
    } catch { setWalletErr("Network error"); }
    finally { setLoading(false); }
  }

  async function generateNowPaymentsAddress() {
    setLoading(true);
    try {
      const r = await fetch(`${baseUrl}/api/orders/${order.id}/nowpayments/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
      });
      const d = await r.json() as { payAddress?: string; payAmount?: number; payCurrency?: string; error?: string };
      if (r.ok && d.payAddress) setNowPayAddr({ address: d.payAddress, amount: d.payAmount ?? 0, currency: d.payCurrency ?? "?" });
    } catch {}
    finally { setLoading(false); }
  }

  if (pm === "mpesa") return null;

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
      <div className="flex items-center gap-2">
        <CreditCard size={16} className="text-blue-400 shrink-0" />
        <p className="text-sm font-bold text-blue-300">Complete Your Payment</p>
      </div>

      {pm === "wallet" && (
        <>
          {walletMsg && <p className="text-xs text-emerald-300 rounded-xl px-3 py-2 font-medium" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>{walletMsg}</p>}
          {walletErr && <p className="text-xs text-red-400 rounded-xl px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>{walletErr}</p>}
          {!walletMsg && (
            <button onClick={payWithWallet} disabled={loading}
              className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
              style={{ background: "rgba(59,130,246,0.3)", border: "1px solid rgba(59,130,246,0.4)" }}>
              <Wallet size={14} />
              {loading ? "Processing…" : `Pay $${parseFloat(order.total).toFixed(2)} from Wallet`}
            </button>
          )}
        </>
      )}

      {pm === "nowpayments" && (
        <>
          {!nowPayAddr ? (
            <button onClick={generateNowPaymentsAddress} disabled={loading}
              className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
              style={{ background: "rgba(59,130,246,0.3)", border: "1px solid rgba(59,130,246,0.4)" }}>
              <ArrowRight size={14} />
              {loading ? "Generating…" : "Generate Crypto Address"}
            </button>
          ) : (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-semibold text-white/50">Send exactly <strong className="text-white">{nowPayAddr.amount} {nowPayAddr.currency.toUpperCase()}</strong> to:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-white/70 rounded-lg px-2 py-1.5 flex-1 break-all select-all" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>{nowPayAddr.address}</code>
              </div>
              <p className="text-[11px] text-white/30">Page auto-refreshes when payment is detected</p>
            </div>
          )}
        </>
      )}

      {pm === "binance_pay" && (
        <div className="space-y-3">
          {payConfig ? (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Binance Pay ID</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white tracking-widest flex-1">{payConfig.binancePayId}</span>
                <button
                  onClick={() => copy(payConfig.binancePayId ?? "", "binance")}
                  className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${copiedKey === "binance" ? "bg-green-600 text-white" : "text-white/50"}`}
                  style={copiedKey !== "binance" ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" } : {}}>
                  {copiedKey === "binance" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedKey === "binance" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[10px] text-amber-400/70">Label: <strong className="text-amber-300">GSM World</strong> — Include <strong className="text-amber-300">ORDER-{order.id}</strong> in your payment note.</p>
            </div>
          ) : (
            <div className="h-20 rounded-xl animate-pulse" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.1)" }} />
          )}
          <div className="flex items-start gap-2 text-xs text-blue-300/70">
            <MessageCircle size={13} className="shrink-0 mt-0.5" />
            <span>After sending, <strong className="text-blue-300">upload your proof screenshot</strong> in the chat below so we can verify.</span>
          </div>
          <a href="#chat" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300">
            ↓ Go to chat
          </a>
        </div>
      )}

      {pm === "usdt_manual" && (
        <div className="space-y-3">
          {payConfig ? (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">USDT TRC20 Address</p>
              <div className="flex items-center gap-2 rounded-lg px-2 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="font-mono text-[10px] text-white/60 break-all flex-1 select-all">{payConfig.usdtAddress}</span>
                <button
                  onClick={() => copy(payConfig.usdtAddress ?? "", "usdt")}
                  className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${copiedKey === "usdt" ? "bg-green-600 text-white" : "text-white/50"}`}
                  style={copiedKey !== "usdt" ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" } : {}}>
                  {copiedKey === "usdt" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedKey === "usdt" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[10px] font-bold text-green-300">Network: TRON (TRC20) only</p>
              <p className="text-[10px] text-green-400/60">Include <strong className="text-green-300">ORDER-{order.id}</strong> as payment memo/note.</p>
            </div>
          ) : (
            <div className="h-20 rounded-xl animate-pulse" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.1)" }} />
          )}
          <div className="flex items-start gap-2 text-xs text-blue-300/70">
            <MessageCircle size={13} className="shrink-0 mt-0.5" />
            <span>After sending, <strong className="text-blue-300">upload your proof screenshot</strong> in the chat below so we can verify.</span>
          </div>
          <a href="#chat" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300">
            ↓ Go to chat
          </a>
        </div>
      )}

      {!["wallet", "nowpayments", "mpesa", "binance_pay", "usdt_manual"].includes(pm) && (
        <div className="space-y-2">
          <p className="text-xs text-blue-300/70">Transfer payment and then <strong className="text-blue-300">upload your proof screenshot</strong> in the chat below ↓</p>
          <a href="#chat" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300">
            <MessageCircle size={12} /> Go to chat
          </a>
        </div>
      )}
    </div>
  );
}

const STATUS_CONFIG = {
  pending: { label: "Pending Payment", color: "text-amber-600 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  paid: { label: "Paid", color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500" },
  processing: { label: "Processing", color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  completed: { label: "Completed", color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  failed: { label: "Failed", color: "text-red-600 bg-red-50 border-red-200", dot: "bg-red-500" },
  expired: { label: "Expired", color: "text-gray-500 bg-gray-50 border-gray-200", dot: "bg-gray-400" },
  cancelled: { label: "Cancelled", color: "text-gray-500 bg-gray-50 border-gray-300", dot: "bg-gray-400" },
  pending_payment_confirmation: { label: "Awaiting Verification", color: "text-purple-700 bg-purple-50 border-purple-200", dot: "bg-purple-500" },
};

interface OrderMessage {
  id: number;
  orderId: number;
  senderType: string;
  senderEmail: string;
  message: string;
  fileUrl?: string | null;
  createdAt: string;
}

function getBaseUrl() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function useCountdown(createdAt: string | undefined, windowMs = 30 * 60 * 1000) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!createdAt) return;
    function calc() {
      const elapsed = Date.now() - new Date(createdAt!).getTime();
      setRemaining(Math.max(0, windowMs - elapsed));
    }
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [createdAt, windowMs]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { remaining, formatted: `${minutes}:${seconds.toString().padStart(2, "0")}` };
}

export function OrderPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const orderId = parseInt(params.id ?? "0");
  const { token, user } = useAuth();
  const rawSearch = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const emailParam = rawSearch.get("email");

  useEffect(() => {
    if (!token && orderId) {
      const qs = new URLSearchParams({ orderId: String(orderId) });
      if (emailParam) qs.set("email", emailParam);
      navigate(`/orders/lookup?${qs.toString()}`, { replace: true });
    }
  }, [token, orderId, navigate, emailParam]);

  const [chatMsg, setChatMsg] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: order, isLoading, error, refetch } = useGetOrder(orderId, {
    query: {
      queryKey: ["order", orderId],
      enabled: !!orderId && !!token,
      refetchInterval: (query) => query.state.data?.paymentStatus === "pending" ? 8000 : false,
    },
  });

  const wsReady = useOrderWebSocket(
    orderId,
    (_status) => { void refetch(); },
    (msg) => setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]),
  );

  const countdown = useCountdown(order?.createdAt);

  const canCancel =
    order &&
    ["pending", "pending_payment_confirmation"].includes(order.paymentStatus) &&
    countdown.remaining > 0;

  const loadMessages = useCallback(async () => {
    if (!orderId) return;
    setMessagesLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${getBaseUrl()}/api/orders/${orderId}/messages`, { headers });
      if (r.ok) {
        const data = await r.json() as OrderMessage[];
        setMessages(data);
      }
    } catch {
    } finally {
      setMessagesLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function handleCancel() {
    if (!order || !canCancel) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = token
        ? `${getBaseUrl()}/api/orders/${orderId}/cancel`
        : `${getBaseUrl()}/api/orders/${orderId}/cancel?email=${encodeURIComponent(order.customerEmail)}`;
      const r = await fetch(url, { method: "POST", headers });
      if (r.ok) {
        await refetch();
      } else {
        const data = await r.json() as { error?: string };
        setCancelError(data.error ?? "Failed to cancel order");
      }
    } catch {
      setCancelError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function sendMessage() {
    if (!chatMsg.trim() && !chatFile) return;
    setChatSending(true);
    setUploadError(null);
    try {
      let fileUrl: string | null = null;

      if (chatFile) {
        const fd = new FormData();
        fd.append("file", chatFile);
        const upRes = await fetch(`${getBaseUrl()}/api/uploads`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (upRes.ok) {
          const upData = await upRes.json() as { url?: string };
          fileUrl = upData.url ?? null;
        }
      }

      const message = chatMsg.trim() || (chatFile ? `[File: ${chatFile.name}]` : "");
      const body: Record<string, unknown> = { message };
      if (fileUrl) body.fileUrl = fileUrl;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const r = await fetch(`${getBaseUrl()}/api/orders/${orderId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (r.ok) {
        const newMsg = await r.json() as OrderMessage;
        setMessages(prev => [...prev, newMsg]);
        setChatMsg("");
        setChatFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setUploadError("Failed to send message. Please try again.");
    } finally {
      setChatSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" style={{ background: "#060b15", minHeight: "100vh" }}>
        <Skeleton className="h-20 w-full" style={{ background: "rgba(255,255,255,0.06)" }} />
        <Skeleton className="h-40 w-full" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 text-center" style={{ background: "#060b15", minHeight: "100vh" }}>
        <p className="text-white/40 mb-4">Order not found.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.paymentStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;

  const progressPct =
    order.paymentStatus === "completed" ? 100 :
    ["paid", "processing"].includes(order.paymentStatus) ? 66 :
    ["pending", "pending_payment_confirmation"].includes(order.paymentStatus) ? 33 : 10;

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto" style={{ background: "#060b15", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-5 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <span className="text-white font-black text-sm">G</span>
          </div>
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-widest leading-none">GSM World</p>
            <p className="text-[11px] font-black text-white leading-tight">Verification Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-black text-green-400">LIVE</span>
        </div>
      </div>

      {/* ── ORDER STATUS CARD ── */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[9px] text-white/30 uppercase tracking-widest leading-none mb-1">Order Reference</p>
            <p className="text-2xl font-black text-white leading-none">#{order.id}</p>
            <p className="text-[10px] text-white/25 mt-1">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1.5">Status</p>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-black ${statusCfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${order.paymentStatus === "pending" ? "animate-pulse" : ""}`} />
              {statusCfg.label}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full mb-1.5" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-1.5 rounded-full transition-all duration-1000"
            style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6)" }} />
        </div>
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
          <span>Pending</span><span>Paid</span><span>Complete</span>
        </div>
      </div>

      {/* ── VERIFICATION STEPS ── */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.12)" }}>
        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-3">Verification Steps</p>
        {[
          { label: "Order Received", done: true },
          { label: "Payment Confirmed", done: ["paid", "processing", "completed"].includes(order.paymentStatus) },
          { label: "Service Processing", done: ["processing", "completed"].includes(order.paymentStatus) },
          { label: "Delivery Complete", done: order.paymentStatus === "completed" },
        ].map(({ label, done }, i) => (
          <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{
              background: done ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.03)",
              border: done ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.07)"
            }}>
              {done
                ? <CheckCircle2 size={10} className="text-green-400" />
                : <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              }
            </div>
            <span className={`text-[12px] font-bold flex-1 ${done ? "text-white" : "text-white/25"}`}>{label}</span>
            {!done && i === (["paid", "processing", "completed"].includes(order.paymentStatus) ? 2 : ["pending", "pending_payment_confirmation"].includes(order.paymentStatus) ? 1 : 0) && (
              <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* ── PAYMENT BLOCKS ── */}
      {order.paymentStatus === "pending" && (
        <div className="mb-4">
          <PayNowBlock order={order} token={token} onSuccess={() => void refetch()} />
        </div>
      )}
      {order.paymentStatus === "pending" && order.paymentMethod === "mpesa" && (
        <div className="mb-4">
          <MpesaResendBlock order={order} token={token} />
        </div>
      )}

      {/* ── STATUS BANNERS ── */}
      {order.paymentStatus === "pending" && (
        <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            {order.paymentMethod === "mpesa" ? (
              <p className="text-sm text-amber-200/80">Waiting for M-Pesa confirmation on <strong className="text-white">{order.customerPhone}</strong>. Page auto-refreshes.</p>
            ) : (
              <p className="text-sm text-amber-200/80">Waiting for payment confirmation. Once received, your order will be marked as paid.</p>
            )}
          </div>
        </div>
      )}

      {order.paymentStatus === "paid" && (
        <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}>
          <ShieldCheck size={15} className="text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-300">Payment confirmed!</p>
            <p className="text-xs text-green-400/60 mt-0.5">Service will be delivered to <strong className="text-green-300">{order.customerEmail}</strong> shortly.</p>
            {order.paidAt && <p className="text-[10px] text-green-400/40 mt-1">Paid: {new Date(order.paidAt).toLocaleString()}</p>}
          </div>
        </div>
      )}

      {order.paymentStatus === "completed" && (
        <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)" }}>
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-300">Order completed!</p>
            <p className="text-xs text-emerald-400/60 mt-0.5">Check your email or the chat below for delivery details.</p>
          </div>
        </div>
      )}

      {order.paymentStatus === "cancelled" && (
        <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ background: "rgba(107,114,128,0.07)", border: "1px solid rgba(107,114,128,0.12)" }}>
          <XCircle size={15} className="text-gray-500 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-400">This order has been cancelled.</p>
        </div>
      )}

      {/* ── CANCEL BLOCK ── */}
      {canCancel && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">Cancel window closes in <strong className="font-mono text-white">{countdown.formatted}</strong></p>
          </div>
          {cancelError && <p className="text-xs text-red-400 mb-3">{cancelError}</p>}
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors"
            style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.35)" }}
          >
            {cancelling
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <XCircle size={14} />}
            {cancelling ? "Cancelling…" : "Cancel Order"}
          </button>
        </div>
      )}

      {/* ── ORDER ITEMS ── */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-3">Order Items</p>
        <div className="space-y-0">
          {order.items.map((item) => (
            <div key={item.productId} className="flex justify-between items-start py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-sm font-bold text-white leading-snug">{item.productName}</p>
                <p className="text-[11px] text-white/25">Qty: {item.quantity}</p>
              </div>
              <p className="text-sm font-black text-blue-300">${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-3">
          <span className="text-sm font-bold text-white/40">Total</span>
          <div className="text-right">
            <span className="text-xl font-black text-white">${parseFloat(order.total).toFixed(2)}</span>
            <span className="text-[10px] text-white/30 ml-1">{order.currency}</span>
          </div>
        </div>
      </div>

      {/* ── ORDER DETAILS ── */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-3">Details</p>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-white/30">Email</span>
            <span className="text-[12px] font-bold text-white/60 break-all text-right max-w-[55%]">{order.customerEmail}</span>
          </div>
          {order.customerPhone && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-white/30">Phone</span>
              <span className="text-[12px] font-bold text-white/60">{order.customerPhone}</span>
            </div>
          )}
          {!!(order as unknown as Record<string, unknown>).deviceIdentifier && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-white/30">IMEI / ID</span>
              <span className="text-[11px] font-bold font-mono text-white/60">{String((order as unknown as Record<string, unknown>).deviceIdentifier)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-white/30">Payment</span>
            <span className="text-[12px] font-black text-white/60 uppercase">{order.paymentMethod}</span>
          </div>
        </div>
      </div>

      {/* ── TRUST BADGES ── */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: <ShieldCheck size={14} />, label: "256-bit SSL", sub: "Encrypted" },
          { icon: <CheckCircle2 size={14} />, label: "15K+ Served", sub: "Trusted" },
          { icon: <Zap size={14} />, label: "2–24 hr Avg", sub: "Delivery" },
        ].map(({ icon, label, sub }) => (
          <div key={label} className="rounded-xl py-2.5 flex flex-col items-center gap-0.5" style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)" }}>
            <span className="text-blue-400">{icon}</span>
            <span className="text-[9px] font-black text-white/40 text-center leading-tight">{label}</span>
            <span className="text-[8px] text-white/20 leading-tight">{sub}</span>
          </div>
        ))}
      </div>

      {/* ── SUPPORT CHAT ── */}
      <div id="chat" className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ background: "rgba(59,130,246,0.09)", borderBottom: "1px solid rgba(59,130,246,0.14)" }}>
          <MessageCircle size={15} className="text-blue-400" />
          <p className="text-sm font-black text-white">Support Chat</p>
          <span className="ml-auto flex items-center gap-1.5">
            {wsReady ? (
              <><Zap size={11} className="text-green-400" /><span className="text-[10px] text-green-400 font-black">Live</span></>
            ) : (
              <><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /><span className="text-[10px] text-green-400 font-bold">Online</span></>
            )}
          </span>
        </div>

        <div className="min-h-[120px] max-h-72 overflow-y-auto p-4 space-y-3" style={{ background: "rgba(0,0,0,0.35)" }}>
          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <MessageCircle size={28} className="mb-2" style={{ color: "rgba(255,255,255,0.08)" }} />
              <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>No messages yet</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.15)" }}>Send a message and our team will reply shortly.</p>
            </div>
          ) : (
            messages.map(msg => {
              const isAdmin = msg.senderType === "admin";
              return (
                <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm" style={isAdmin ? {
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "#f1f5f9",
                    borderRadius: "4px 18px 18px 18px",
                  } : {
                    background: "linear-gradient(135deg,rgba(59,130,246,0.75),rgba(99,102,241,0.75))",
                    color: "#fff",
                    borderRadius: "18px 4px 18px 18px",
                  }}>
                    {isAdmin && <p className="text-[10px] font-black text-blue-400 mb-1">Support Team</p>}
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                    {msg.fileUrl && (
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-blue-300 underline">
                        <Paperclip size={11} /> View attachment
                      </a>
                    )}
                    <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 space-y-2" style={{ background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {uploadError && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-400" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <X size={12} /> {uploadError}
              <button onClick={() => setUploadError(null)} className="ml-auto"><X size={11} /></button>
            </div>
          )}
          <textarea
            value={chatMsg}
            onChange={e => setChatMsg(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Describe your issue with order #${orderId}…`}
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
              style={{
                background: chatFile ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
                border: chatFile ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.07)",
                color: chatFile ? "#93c5fd" : "rgba(255,255,255,0.35)",
              }}
            >
              <Paperclip size={13} />
              {chatFile ? (
                <span className="flex items-center gap-1">
                  {chatFile.name.slice(0, 16)}{chatFile.name.length > 16 ? "…" : ""}
                  <X size={11} onClick={e => { e.stopPropagation(); setChatFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} />
                </span>
              ) : "Attach"}
            </button>

            <button
              onClick={loadMessages}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.25)" }}
              title="Refresh messages"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
              </svg>
            </button>

            <button
              onClick={sendMessage}
              disabled={chatSending || (!chatMsg.trim() && !chatFile)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 text-white text-xs font-black rounded-xl disabled:opacity-40 transition-colors"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
            >
              {chatSending
                ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Send size={13} />}
              {chatSending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      <button
        onClick={() => navigate("/")}
        className="w-full py-3 rounded-2xl text-sm font-bold transition-colors"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}
      >
        ← Continue Shopping
      </button>
    </div>
  );
}
