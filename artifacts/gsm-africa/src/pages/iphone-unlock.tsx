import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListProducts, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, ShoppingCart, Check, Smartphone, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";

const IPHONE_CATEGORIES = [
  "iPhone Unlock T-Mobile USA","iPhone Unlock AT&T USA","USA Sprint Clean Unlock",
  "iPhone Unlock EE UK","iPhone Unlock O2 UK",
  "iPhone Unlock Optus Australia",
  "iPhone Unlock Rogers Canada",
  "iCloud Activation Lock","iCloud Bypass With Network iPhone 5s–X iOS12/17","iCloud Full Unlock",
  "A12+ Offer Service iPhones / iPads","Hfz Activator A12+ Windows iPhone","Mina A12+ Bypass No Signal",
  "iRemoval Pro Tools","iRemoval Pro V5.0 iPads Wi-Fi & Cellular",
  "IMEI Repair","Remote Services",
];

const REGION_TABS = [
  { label: "All",       cats: IPHONE_CATEGORIES },
  { label: "USA",       cats: ["iPhone Unlock T-Mobile USA","iPhone Unlock AT&T USA","USA Sprint Clean Unlock"] },
  { label: "UK",        cats: ["iPhone Unlock EE UK","iPhone Unlock O2 UK"] },
  { label: "Australia", cats: ["iPhone Unlock Optus Australia"] },
  { label: "Canada",    cats: ["iPhone Unlock Rogers Canada"] },
  { label: "iCloud",    cats: ["iCloud Activation Lock","iCloud Bypass With Network iPhone 5s–X iOS12/17","iCloud Full Unlock"] },
  { label: "A12+",      cats: ["A12+ Offer Service iPhones / iPads","Hfz Activator A12+ Windows iPhone","Mina A12+ Bypass No Signal"] },
  { label: "Tools",     cats: ["iRemoval Pro Tools","iRemoval Pro V5.0 iPads Wi-Fi & Cellular"] },
];

function regionBadge(cat: string) {
  if (cat.includes("USA") || cat.includes("Sprint")) return "bg-red-100 text-red-700";
  if (cat.includes("UK")) return "bg-blue-100 text-blue-700";
  if (cat.includes("Australia")) return "bg-green-100 text-green-700";
  if (cat.includes("Canada")) return "bg-orange-100 text-orange-700";
  if (cat.toLowerCase().includes("icloud")) return "bg-purple-100 text-purple-700";
  if (cat.includes("A12+") || cat.includes("Hfz") || cat.includes("Mina")) return "bg-gray-200 text-gray-700";
  return "bg-indigo-100 text-indigo-700";
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
        added ? "bg-green-600 text-white" : adding ? "bg-gray-100" : "bg-indigo-600 text-white hover:bg-indigo-700"
      }`}>
      {adding ? <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        : added ? <Check size={14} strokeWidth={3} />
        : <ShoppingCart size={14} />}
    </button>
  );
}

export function IphoneUnlockPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading } = useListProducts({ limit: 1500 }, { query: { staleTime: 60_000 } as never });

  const allIphone = useMemo(() =>
    (data?.products ?? []).filter(p => IPHONE_CATEGORIES.includes(p.categoryName ?? "")),
    [data]
  );

  const tabCats = REGION_TABS[activeTab].cats;
  const tabFiltered = useMemo(() =>
    allIphone.filter(p => tabCats.includes(p.categoryName ?? "")),
    [allIphone, tabCats]
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
      <div style={{ background: "linear-gradient(135deg,#1a1a2e 0%,#3b1f6e 100%)" }} className="px-4 pt-5 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone size={18} className="text-purple-300" />
          <h1 className="text-white font-black text-lg">iPhone / iCloud Unlock</h1>
          <span className="ml-auto bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {allIphone.length} Services
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
            {search && <button onClick={() => setSearch("")} className="text-indigo-600 text-sm font-bold">Clear search</button>}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, products]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-black text-gray-700">{cat}</p>
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
