import { useState, useMemo } from "react";
import { useListProducts } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingCart, Check, Smartphone, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";

const ANDROID_CATEGORIES = [
  // Samsung
  "Samsung Unlock","Samsung Factory Unlock","Samsung MDM Bypass","Samsung FRP Bypass",
  "Samsung Network Unlock","Samsung Knox Bypass",
  // Huawei / Honor
  "Huawei Unlock","Huawei NCK Unlock","Huawei FRP Bypass","Honor Unlock",
  // Xiaomi / POCO / Redmi
  "Xiaomi Unlock","Xiaomi Mi Unlock","Xiaomi Redmi Unlock","Xiaomi POCO Unlock","Xiaomi FRP Bypass",
  // LG
  "LG Unlock","LG Factory Unlock","LG FRP Bypass",
  // Motorola / Lenovo
  "Motorola Unlock","Motorola Factory Unlock","Moto G Unlock","Lenovo Unlock",
  // Nokia
  "Nokia Unlock","Nokia Factory Unlock",
  // Sony
  "Sony Unlock","Sony Xperia Unlock",
  // Google / Android One
  "Google Pixel Unlock","Android One Unlock",
  // HTC
  "HTC Unlock","HTC Factory Unlock",
  // ZTE / Alcatel / TCL
  "ZTE Unlock","Alcatel Unlock","TCL Unlock",
  // OPPO / Realme / OnePlus / Vivo
  "OPPO Unlock","Realme Unlock","OnePlus Unlock","Vivo Unlock",
  // General Android
  "Android FRP Bypass","Android MDM Bypass","Android Unlock Generic",
];

const BRAND_TABS = [
  { label: "All",        cats: ANDROID_CATEGORIES },
  { label: "Samsung",   cats: ["Samsung Unlock","Samsung Factory Unlock","Samsung MDM Bypass","Samsung FRP Bypass","Samsung Network Unlock","Samsung Knox Bypass"] },
  { label: "Huawei",    cats: ["Huawei Unlock","Huawei NCK Unlock","Huawei FRP Bypass","Honor Unlock"] },
  { label: "Xiaomi",    cats: ["Xiaomi Unlock","Xiaomi Mi Unlock","Xiaomi Redmi Unlock","Xiaomi POCO Unlock","Xiaomi FRP Bypass"] },
  { label: "LG",        cats: ["LG Unlock","LG Factory Unlock","LG FRP Bypass"] },
  { label: "Motorola",  cats: ["Motorola Unlock","Motorola Factory Unlock","Moto G Unlock","Lenovo Unlock"] },
  { label: "Nokia",     cats: ["Nokia Unlock","Nokia Factory Unlock"] },
  { label: "OPPO+",     cats: ["OPPO Unlock","Realme Unlock","OnePlus Unlock","Vivo Unlock"] },
  { label: "FRP / MDM", cats: ["Android FRP Bypass","Android MDM Bypass","Android Unlock Generic","Samsung FRP Bypass","Xiaomi FRP Bypass","Huawei FRP Bypass","LG FRP Bypass"] },
];

const BRAND_COLOR: Record<string, string> = {
  Samsung: "bg-blue-100 text-blue-700",
  Huawei: "bg-red-100 text-red-700",
  Honor: "bg-red-100 text-red-700",
  Xiaomi: "bg-orange-100 text-orange-700",
  Redmi: "bg-orange-100 text-orange-700",
  POCO: "bg-orange-100 text-orange-700",
  LG: "bg-purple-100 text-purple-700",
  Motorola: "bg-indigo-100 text-indigo-700",
  Moto: "bg-indigo-100 text-indigo-700",
  Lenovo: "bg-indigo-100 text-indigo-700",
  Nokia: "bg-cyan-100 text-cyan-700",
  Sony: "bg-gray-200 text-gray-700",
  Google: "bg-green-100 text-green-700",
  HTC: "bg-pink-100 text-pink-700",
  ZTE: "bg-emerald-100 text-emerald-700",
  Alcatel: "bg-teal-100 text-teal-700",
  TCL: "bg-teal-100 text-teal-700",
  OPPO: "bg-rose-100 text-rose-700",
  Realme: "bg-yellow-100 text-yellow-700",
  OnePlus: "bg-red-100 text-red-700",
  Vivo: "bg-blue-100 text-blue-700",
};

