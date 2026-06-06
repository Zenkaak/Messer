import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { Search, ShoppingCart, ChevronRight, Shield, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";

const FRP_KEYWORDS = [
  "frp", "google account", "bypass", "factory reset protection",
  "samsung frp", "huawei frp", "xiaomi frp", "samsung account",
  "mi account", "frptoolpro", "fcktool", "xrt", "samstool",
  "z3x", "huawei id", "oppo services", "oneplus services",
];

const BRAND_TABS = [
  { label: "All", keywords: FRP_KEYWORDS },
  { label: "Samsung", keywords: ["samsung frp", "samsung account", "samsung unlock", "z3x", "samstool"] },
  { label: "Huawei", keywords: ["huawei frp", "huawei id", "huawei unlock"] },
  { label: "Xiaomi", keywords: ["xiaomi frp", "mi account", "fcktool", "xrt", "xiaomi repair"] },
  { label: "Oppo/OnePlus", keywords: ["oppo services", "oneplus services"] },
  { label: "Android", keywords: ["android 11", "android 12", "android 13", "android 14", "bypass android"] },
  { label: "Tools", keywords: ["frptoolpro", "tool"] },
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function catColor(cat: string) {
  const lower = cat.toLowerCase();
  if (lower.includes("samsung")) return "bg-blue-100 text-blue-700";
  if (lower.includes("huawei")) return "bg-red-100 text-red-700";
  if (lower.includes("xiaomi") || lower.includes("redmi")) return "bg-orange-100 text-orange-700";
  if (lower.includes("oppo") || lower.includes("oneplus")) return "bg-rose-100 text-rose-700";
  if (lower.includes("android")) return "bg-green-100 text-green-700";
  if (lower.includes("tool") || lower.includes("z3x")) return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function AddButton({ product }: { product: { id: number; name: string; inStock: boolean } }) {
  const [, navigate] = useLocation();

  function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/products/${product.id}`);
  }

  return (
    <button onClick={handle} disabled={!product.inStock}
      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
        !product.inStock ? "bg-gray-100 text-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
      title={product.inStock ? "View & Order" : "Out of stock"}>
      <ShoppingCart size={14} />
    </button>
  );
}

export function FrpPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading } = useListProducts({ limit: 2000 }, { query: { staleTime: 60_000 } as never });

  const allFrp = useMemo(() => {
    const allProducts = data?.products ?? [];
    return allProducts.filter(p => {
      const text = `${p.categoryName ?? ""} ${p.name ?? ""}`;
      return matchesKeywords(text, FRP_KEYWORDS);
    });
  }, [data]);

  const tabFiltered = useMemo(() => {
    if (activeTab === 0) return allFrp;
    const keywords = BRAND_TABS[activeTab].keywords;
    return allFrp.filter(p => {
      const text = `${p.categoryName ?? ""} ${p.name ?? ""}`;
      return matchesKeywords(text, keywords);
    });
  }, [allFrp, activeTab]);

  const searched = useMemo(() => {
    if (!search.trim()) return tabFiltered;
    const q = search.toLowerCase();
    return tabFiltered.filter(p =>
      p.name.toLowerCase().includes(q) || (p.categoryName ?? "").toLowerCase().includes(q)
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
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#1a5276 100%)" }} className="px-4 pt-5 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={18} className="text-blue-300" />
          <h1 className="text-white font-black text-lg">FRP Bypass</h1>
          <span className="ml-auto bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {isLoading ? "Loading…" : `${allFrp.length} Services`}
          </span>
        </div>
        <p className="text-blue-300/60 text-xs mb-4">
          Google account bypass &amp; FRP unlock for Samsung, Huawei, Xiaomi, Oppo &amp; more
        </p>

        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search device or service…"
            className="w-full pl-9 pr-9 py-3 rounded-2xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
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
                activeTab === i ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
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
            <Shield size={44} className="text-gray-200" />
            <p className="font-bold text-gray-500">No services found</p>
            <p className="text-xs text-gray-400">Try a different brand tab or search term</p>
            {search && <button onClick={() => setSearch("")} className="text-blue-600 text-sm font-bold">Clear search</button>}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, products]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${catColor(cat)}`}>
                    {cat.replace(/ FRP Remove$/i, "").replace(/ Bypass$/i, "")}
                  </span>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{cat}</p>
                </div>
                <span className="text-[10px] text-gray-400">{products.length} services</span>
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
