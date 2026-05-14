import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListProducts, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, ShoppingCart, Check, Cpu, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const IMEI_CATEGORIES = [
  "IMEI Check & Info",
  "IMEI Repair",
  "IMEI Blacklist Removal",
  "Honor FRP Unlock Key SN IMEI",
  "Samsung FRP By IMEI/SN",
  "IMEI Services",
];

const SERVICE_TABS = [
  { label: "All",              cats: IMEI_CATEGORIES },
  { label: "Check & Info",     cats: ["IMEI Check & Info"] },
  { label: "Blacklist Removal",cats: ["IMEI Blacklist Removal"] },
  { label: "IMEI Repair",      cats: ["IMEI Repair"] },
  { label: "FRP by IMEI",      cats: ["Honor FRP Unlock Key SN IMEI","Samsung FRP By IMEI/SN"] },
];

function typeColor(cat: string) {
  if (cat.includes("Check")) return "bg-blue-100 text-blue-700";
  if (cat.includes("Blacklist")) return "bg-red-100 text-red-700";
  if (cat.includes("Repair")) return "bg-orange-100 text-orange-700";
  if (cat.includes("FRP")) return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-600";
}

function typeLabel(cat: string) {
  if (cat.includes("Check")) return "CHECK";
  if (cat.includes("Blacklist")) return "UNBLACKLIST";
  if (cat.includes("Repair")) return "REPAIR";
  if (cat.includes("FRP")) return "FRP";
  return "IMEI";
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
        added ? "bg-green-600 text-white" : adding ? "bg-gray-100" : "bg-teal-600 text-white hover:bg-teal-700"
      }`}>
      {adding ? <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        : added ? <Check size={14} strokeWidth={3} />
        : <ShoppingCart size={14} />}
    </button>
  );
}

export function ImeiPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading } = useListProducts({ limit: 1500 }, { query: { staleTime: 60_000 } as never });

  const allImei = useMemo(() =>
    (data?.products ?? []).filter(p => IMEI_CATEGORIES.includes(p.categoryName ?? "")),
    [data]
  );

  const tabCats = SERVICE_TABS[activeTab].cats;
  const tabFiltered = useMemo(() =>
    allImei.filter(p => tabCats.includes(p.categoryName ?? "")),
    [allImei, tabCats]
  );

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
      <div style={{ background: "linear-gradient(135deg,#0d2e2e 0%,#0f5f5f 100%)" }} className="px-4 pt-5 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Cpu size={18} className="text-teal-300" />
          <h1 className="text-white font-black text-lg">IMEI Services</h1>
          <span className="ml-auto bg-teal-500/20 border border-teal-400/30 text-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {allImei.length} Services
          </span>
        </div>
        <p className="text-teal-300/60 text-xs mb-4">
          IMEI check, blacklist removal, IMEI repair &amp; FRP unlock by IMEI/SN for all devices
        </p>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search device or service type…"
            className="w-full pl-9 pr-9 py-3 rounded-2xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Service type tabs */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SERVICE_TABS.map((tab, i) => (
            <button key={tab.label} onClick={() => { setActiveTab(i); setSearch(""); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                activeTab === i ? "bg-teal-700 text-white border-teal-700" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="px-4 pt-3 space-y-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Cpu size={44} className="text-gray-200" />
            <p className="font-bold text-gray-500">No services found</p>
            {search && <button onClick={() => setSearch("")} className="text-teal-600 text-sm font-bold">Clear search</button>}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, products]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-black text-gray-700">{cat}</p>
                <span className="text-[10px] text-gray-400">{products.length} services</span>
              </div>
              <div className="space-y-2">
                {products.map(p => (
                  <Link href={`/products/${p.id}`} key={p.id}>
                    <div className="bg-white border border-gray-100 rounded-2xl px-3.5 py-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 to-teal-900 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={p.imageUrl ?? undefined} alt={p.name} className="w-full h-full object-contain p-1"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-gray-800 line-clamp-2 leading-snug">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${typeColor(cat)}`}>
                            {typeLabel(cat)}
                          </span>
                          <span className="text-[11px] font-black text-teal-700">${p.price.toFixed(2)}</span>
                          {!p.inStock && <span className="text-[9px] text-red-500 font-bold">Out of stock</span>}
                        </div>
                      </div>
                      <AddButton product={p} />
                    </div>
                  </Link>
                ))}
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
