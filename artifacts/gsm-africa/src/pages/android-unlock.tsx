import { useState, useMemo } from "react";
import { useListProducts } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingCart, Check, Smartphone, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";

const ANDROID_KEYWORDS = [
  "samsung", "huawei", "honor", "xiaomi", "redmi", "poco",
  "lg", "motorola", "moto", "lenovo", "nokia", "sony", "xperia",
  "google pixel", "pixel", "android one", "htc",
  "zte", "alcatel", "tcl", "oppo", "realme", "oneplus", "vivo",
  "android frp", "android mdm", "android unlock", "frp bypass",
  "mdm bypass", "frp remove", "network unlock",
];

const BRAND_TABS = [
  { label: "All", keywords: ANDROID_KEYWORDS },
  { label: "Samsung", keywords: ["samsung"] },
  { label: "Huawei", keywords: ["huawei", "honor"] },
  { label: "Xiaomi", keywords: ["xiaomi", "redmi", "poco"] },
  { label: "LG", keywords: ["lg unlock", "lg factory", "lg frp"] },
  { label: "Motorola", keywords: ["motorola", "moto g", "lenovo"] },
  { label: "Nokia", keywords: ["nokia"] },
  { label: "OPPO+", keywords: ["oppo", "realme", "oneplus", "vivo"] },
  { label: "FRP / MDM", keywords: ["frp", "mdm", "bypass"] },
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function catColor(cat: string) {
  const lower = cat.toLowerCase();
  if (lower.includes("samsung")) return "bg-blue-100 text-blue-700";
  if (lower.includes("huawei") || lower.includes("honor")) return "bg-red-100 text-red-700";
  if (lower.includes("xiaomi") || lower.includes("redmi") || lower.includes("poco")) return "bg-orange-100 text-orange-700";
  if (lower.includes("lg")) return "bg-purple-100 text-purple-700";
  if (lower.includes("motorola") || lower.includes("moto") || lower.includes("lenovo")) return "bg-indigo-100 text-indigo-700";
  if (lower.includes("nokia")) return "bg-cyan-100 text-cyan-700";
  if (lower.includes("sony") || lower.includes("xperia")) return "bg-gray-200 text-gray-700";
  if (lower.includes("google") || lower.includes("pixel")) return "bg-green-100 text-green-700";
  if (lower.includes("zte") || lower.includes("alcatel") || lower.includes("tcl")) return "bg-teal-100 text-teal-700";
  if (lower.includes("oppo") || lower.includes("realme")) return "bg-rose-100 text-rose-700";
  if (lower.includes("oneplus")) return "bg-red-100 text-red-700";
  if (lower.includes("vivo")) return "bg-blue-100 text-blue-700";
  if (lower.includes("frp") || lower.includes("mdm")) return "bg-amber-100 text-amber-700";
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

  const { data, isLoading } = useListProducts({ limit: 2000 }, { query: { staleTime: 60_000 } as never });

  const allAndroid = useMemo(() => {
    const allProducts = data?.products ?? [];
    return allProducts.filter(p => {
      const cat = (p.categoryName ?? "").toLowerCase();
      const name = (p.name ?? "").toLowerCase();
      return matchesKeywords(cat, ANDROID_KEYWORDS) || matchesKeywords(name, ["unlock", "frp", "mdm", "bypass"]);
    });
  }, [data]);

  const tabFiltered = useMemo(() => {
    if (activeTab === 0) return allAndroid;
    const keywords = BRAND_TABS[activeTab].keywords;
    return allAndroid.filter(p => {
      const text = `${p.categoryName ?? ""} ${p.name ?? ""}`;
      return matchesKeywords(text, keywords);
    });
  }, [allAndroid, activeTab]);

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
            {isLoading ? "Loading…" : `${allAndroid.length} Services`}
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
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Smartphone size={44} className="text-gray-200" />
            <p className="font-bold text-gray-500">No services found</p>
            <p className="text-xs text-gray-400">Try a different brand tab or search term</p>
            {search && <button onClick={() => setSearch("")} className="text-green-600 text-sm font-bold">Clear search</button>}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, products]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${catColor(cat)}`}>
                    {cat.replace(/ Unlock$/i, "").replace(/ Bypass$/i, "").replace(/^Android /i, "")}
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
