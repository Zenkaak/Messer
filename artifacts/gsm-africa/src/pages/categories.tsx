import { useListCategories } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ChevronRight, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

function getCategoryIcon(slug: string): { emoji: string; bg: string } {
  const s = slug.toLowerCase();
  if (s.includes("icloud") || s.includes("iremoval") || s.includes("mina") || s.includes("hfz") || s.includes("smd") || s.includes("ipad") || s.includes("a12")) return { emoji: "🍎", bg: "bg-gray-100" };
  if (s.includes("iphone")) return { emoji: "📱", bg: "bg-gray-100" };
  if (s.includes("samsung") || s.includes("samstool") || s.includes("z3x")) return { emoji: "🔵", bg: "bg-blue-50" };
  if (s.includes("huawei") || s.includes("hw-key")) return { emoji: "📡", bg: "bg-red-50" };
  if (s.includes("xiaomi") || s.includes("mi-auth") || s.includes("miflash")) return { emoji: "🟠", bg: "bg-orange-50" };
  if (s.includes("frp") || s.includes("android") || s.includes("google-account")) return { emoji: "🔓", bg: "bg-green-50" };
  if (s.includes("imei")) return { emoji: "🔍", bg: "bg-purple-50" };
  if (s.includes("network") || s.includes("unlock")) return { emoji: "📶", bg: "bg-indigo-50" };
  if (s.includes("server") || s.includes("credit") || s.includes("activation")) return { emoji: "⚡", bg: "bg-yellow-50" };
  if (s.includes("tool") || s.includes("auth") || s.includes("dongle") || s.includes("software")) return { emoji: "🔧", bg: "bg-slate-100" };
  if (s.includes("remote")) return { emoji: "🌐", bg: "bg-cyan-50" };
  if (s.includes("oppo") || s.includes("realme")) return { emoji: "🟢", bg: "bg-green-50" };
  if (s.includes("oneplus")) return { emoji: "🔴", bg: "bg-red-50" };
  if (s.includes("nokia")) return { emoji: "🔷", bg: "bg-blue-50" };
  if (s.includes("sony")) return { emoji: "🎵", bg: "bg-slate-100" };
  if (s.includes("motorola")) return { emoji: "〽️", bg: "bg-blue-50" };
  if (s.includes("amazon")) return { emoji: "📦", bg: "bg-orange-50" };
  if (s.includes("playstation")) return { emoji: "🎮", bg: "bg-blue-50" };
  if (s.includes("ebay")) return { emoji: "🛒", bg: "bg-yellow-50" };
  if (s.includes("binance")) return { emoji: "💰", bg: "bg-yellow-50" };
  if (s.includes("microsoft")) return { emoji: "🪟", bg: "bg-blue-50" };
  if (s.includes("capcut")) return { emoji: "🎬", bg: "bg-slate-100" };
  if (s.includes("jtag") || s.includes("isp")) return { emoji: "🔌", bg: "bg-gray-100" };
  if (s.includes("pattern") || s.includes("pin") || s.includes("mdm")) return { emoji: "🔐", bg: "bg-green-50" };
  if (s.includes("bootloader")) return { emoji: "⚙️", bg: "bg-slate-100" };
  if (s.includes("flash") || s.includes("rom")) return { emoji: "💾", bg: "bg-purple-50" };
  if (s.includes("schematic") || s.includes("jcid") || s.includes("wuxinji")) return { emoji: "📐", bg: "bg-teal-50" };
  if (s.includes("esim")) return { emoji: "📲", bg: "bg-cyan-50" };
  if (s.includes("best-seller")) return { emoji: "🏆", bg: "bg-yellow-50" };
  if (s.includes("new-arrival") || s.includes("trending")) return { emoji: "✨", bg: "bg-pink-50" };
  if (s.includes("special") || s.includes("offer")) return { emoji: "🎁", bg: "bg-red-50" };
  return { emoji: "📱", bg: "bg-teal-50" };
}

export function CategoriesPage() {
  const { data: categories, isLoading } = useListCategories();
  const [search, setSearch] = useState("");

  const withProducts = categories?.filter(c =>
    c.productCount > 0 &&
    !c.name.toLowerCase().includes("gift") &&
    !(c.slug ?? "").toLowerCase().includes("gift")
  ) ?? [];
  const filtered = search.trim()
    ? withProducts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : withProducts;

  const totalProducts = withProducts.reduce((s, c) => s + c.productCount, 0);

  return (
    <div className="flex flex-col min-h-full pb-6 bg-gray-50">
      <div className="bg-gradient-to-br from-[#0f1922] via-[#1a2332] to-[#1e3a5f] px-5 pt-6 pb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-5 pointer-events-none"
          style={{ background: "radial-gradient(circle, #60a5fa 0%, transparent 70%)", transform: "translate(30%,-30%)" }} />
        <p className="text-blue-400/70 text-[11px] font-bold uppercase tracking-widest mb-1 relative z-10">Browse by</p>
        <h1 className="text-2xl font-black text-white mb-1 relative z-10">All Categories</h1>
        <p className="text-gray-400 text-sm relative z-10">
          {isLoading ? "Loading…" : `${withProducts.length} categories · ${totalProducts.toLocaleString()} products`}
        </p>
      </div>

      <div className="-mt-6 px-4 relative z-20 mb-4">
        <div className="relative shadow-lg rounded-2xl">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
              <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-bold text-gray-600 mb-1">No categories found</p>
            {search && (
              <button onClick={() => setSearch("")} className="text-blue-600 text-sm mt-2 font-semibold underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          filtered.map((category) => {
            const { emoji, bg } = getCategoryIcon(category.slug);
            return (
              <Link
                key={category.id}
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all group"
              >
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0 text-xl group-hover:scale-110 transition-transform`}>
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm leading-snug truncate">{category.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-blue-50 text-blue-700 text-xs font-black px-2.5 py-1 rounded-full border border-blue-100">
                    {category.productCount}
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}
