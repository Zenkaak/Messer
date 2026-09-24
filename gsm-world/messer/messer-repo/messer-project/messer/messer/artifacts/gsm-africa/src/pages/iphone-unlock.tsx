import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { Search, ShoppingCart, Smartphone, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";

const IPHONE_KEYWORDS = [
  "iphone", "ipad", "ios", "icloud", "apple",
  "t-mobile", "at&t", "sprint", "verizon",
  "ee uk", "o2 uk", "optus", "rogers",
  "a12", "a13", "a14", "a15", "a16", "a17",
  "iremoval", "hfz", "mina", "imei repair",
  "remote service",
];

const REGION_TABS = [
  { label: "All", keywords: IPHONE_KEYWORDS },
  { label: "USA", keywords: ["t-mobile", "at&t", "sprint", "verizon", "usa", " us ", "united states", "boost", "cricket", "metro by", "metro pcs", "tracfone", "straight talk", "xfinity", "visible", "us unlock", "tmobile", "american"] },
  { label: "UK", keywords: ["ee uk", "o2 uk", " uk"] },
  { label: "Australia", keywords: ["optus", "australia"] },
  { label: "Canada", keywords: ["rogers", "canada"] },
  { label: "iCloud", keywords: ["icloud", "activation lock", "fmi"] },
  { label: "A12+", keywords: ["a12", "a13", "a14", "a15", "hfz", "mina"] },
  { label: "Tools", keywords: ["iremoval", "tool", "activator"] },
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function regionBadge(cat: string) {
  const lower = cat.toLowerCase();
  if (lower.includes("usa") || lower.includes("sprint") || lower.includes("t-mobile") || lower.includes("at&t")) return "bg-red-100 text-red-700";
  if (lower.includes("uk") || lower.includes("ee") || lower.includes("o2")) return "bg-blue-100 text-blue-700";
  if (lower.includes("australia") || lower.includes("optus")) return "bg-green-100 text-green-700";
  if (lower.includes("canada") || lower.includes("rogers")) return "bg-orange-100 text-orange-700";
  if (lower.includes("icloud") || lower.includes("activation")) return "bg-purple-100 text-purple-700";
  if (lower.includes("a12") || lower.includes("hfz") || lower.includes("mina")) return "bg-gray-200 text-gray-700";
  return "bg-indigo-100 text-indigo-700";
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
        !product.inStock ? "bg-gray-100 text-gray-300" : "bg-indigo-600 text-white hover:bg-indigo-700"
      }`}
      title={product.inStock ? "View & Order" : "Out of stock"}>
      <ShoppingCart size={14} />
    </button>
  );
}

export function IphoneUnlockPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading } = useListProducts({ limit: 2000 }, { query: { staleTime: 60_000 } as never });

  const allIphone = useMemo(() => {
    const allProducts = data?.products ?? [];
    return allProducts.filter(p => {
      const text = `${p.categoryName ?? ""} ${p.name ?? ""}`;
      return matchesKeywords(text, IPHONE_KEYWORDS);
    });
  }, [data]);

  const tabFiltered = useMemo(() => {
    if (activeTab === 0) return allIphone;
    const keywords = REGION_TABS[activeTab].keywords;
    return allIphone.filter(p => {
      const text = `${p.categoryName ?? ""} ${p.name ?? ""}`;
      return matchesKeywords(text, keywords);
    });
  }, [allIphone, activeTab]);

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
      <div style={{ background: "linear-gradient(135deg,#1a1a2e 0%,#3b1f6e 100%)" }} className="px-4 pt-5 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone size={18} className="text-purple-300" />
          <h1 className="text-white font-black text-lg">iPhone / iCloud Unlock</h1>
          <span className="ml-auto bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {isLoading ? "Loading…" : `${allIphone.length} Services`}
          </span>
        </div>
        <p className="text-purple-300/60 text-xs mb-4">
          Official carrier unlocks, iCloud bypass &amp; A12+ solutions for all iPhone &amp; iPad models
        </p>

        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search iPhone model, carrier, country…"
            className="w-full pl-9 pr-9 py-3 rounded-2xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Region tabs */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {REGION_TABS.map((tab, i) => (
            <button key={tab.label} onClick={() => { setActiveTab(i); setSearch(""); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                activeTab === i ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
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
            <p className="text-xs text-gray-400">Try a different region tab or search term</p>
            {search && <button onClick={() => setSearch("")} className="text-indigo-600 text-sm font-bold">Clear search</button>}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, products]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${regionBadge(cat)}`}>
                    {cat.replace(/^iPhone Unlock /i, "").replace(/^iCloud /i, "")}
                  </span>
                  <p className="text-[11px] font-black text-gray-700 truncate max-w-[180px]">{cat}</p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{products.length} services</span>
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
