import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Zap, ShieldCheck, Headphones, Globe, ArrowRight, Star,
  Package, Users, Clock, Search, ChevronRight, Unlock,
  CreditCard, Cpu, Smartphone, CheckCircle, TrendingUp,
  Gift, Wrench,
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
    {
      icon: <Smartphone size={20} />,
      label: "Phone Unlock",
      desc: "iPhone, Samsung & all brands",
      href: "/direct-unlock",
      from: "#3b82f6",
      to: "#6366f1",
      badge: "From $30",
    },
    {
      icon: <Unlock size={20} />,
      label: "iCloud & FRP",
      desc: "Activation lock & FRP removal",
      href: "/frp",
      from: "#0ea5e9",
      to: "#6366f1",
      badge: "From $10",
    },
    {
      icon: <Cpu size={20} />,
      label: "Server Credits",
      desc: "DC-Unlocker, Z3X, Octoplus & more",
      href: "/credits",
      from: "#8b5cf6",
      to: "#ec4899",
      badge: "Instant",
    },
    {
      icon: <Gift size={20} />,
      label: "Gift Cards",
      desc: "PSN, Xbox, Steam, Netflix & 30+",
      href: "/gift-cards",
      from: "#10b981",
      to: "#06b6d4",
      badge: "30+ brands",
    },
    {
      icon: <Wrench size={20} />,
      label: "Tool Rentals",
      desc: "26 professional unlock tools",
      href: "/unlock-tools",
      from: "#f59e0b",
      to: "#ef4444",
      badge: "From $3",
    },
    {
      icon: <TrendingUp size={20} />,
      label: "IMEI Services",
      desc: "Check, blacklist & repair",
      href: "/imei",
      from: "#06b6d4",
      to: "#3b82f6",
      badge: "5 min",
    },
  ];

  const topPrices = [
    { label: "iPhone 15 Unlock",   price: "$80",  time: "~30 min" },
    { label: "iPhone 14 Unlock",   price: "$75",  time: "~30 min" },
    { label: "iPhone 13 Unlock",   price: "$65",  time: "~30 min" },
    { label: "Samsung S24 Unlock", price: "$35",  time: "~2 hrs"  },
    { label: "PSN Gift Card",      price: "Any",  time: "Instant" },
    { label: "FRP Bypass",         price: "$15+", time: "~1 hr"   },
  ];

  const testimonials = [
    { name: "Moses K.", loc: "Nairobi", text: "Unlocked my iPhone 14 in under 20 minutes. Legit service!", stars: 5 },
    { name: "Amina S.", loc: "Mombasa", text: "PSN gift card delivered instantly. Will definitely order again.", stars: 5 },
    { name: "James O.", loc: "Kampala", text: "FRP bypass worked perfectly on my Samsung. Reliable!", stars: 5 },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#080d18", color: "#e2e8f0" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Gradient layers */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 100% 70% at 50% -5%,rgba(59,130,246,0.22) 0%,transparent 70%)" }} />
        <div className="absolute top-0 right-0 w-80 h-80 pointer-events-none opacity-[0.07]" style={{ background: "radial-gradient(circle,#818cf8 0%,transparent 70%)", transform: "translate(25%,-25%)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none opacity-[0.06]" style={{ background: "radial-gradient(circle,#34d399 0%,transparent 70%)", transform: "translate(-30%,30%)" }} />

        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-10 pb-8">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 mb-5 px-3.5 py-1.5 rounded-full border text-xs font-bold"
            style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)", color: "#34d399" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live · Trusted since 2016 · 10,000+ customers
          </div>

          <h1 className="font-black leading-[1.1] tracking-tight mb-3" style={{ fontSize: "clamp(30px,8vw,46px)", color: "#f8fafc" }}>
            East Africa's #1<br />
            <span style={{ background: "linear-gradient(90deg,#60a5fa 0%,#a78bfa 50%,#34d399 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Phone Services Hub
            </span>
          </h1>

          <p className="text-sm font-medium mb-6 max-w-xs leading-relaxed" style={{ color: "#94a3b8" }}>
            Unlock any phone · Remove iCloud locks · Buy gift cards · Top up server credits — delivered in under 2 hours, worldwide.
          </p>

          {/* CTA buttons */}
          <div className="flex gap-3 mb-7 w-full max-w-xs">
            <Link href="/products" className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 font-black text-sm px-5 py-3 rounded-2xl text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 6px 24px rgba(99,102,241,0.4)" }}>
                Browse Store <ArrowRight size={14} />
              </button>
            </Link>
            <Link href="/direct-unlock" className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 font-bold text-sm px-5 py-3 rounded-2xl border transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "#e2e8f0" }}>
                Unlock Now
              </button>
            </Link>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="w-full max-w-sm">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-4 pointer-events-none" style={{ color: "#64748b" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search — iPhone, Samsung, Steam..."
                className="w-full pl-10 pr-[72px] py-3.5 rounded-2xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.11)",
                  color: "#f1f5f9",
                  caretColor: "#60a5fa",
                }}
              />
              <button type="submit" className="absolute right-1.5 text-xs font-bold px-3.5 py-2 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 grid grid-cols-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)" }}>
          {[
            { value: productStat,  label: "Products"   },
            { value: categoryStat, label: "Categories" },
            { value: "98%",        label: "Success"    },
            { value: "24/7",       label: "Support"    },
          ].map(({ value, label }, i) => (
            <div key={label} className="flex flex-col items-center py-3"
              style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : undefined }}>
              <span className="font-black text-base leading-none" style={{ color: "#f8fafc" }}>{value}</span>
              <span className="text-[9px] font-semibold mt-0.5 uppercase tracking-widest" style={{ color: "#60a5fa" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOP PRICES TABLE ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-7 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#475569" }}>Quick Prices</p>
            <h2 className="font-black text-[15px] leading-tight mt-0.5" style={{ color: "#f1f5f9" }}>Popular Services</h2>
          </div>
          <Link href="/direct-unlock">
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#60a5fa" }}>
              Full list <ArrowRight size={12} />
            </span>
          </Link>
        </div>
        <div className="rounded-2xl overflow-hidden border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
          {topPrices.map(({ label, price, time }, i) => (
            <div key={label} className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: i < topPrices.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="text-[13px] font-semibold" style={{ color: "#cbd5e1" }}>{label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>
                  ⏱ {time}
                </span>
                <span className="font-black text-sm" style={{ color: "#60a5fa" }}>{price}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SERVICES GRID ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-center" style={{ color: "#475569" }}>Everything We Offer</p>
        <h2 className="font-black text-[15px] text-center mb-4" style={{ color: "#f1f5f9" }}>Our Services</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {services.map(({ icon, label, desc, href, from, to, badge }) => (
            <Link href={href} key={label}>
              <div className="relative rounded-2xl p-4 active:scale-95 transition-transform cursor-pointer overflow-hidden"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", minHeight: 104 }}>
                {/* Gradient orb */}
                <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full pointer-events-none opacity-20"
                  style={{ background: `radial-gradient(circle,${to} 0%,transparent 70%)` }} />
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5"
                  style={{ background: `linear-gradient(135deg,${from},${to})` }}>
                  <span className="text-white">{icon}</span>
                </div>
                <p className="font-bold text-[13px] leading-tight mb-1" style={{ color: "#f1f5f9" }}>{label}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
                <span className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: `linear-gradient(135deg,${from}22,${to}22)`, color: from, border: `1px solid ${from}44` }}>
                  {badge}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── WHY US ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 py-6">
        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,#0f1e35 0%,#131f33 100%)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-center" style={{ color: "#818cf8" }}>Why Choose Us</p>
          <h2 className="font-black text-center mb-5 leading-tight" style={{ fontSize: 17, color: "#f8fafc" }}>
            The Most Trusted GSM Platform in Africa
          </h2>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { icon: <Package size={15} />, stat: productStat, label: "Products" },
              { icon: <Users size={15} />,   stat: "10K+",      label: "Customers" },
              { icon: <Clock size={15} />,   stat: "8yr+",      label: "Experience" },
            ].map(({ icon, stat, label }) => (
              <div key={label} className="rounded-xl py-3 px-2 text-center" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.15)" }}>
                <div className="flex justify-center mb-1" style={{ color: "#818cf8" }}>{icon}</div>
                <p className="font-black text-base leading-none" style={{ color: "#f8fafc" }}>{stat}</p>
                <p className="text-[9px] font-medium mt-0.5" style={{ color: "#818cf8" }}>{label}</p>
              </div>
            ))}
          </div>
          {/* Feature pills */}
          <div className="space-y-2">
            {[
              { icon: <Zap size={13} className="text-yellow-400" />,        label: "Instant Delivery",   desc: "Results in under 2 hours, most in 30 min" },
              { icon: <ShieldCheck size={13} className="text-green-400" />, label: "Permanent Unlocks",  desc: "Carrier unlocks survive resets & updates" },
              { icon: <Globe size={13} className="text-blue-400" />,        label: "Works Worldwide",    desc: "Unlocked phones work with any SIM globally" },
              { icon: <Headphones size={13} className="text-violet-400" />, label: "24/7 Human Support", desc: "Live chat, WhatsApp & Telegram support" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.07)" }}>
                  {icon}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[12px] leading-tight" style={{ color: "#e2e8f0" }}>{label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>{desc}</p>
                </div>
                <CheckCircle size={13} className="text-green-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-center" style={{ color: "#475569" }}>Simple Process</p>
        <h2 className="font-black text-[15px] text-center mb-5" style={{ color: "#f1f5f9" }}>How It Works</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { step: "01", emoji: "🛒", title: "Browse",   desc: "Find your service or product." },
            { step: "02", emoji: "💳", title: "Pay",       desc: "M-Pesa, USDT, crypto & wallet." },
            { step: "03", emoji: "⚡", title: "Process",   desc: "We handle it — within 2 hours." },
            { step: "04", emoji: "📧", title: "Delivered", desc: "Code or result sent to email." },
          ].map(({ step, emoji, title, desc }) => (
            <div key={step} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-[10px] font-black mb-2" style={{ color: "#475569" }}>{step}</div>
              <div className="text-xl mb-1.5">{emoji}</div>
              <p className="font-bold text-[13px] leading-tight mb-1" style={{ color: "#f1f5f9" }}>{title}</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-center" style={{ color: "#475569" }}>Reviews</p>
        <h2 className="font-black text-[15px] text-center mb-4" style={{ color: "#f1f5f9" }}>What Customers Say</h2>
        <div className="space-y-2.5">
          {testimonials.map(({ name, loc, text, stars }) => (
            <div key={name} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "white" }}>
                  {name[0]}
                </div>
                <div>
                  <p className="font-bold text-[12px] leading-none" style={{ color: "#e2e8f0" }}>{name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>{loc}</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={10} fill="#f59e0b" stroke="none" />
                  ))}
                </div>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: "#94a3b8" }}>"{text}"</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── PAYMENT METHODS ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-center mb-3" style={{ color: "#475569" }}>
          Accepted Payments
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { label: "M-Pesa", color: "#00C767", bg: "rgba(0,199,103,0.1)" },
            { label: "USDT", color: "#26A17B", bg: "rgba(38,161,123,0.1)" },
            { label: "Binance", color: "#F3BA2F", bg: "rgba(243,186,47,0.1)" },
            { label: "Bitcoin", color: "#F7931A", bg: "rgba(247,147,26,0.1)" },
            { label: "Crypto", color: "#627EEA", bg: "rgba(98,126,234,0.1)" },
            { label: "Wallet", color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
          ].map(({ label, color, bg }) => (
            <div key={label} className="px-3.5 py-1.5 rounded-xl text-xs font-bold border"
              style={{ background: bg, borderColor: `${color}33`, color }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTACT CTA ────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-10">
        <div className="rounded-2xl p-5 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#0f1e35,#131f33)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%,rgba(99,102,241,0.08) 0%,transparent 70%)" }} />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Online &amp; Ready to Help
            </div>
            <p className="font-black text-[16px] mb-1.5 leading-snug" style={{ color: "#f8fafc" }}>
              Need help? We're here 24/7
            </p>
            <p className="text-xs mb-4" style={{ color: "#64748b" }}>Respond within minutes on WhatsApp &amp; Telegram</p>
            <div className="flex gap-3 justify-center">
              <a href="https://wa.me/254756816951" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 font-bold text-sm text-white rounded-xl active:scale-95 transition-transform px-5 py-2.5"
                style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
              <a href="https://t.me/markjsbb" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 font-bold text-sm text-white rounded-xl active:scale-95 transition-transform px-5 py-2.5"
                style={{ background: "linear-gradient(135deg,#229ED9,#1a7fbf)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </a>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
