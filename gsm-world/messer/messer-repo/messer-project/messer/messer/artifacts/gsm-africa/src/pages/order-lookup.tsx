import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Package, Mail, Hash, ArrowRight, CheckCircle, Clock, XCircle, ShoppingBag } from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pending Payment", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500", pulse: true },
  paid:    { label: "Paid & Confirmed", color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500", pulse: false },
  failed:  { label: "Failed", color: "text-red-600 bg-red-50 border-red-200", dot: "bg-red-400", pulse: false },
  expired: { label: "Expired", color: "text-gray-500 bg-gray-50 border-gray-200", dot: "bg-gray-400", pulse: false },
};

type OrderItem = { productName: string; quantity: number; price: string };
type LookupOrder = {
  id: number;
  customerEmail: string;
  customerPhone: string | null;
  customerName: string | null;
  paymentMethod: string;
  paymentStatus: string;
  total: string;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
};

export function OrderLookupPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<LookupOrder | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !orderId) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(
        `/api/orders/lookup?email=${encodeURIComponent(email.trim())}&orderId=${encodeURIComponent(orderId.trim())}`
      );
      const data = await res.json() as LookupOrder & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Order not found. Check your email and order ID.");
        return;
      }
      setOrder(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const statusCfg = order
    ? (STATUS_CONFIG[order.paymentStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending)
    : null;

  return (
    <div className="min-h-[80vh] bg-gray-50">

      {/* Header */}
      <div
        className="px-5 pt-8 pb-10 text-center"
        style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center mx-auto mb-4">
          <Search size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-white mb-1">Track Your Order</h1>
        <p className="text-blue-300/70 text-sm max-w-[260px] mx-auto">
          Enter your email and order ID to check your order status
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 pb-10">

        {/* Lookup form */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <form onSubmit={handleLookup} className="p-5 space-y-4">

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">The email you used when placing the order</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                Order ID
              </label>
              <div className="relative">
                <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  placeholder="e.g. 1042"
                  required
                  min="1"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Found in your order confirmation email</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <XCircle size={15} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !orderId}
              className="w-full py-3.5 bg-[#1a2332] hover:bg-[#253246] disabled:opacity-50 text-white font-black text-base rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Looking up…</>
              ) : (
                <><Search size={17} /> Find Order</>
              )}
            </button>
          </form>
        </div>

        {/* Result */}
        {order && statusCfg && (
          <div className="mt-5 space-y-3">

            {/* Status banner */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-blue-300/70 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Order</p>
                  <p className="text-white font-black text-xl">#{order.id}</p>
                  <p className="text-blue-200/60 text-xs">{new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${statusCfg.color}`}>
                  <span className={`w-2 h-2 rounded-full ${statusCfg.dot} ${statusCfg.pulse ? "animate-pulse" : ""}`} />
                  {statusCfg.label}
                </div>
              </div>

              {/* Status info strip */}
              {order.paymentStatus === "paid" && (
                <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
                  <CheckCircle size={15} className="text-green-600 shrink-0" />
                  <p className="text-sm text-green-700 font-medium">
                    Payment confirmed. Service details sent to <strong>{order.customerEmail}</strong>.
                    {order.paidAt && <span className="text-green-600 font-normal"> Paid {new Date(order.paidAt).toLocaleString()}</span>}
                  </p>
                </div>
              )}
              {order.paymentStatus === "pending" && (
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                  <Clock size={15} className="text-amber-600 shrink-0 animate-pulse" />
                  <p className="text-sm text-amber-700 font-medium">Awaiting payment confirmation.</p>
                </div>
              )}

              {/* Order items */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Items</p>
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between text-sm">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 leading-snug">{item.productName}</p>
                      <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-bold text-gray-700">${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-3 font-black text-base">
                  <span className="text-gray-700">Total</span>
                  <span className="text-[#1a2332]">${parseFloat(order.total).toFixed(2)} {order.currency}</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-white rounded-2xl shadow-sm px-5 py-4 space-y-2 text-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Details</p>
              {[
                { label: "Email", value: order.customerEmail },
                order.customerPhone ? { label: "Phone", value: order.customerPhone } : null,
                order.customerName ? { label: "Name", value: order.customerName } : null,
                { label: "Payment", value: order.paymentMethod.toUpperCase() },
              ].filter(Boolean).map((row) => (
                <div key={row!.label} className="flex justify-between">
                  <span className="text-gray-400">{row!.label}</span>
                  <span className="font-medium text-gray-800">{row!.value}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => navigate(`/orders/${order.id}`)}
              className="w-full py-3.5 bg-[#1a2332] text-white font-black text-base rounded-2xl flex items-center justify-center gap-2"
            >
              View Full Order <ArrowRight size={17} />
            </button>

            <button
              onClick={() => { setOrder(null); setEmail(""); setOrderId(""); setError(null); }}
              className="w-full py-3 border-2 border-gray-200 text-gray-600 font-bold text-sm rounded-2xl"
            >
              Look Up Another Order
            </button>
          </div>
        )}

        {/* Divider + sign-in prompt */}
        {!order && (
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-gray-400">Have an account?</p>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800"
            >
              Sign in to see all your orders <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Help tip */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <ShoppingBag size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-800 mb-0.5">Where's my order ID?</p>
            <p className="text-xs text-blue-600">
              Your order ID was included in the confirmation email sent after checkout.
              It's a number like <strong>#1042</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
