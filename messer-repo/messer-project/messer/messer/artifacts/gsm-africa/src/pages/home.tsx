import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Zap, ShieldCheck, Headphones, Globe, ArrowRight, Star, Package, Users, Clock, Search } from "lucide-react";
import { useListCategories, useListProducts } from "@workspace/api-client-react";

export function Home() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: categoriesData } = useListCategories();

  // Fetch real product total directly — summing category productCounts misses
  // products that have no category assigned, causing an undercount.
  const { data: productTotalData } = useListProducts({ limit: 1, page: 1 });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/products?search=${encodeURIComponent(q)}`);
  }

  const totalProducts = productTotalData?.total ?? null;
  const totalCategories = categoriesData
    ? categoriesData.filter((c) => c.productCount > 0).length
    : null;

  const productStat = totalProducts ? `${totalProducts.toLocaleString()}+` : "1,500+";
  const categoryStat = totalCategories ? `${totalCategories}+` : "50+";

  return (
    <div className="flex flex-col bg-white">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center justify-center text-center overflow-hidden px-6"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, #1e3a5f 0%, #1a2332 55%, #0f1922 100%)",
          minHeight: 260,
          paddingTop: 52,
          paddingBottom: 52,
        }}
      >
        {/* glow rings */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div style={{ width: 420, height: 420, borderRadius: "50%", background: "rgba(59,130,246,0.06)", position: "absolute" }} />
          <div style={{ width: 260, height: 260, borderRadius: "50%", background: "rgba(59,130,246,0.08)", position: "absolute" }} />
        </div>

        {/* badge */}
        <div className="relative z-10 inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 rounded-full px-3 py-1 mb-4">
          <Star size={11} className="text-blue-300 fill-blue-300" />
          <span className="text-blue-200 text-[11px] font-semibold tracking-wide">Trusted Since 2016</span>
        </div>

        <p className="relative z-10 text-blue-300 text-sm font-medium tracking-wider uppercase mb-1">Welcome to</p>
        <h1 className="relative z-10 text-white font-black leading-tight mb-3" style={{ fontSize: 32 }}>
          GSM World
        </h1>
        <p className="relative z-10 text-blue-200/70 text-sm font-normal mb-6 max-w-xs">
          Your worldwide source for unlock tools, server credits &amp; GSM services
        </p>

        <div className="relative z-10 flex gap-3">
          <Link href="/products">
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-900/40">
              Browse Store <ArrowRight size={14} />
            </button>
          </Link>
          <Link href="/categories">
            <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors">
              Categories
            </button>
          </Link>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="relative z-10 mt-5 w-full max-w-sm">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products, e.g. iPhone 15, Samsung..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl border-0 text-sm text-gray-900 bg-white/95 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button type="submit" className="absolute right-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors">Search</button>
          </div>
        </form>
      </div>

      {/* ── App download banner ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-teal-700 to-blue-800 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <line x1="12" y1="18" x2="12" y2="18.01"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-[12px] leading-tight">Get the GSM World App</p>
          <p className="text-teal-200/70 text-[10px]">Free Android APK — faster access, push alerts</p>
        </div>
        <a
          href="https://github.com/Zenkaak/Messer/releases/latest/download/app-release.apk"
          target="_blank"
          rel="noreferrer"
          className="bg-white text-teal-800 font-black text-[11px] px-3 py-1.5 rounded-xl shrink-0 hover:bg-teal-50 transition-colors"
        >
          Download
        </a>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 bg-[#1a2332]">
        {[
          { value: productStat,    label: "Products" },
          { value: categoryStat,   label: "Categories" },
          { value: "24/7",         label: "Support" },
        ].map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center py-3 border-r border-white/10 last:border-r-0">
            <span className="text-white font-black text-lg leading-none">{value}</span>
            <span className="text-blue-300/70 text-[10px] font-medium mt-0.5 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {/* ── About section ────────────────────────────────────────────────── */}
      <div className="px-5 py-7 text-center space-y-4 max-w-2xl mx-auto w-full">
        <h2 className="font-black leading-snug" style={{ color: "#1565c0", fontSize: 17 }}>
          Worldwide Source for Unlock Tools, Server Activation &amp; GSM Software
        </h2>
        <p className="text-gray-600 leading-relaxed text-[13.5px]">
          GSM World is a trusted worldwide supplier of{" "}
          <Link href="/products" className="font-semibold hover:underline" style={{ color: "#009688" }}>digital activation</Link>,{" "}
          <Link href="/products" className="font-semibold hover:underline" style={{ color: "#1e88e5" }}>server credits</Link>,{" "}
          <Link href="/categories" className="font-semibold hover:underline" style={{ color: "#43a047" }}>IMEI services</Link>,{" "}
          <Link href="/products" className="font-semibold hover:underline" style={{ color: "#f57c00" }}>software licenses</Link>,{" "}
          <Link href="/products" className="font-semibold hover:underline" style={{ color: "#8e24aa" }}>subscriptions</Link>,{" "}
          <Link href="/products" className="font-semibold hover:underline" style={{ color: "#e53935" }}>gift cards</Link> and{" "}
          <Link href="/products" className="font-semibold hover:underline" style={{ color: "#009688" }}>online GSM tools</Link>.
        </p>
        <p className="text-gray-600 leading-relaxed text-[13.5px]">
          Official distributor for major tool teams — delivering{" "}
          <span className="font-semibold text-teal-600">instant</span>,{" "}
          <span className="font-semibold text-blue-600">secure</span> and{" "}
          <span className="font-semibold text-orange-600">reliable</span> service since 2016.
        </p>
      </div>

      {/* ── Feature cards ────────────────────────────────────────────────── */}
      <div className="px-4 pb-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto w-full">
        {[
          { icon: <Zap size={20} className="text-yellow-500" />, title: "Instant Delivery", desc: "Products delivered instantly after payment confirmation.", bg: "bg-yellow-50 border-yellow-100" },
          { icon: <ShieldCheck size={20} className="text-green-600" />, title: "Secure Payments", desc: "M-Pesa, USDT & crypto payments with full encryption.", bg: "bg-green-50 border-green-100" },
          { icon: <Globe size={20} className="text-blue-600" />, title: "Worldwide Access", desc: "Serving customers in 50+ countries globally.", bg: "bg-blue-50 border-blue-100" },
          { icon: <Headphones size={20} className="text-purple-600" />, title: "24/7 Support", desc: "Always available via WhatsApp & Telegram.", bg: "bg-purple-50 border-purple-100" },
        ].map(({ icon, title, desc, bg }) => (
          <div key={title} className={`${bg} border rounded-2xl p-4 space-y-2`}>
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center">{icon}</div>
            <p className="font-bold text-gray-800 text-[13px] leading-tight">{title}</p>
            <p className="text-gray-500 text-[11px] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <div className="px-4 pb-6 max-w-5xl mx-auto w-full">
        <div className="text-center mb-4">
          <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest mb-1">Simple Process</p>
          <h3 className="font-black text-gray-800 text-[16px]">How It Works</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { step: "1", title: "Browse & Select", desc: "Choose from 1,500+ products across 50+ categories worldwide.", emoji: "🛒" },
            { step: "2", title: "Pay Securely",    desc: "M-Pesa, USDT, crypto — multiple safe payment options.", emoji: "💳" },
            { step: "3", title: "We Process Fast", desc: "Admin reviews and processes your order — usually within hours.", emoji: "⚡" },
            { step: "4", title: "Email Delivery",  desc: "Codes, credits & activations delivered to your inbox.", emoji: "📧" },
          ].map(s => (
            <div key={s.step} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute -right-1 -top-1 text-5xl font-black text-gray-50 leading-none select-none">{s.step}</div>
              <span className="text-2xl block mb-2">{s.emoji}</span>
              <p className="font-bold text-gray-800 text-[12px] leading-tight">{s.title}</p>
              <p className="text-gray-500 text-[11px] leading-relaxed mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Supported Brands ────────────────────────────────────────────── */}
      <div className="px-4 pb-5 max-w-5xl mx-auto w-full">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Supported Brands &amp; Tools</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { slug: "samsung",   name: "Samsung" },
            { slug: "apple",     name: "Apple" },
            { slug: "huawei",    name: "Huawei" },
            { slug: "xiaomi",    name: "Xiaomi" },
            { slug: "motorola",  name: "Motorola" },
            { slug: "nokia",     name: "Nokia" },
            { slug: "lg",        name: "LG" },
            { slug: "sony",      name: "Sony" },
            { slug: "oneplus",   name: "OnePlus" },
            { slug: "oppo",      name: "OPPO" },
            { slug: "asus",      name: "ASUS" },
            { slug: "qualcomm",  name: "Qualcomm" },
            { slug: "android",   name: "Android" },
            { slug: "google",    name: "Google" },
            { slug: "blackberry",name: "BlackBerry" },
          ].map(({ slug, name }) => (
            <div key={slug} title={name}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <img
                src={`https://cdn.simpleicons.org/${slug}/475569`}
                alt={name}
                className="w-5 h-5 object-contain"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Category quick links ─────────────────────────────────────────── */}
      <div className="px-4 pb-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-gray-800 text-[15px]">Popular Categories</h3>
          <Link href="/categories" className="text-blue-600 text-xs font-semibold flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: "iPhone Unlock", emoji: "🍎", color: "bg-gray-50 border-gray-200",     slug: "iphone-unlock-tmobile" },
            { label: "Samsung",       emoji: "🔵", color: "bg-blue-50 border-blue-100",     slug: "samsung-unlock" },
            { label: "IMEI Services", emoji: "🔍", color: "bg-green-50 border-green-100",   slug: "imei-blacklist-removal" },
            { label: "iCloud Unlock", emoji: "☁️", color: "bg-sky-50 border-sky-100",       slug: "icloud-full-unlock" },
            { label: "FRP Unlock",    emoji: "🔓", color: "bg-orange-50 border-orange-100", slug: "frp-bypass-android-11" },
            { label: "Server Credits",emoji: "⚡", color: "bg-purple-50 border-purple-100", slug: "server-service" },
          ].map(({ label, emoji, color, slug }) => (
            <Link href={`/products?category=${slug}`} key={label}>
              <div className={`${color} border rounded-xl p-3 text-center space-y-1.5 hover:shadow-sm transition-shadow cursor-pointer`}>
                <span className="text-2xl block">{emoji}</span>
                <p className="text-[10px] font-bold text-gray-700 leading-tight">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Why choose us ────────────────────────────────────────────────── */}
      <div className="mx-4 mb-6 rounded-2xl overflow-hidden max-w-5xl md:mx-auto w-[calc(100%-2rem)]" style={{ background: "linear-gradient(135deg, #1a2332 0%, #1e3a5f 100%)" }}>
        <div className="px-5 py-5 text-center">
          <p className="text-blue-300/80 text-xs font-semibold uppercase tracking-widest mb-1">Why GSM World?</p>
          <h3 className="text-white font-black text-[17px] mb-4 leading-tight">The Most Trusted GSM Platform Worldwide</h3>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { icon: <Package size={16} />, stat: productStat, label: "Products" },
              { icon: <Users size={16} />,   stat: "10K+",      label: "Customers" },
              { icon: <Clock size={16} />,   stat: "8yr+",      label: "Experience" },
            ].map(({ icon, stat, label }) => (
              <div key={label} className="bg-white/10 rounded-xl py-3 px-2 text-center">
                <div className="flex justify-center text-blue-300 mb-1">{icon}</div>
                <p className="text-white font-black text-base leading-none">{stat}</p>
                <p className="text-blue-300/70 text-[9px] font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <Link href="/products">
            <button className="w-full bg-blue-500 hover:bg-blue-400 text-white font-black text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              Shop Now <ArrowRight size={15} />
            </button>
          </Link>
        </div>
      </div>

      {/* ── Contact / Social ─────────────────────────────────────────────── */}
      <div className="px-5 pb-8 text-center max-w-2xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-4">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-blue-700 text-xs font-bold">Online &amp; Ready to Help</span>
        </div>
        <p className="font-bold text-gray-800 text-[15px] mb-4">Stay Connected on WhatsApp &amp; Telegram</p>
        <div className="flex gap-3 justify-center">
          <a
            href="https://wa.me/254756816951"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 font-bold text-white rounded-xl shadow-md shadow-green-200 transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", fontSize: 14, padding: "11px 22px" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>
          <a
            href="https://t.me/markjsbb"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 font-bold text-white rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#229ED9,#1a7fbf)", fontSize: 14, padding: "11px 22px" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Telegram
          </a>
        </div>
      </div>
    </div>
  );
}
