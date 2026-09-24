import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Zap, ShieldCheck, Headphones, Globe, ArrowRight, Star,
  Package, Users, Clock, Search, ChevronRight, Unlock,
  CreditCard, Cpu, Smartphone, Store, DollarSign, TrendingUp, Download,
} from "lucide-react";
import { useListCategories, useListProducts } from "@workspace/api-client-react";

export function Home() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: categoriesData } = useListCategories();
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

  const services = [
    { icon: <Smartphone size={22} className="text-blue-400" />, label: "Phone Unlock", desc: "iPhone, Samsung & all Android brands", href: "/direct-unlock", color: "from-blue-500/10 to-blue-600/5 border-blue-500/20" },
    { icon: <Unlock size={22} className="text-sky-400" />, label: "iCloud & FRP", desc: "iCloud removal, FRP bypass, MDM unlock", href: "/frp", color: "from-sky-500/10 to-sky-600/5 border-sky-500/20" },
    { icon: <Cpu size={22} className="text-violet-400" />, label: "Server Credits", desc: "DC-Unlocker, Octoplus, Z3X & 26+ tools", href: "/credits", color: "from-violet-500/10 to-violet-600/5 border-violet-500/20" },
    { icon: <CreditCard size={22} className="text-emerald-400" />, label: "Gift Cards", desc: "PlayStation, Xbox, Steam, Netflix & more", href: "/gift-cards", color: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20" },
  ];

  const categories = [
    { label: "iPhone Unlock", emoji: "🍎", href: "/iphone-unlock",   bg: "bg-gray-900 border-gray-700" },
    { label: "Samsung",       emoji: "📱", href: "/direct-unlock",    bg: "bg-blue-950 border-blue-800" },
    { label: "iCloud Unlock", emoji: "☁️", href: "/iphone-unlock",   bg: "bg-sky-950 border-sky-800" },
    { label: "FRP Bypass",    emoji: "🔓", href: "/frp",              bg: "bg-orange-950 border-orange-800" },
    { label: "IMEI Services", emoji: "🔍", href: "/imei",             bg: "bg-green-950 border-green-800" },
    { label: "Server Credits",emoji: "⚡", href: "/credits",          bg: "bg-violet-950 border-violet-800" },
  ];

  const brands = [
    { slug: "samsung", name: "Samsung" }, { slug: "apple", name: "Apple" },
    { slug: "huawei",  name: "Huawei"  }, { slug: "xiaomi", name: "Xiaomi" },
    { slug: "motorola",name: "Motorola"}, { slug: "nokia",  name: "Nokia"  },
    { slug: "lg",      name: "LG"      }, { slug: "sony",   name: "Sony"   },
    { slug: "oneplus", name: "OnePlus" }, { slug: "oppo",   name: "OPPO"   },
    { slug: "asus",    name: "ASUS"    }, { slug: "google",  name: "Google" },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0a0f1a", color: "#e2e8f0" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(160deg,#0d1828 0%,#0a0f1a 60%)" }}>
        {/* Background mesh */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 50% -10%,rgba(59,130,246,0.18) 0%,transparent 70%)" }} />
        <div className="absolute top-0 right-0 w-72 h-72 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle,#3b82f6 0%,transparent 70%)", transform: "translate(30%,-30%)" }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle,#8b5cf6 0%,transparent 70%)", transform: "translate(-30%,30%)" }} />

        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-10 pb-8">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full border text-xs font-semibold" style={{ background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.3)", color: "#93c5fd" }}>
            <Star size={11} fill="#93c5fd" />
            Trusted by 10,000+ customers since 2016
          </div>

          <h1 className="font-black leading-tight tracking-tight mb-3" style={{ fontSize: "clamp(28px,7vw,42px)", color: "#f8fafc" }}>
            The World's #1<br />
            <span style={{ background: "linear-gradient(90deg,#60a5fa,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              GSM Unlock Hub
            </span>
          </h1>

          <p className="text-sm font-medium mb-6 max-w-xs leading-relaxed" style={{ color: "#94a3b8" }}>
            Phone unlocks · iCloud removal · Server credits · Gift cards — delivered instantly worldwide.
          </p>

          {/* CTA buttons */}
          <div className="flex gap-3 mb-6">
            <Link href="/products">
              <button className="flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl text-white transition-all active:scale-95 shadow-lg"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
                Browse Store <ArrowRight size={14} />
              </button>
            </Link>
            <Link href="/orders/lookup">
              <button className="flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl border transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "#e2e8f0" }}>
                Track Order
              </button>
            </Link>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="w-full max-w-sm">
            <div className="relative flex items-center">
              <Search size={15} className="absolute left-3.5 pointer-events-none" style={{ color: "#64748b" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search — iPhone unlock, Samsung, Steam..."
                className="w-full pl-10 pr-20 py-3 rounded-2xl text-sm outline-none focus:ring-2"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#f1f5f9",
                  caretColor: "#60a5fa",
                  focusRingColor: "#3b82f6",
                }}
              />
              <button type="submit" className="absolute right-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 grid grid-cols-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
          {[
            { value: productStat,  label: "Products"   },
            { value: categoryStat, label: "Categories" },
            { value: "24/7",       label: "Support"    },
          ].map(({ value, label }, i) => (
            <div key={label} className="flex flex-col items-center py-3"
              style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : undefined }}>
              <span className="font-black text-lg leading-none" style={{ color: "#f8fafc" }}>{value}</span>
              <span className="text-[10px] font-semibold mt-0.5 uppercase tracking-widest" style={{ color: "#60a5fa" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── APP DOWNLOAD BANNER ───────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-1">
        <a
          href="/api/download/apk"
          download="GSMWorld.apk"
          className="flex items-center gap-4 rounded-2xl px-4 py-4 active:scale-[0.98] transition-transform select-none"
          style={{ background: "linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%)", border: "1px solid rgba(74,222,128,0.25)", boxShadow: "0 4px 24px rgba(22,101,52,0.4)" }}
        >
          {/* Android icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#4ade80">
              <path d="M17.523 15.341a.5.5 0 01-.5.5H6.977a.5.5 0 01-.5-.5V9.5h11.046v5.841zm.5-9.341H5.977l1.65-2.859a.5.5 0 01.866.5L7.25 5h9.5l-1.243-2.159a.5.5 0 01.866-.5L18.023 6zM3 9.5A1.5 1.5 0 014.5 8H4V7a1 1 0 012 0v1h12V7a1 1 0 012 0v1h-.5A1.5 1.5 0 0121 9.5v6a1.5 1.5 0 01-1.5 1.5v1.5a1 1 0 01-2 0V17H6.5v1.5a1 1 0 01-2 0V17A1.5 1.5 0 013 15.5v-6z"/>
            </svg>
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-black text-[14px] text-white leading-tight">Get the GSM World App</p>
            <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#86efac" }}>
              Faster · Offline-ready · Instant notifications
            </p>
          </div>
          {/* Download button */}
          <div className="flex-shrink-0 flex items-center gap-1.5 font-black text-[11px] text-white rounded-xl px-3 py-2"
            style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <Download size={13} />
            APK
          </div>
        </a>
      </div>

      {/* ── SERVICES GRID ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-7 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-center" style={{ color: "#475569" }}>Our Services</p>
        <div className="grid grid-cols-2 gap-2.5">
          {services.map(({ icon, label, desc, href, color }) => (
            <Link href={href} key={label}>
              <div className={`relative rounded-2xl border p-4 bg-gradient-to-br ${color} active:scale-95 transition-transform cursor-pointer`}
                style={{ minHeight: 100 }}>
                <div className="mb-2.5">{icon}</div>
                <p className="font-bold text-[13px] leading-tight mb-1" style={{ color: "#f1f5f9" }}>{label}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "#94a3b8" }}>{desc}</p>
                <ChevronRight size={13} className="absolute right-3 top-3" style={{ color: "#475569" }} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── WHY US ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 py-6">
        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,#0f1e35 0%,#131f33 100%)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-center" style={{ color: "#818cf8" }}>Why GSM World</p>
          <h2 className="font-black text-center mb-4 leading-tight" style={{ fontSize: 17, color: "#f8fafc" }}>The Most Trusted GSM Platform Worldwide</h2>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { icon: <Package size={15} />, stat: productStat, label: "Products" },
              { icon: <Users size={15} />,   stat: "10K+",      label: "Customers" },
              { icon: <Clock size={15} />,   stat: "8yr+",      label: "Experience" },
            ].map(({ icon, stat, label }) => (
              <div key={label} className="rounded-xl py-3 px-2 text-center" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.15)" }}>
                <div className="flex justify-center mb-1" style={{ color: "#818cf8" }}>{icon}</div>
                <p className="font-black text-base leading-none" style={{ color: "#f8fafc" }}>{stat}</p>
                <p className="text-[9px] font-medium mt-0.5" style={{ color: "#818cf8" }}>{label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Zap size={14} className="text-yellow-400" />,       label: "Instant Delivery",  desc: "Delivered right after payment" },
              { icon: <ShieldCheck size={14} className="text-green-400" />, label: "Secure Payments",   desc: "M-Pesa, USDT & crypto" },
              { icon: <Globe size={14} className="text-blue-400" />,        label: "50+ Countries",     desc: "Worldwide coverage" },
              { icon: <Headphones size={14} className="text-violet-400" />, label: "24/7 Support",      desc: "WhatsApp & Telegram" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="mt-0.5 flex-shrink-0">{icon}</div>
                <div>
                  <p className="font-bold text-[11px] leading-tight" style={{ color: "#e2e8f0" }}>{label}</p>
                  <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "#64748b" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── POPULAR CATEGORIES ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-[15px]" style={{ color: "#f1f5f9" }}>Popular Categories</h3>
          <Link href="/categories">
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#60a5fa" }}>
              View all <ArrowRight size={12} />
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {categories.map(({ label, emoji, href, bg }) => (
            <Link href={href} key={label}>
              <div className={`${bg} border rounded-2xl p-3 text-center cursor-pointer active:scale-95 transition-transform`}>
                <span className="text-2xl block mb-1.5">{emoji}</span>
                <p className="font-bold text-[10px] leading-tight" style={{ color: "#cbd5e1" }}>{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-center" style={{ color: "#475569" }}>Simple Process</p>
        <h3 className="font-black text-[15px] text-center mb-4" style={{ color: "#f1f5f9" }}>How It Works</h3>
        <div className="relative">
          {/* connector line */}
          <div className="absolute left-[19px] top-6 bottom-6 w-px" style={{ background: "linear-gradient(to bottom,#3b82f6,#8b5cf6)", opacity: 0.25 }} />
          <div className="space-y-3">
            {[
              { step: 1, emoji: "🛒", title: "Browse & Select",  desc: "Choose from 1,500+ products across 50+ categories." },
              { step: 2, emoji: "💳", title: "Pay Securely",     desc: "M-Pesa, USDT, crypto & more payment options." },
              { step: 3, emoji: "⚡", title: "Fast Processing",  desc: "Admin reviews your order — usually within hours." },
              { step: 4, emoji: "📧", title: "Email Delivery",   desc: "Codes, credits & activations sent to your inbox." },
            ].map(({ step, emoji, title, desc }) => (
              <div key={step} className="flex items-start gap-3.5 pl-0">
                <div className="relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base font-black border"
                  style={{ background: "#0f1e35", borderColor: "rgba(99,102,241,0.4)", color: "#818cf8", minWidth: 36 }}>
                  {step}
                </div>
                <div className="flex-1 rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="font-bold text-[13px] leading-tight mb-0.5" style={{ color: "#f1f5f9" }}>
                    {emoji} {title}
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SUPPORTED BRANDS ───────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-center mb-3" style={{ color: "#475569" }}>
          Supported Brands &amp; Tools
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {brands.map(({ slug, name }) => (
            <div key={slug} title={name}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <img
                src={`https://cdn.simpleicons.org/${slug}/94a3b8`}
                alt={name}
                className="w-5 h-5 object-contain"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── RESELLER PROGRAM CTA ───────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <div className="rounded-2xl p-5 overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0d4f3c 0%,#1a7a5e 100%)" }}>
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle,#ffffff 0%,transparent 70%)", transform: "translate(30%,-30%)" }} />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "#a7f3d0" }}>
              <Store size={10} /> Reseller Program
            </div>
            <h3 className="font-black text-white text-lg leading-tight mb-1.5">
              Earn 10% on Every Sale
            </h3>
            <p className="text-green-100/70 text-xs mb-4 leading-relaxed">
              Get your own branded store link, share it with customers, and earn 10% commission on every order placed through your link.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { icon: <TrendingUp size={13} />, label: "10% Commission" },
                { icon: <DollarSign size={13} />, label: "$10 Min Payout" },
                { icon: <Store size={13} />, label: "Own Store URL" },
              ].map(f => (
                <div key={f.label} className="rounded-xl py-2 px-1.5 text-center" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <div className="flex justify-center text-green-200 mb-1">{f.icon}</div>
                  <p className="text-[9px] font-bold text-green-100/80 leading-tight">{f.label}</p>
                </div>
              ))}
            </div>
            <Link href="/reseller">
              <button className="w-full py-3 font-black text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.95)", color: "#0d4f3c" }}>
                Apply to Become a Reseller <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── CONTACT CTA ────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-10">
        <div className="rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg,#0d1828,#131f33)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }}>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Online &amp; Ready to Help
          </div>
          <p className="font-black text-[15px] mb-4 leading-snug" style={{ color: "#f8fafc" }}>
            Stay Connected on WhatsApp &amp; Telegram
          </p>
          <div className="flex gap-3 justify-center">
            <a href="https://wa.me/254756816951" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 font-bold text-sm text-white rounded-xl active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", padding: "10px 20px" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
            <a href="https://t.me/markjsbb" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 font-bold text-sm text-white rounded-xl active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg,#229ED9,#1a7fbf)", padding: "10px 20px" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Telegram
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
