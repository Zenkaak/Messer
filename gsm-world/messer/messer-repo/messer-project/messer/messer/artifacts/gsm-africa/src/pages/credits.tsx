import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useAuth } from "@/hooks/use-auth";
import { ShoppingCart, Wallet, Plus, ChevronRight, Zap, Server, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/product-card";

const SERVER_KEYWORDS = [
  "tool","credit","server","paid tool","activation","software","license",
  "dongle","repair software","nc auth","bmt","adam","miracle","umt","chimera",
];

function isServerProduct(name: string, cat: string) {
  const h = `${name} ${cat}`.toLowerCase();
  return SERVER_KEYWORDS.some((k) => h.includes(k));
}

const TOOL_TABS = [
  "All",
  "Ultra Tool",
  "Multiunlock Tool",
  "Xiaomi",
  "iRemoval",
  "NC Auth",
  "BMT Pro",
  "Samsung",
  "iPhone / iCloud",
  "FRP Bypass",
  "Huawei",
  "Motorola",
  "IMEI Services",
  "Dongle & Tools",
  "Repair Software",
];

// Keyword groups for each tab (matches against name + categoryName)
const TAB_KEYWORDS: Record<string, string[]> = {
  "Ultra Tool":        ["ultra tool", "ultra"],
  "Multiunlock Tool":  ["multiunlock"],
  "Xiaomi":            ["xiaomi", "xrt", "miflash", "xyno"],
  "iRemoval":          ["iremoval", "icloud bypass", "hfz", "lpro", "a12+"],
  "NC Auth":           ["nc auth"],
  "BMT Pro":           ["bmt"],
  "Samsung":           ["samsung"],
  "iPhone / iCloud":   ["iphone", "ipad", "ios"],
  "FRP Bypass":        ["frp"],
  "Huawei":            ["huawei", "honor"],
  "Motorola":          ["motorola", "moto"],
  "IMEI Services":     ["imei", "blacklist"],
  "Dongle & Tools":    ["dongle", "infinity", "cm2", "z3x", "sigma", "octoplus", "umt", "miracle", "riff", "medusa", "ufi", "mrt", "eft"],
  "Repair Software":   ["software", "license", "repair", "flash", "schematic"],
};

function CreditCard({ product }: { product: { id: number; name: string; price: number; categoryName?: string | null; imageUrl: string; inStock: boolean } }) {
  const [, navigate] = useLocation();

  function handleBuy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/products/${product.id}`);
  }

  return (
    <Link href={`/products/${product.id}`}>
      <div className="bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shrink-0 overflow-hidden">
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-1"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-gray-800 line-clamp-1">{product.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="bg-orange-100 text-orange-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">Server</span>
            <span className="text-[11px] font-black text-blue-600">${product.price.toFixed(2)}</span>
          </div>
        </div>
        <button
          onClick={handleBuy}
          disabled={!product.inStock}
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            product.inStock ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-300"
          }`}
          title={product.inStock ? "View & Order" : "Out of stock"}
        >
          <ShoppingCart size={15} />
        </button>
      </div>
    </Link>
  );
}

export function CreditsPage() {
  const { isAuthenticated } = useAuth();
  const { data: balance = 0 } = useWalletBalance();
  const [activeTab, setActiveTab] = useState("All");

  const { data, isLoading } = useListProducts(
    { limit: 300 },
    { query: { staleTime: 60_000 } as never }
  );

  const serverProducts = (data?.products ?? []).filter((p) =>
    isServerProduct(p.name, p.categoryName ?? "")
  );

  const filtered = activeTab === "All"
    ? serverProducts
    : serverProducts.filter((p) => {
        const keywords = TAB_KEYWORDS[activeTab];
        if (!keywords) return false;
        const haystack = `${p.name} ${p.categoryName ?? ""}`.toLowerCase();
        return keywords.some((kw) => haystack.includes(kw));
      });

  const grouped: Record<string, typeof serverProducts> = {};
  if (activeTab === "All") {
    for (const p of serverProducts) {
      // Group by matching tab keyword, fallback to categoryName or "Other"
      let groupName = p.categoryName ?? "Other";
      for (const [tab, keywords] of Object.entries(TAB_KEYWORDS)) {
        const h = `${p.name} ${p.categoryName ?? ""}`.toLowerCase();
        if (keywords.some((kw) => h.includes(kw))) { groupName = tab; break; }
      }
      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push(p);
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-8">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#1a2332 0%,#7c3a00 100%)" }} className="px-4 pt-5 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <Server size={18} className="text-orange-300" />
          <h1 className="text-white font-black text-lg">Server Credits</h1>
        </div>
        <p className="text-orange-200/70 text-xs mb-5">
          Purchase credits for server tools — Xiaomi, Ultra, Multiunlock, BMT &amp; more
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white/10 border border-white/15 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Wallet size={13} className="text-orange-300" />
              <p className="text-orange-300/70 text-[10px] font-semibold uppercase tracking-widest">Wallet</p>
            </div>
            <p className="text-white font-black text-xl leading-none">
              {isAuthenticated ? `$${balance.toFixed(2)}` : "—"}
            </p>
            <p className="text-white/40 text-[10px] mt-0.5">Available balance</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/account/add-fund">
              <div className="bg-orange-500/80 hover:bg-orange-500 border border-orange-400/30 rounded-xl p-2.5 flex items-center gap-2 transition-colors">
                <Plus size={14} className="text-white shrink-0" />
                <span className="text-white font-bold text-xs">Add Funds</span>
              </div>
            </Link>
            <Link href="/activate">
              <div className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-2.5 flex items-center gap-2 transition-colors">
                <Zap size={14} className="text-orange-300 shrink-0" />
                <span className="text-white font-bold text-xs">Activate Tool</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        {[
          { label: "Products", value: serverProducts.length.toString(), icon: <Star size={14} className="text-orange-500" /> },
          { label: "Categories", value: Object.keys(grouped).length || TOOL_TABS.length - 1, icon: <Server size={14} className="text-blue-500" /> },
          { label: "Instant", value: "24/7", icon: <Zap size={14} className="text-green-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-2.5 text-center shadow-sm">
            <div className="flex justify-center mb-1">{icon}</div>
            <p className="font-black text-gray-800 text-sm">{value}</p>
            <p className="text-[9px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ───────────────────────────────────────────────────── */}
      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TOOL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                activeTab === tab
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product list ──────────────────────────────────────────────────── */}
      <div className="px-4 space-y-4">
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
        ) : activeTab === "All" ? (
          Object.entries(grouped).map(([cat, products]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{cat}</p>
                <button onClick={() => setActiveTab(cat)} className="text-orange-600 text-[11px] font-semibold flex items-center gap-0.5">
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} compact />)}
              </div>
            </div>
          ))
        ) : (
          <>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <Server size={40} className="text-gray-200" />
                <p className="font-semibold">No credits found for this tool</p>
                <button onClick={() => setActiveTab("All")} className="text-orange-600 text-sm font-bold">View all credits</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filtered.map((p) => <ProductCard key={p.id} product={p} compact />)}
              </div>
            )}
          </>
        )}
      </div>

      {!isAuthenticated && (
        <div className="mx-4 mt-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <p className="text-orange-800 text-sm font-semibold mb-2">Sign in to purchase credits</p>
          <Link href="/login">
            <button className="bg-orange-600 text-white text-sm font-bold px-5 py-2 rounded-xl">Sign In</button>
          </Link>
        </div>
      )}
    </div>
  );
}
