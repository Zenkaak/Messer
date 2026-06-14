import { useState, useRef, useEffect, useCallback } from "react";
import { useGetOrder } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, Paperclip, Send, X, ShieldCheck, XCircle, Clock, Wallet, CreditCard, ArrowRight, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CreditCard size={16} className="text-blue-600 shrink-0" />
        <p className="text-sm font-bold text-blue-900">Complete Your Payment</p>
      </div>

      {pm === "wallet" && (
        <>
          {walletMsg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 font-medium">{walletMsg}</p>}
          {walletErr && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{walletErr}</p>}
          {!walletMsg && (
            <button onClick={payWithWallet} disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
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
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors">
              <ArrowRight size={14} />
              {loading ? "Generating…" : "Generate Crypto Address"}
            </button>
          ) : (
            <div className="bg-white rounded-xl p-3 border border-blue-200 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Send exactly <strong>{nowPayAddr.amount} {nowPayAddr.currency.toUpperCase()}</strong> to:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 flex-1 break-all select-all">{nowPayAddr.address}</code>
              </div>
              <p className="text-[11px] text-slate-400">Page auto-refreshes when payment is detected</p>
            </div>
          )}
        </>
      )}

      {pm === "binance_pay" && (
        <div className="space-y-3">
          {payConfig ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest">Binance Pay ID</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-gray-900 tracking-widest flex-1">{payConfig.binancePayId}</span>
                <button
                  onClick={() => copy(payConfig.binancePayId ?? "", "binance")}
                  className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${copiedKey === "binance" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
                  {copiedKey === "binance" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedKey === "binance" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[10px] text-yellow-700">Label: <strong>GSM World</strong> — Include <strong>ORDER-{order.id}</strong> in your payment note.</p>
            </div>
          ) : (
            <div className="h-20 rounded-xl bg-yellow-50 border border-yellow-100 animate-pulse" />
          )}
          <div className="flex items-start gap-2 text-xs text-blue-800">
            <MessageCircle size={13} className="shrink-0 mt-0.5" />
            <span>After sending, <strong>upload your proof screenshot</strong> in the chat below so we can verify.</span>
          </div>
          <a href="#chat" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900">
            ↓ Go to chat
          </a>
        </div>
      )}

      {pm === "usdt_manual" && (
        <div className="space-y-3">
          {payConfig ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-green-800 uppercase tracking-widest">USDT TRC20 Address</p>
              <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-2 py-2">
                <span className="font-mono text-[10px] text-gray-700 break-all flex-1 select-all">{payConfig.usdtAddress}</span>
                <button
                  onClick={() => copy(payConfig.usdtAddress ?? "", "usdt")}
                  className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${copiedKey === "usdt" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>
                  {copiedKey === "usdt" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedKey === "usdt" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[10px] font-bold text-green-800">Network: TRON (TRC20) only</p>
              <p className="text-[10px] text-green-700">Include <strong>ORDER-{order.id}</strong> as payment memo/note.</p>
            </div>
          ) : (
            <div className="h-20 rounded-xl bg-green-50 border border-green-100 animate-pulse" />
          )}
          <div className="flex items-start gap-2 text-xs text-blue-800">
            <MessageCircle size={13} className="shrink-0 mt-0.5" />
            <span>After sending, <strong>upload your proof screenshot</strong> in the chat below so we can verify.</span>
          </div>
          <a href="#chat" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900">
            ↓ Go to chat
          </a>
        </div>
      )}

      {!["wallet", "nowpayments", "mpesa", "binance_pay", "usdt_manual"].includes(pm) && (
        <div className="space-y-2">
          <p className="text-xs text-blue-800">Transfer payment and then <strong>upload your proof screenshot</strong> in the chat below ↓</p>
          <a href="#chat" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900">
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
    if (!token && !emailParam && orderId) {
      navigate(`/orders/lookup?orderId=${orderId}`, { replace: true });
    }
  }, [token, emailParam, orderId, navigate]);

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
      enabled: !!orderId,
      refetchInterval: (query) => query.state.data?.paymentStatus === "pending" ? 8000 : false,
    },
  });

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
      <div className="p-4 space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground mb-4">Order not found.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.paymentStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-black text-xl">Order #{order.id}</h1>
          <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${statusCfg.color}`}>
          <span className={`w-2 h-2 rounded-full ${statusCfg.dot} ${order.paymentStatus === "pending" ? "animate-pulse" : ""}`} />
          {statusCfg.label}
        </div>
      </div>

      {order.paymentStatus === "pending" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {order.paymentMethod === "mpesa" ? (
            <p>Waiting for M-Pesa confirmation on <strong>{order.customerPhone}</strong>. This page auto-refreshes.</p>
          ) : (
            <p>Waiting for payment confirmation. Once received, your order will be marked as paid.</p>
          )}
        </div>
      )}

      {order.paymentStatus === "pending" && <PayNowBlock order={order} token={token} onSuccess={() => void refetch()} />}

      {order.paymentStatus === "paid" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          <p className="font-semibold flex items-center gap-2">
            <ShieldCheck size={16} className="text-green-600 shrink-0" />
            Payment confirmed! Your service will be delivered to <strong>{order.customerEmail}</strong> shortly.
          </p>
          {order.paidAt && (
            <p className="text-xs mt-1 text-green-600">Paid at: {new Date(order.paidAt).toLocaleString()}</p>
          )}
        </div>
      )}

      {order.paymentStatus === "completed" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
          <p className="font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            Order completed! Check your email or the support chat below for delivery details.
          </p>
        </div>
      )}

      {order.paymentStatus === "cancelled" && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
          <p className="font-semibold flex items-center gap-2">
            <XCircle size={16} className="text-gray-400 shrink-0" />
            This order has been cancelled.
          </p>
        </div>
      )}

      {/* Cancel within 30 min */}
      {canCancel && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 font-medium">
              You can cancel this order — window closes in <strong className="font-mono">{countdown.formatted}</strong>
            </p>
          </div>
          {cancelError && (
            <p className="text-xs text-red-600 bg-red-100 rounded-lg px-3 py-2">{cancelError}</p>
          )}
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {cancelling
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <XCircle size={15} />}
            {cancelling ? "Cancelling…" : "Cancel Order"}
          </button>
        </div>
      )}

      {/* Order Items */}
      <div className="bg-muted rounded-xl p-4 space-y-3">
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Order Items</h2>
        {order.items.map((item) => (
          <div key={item.productId} className="flex justify-between items-start text-sm">
            <div className="flex-1 min-w-0 pr-3">
              <p className="font-medium text-foreground leading-snug">{item.productName}</p>
              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
            </div>
            <p className="font-bold shrink-0">${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
          </div>
        ))}
        <div className="flex justify-between font-bold border-t pt-3">
          <span>Total</span>
          <span className="text-primary">${parseFloat(order.total).toFixed(2)} {order.currency}</span>
        </div>
      </div>

      {/* Order Details */}
      <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">Details</h2>
        <div className="flex justify-between flex-wrap gap-1">
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium break-all">{order.customerEmail}</span>
        </div>
        {order.customerPhone && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium">{order.customerPhone}</span>
          </div>
        )}
        {!!(order as unknown as Record<string, unknown>).deviceIdentifier && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">IMEI / ID</span>
            <span className="font-medium font-mono text-xs">{String((order as unknown as Record<string, unknown>).deviceIdentifier)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Payment</span>
          <span className="font-medium uppercase">{order.paymentMethod}</span>
        </div>
      </div>

      {/* Support Chat */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-[#1a2332] flex items-center gap-2">
          <MessageCircle size={16} className="text-blue-300" />
          <p className="text-sm font-bold text-white">Support Chat</p>
          <span className="ml-auto flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] text-green-300 font-medium">Online</span>
          </span>
        </div>

        {/* Messages list */}
        <div className="min-h-[120px] max-h-72 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <MessageCircle size={28} className="text-gray-200 mb-2" />
              <p className="text-xs text-gray-400 font-medium">No messages yet</p>
              <p className="text-[11px] text-gray-300">Send a message and our team will reply shortly.</p>
            </div>
          ) : (
            messages.map(msg => {
              const isAdmin = msg.senderType === "admin";
              return (
                <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                    isAdmin
                      ? "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                      : "bg-[#1a2332] text-white rounded-tr-sm"
                  }`}>
                    {isAdmin && (
                      <p className="text-[10px] font-bold text-blue-600 mb-1">Support Team</p>
                    )}
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                    {msg.fileUrl && (
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 mt-2 text-[11px] font-medium underline ${isAdmin ? "text-blue-600" : "text-blue-200"}`}>
                        <Paperclip size={11} /> View attachment
                      </a>
                    )}
                    <p className={`text-[10px] mt-1 ${isAdmin ? "text-gray-400" : "text-blue-200/70"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="p-4 border-t border-gray-100 space-y-2 bg-white">
          {uploadError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600">
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
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                chatFile ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-blue-300"
              }`}
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
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
              title="Refresh messages"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
              </svg>
            </button>

            <button
              onClick={sendMessage}
              disabled={chatSending || (!chatMsg.trim() && !chatFile)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-[#1a2332] hover:bg-[#253246] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors"
            >
              {chatSending
                ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Send size={13} />}
              {chatSending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="text-[10px] text-gray-400">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
        Continue Shopping
      </Button>
    </div>
  );
}
