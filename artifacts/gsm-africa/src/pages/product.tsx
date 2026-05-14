import { useGetProduct, useAddToCart, getGetCartQueryKey, useListProducts } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Check, Truck, ShieldCheck, Zap, Package, Star, ShoppingCart, ChevronRight, Minus, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Determine whether a product is a "Server / Credits" service or an "IMEI" service
function getServiceType(name: string, categoryName: string): "server" | "imei" {
  const haystack = `${name} ${categoryName}`.toLowerCase();
  const serverKeywords = [
    "tool", "credit", "server", "paid tool", "username", "account",
    "activation", "software", "license", "dongle", "repair software",
    "adam", "miracle", "umt", "chimera", "bmt", "nc auth",
  ];
  if (serverKeywords.some((kw) => haystack.includes(kw))) return "server";
  return "imei";
}

export function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: product, isLoading } = useGetProduct(id, { query: { enabled: !!id } as never });
  const addToCart = useAddToCart();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [fieldValue, setFieldValue] = useState("");
  const [imeiValue, setImeiValue] = useState("");

  const { data: related } = useListProducts(
    { category: product?.categoryName ?? undefined, limit: 5 },
    { query: { enabled: !!product?.categoryName } as never }
  );

  const serviceType = product
    ? getServiceType(product.name, product.categoryName ?? "")
    : "imei";

  const isServer = serviceType === "server";

  function handleAddToCart() {
    if (!product) return;
    if (!fieldValue.trim()) {
      toast({
        variant: "destructive",
        title: isServer ? "Username required" : "IMEI / Serial number required",
        description: isServer
          ? "Please enter your server account username before adding to cart."
          : "Please enter the device IMEI or serial number before adding to cart.",
      });
      return;
    }
    setIsAdding(true);
    addToCart.mutate(
      { data: { productId: product.id, quantity } },
      {
        onSuccess: (newCart) => {
          queryClient.setQueryData(getGetCartQueryKey(), newCart);
          setIsAdding(false);
          setAdded(true);
          toast({ title: "Added to cart!", description: product.name, duration: 2000 });
          setTimeout(() => setAdded(false), 2000);
        },
        onError: () => {
          setIsAdding(false);
          toast({ variant: "destructive", title: "Could not add item to cart." });
        },
      }
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-full p-4 space-y-3">
        <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="rounded-2xl p-4">
          <div className="flex gap-4">
            <Skeleton className="w-28 h-28 rounded-2xl shrink-0 bg-white/10" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-4/5 bg-white/10" />
              <Skeleton className="h-6 w-20 mt-3 bg-white/10" />
              <Skeleton className="h-8 w-24 mt-1 bg-white/10" />
            </div>
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-4 text-center">
        <Package size={48} className="text-gray-300" />
        <h2 className="text-xl font-bold text-gray-700">Product not found</h2>
        <Link href="/products" className="text-blue-600 font-medium hover:underline">← Back to Store</Link>
      </div>
    );
  }

  const deliveryTime = (product as typeof product & { deliveryTime?: string }).deliveryTime ?? "1–10 Minutes";
  const relatedProducts = related?.products.filter((p) => p.id !== product.id).slice(0, 3) ?? [];

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-8">

      {/* ── Dark hero ─────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }} className="px-4 pt-3 pb-6">
        <Link href="/products" className="inline-flex items-center gap-1 text-blue-300/70 hover:text-blue-200 text-sm mb-4">
          <ArrowLeft size={15} /> Back to Store
        </Link>

        <div className="flex gap-4">
          {/* Image */}
          <div className="w-28 h-28 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={product.imageUrl ?? undefined}
              alt={product.name}
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23006b6b'/%3E%3Ctext x='50' y='56' text-anchor='middle' fill='white' font-size='28' font-weight='bold' font-family='sans-serif'%3EGSM%3C/text%3E%3C/svg%3E";
              }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {product.categoryName && (
              <p className="text-blue-300/60 text-[10px] font-bold uppercase tracking-widest">{product.categoryName}</p>
            )}
            <h1 className="text-white font-black text-[15px] leading-snug">{product.name}</h1>

            {/* Service type badges */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {isServer ? (
                <span className="bg-orange-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full">
                  Server Service
                </span>
              ) : (
                <span className="bg-green-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full">
                  IMEI Service
                </span>
              )}
              <span className="bg-white/15 text-white/80 text-[9px] font-bold px-2.5 py-0.5 rounded-full">Digital</span>
            </div>

            {/* Price */}
            <p className="text-white font-black text-2xl leading-none">
              ${product.price % 1 === 0 ? product.price.toFixed(0) : product.price.toFixed(2)}
            </p>

            {/* Stock */}
            <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${product.inStock ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"}`}>
              {product.inStock ? <><Check size={10} strokeWidth={3} /> In Stock</> : "Out of Stock"}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* ── Info chips ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <Truck size={15} className="text-blue-500" />, label: "Delivery", value: deliveryTime },
            { icon: <Zap size={15} className="text-yellow-500" />, label: "Type", value: isServer ? "Credits" : "Instant" },
            { icon: <ShieldCheck size={15} className="text-green-500" />, label: "Verified", value: "100%" },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
              <div className="flex justify-center mb-1">{icon}</div>
              <p className="text-[9px] text-gray-400 font-medium">{label}</p>
              <p className="text-[11px] font-black text-gray-700 leading-tight mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Order form card ───────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">

          {/* Quantity (always shown, prominent for server services) */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
              Quantity <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-0">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-11 h-11 flex items-center justify-center border border-gray-200 rounded-l-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <Minus size={16} className="text-gray-600" />
              </button>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full h-11 border-y border-gray-200 text-center text-base font-black text-gray-800 focus:outline-none bg-white"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-11 h-11 flex items-center justify-center border border-gray-200 rounded-r-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <Plus size={16} className="text-gray-600" />
              </button>
            </div>
          </div>

          {/* Dynamic input: Username (server) or SN/IMEI (imei) */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
              {isServer ? "Username" : "Serial / IMEI Number"} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder={isServer ? "Username *" : "Enter IMEI or Serial Number"}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">
              {isServer
                ? "Your server account username for this service"
                : "Required to process your order correctly"}
            </p>
          </div>

          {/* Optional IMEI field — shown alongside Username for server services */}
          {isServer && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                IMEI <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={imeiValue}
                onChange={(e) => setImeiValue(e.target.value)}
                placeholder="Enter device IMEI if applicable"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                Provide the device IMEI if this service requires it
              </p>
            </div>
          )}
        </div>

        {/* ── Add to cart ───────────────────────────────────────────────── */}
        <button
          onClick={handleAddToCart}
          disabled={!product.inStock || isAdding}
          className={`w-full py-4 rounded-2xl text-white text-base font-black transition-all shadow-lg flex items-center justify-center gap-2 ${
            added
              ? "bg-green-600 shadow-green-900/20"
              : !product.inStock
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-900/20 active:scale-[0.98]"
          }`}
        >
          {isAdding ? (
            <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding…</>
          ) : added ? (
            <><Check size={20} strokeWidth={3} /> Added to Cart!</>
          ) : (
            <><ShoppingCart size={18} /> Add To Cart</>
          )}
        </button>

        {/* ── Total preview (server services especially) ────────────────── */}
        {quantity > 1 && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 flex items-center justify-between">
            <p className="text-[12px] text-blue-700 font-semibold">Total ({quantity} × ${product.price.toFixed(2)})</p>
            <p className="text-base font-black text-blue-800">${(quantity * product.price).toFixed(2)}</p>
          </div>
        )}

        {/* ── Description ───────────────────────────────────────────────── */}
        {product.description && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">About This Service</p>
            <p className="text-[13px] text-gray-700 leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* ── Features ──────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-2.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Service Features</p>
          {[
            { icon: <Zap size={14} className="text-yellow-500" />, text: "Instant automated delivery" },
            { icon: <ShieldCheck size={14} className="text-green-500" />, text: isServer ? "Safe server-side processing" : "100% safe — no personal data required" },
            { icon: <Star size={14} className="text-blue-500" fill="currentColor" />, text: "Verified by GSM World team" },
            { icon: <Truck size={14} className="text-purple-500" />, text: `Delivery in ${deliveryTime}` },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">{icon}</div>
              <p className="text-[12px] text-gray-700 font-medium">{text}</p>
            </div>
          ))}
        </div>

        {/* ── Disclaimer ────────────────────────────────────────────────── */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
          <p className="text-[11px] text-amber-700 leading-relaxed">
            ⚠️ Tax and/or service fee may apply and will be calculated at checkout based on your billing address and applicable rates.
          </p>
        </div>

        {/* ── Related products ──────────────────────────────────────────── */}
        {relatedProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Related Services</p>
              <Link
                href={`/products?category=${encodeURIComponent(product.categoryName ?? "")}`}
                className="text-blue-600 text-xs font-semibold flex items-center gap-0.5"
              >
                View all <ChevronRight size={13} />
              </Link>
            </div>
            <div className="space-y-2">
              {relatedProducts.map((p) => {
                const relType = getServiceType(p.name, p.categoryName ?? "");
                return (
                  <Link href={`/products/${p.id}`} key={p.id}>
                    <div className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-700 to-teal-900 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={p.imageUrl ?? undefined} alt={p.name} className="w-full h-full object-contain p-1"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-gray-800 line-clamp-1">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${relType === "server" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
                            {relType === "server" ? "Server" : "IMEI"}
                          </span>
                          <p className="text-[11px] text-blue-600 font-black">${p.price.toFixed(2)}</p>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-gray-300 shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
