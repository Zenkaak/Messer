import { useEffect, useMemo, useState } from "react";
import { useGetCart, useUpdateCartItem, useRemoveFromCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Trash2, ShoppingBag, Plus, Minus, ArrowRight, ShieldCheck, Package, CheckCircle2, Sparkles, CreditCard, Truck, BadgeCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export function CartPage() {
  const [isReady, setIsReady] = useState(false);
  const { data: cart, isLoading } = useGetCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.removeQueries({ queryKey: getGetCartQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
    setIsReady(true);
  }, [queryClient]);

  const totalItems = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [cart]);

  const handleUpdateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateItem.mutate(
      { productId, data: { quantity: newQuantity } },
      {
        onSuccess: (newCart) => {
          queryClient.setQueryData(getGetCartQueryKey(), newCart);
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        },
      }
    );
  };

  const handleRemove = (productId: number) => {
    removeItem.mutate(
      { productId },
      {
        onSuccess: (newCart) => {
          queryClient.setQueryData(getGetCartQueryKey(), newCart);
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        },
      }
    );
  };

  if (isLoading || !isReady) {
    return (
      <div className="bg-slate-50 min-h-full p-4 space-y-3">
        <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="rounded-3xl p-4 mb-4 shadow-lg shadow-slate-900/10">
          <Skeleton className="h-5 w-32 bg-white/10 mb-1" />
          <Skeleton className="h-7 w-20 bg-white/10" />
          <Skeleton className="h-3 w-44 bg-white/10 mt-3" />
        </div>
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-3xl p-4 flex gap-3 shadow-sm border border-slate-100">
            <Skeleton className="w-18 h-18 rounded-xl shrink-0" style={{ width: 72, height: 72 }} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex justify-between items-center mt-3">
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: "linear-gradient(180deg,#06101f 0%,#0a1628 60%,#0d1f3c 100%)" }}>
        {/* Hero section */}
        <div className="relative flex flex-col items-center pt-16 pb-10 px-6 text-center overflow-hidden">
          {/* Background glows */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(30,58,95,0.7)_0%,transparent_100%)]" />
          <div className="absolute top-8 left-6 w-2 h-2 rounded-full bg-blue-400/50 animate-pulse" />
          <div className="absolute top-16 right-8 w-1.5 h-1.5 rounded-full bg-cyan-400/40 animate-pulse" style={{ animationDelay: "0.7s" }} />
          <div className="absolute top-28 left-14 w-1 h-1 rounded-full bg-purple-400/50 animate-pulse" style={{ animationDelay: "1.2s" }} />
          <div className="absolute top-24 right-14 w-2 h-2 rounded-full bg-blue-300/30 animate-pulse" style={{ animationDelay: "0.3s" }} />

          {/* Icon */}
          <div className="relative z-10 mb-7">
            <div className="w-28 h-28 rounded-[2rem] flex items-center justify-center relative"
              style={{ background: "linear-gradient(135deg,#1e3a5f 0%,#162d4a 100%)", border: "1.5px solid rgba(96,165,250,0.25)", boxShadow: "0 0 40px rgba(30,58,95,0.8), 0 16px 40px rgba(0,0,0,0.5)" }}>
              <ShoppingBag size={50} strokeWidth={1.4} className="text-blue-300/60" />
              <div className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>
                <span className="text-white text-[11px] font-black">0</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 space-y-2 mb-7">
            <h1 className="text-[28px] font-black text-white leading-tight tracking-tight">Your Cart is Empty</h1>
            <p className="text-blue-300/55 text-sm max-w-[230px] mx-auto leading-relaxed">
              Nothing here yet. Explore our services and add what you need.
            </p>
          </div>

          {/* Category chips */}
          <div className="relative z-10 flex flex-wrap justify-center gap-2">
            {[{ e: "📱", l: "Unlocks" }, { e: "🔑", l: "Credits" }, { e: "🎁", l: "Gift Cards" }, { e: "🛠", l: "Tools" }].map(({ e, l }) => (
              <span key={l}
                className="text-[11px] font-bold text-blue-300/65 rounded-full px-3 py-1.5"
                style={{ background: "rgba(30,58,95,0.45)", border: "1px solid rgba(96,165,250,0.18)" }}>
                {e} {l}
              </span>
            ))}
          </div>
        </div>

        {/* Divider line */}
        <div className="mx-5 h-px" style={{ background: "linear-gradient(to right,transparent,rgba(96,165,250,0.15),transparent)" }} />

        {/* CTAs */}
        <div className="px-5 pt-8 pb-12 space-y-3">
          <Link href="/products">
            <button
              className="w-full py-4 text-white font-black text-[15px] rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform"
              style={{ background: "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)", boxShadow: "0 8px 28px rgba(37,99,235,0.4)" }}>
              <ShoppingBag size={18} strokeWidth={2.5} />
              Browse Products
              <ArrowRight size={17} strokeWidth={2.5} />
            </button>
          </Link>
          <Link href="/categories">
            <button
              className="w-full py-3.5 font-bold text-[14px] rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(180,210,255,0.75)" }}>
              View All Categories
            </button>
          </Link>
        </div>

        {/* Bottom decorative strip */}
        <div className="mx-5 rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(16,185,129,0.15)" }}>
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-[12px] font-black text-white/80">Safe & Secure Checkout</p>
            <p className="text-[10px] text-blue-300/40 mt-0.5">Every order is encrypted and verified</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-full pb-44">

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="px-5 pt-5 pb-6 shadow-lg shadow-slate-900/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_42%)]" />
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100 mb-3">
            <Sparkles size={11} />
            Premium Cart
          </div>
          <p className="text-blue-300/70 text-xs font-semibold uppercase tracking-[0.22em] mb-1">Shopping Cart</p>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-white font-black text-2xl leading-none">{totalItems} {totalItems === 1 ? "Item" : "Items"}</p>
              <p className="text-blue-200/60 text-[11px] mt-1">Ready for secure checkout</p>
            </div>
            <p className="text-blue-200/70 text-sm">Total: <span className="text-white font-black">${cart.total.toFixed(2)}</span></p>
          </div>
          <p className="text-blue-200/60 text-xs mt-2">Review your items and checkout securely.</p>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 pt-4 space-y-3">
        {cart.items.map((item) => (
          <div key={item.productId} className="bg-white rounded-3xl border border-slate-100 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.18)] overflow-hidden">
            <div className="flex gap-3 p-4">
              {/* Image */}
              <div className="w-[76px] h-[76px] rounded-2xl bg-gradient-to-br from-teal-700 to-teal-900 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-black/5 shadow-inner">
                <img
                  src={item.imageUrl ?? undefined}
                  alt={item.productName}
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    (e.currentTarget.parentElement as HTMLElement).innerHTML =
                      `<div class="flex items-center justify-center w-full h-full"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><line x1="12" y1="12" x2="12" y2="15"/></svg></div>`;
                  }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link href={`/products/${item.productId}`}>
                  <p className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2 hover:text-blue-600 transition-colors">{item.productName}</p>
                </Link>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                  Fast delivery, secure checkout, and instant access after payment confirmation.
                  Perfect for GSM tools, credits, and digital services.
                </p>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">Unit price</p>
                <p className="text-blue-600 font-black text-lg leading-none mt-1">${item.price.toFixed(2)}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">
                  <CheckCircle2 size={12} />
                  In cart
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleRemove(item.productId)}
                disabled={removeItem.isPending}
                className="self-start p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Bottom row: subtotal + quantity */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-t border-slate-100">
              <div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Subtotal</p>
                <p className="text-slate-800 font-black text-sm">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
              <div className="flex items-center bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                  className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
                  disabled={item.quantity <= 1 || updateItem.isPending}
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center text-sm font-black text-slate-800">{item.quantity}</span>
                <button
                  onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40"
                  disabled={updateItem.isPending}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trust badges */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        {[
          { icon: <BadgeCheck size={14} />, label: "Verified" },
          { icon: <Truck size={14} />, label: "Fast Delivery" },
          { icon: <CreditCard size={14} />, label: "Secure Pay" },
        ].map(({ icon, label }) => (
          <div key={label} className="bg-white border border-slate-100 rounded-2xl py-2.5 flex flex-col items-center gap-1 shadow-[0_4px_14px_-8px_rgba(15,23,42,0.2)]">
            <span className="text-blue-600">{icon}</span>
            <span className="text-[10px] font-semibold text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Fixed checkout bar */}
      <div className="fixed bottom-[4rem] left-0 w-full flex justify-center z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-[430px] bg-white/95 border-t border-slate-100 shadow-[0_-10px_28px_-6px_rgba(15,23,42,0.16)] rounded-t-3xl overflow-hidden backdrop-blur">
          <div className="px-4 pt-3 pb-4 space-y-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider">{cart.itemCount} item{cart.itemCount !== 1 ? "s" : ""}</p>
                <p className="text-xs text-slate-400">Order Total</p>
              </div>
              <p className="text-2xl font-black text-slate-900">${cart.total.toFixed(2)}</p>
            </div>
            <Link href="/checkout">
              <button className="w-full h-13 py-3.5 bg-[#1a2332] hover:bg-[#253246] text-white font-black text-base rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-slate-900/20 active:scale-[0.99]">
                Proceed to Checkout <ArrowRight size={18} />
              </button>
            </Link>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck size={12} className="text-green-500" />
              Secure &amp; Encrypted Checkout
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
