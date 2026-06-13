import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { ShoppingCart, Search, Clock, ChevronRight, Store, Shield, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddToCart } from "@/hooks/api";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type StoreProduct = {
  id: number; name: string; price: string; originalPrice: string | null;
  imageUrl: string; description: string; inStock: boolean; featured: boolean;
  categoryId: number; categoryName: string | null;
};
type StoreInfo = { slug: string; name: string | null; ownerName: string | null; commissionRate: string };

function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-teal-700 to-teal-900 flex items-center justify-center">
        <span className="text-white font-black text-[8px]">GSM</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className="w-full h-full object-contain p-0.5" onError={() => setFailed(true)} />;
}

function DeliveryBadge({ name }: { name: string }) {
  const lower = name.toLowerCase();
  const isInstant = lower.includes("credit") || lower.includes("server") || lower.includes("activation") || lower.includes("license") || lower.includes("tool");
  return (
    <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
      <Clock size={10} className="shrink-0" />
      {isInstant ? "1 Minute" : "0-3 Hours"}
    </span>
  );
}

export function ResellerStorePage() {
  const [, params] = useRoute("/store/:slug");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const slug = params?.slug ?? "";

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const { mutateAsync: addItem } = useAddToCart();
  const [addingId, setAddingId] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    sessionStorage.setItem("gsm_reseller_ref", slug);
    fetch(`${BASE}/api/reseller/store/${encodeURIComponent(slug)}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return; }
        const d = await r.json() as { store: StoreInfo; products: StoreProduct[] };
        setStore(d.store);
        setProducts(d.products);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc: Record<string, StoreProduct[]>, p) => {
    const cat = p.categoryName ?? "Other";
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

  async function handleAdd(product: StoreProduct) {
    setAddingId(product.id);
    try {
      await addItem({ productId: product.id, data: { quantity: 1 } });
      toast({ title: `${product.name} added to cart` });
    } catch {
      toast({ title: "Failed to add to cart", variant: "destructive" });
    } finally {
      setAddingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="h-28 bg-gradient-to-br from-[#1a2332] to-[#1e3a5f]" />
        <div className="px-4 pt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 items-center px-3 py-2.5 border-b border-gray-100">
              <Skeleton className="w-10 h-10 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-2.5 w-16" /></div>
              <Skeleton className="h-4 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Store size={28} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-black text-gray-800 mb-2">Store Not Found</h2>
        <p className="text-gray-400 text-sm mb-6">This store link may be invalid or not yet active.</p>
        <button onClick={() => navigate("/")} className="px-6 py-2.5 bg-[#1a2332] text-white font-bold rounded-xl text-sm">
          Go to GSM World
        </button>
      </div>
    );
  }

  const storeName = store?.name ?? "GSM World Store";

  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Store hero */}
      <div className="px-4 pt-7 pb-6" style={{ background: "linear-gradient(135deg,#1a2332 0%,#1e3a5f 100%)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
            <Store size={24} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-lg leading-tight">{storeName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Shield size={10} className="text-teal-300" />
              <span className="text-teal-300/70 text-[10px] font-semibold">Powered by GSM World</span>
            </div>
          </div>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl px-3 py-2">
          <Search size={15} className="text-white/40 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="flex-1 bg-transparent text-white placeholder-white/30 text-sm focus:outline-none"
          />
        </div>
      </div>

      {/* Products */}
      <div className="px-3 pt-3">
        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <Search size={32} className="mb-3 opacity-40" />
            <p className="text-sm font-semibold">No products found</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, prods]) => (
            <div key={cat} className="mb-3">
              <div className="flex items-center gap-2 px-1 py-2">
                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{cat}</h3>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                {prods.map(product => (
                  <div key={product.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                      <ProductThumb src={product.imageUrl} alt={product.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-1">{product.name}</p>
                      <DeliveryBadge name={product.name} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-[13px] font-black text-gray-800">
                        ${Number(product.price) % 1 === 0 ? Number(product.price).toFixed(1) : Number(product.price).toFixed(2)}
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => navigate(`${BASE}/products/${product.id}`)}
                          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
                          <ChevronRight size={13} />
                        </button>
                        <button
                          onClick={() => handleAdd(product)}
                          disabled={addingId === product.id}
                          className="w-8 h-8 rounded-lg bg-[#1a2332] flex items-center justify-center text-white hover:bg-[#1e3a5f] disabled:opacity-50 transition-colors">
                          {addingId === product.id
                            ? <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                            : <ShoppingCart size={12} />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Powered by */}
        <div className="flex items-center justify-center gap-2 py-6 text-gray-300">
          <Shield size={12} />
          <span className="text-[11px] font-semibold">Powered by</span>
          <button onClick={() => navigate("/")} className="flex items-center gap-1 text-[11px] font-black text-gray-500 hover:text-gray-700">
            GSM World <ExternalLink size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