function catColor(cat: string) {
  for (const [brand, cls] of Object.entries(BRAND_COLOR)) {
    if (cat.includes(brand)) return cls;
  }
  if (cat.toLowerCase().includes("frp") || cat.toLowerCase().includes("mdm")) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function AddButton({ product }: { product: { id: number; name: string; inStock: boolean } }) {
  const addToCart = useAddToCart();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  function handle(e: React.MouseEvent) {
    e.preventDefault();
    if (!product.inStock || adding || added) return;
    setAdding(true);
    addToCart.mutate({ data: { productId: product.id, quantity: 1 } }, {
      onSuccess: (cart) => {
        queryClient.setQueryData(getGetCartQueryKey(), cart);
        setAdding(false); setAdded(true);
        toast({ title: "Added!", description: product.name, duration: 1800 });
        setTimeout(() => setAdded(false), 2000);
      },
      onError: () => { setAdding(false); toast({ variant: "destructive", title: "Could not add" }); },
    });
  }

  return (
    <button onClick={handle} disabled={!product.inStock || adding}
      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
        added ? "bg-green-600 text-white" : adding ? "bg-gray-100" : "bg-green-600 text-white hover:bg-green-700"
      }`}>
      {adding ? <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        : added ? <Check size={14} strokeWidth={3} />
        : <ShoppingCart size={14} />}
    </button>
  );
}

export function AndroidUnlockPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading } = useListProducts({ limit: 1500 }, { query: { staleTime: 60_000 } as never });

  const allAndroid = useMemo(() =>
    (data?.products ?? []).filter(p => ANDROID_CATEGORIES.includes(p.categoryName ?? "")),
    [data]
  );

  const tabCats = BRAND_TABS[activeTab].cats;
  const tabFiltered = useMemo(() =>
    allAndroid.filter(p => tabCats.includes(p.categoryName ?? "")),
    [allAndroid, tabCats]
  );

  const searched = useMemo(() => {
    if (!search.trim()) return tabFiltered;
    const q = search.toLowerCase();
    return tabFiltered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.categoryName ?? "").toLowerCase().includes(q)
    );
  }, [tabFiltered, search]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof searched> = {};
    for (const p of searched) {
      const cat = p.categoryName ?? "Other";
      if (!g[cat]) g[cat] = [];
      g[cat].push(p);
    }
    return g;
  }, [searched]);

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-8">

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1b5e20 100%)" }} className="px-4 pt-5 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone size={18} className="text-green-300" />
          <h1 className="text-white font-black text-lg">Android Unlock</h1>
          <span className="ml-auto bg-green-500/20 border border-green-400/30 text-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {allAndroid.length > 0 ? `${allAndroid.length} Services` : "All Brands"}
          </span>
        </div>
        <p className="text-green-300/60 text-xs mb-4">
          Network unlock, FRP bypass &amp; MDM removal for Samsung, Huawei, Xiaomi, LG, Motorola &amp; more
        </p>

        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search brand, model, service…"
            className="w-full pl-9 pr-9 py-3 rounded-2xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400 shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Brand tabs */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {BRAND_TABS.map((tab, i) => (
            <button key={tab.label} onClick={() => { setActiveTab(i); setSearch(""); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                activeTab === i ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Device overview grid (shown when no search and "All" tab) */}
      {activeTab === 0 && !search && allAndroid.length === 0 && !isLoading && (
        <div className="px-4 pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Supported Brands</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { brand: "Samsung", emoji: "🔵" },
              { brand: "Huawei", emoji: "🔴" },
              { brand: "Xiaomi", emoji: "🟠" },
              { brand: "LG", emoji: "🟣" },
              { brand: "Motorola", emoji: "🔷" },
              { brand: "Nokia", emoji: "🔵" },
              { brand: "OPPO", emoji: "🔴" },
              { brand: "OnePlus", emoji: "🔴" },
              { brand: "Realme", emoji: "🟡" },
              { brand: "Vivo", emoji: "🔵" },
              { brand: "Sony", emoji: "⚫" },
              { brand: "Google Pixel", emoji: "🟢" },
            ].map(({ brand, emoji }) => (
              <div key={brand} className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
                <span className="text-2xl block mb-1">{emoji}</span>
                <p className="text-[10px] font-bold text-gray-700 leading-tight">{brand}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
            <p className="text-sm font-bold text-green-800 mb-1">Browse all Android unlock services</p>
            <p className="text-xs text-green-600">Select a brand tab above or search by model name</p>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-4 pt-3 space-y-5">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-border p-2">
                <Skeleton className="w-full aspect-square rounded-lg mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </div>
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 && (search || activeTab !== 0) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Smartphone size={44} className="text-gray-200" />
            <p className="font-bold text-gray-500">No services found</p>
            <p className="text-xs text-gray-400">Try selecting a different brand or check back later</p>
            {search && <button onClick={() => setSearch("")} className="text-green-600 text-sm font-bold">Clear search</button>}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, products]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${catColor(cat)}`}>
                    {cat.replace(" Unlock","").replace(" Bypass","").replace("Android ","")}
                  </span>
                  <p className="text-[11px] font-black text-gray-700">{cat}</p>
                </div>
                <span className="text-[10px] text-gray-400">{products.length} service{products.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.map(p => <ProductCard key={p.id} product={p} compact />)}
              </div>
            </div>
          ))
        )}

        {searched.length > 0 && (
          <p className="text-center text-[11px] text-gray-400 py-2">{searched.length} service{searched.length !== 1 ? "s" : ""} shown</p>
        )}
      </div>
    </div>
  );
}
