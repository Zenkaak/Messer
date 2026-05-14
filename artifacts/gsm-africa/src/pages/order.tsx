import { useState, useRef } from "react";
import { useGetOrder } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, Paperclip, Send } from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pending Payment", color: "text-amber-600 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  paid: { label: "Paid", color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500" },
  failed: { label: "Failed", color: "text-red-600 bg-red-50 border-red-200", dot: "bg-red-500" },
  expired: { label: "Expired", color: "text-gray-500 bg-gray-50 border-gray-200", dot: "bg-gray-400" },
};

export function OrderPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const orderId = parseInt(params.id ?? "0");
  const [chatMsg, setChatMsg] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatSent, setChatSent] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const SUPPORT_WA = "254756816951";

  async function sendToSupport() {
    if (!chatMsg.trim() && !chatFile) return;
    setChatSending(true);
    const text = `Order #${orderId} — ${chatMsg.trim() || (chatFile ? `[File: ${chatFile.name}]` : "")}`;
    const waUrl = `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(text)}`;
    setTimeout(() => {
      setChatSent(true);
      setChatSending(false);
      setChatMsg("");
      setChatFile(null);
      window.open(waUrl, "_blank");
    }, 600);
  }

  const { data: order, isLoading, error } = useGetOrder(orderId, {
    query: { queryKey: ["order", orderId], enabled: !!orderId, refetchInterval: (query) => query.state.data?.paymentStatus === "pending" ? 8000 : false },
  });

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
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
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
            <p>Waiting for USDT payment confirmation. Once received, your order will be marked as paid.</p>
          )}
        </div>
      )}
      {/* Support chat */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-[#1a2332] flex items-center gap-2">
          <MessageCircle size={16} className="text-blue-300" />
          <p className="text-sm font-bold text-white">Support Chat</p>
          <span className="ml-auto flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] text-green-300 font-medium">Online</span>
          </span>
        </div>
        <div className="p-4 space-y-3">
          {chatSent ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
              <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-800">Message sent!</p>
                <p className="text-xs text-green-600">Opening WhatsApp. Our team will reply shortly.</p>
              </div>
            </div>
          ) : (
            <>
              <textarea
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                placeholder={`Describe your issue with order #${orderId}…`}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.txt,.zip"
                  onChange={e => setChatFile(e.target.files?.[0] || null)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${chatFile ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-blue-300"}`}
                >
                  <Paperclip size={13} />
                  {chatFile ? chatFile.name.slice(0, 18) + (chatFile.name.length > 18 ? "…" : "") : "Attach File"}
                </button>
                <button
                  onClick={sendToSupport}
                  disabled={chatSending || (!chatMsg.trim() && !chatFile)}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-[#1a2332] hover:bg-[#253246] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  {chatSending
                    ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send size={13} />}
                  {chatSending ? "Sending…" : "Send"}
                </button>
              </div>
              <p className="text-[10px] text-gray-400">
                Messages open WhatsApp with your order details pre-filled. Files can be shared directly in chat.
              </p>
            </>
          )}
        </div>
      </div>

      {order.paymentStatus === "paid" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          <p className="font-semibold">Payment confirmed! Your service will be delivered to <strong>{order.customerEmail}</strong> shortly.</p>
          {order.paidAt && (
            <p className="text-xs mt-1 text-green-600">Paid at: {new Date(order.paidAt).toLocaleString()}</p>
          )}
        </div>
      )}

      <div className="bg-muted rounded-xl p-4 space-y-3">
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Order Items</h2>
        {order.items.map((item) => (
          <div key={item.productId} className="flex justify-between items-start text-sm">
            <div className="flex-1">
              <p className="font-medium text-foreground leading-snug">{item.productName}</p>
              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
            </div>
            <p className="font-bold">${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
          </div>
        ))}
        <div className="flex justify-between font-bold border-t pt-3">
          <span>Total</span>
          <span className="text-primary">${parseFloat(order.total).toFixed(2)} {order.currency}</span>
        </div>
      </div>

      <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
        <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">Details</h2>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium">{order.customerEmail}</span>
        </div>
        {order.customerPhone && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium">{order.customerPhone}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Payment</span>
          <span className="font-medium uppercase">{order.paymentMethod}</span>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
        Continue Shopping
      </Button>
    </div>
  );
}
