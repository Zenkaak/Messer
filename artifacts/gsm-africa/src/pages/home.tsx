import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import {
  Zap, ShieldCheck, Headphones, Globe, ArrowRight, Star,
  Package, Users, Clock, Search, ChevronRight, Unlock,
  CreditCard, Cpu, Smartphone, Store, DollarSign, TrendingUp, Download,
  Shield, AlertTriangle, Loader2, CheckCircle2,
} from "lucide-react";
import { useListCategories, useListProducts } from "@workspace/api-client-react";

const GSM_STYLES = `
  @keyframes gsmFadeUp {
    from { opacity:0; transform:translateY(22px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes gsmFloat {
    0%,100% { transform:translateY(0) scale(1); }
    50%     { transform:translateY(-14px) scale(1.03); }
  }
  @keyframes gsmFloatSlow {
    0%,100% { transform:translateY(0) rotate(-3deg); }
    50%     { transform:translateY(-10px) rotate(3deg); }
  }
  @keyframes gsmPulseOrb {
    0%,100% { opacity:0.35; transform:scale(1); }
    50%     { opacity:0.7;  transform:scale(1.08); }
  }
  @keyframes gsmShimmerText {
    0%   { background-position:-200% center; }
    100% { background-position:200% center; }
  }
  @keyframes gsmBadgePop {
    0%   { transform:scale(0.85); opacity:0; }
    60%  { transform:scale(1.06); }
    100% { transform:scale(1);    opacity:1; }
  }
  @keyframes gsmRingPulse {
    0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0.4); }
    50%     { box-shadow:0 0 0 10px rgba(59,130,246,0); }
  }
  @keyframes gsmSpin {
    from { transform:rotate(0deg); }
    to   { transform:rotate(360deg); }
  }
  @keyframes gsmSlideIn {
    from { opacity:0; transform:translateX(-16px); }
    to   { opacity:1; transform:translateX(0); }
  }

  .gsm-float       { animation:gsmFloat     4s ease-in-out infinite; }
  .gsm-float-slow  { animation:gsmFloatSlow 7s ease-in-out infinite; }
  .gsm-pulse-orb   { animation:gsmPulseOrb  3s ease-in-out infinite; }
  .gsm-badge-pop   { animation:gsmBadgePop  0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
  .gsm-ring-pulse  { animation:gsmRingPulse 2s ease-in-out infinite; }

  .gsm-shimmer {
    background:linear-gradient(90deg,#60a5fa 0%,#a78bfa 30%,#f0abfc 50%,#a78bfa 70%,#60a5fa 100%);
    background-size:200% auto;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:gsmShimmerText 3s linear infinite;
  }
  .gsm-hero-in {
    animation:gsmFadeUp 0.7s ease forwards;
  }
  .gsm-in {
    opacity:1 !important;
    transform:translateY(0) !important;
  }
  .gsm-observe {
    opacity:0;
    transform:translateY(18px);
    transition:opacity 0.55s ease, transform 0.55s ease;
  }
  .gsm-service-card {
    transition:transform 0.18s ease, box-shadow 0.18s ease;
  }
  .gsm-service-card:active { transform:scale(0.95) translateY(2px); }
  .gsm-cat-pill {
    transition:transform 0.15s ease, background 0.15s ease;
  }
  .gsm-cat-pill:active { transform:scale(0.94); }
  .gsm-btn-primary {
    transition:transform 0.15s ease, box-shadow 0.15s ease;
  }
  .gsm-btn-primary:active { transform:scale(0.96); }

  @media (prefers-reduced-motion: reduce) {
    .gsm-float, .gsm-float-slow, .gsm-pulse-orb, .gsm-ring-pulse { animation:none; }
  }
`;

const BRAND_MAP: Record<string, string> = {
  "Apple":"iPhone / iCloud","Samsung":"Samsung","Huawei":"Huawei",
  "Google":"Google Pixel","Xiaomi":"Xiaomi / Redmi / POCO","Nokia":"Nokia",
  "LG":"LG","Motorola":"Motorola","Sony":"Sony",
  "OnePlus":"OnePlus","Oppo":"Oppo / Realme","Vivo":"Vivo",
};

function luhnValid(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(imei[i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

type ImeiLookupResult = {
  imei:string; tac:string; valid:boolean;
  manufacturer:string|null; brand:string|null;
  model:string|null; marketingName:string|null;
  source:string; note?:string;
  modelRegion?:string|null;
  modelRegionFull?:string|null;
  simConfig?:string|null;
  simLock?:string|null;
  carrier?:string|null;
  blacklist?:string|null;
  enhanced?:boolean;
};

function useInView(ref: React.RefObject<HTMLElement|null>, rootMargin = "0px 0px -40px 0px") {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return inView;
}

function AnimSection({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref as React.RefObject<HTMLElement>);
  return (
    <div
      ref={ref}
      className={`gsm-observe ${inView ? "gsm-in" : ""} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

function AnimCount({ target, suffix = "", prefix = "" }: { target: number | string; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref as React.RefObject<HTMLElement>);
  const [count, setCount] = useState(0);
  const isNum = typeof target === "number";

  useEffect(() => {
    if (!inView || !isNum) return;
    const end = target as number;
    const duration = 1400;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{prefix}{isNum ? count.toLocaleString() : target}{suffix}</span>;
}

function StatusPill({ label, status }: { label: string; status: "pass" | "fail" | "unknown" }) {
  const cfg = {
    pass:    { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)",   dot: "#22c55e", text: "#86efac", badge: "✓ Clean"   },
    fail:    { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",   dot: "#ef4444", text: "#fca5a5", badge: "✗ Flagged" },
    unknown: { bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)", dot: "#f59e0b", text: "#fcd34d", badge: "? Unknown" },
  }[status];
  return (
    <div className="rounded-xl p-2.5 text-center" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: "#475569" }}>{label}</p>
      <div className="flex items-center justify-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.dot }} />
        <span className="text-[10px] font-bold" style={{ color: cfg.text }}>{cfg.badge}</span>
      </div>
    </div>
  );
}

function HomeImeiChecker() {
  const [, navigate] = useLocation();
  const [imei, setImei] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImeiLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function apiBase() { return (import.meta.env.BASE_URL as string).replace(/\/$/, ""); }

  async function handleCheck() {
    const val = imei.replace(/[\s\-]/g, "").trim();
    if (!val) return;
    if (!luhnValid(val)) { setError("Invalid IMEI — check digit doesn't match. Dial *#06# to get yours."); setResult(null); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`${apiBase()}/api/imei/lookup?imei=${encodeURIComponent(val)}`);
      const data = await res.json() as ImeiLookupResult & { error?: string };
      if (!res.ok) setError(data.error ?? "Lookup failed. Please try again.");
      else setResult(data);
    } catch {
      setResult({ imei: val, tac: val.slice(0, 8), valid: true, manufacturer: null, brand: null, model: null, marketingName: null, source: "luhn-only" });
    } finally { setLoading(false); }
  }

  function handleUnlock() {
    const detected = result?.brand ?? result?.manufacturer ?? null;
    const catalogBrand = detected ? (BRAND_MAP[detected] ?? null) : null;
    navigate(`/direct-unlock${catalogBrand ? `?brand=${encodeURIComponent(catalogBrand)}` : ""}`);
  }

  const displayBrand = result?.brand ?? result?.manufacturer ?? null;
  const displayModel = result?.marketingName ?? result?.model ?? null;

  return (
    <AnimSection className="px-4 pt-6 pb-1">
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(10,22,48,0.98),rgba(8,16,36,1))", border: "1px solid rgba(59,130,246,0.22)", boxShadow: "0 8px 32px rgba(0,0,0,0.4),0 0 0 1px rgba(59,130,246,0.06)" }}>
        <div className="px-4 py-3 flex items-center gap-2.5"
          style={{ background: "linear-gradient(90deg,rgba(59,130,246,0.14),rgba(99,102,241,0.08))", borderBottom: "1px solid rgba(59,130,246,0.12)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.18)" }}>
            <Shield size={14} className="text-blue-400" />
          </div>
          <p className="font-black text-sm text-white">Free IMEI Checker</p>
          <span className="ml-auto text-[9px] font-black px-2 py-1 rounded-full tracking-wider"
            style={{ background: "rgba(59,130,246,0.2)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}>FREE</span>
        </div>

        <div className="p-4">
          {!result ? (
            <>
              <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "#64748b" }}>
                Enter your 15-digit IMEI to check device info &amp; network lock status instantly.
              </p>
              <div className="flex gap-2">
                <input
                  type="tel" value={imei}
                  onChange={e => { setImei(e.target.value); setError(null); }}
                  onKeyDown={e => { if (e.key === "Enter") handleCheck(); }}
                  placeholder="Enter 15-digit IMEI…" maxLength={20}
                  className="flex-1 px-3.5 py-3 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", caretColor: "#60a5fa" }}
                />
                <button onClick={handleCheck}
                  disabled={loading || imei.replace(/[\s\-]/g, "").length < 15}
                  className="gsm-btn-primary px-4 py-3 font-black text-sm text-white rounded-xl disabled:opacity-40 flex items-center gap-1.5"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  {loading ? "…" : "Check"}
                </button>
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: "#334155" }}>
                Dial <span className="font-mono font-bold" style={{ color: "#60a5fa" }}>*#06#</span> to get your IMEI
              </p>
              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl p-3"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-300">{error}</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {/* Success banner */}
              <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                <p className="font-black text-white text-[13px] flex-1">✅ Success — IMEI Verified</p>
                <button onClick={() => { setResult(null); setImei(""); setError(null); }}
                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg shrink-0"
                  style={{ color: "#64748b", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Reset
                </button>
              </div>

              {/* Info table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                {([
                  { label: "IMEI",         value: result.imei },
                  { label: "Model",        value: [result.marketingName, result.model ? `(${result.model})` : null, result.modelRegion ? `[${result.modelRegion}]` : null].filter(Boolean).join(" ") || (displayBrand ?? "Unknown") },
                  { label: "Model Region", value: result.modelRegionFull ?? result.modelRegion ?? "—" },
                  { label: "SIM Config",   value: result.simConfig ?? "nano-SIM" },
                  { label: "SimLock",      value: result.simLock ?? "Carrier check required" },
                  ...(result.enhanced && result.carrier   ? [{ label: "Network",   value: result.carrier }] : []),
                  ...(result.enhanced && result.blacklist ? [{ label: "Blacklist", value: result.blacklist }] : []),
                ]).map(({ label, value }, i, arr) => {
                  const isAmber = (label === "SimLock" && value === "Carrier check required") || (label === "Blacklist" && /black|block|lost|stolen/i.test(value));
                  const isRed   = label === "SimLock" && value === "Locked";
                  const isGreen = (label === "SimLock" && value === "Unlocked") || (label === "Blacklist" && /clean|not black/i.test(value));
                  const color   = label === "IMEI" ? "#60a5fa" : isGreen ? "#4ade80" : isRed ? "#f87171" : isAmber ? "#f59e0b" : "#e2e8f0";
                  return (
                    <div key={label} className="flex items-start px-3 py-2.5"
                      style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined, background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent" }}>
                      <p className="text-[10px] font-bold shrink-0 pt-0.5" style={{ color: "#475569", width: 90 }}>{label}</p>
                      <p className="text-[11px] font-semibold break-all leading-relaxed" style={{ color }}>{value}</p>
                    </div>
                  );
                })}
              </div>

              <button onClick={handleUnlock}
                className="gsm-btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm text-white"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
                <Unlock size={15} />
                Unlock My Device Now
                <ArrowRight size={14} />
              </button>
              {displayBrand && <p className="text-[10px] text-center" style={{ color: "#334155" }}>→ {displayBrand} unlocks from $10</p>}
            </div>
          )}
        </div>
      </div>
    </AnimSection>
  );
}

export function Home() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: categoriesData } = useListCategories();
  const { data: productTotalData } = useListProducts({ limit: 1, page: 1 });

  useEffect(() => {
    if (document.getElementById("gsm-styles")) return;
    const el = document.createElement("style");
    el.id = "gsm-styles";
    el.textContent = GSM_STYLES;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/products?search=${encodeURIComponent(q)}`);
  }

  const totalProducts = productTotalData?.total ?? null;
  const totalCategories = categoriesData ? categoriesData.filter(c => c.productCount > 0).length : null;

  const services = [
    { icon: <Smartphone size={22} />, iconColor: "#60a5fa", label: "Phone Unlock", desc: "iPhone, Samsung & all Android", href: "/direct-unlock",
      grad: "linear-gradient(135deg,rgba(59,130,246,0.12),rgba(37,99,235,0.04))", border: "rgba(59,130,246,0.22)", glow: "rgba(59,130,246,0.15)" },
    { icon: <Unlock size={22} />, iconColor: "#38bdf8", label: "iCloud & FRP", desc: "iCloud removal, FRP bypass, MDM", href: "/frp",
      grad: "linear-gradient(135deg,rgba(56,189,248,0.12),rgba(14,165,233,0.04))", border: "rgba(56,189,248,0.22)", glow: "rgba(56,189,248,0.15)" },
    { icon: <Cpu size={22} />, iconColor: "#a78bfa", label: "Server Credits", desc: "DC-Unlocker, Octoplus, Z3X & 26+", href: "/credits",
      grad: "linear-gradient(135deg,rgba(139,92,246,0.12),rgba(109,40,217,0.04))", border: "rgba(139,92,246,0.22)", glow: "rgba(139,92,246,0.15)" },
  ];

  const categories = [
    { label: "iPhone Unlock", emoji: "🍎", href: "/iphone-unlock",  bg: "rgba(100,100,120,0.15)", border: "rgba(150,150,180,0.2)"  },
    { label: "Samsung",       emoji: "📱", href: "/direct-unlock",  bg: "rgba(59,130,246,0.1)",   border: "rgba(59,130,246,0.25)"  },
    { label: "iCloud Unlock", emoji: "☁️", href: "/iphone-unlock",  bg: "rgba(56,189,248,0.1)",   border: "rgba(56,189,248,0.25)"  },
    { label: "FRP Bypass",    emoji: "🔓", href: "/frp",            bg: "rgba(251,146,60,0.1)",   border: "rgba(251,146,60,0.25)"  },
    { label: "IMEI Check",    emoji: "🔍", href: "/imei",           bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.25)"  },
    { label: "Server Credits",emoji: "⚡", href: "/credits",        bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.25)" },
  ];

  const brands = [
    { slug: "samsung",  name: "Samsung"  }, { slug: "apple",   name: "Apple"   },
    { slug: "huawei",   name: "Huawei"   }, { slug: "xiaomi",  name: "Xiaomi"  },
    { slug: "motorola", name: "Motorola" }, { slug: "nokia",   name: "Nokia"   },
    { slug: "lg",       name: "LG"       }, { slug: "sony",    name: "Sony"    },
    { slug: "oneplus",  name: "OnePlus"  }, { slug: "oppo",    name: "OPPO"    },
    { slug: "asus",     name: "ASUS"     }, { slug: "google",  name: "Google"  },
  ];

  const isAndroidApp = navigator.userAgent.includes("GSMWorldApp");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#060b15", color: "#e2e8f0" }}>

      {/* ─── HERO ──────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(170deg,#0d1b2e 0%,#070d1a 65%,#060b15 100%)", minHeight: 320 }}>

        {/* Animated gradient orbs */}
        <div className="absolute pointer-events-none gsm-float-slow"
          style={{ top: -60, right: -60, width: 220, height: 220,
            background: "radial-gradient(circle,rgba(59,130,246,0.22) 0%,transparent 65%)" }} />
        <div className="absolute pointer-events-none gsm-float"
          style={{ top: 30, left: -40, width: 180, height: 180,
            background: "radial-gradient(circle,rgba(139,92,246,0.18) 0%,transparent 65%)" }} />
        <div className="absolute pointer-events-none gsm-pulse-orb"
          style={{ bottom: -20, right: "30%", width: 140, height: 140,
            background: "radial-gradient(circle,rgba(99,102,241,0.2) 0%,transparent 65%)" }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-10 pb-8">

          {/* Animated trust badge */}
          <div className="gsm-badge-pop inline-flex items-center gap-2 mb-5 px-3.5 py-1.5 rounded-full text-xs font-bold gsm-ring-pulse"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.32)", color: "#93c5fd" }}>
            <Star size={11} fill="#93c5fd" />
            Trusted by 10,000+ customers · Since 2016
          </div>

          <h1 className="font-black leading-tight tracking-tight mb-3 gsm-hero-in"
            style={{ fontSize: "clamp(30px,7.5vw,46px)", color: "#f8fafc", animationDelay: "0.1s" }}>
            The World&apos;s #1<br />
            <span className="gsm-shimmer">GSM Unlock Hub</span>
          </h1>

          <p className="text-sm leading-relaxed mb-6 max-w-xs gsm-hero-in"
            style={{ color: "#94a3b8", animationDelay: "0.22s" }}>
            Phone unlocks · iCloud removal · Server credits · Gift cards — delivered instantly worldwide.
          </p>

          {/* CTA buttons */}
          <div className="flex gap-3 mb-6 gsm-hero-in" style={{ animationDelay: "0.34s" }}>
            <Link href="/products">
              <button className="gsm-btn-primary flex items-center gap-2 font-black text-sm px-5 py-3 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 4px 24px rgba(99,102,241,0.45)" }}>
                Browse Store <ArrowRight size={14} />
              </button>
            </Link>
            <Link href="/direct-unlock">
              <button className="gsm-btn-primary flex items-center gap-2 font-black text-sm px-5 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#e2e8f0" }}>
                <Unlock size={14} /> Unlock
              </button>
            </Link>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="w-full max-w-sm gsm-hero-in" style={{ animationDelay: "0.46s" }}>
            <div className="relative flex items-center">
              <Search size={15} className="absolute left-3.5 pointer-events-none" style={{ color: "#475569" }} />
              <input
                type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search — iPhone, Samsung, Steam..."
                className="w-full pl-10 pr-20 py-3.5 rounded-2xl text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)", color: "#f1f5f9", caretColor: "#60a5fa" }}
              />
              <button type="submit" className="absolute right-1.5 text-xs font-black px-3.5 py-2 rounded-xl text-white"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>Search</button>
            </div>
          </form>
        </div>

        {/* Animated stats strip */}
        <div className="relative z-10 grid grid-cols-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}>
          {[
            { value: totalProducts ?? 1500, suffix: "+", label: "Products" },
            { value: totalCategories ?? 50,  suffix: "+", label: "Categories" },
            { value: "24/7", label: "Support" },
          ].map(({ value, suffix, label }, i) => (
            <div key={label} className="flex flex-col items-center py-3.5"
              style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : undefined }}>
              <span className="font-black text-lg leading-none" style={{ color: "#f8fafc" }}>
                {typeof value === "number"
                  ? <AnimCount target={value} suffix={suffix ?? ""} />
                  : <>{value}</>}
              </span>
              <span className="text-[10px] font-bold mt-0.5 uppercase tracking-widest" style={{ color: "#60a5fa" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── FREE IMEI CHECKER ─────────────────────────────────────────────────── */}
      <HomeImeiChecker />

      {/* ─── APP BANNER ────────────────────────────────────────────────────────── */}
      <AnimSection className="px-4 pt-5 pb-1">
        {isAndroidApp ? (
          <button className="w-full flex items-center gap-4 rounded-2xl px-4 py-4 active:scale-[0.98] transition-transform select-none"
            style={{ background: "linear-gradient(135deg,#14532d,#166534 60%,#15803d)", border: "1px solid rgba(74,222,128,0.25)", boxShadow: "0 4px 28px rgba(22,101,52,0.45)" }}
            onClick={() => {
              try {
                // Web content auto-updates from Vercel — just reload to get the latest
                const url = new URL(window.location.href);
                url.searchParams.set("_v", String(Date.now()));
                window.location.replace(url.toString());
              } catch {
                window.location.reload();
              }
            }}>
            <AppBannerContent isUpdate />
          </button>
        ) : (
          <a href="/api/download/apk" download="GSMWorld.apk"
            className="flex items-center gap-4 rounded-2xl px-4 py-4 active:scale-[0.98] transition-transform select-none"
            style={{ background: "linear-gradient(135deg,#14532d,#166534 60%,#15803d)", border: "1px solid rgba(74,222,128,0.25)", boxShadow: "0 4px 28px rgba(22,101,52,0.45)" }}>
            <AppBannerContent isUpdate={false} />
          </a>
        )}
      </AnimSection>

      {/* ─── SERVICES GRID ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-7 pb-2">
        <AnimSection>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4 text-center" style={{ color: "#334155" }}>Our Services</p>
        </AnimSection>
        <div className="grid grid-cols-2 gap-3">
          {services.map(({ icon, iconColor, label, desc, href, grad, border, glow }, i) => (
            <AnimSection key={label} delay={i * 60}>
              <Link href={href}>
                <div className="gsm-service-card relative rounded-2xl p-4 cursor-pointer overflow-hidden"
                  style={{ background: grad, border: `1px solid ${border}`, minHeight: 110,
                    boxShadow: `0 4px 20px ${glow}, 0 1px 3px rgba(0,0,0,0.3)` }}>
                  {/* Glow dot */}
                  <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none rounded-bl-full"
                    style={{ background: `radial-gradient(circle at top right,${glow.replace("0.15","0.25")},transparent 70%)` }} />
                  <div className="mb-3 w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.06)", color: iconColor }}>
                    {icon}
                  </div>
                  <p className="font-black text-[13px] leading-tight mb-1" style={{ color: "#f1f5f9" }}>{label}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
                  <ChevronRight size={12} className="absolute right-3 top-3" style={{ color: "#374151" }} />
                </div>
              </Link>
            </AnimSection>
          ))}
        </div>
      </div>

      {/* ─── TRUST STATS ───────────────────────────────────────────────────────── */}
      <AnimSection className="px-4 py-6">
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg,#0d1b35,#0f2040)", border: "1px solid rgba(99,102,241,0.18)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          {/* Header */}
          <div className="px-5 pt-5 pb-3 text-center">
            <span className="inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2"
              style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
              Why GSM World
            </span>
            <h2 className="font-black leading-tight" style={{ fontSize: 17, color: "#f8fafc" }}>
              The Most Trusted GSM Platform
            </h2>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-0 border-t border-b" style={{ borderColor: "rgba(99,102,241,0.1)" }}>
            {[
              { icon: <Package size={14} />, num: totalProducts ?? 1500, suffix: "+", label: "Products" },
              { icon: <Users size={14} />,   num: 10000, suffix: "+", label: "Customers" },
              { icon: <Clock size={14} />,   num: 8,     suffix: "yr+", label: "Experience" },
            ].map(({ icon, num, suffix, label }, i) => (
              <div key={label} className="flex flex-col items-center py-4"
                style={{ borderRight: i < 2 ? "1px solid rgba(99,102,241,0.1)" : undefined }}>
                <div className="mb-1" style={{ color: "#818cf8" }}>{icon}</div>
                <p className="font-black text-lg leading-none" style={{ color: "#f8fafc" }}>
                  <AnimCount target={num} suffix={suffix} />
                </p>
                <p className="text-[9px] font-bold mt-0.5 uppercase tracking-widest" style={{ color: "#6366f1" }}>{label}</p>
              </div>
            ))}
          </div>
          {/* Features */}
          <div className="grid grid-cols-2 gap-2 p-4">
            {[
              { icon: <Zap size={13} className="text-yellow-400" />,       label: "Instant Delivery",  desc: "Delivered after payment" },
              { icon: <ShieldCheck size={13} className="text-green-400" />, label: "Secure Payments",   desc: "M-Pesa, USDT & crypto" },
              { icon: <Globe size={13} className="text-blue-400" />,        label: "50+ Countries",     desc: "Worldwide coverage" },
              { icon: <Headphones size={13} className="text-violet-400" />, label: "24/7 Support",      desc: "WhatsApp & Telegram" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex items-start gap-2.5 rounded-xl p-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div>
                  <p className="font-bold text-[11px] leading-tight" style={{ color: "#e2e8f0" }}>{label}</p>
                  <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "#475569" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AnimSection>

      {/* ─── CATEGORIES ────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <AnimSection>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-[15px]" style={{ color: "#f1f5f9" }}>Popular Categories</h3>
            <Link href="/categories">
              <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#60a5fa" }}>
                View all <ArrowRight size={12} />
              </span>
            </Link>
          </div>
        </AnimSection>
        <div className="grid grid-cols-3 gap-2">
          {categories.map(({ label, emoji, href, bg, border }, i) => (
            <AnimSection key={label} delay={i * 50}>
              <Link href={href}>
                <div className="gsm-cat-pill rounded-2xl p-3 text-center cursor-pointer"
                  style={{ background: bg, border: `1px solid ${border}` }}>
                  <span className="text-2xl block mb-1.5">{emoji}</span>
                  <p className="font-bold text-[10px] leading-tight" style={{ color: "#cbd5e1" }}>{label}</p>
                </div>
              </Link>
            </AnimSection>
          ))}
        </div>
      </div>

      {/* ─── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <AnimSection className="px-4 pb-7">
        <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-center" style={{ color: "#334155" }}>Simple Process</p>
        <h3 className="font-black text-[15px] text-center mb-5" style={{ color: "#f1f5f9" }}>How It Works</h3>
        <div className="space-y-3 relative">
          <div className="absolute left-[19px] top-6 bottom-6 w-px"
            style={{ background: "linear-gradient(to bottom,rgba(59,130,246,0.4),rgba(139,92,246,0.4))" }} />
          {[
            { n:1, emoji:"🛒", title:"Browse & Select",  desc:"Choose from 1,500+ products across 50+ categories." },
            { n:2, emoji:"💳", title:"Pay Securely",     desc:"M-Pesa, USDT, crypto & more payment options." },
            { n:3, emoji:"⚡", title:"Fast Processing",  desc:"Admin reviews your order — usually within hours." },
            { n:4, emoji:"📧", title:"Email Delivery",   desc:"Codes, credits & activations sent to your inbox." },
          ].map(({ n, emoji, title, desc }) => (
            <div key={n} className="flex items-start gap-3.5">
              <div className="relative z-10 shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black border text-sm"
                style={{ background: "#0d1b35", borderColor: "rgba(99,102,241,0.4)", color: "#818cf8", minWidth: 36 }}>
                {n}
              </div>
              <div className="flex-1 rounded-2xl p-3.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="font-bold text-[13px] leading-tight mb-0.5" style={{ color: "#f1f5f9" }}>
                  {emoji} {title}
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: "#475569" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </AnimSection>

      {/* ─── SUPPORTED BRANDS ──────────────────────────────────────────────────── */}
      <AnimSection className="px-4 pb-7">
        <p className="text-[10px] font-black uppercase tracking-widest text-center mb-3" style={{ color: "#334155" }}>
          Supported Brands &amp; Tools
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {brands.map(({ slug, name }) => (
            <div key={slug} title={name}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform active:scale-95"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <img src={`https://cdn.simpleicons.org/${slug}/94a3b8`} alt={name} className="w-6 h-6 object-contain" loading="lazy" />
            </div>
          ))}
        </div>
      </AnimSection>

      {/* ─── RESELLER CTA ──────────────────────────────────────────────────────── */}
      <AnimSection className="px-4 pb-7">
        <div className="rounded-2xl p-5 overflow-hidden relative"
          style={{ background: "linear-gradient(135deg,#0d4f3c,#1a7a5e)", boxShadow: "0 8px 32px rgba(13,79,60,0.4)" }}>
          <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none opacity-10"
            style={{ background: "radial-gradient(circle,#fff,transparent 70%)", transform: "translate(30%,-30%)" }} />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full text-[10px] font-black"
              style={{ background: "rgba(255,255,255,0.15)", color: "#a7f3d0" }}>
              <Store size={10} /> Reseller Program
            </div>
            <h3 className="font-black text-white text-lg leading-tight mb-1.5">Earn 10% on Every Sale</h3>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: "rgba(167,243,208,0.7)" }}>
              Get your own branded store link, share it, and earn 10% commission on every order placed through your link.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { icon: <TrendingUp size={13} />, label: "10% Commission" },
                { icon: <DollarSign size={13} />, label: "$10 Min Payout" },
                { icon: <Store size={13} />,       label: "Own Store URL"  },
              ].map(f => (
                <div key={f.label} className="rounded-xl py-2 px-1.5 text-center"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <div className="flex justify-center text-green-200 mb-1">{f.icon}</div>
                  <p className="text-[9px] font-bold text-green-100/80 leading-tight">{f.label}</p>
                </div>
              ))}
            </div>
            <Link href="/reseller">
              <button className="gsm-btn-primary w-full py-3 font-black text-sm rounded-xl flex items-center justify-center gap-2"
                style={{ background: "rgba(255,255,255,0.95)", color: "#0d4f3c" }}>
                Apply to Become a Reseller <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        </div>
      </AnimSection>

      {/* ─── CONTACT CTA ───────────────────────────────────────────────────────── */}
      <AnimSection className="px-4 pb-12">
        <div className="rounded-2xl p-5 text-center"
          style={{ background: "linear-gradient(135deg,#0d1828,#131f33)", border: "1px solid rgba(255,255,255,0.07)" }}>
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
              className="gsm-btn-primary flex items-center gap-2 font-bold text-sm text-white rounded-xl px-5 py-2.5"
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
            <a href="https://t.me/markjsbb" target="_blank" rel="noreferrer"
              className="gsm-btn-primary flex items-center gap-2 font-bold text-sm text-white rounded-xl px-5 py-2.5"
              style={{ background: "linear-gradient(135deg,#229ED9,#1a7fbf)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Telegram
            </a>
          </div>
        </div>
      </AnimSection>

    </div>
  );
}

function AppBannerContent({ isUpdate }: { isUpdate: boolean }) {
  return (
    <>
      <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#4ade80">
          <path d="M17.523 15.341a.5.5 0 01-.5.5H6.977a.5.5 0 01-.5-.5V9.5h11.046v5.841zm.5-9.341H5.977l1.65-2.859a.5.5 0 01.866.5L7.25 5h9.5l-1.243-2.159a.5.5 0 01.866-.5L18.023 6zM3 9.5A1.5 1.5 0 014.5 8H4V7a1 1 0 012 0v1h12V7a1 1 0 012 0v1h-.5A1.5 1.5 0 0121 9.5v6a1.5 1.5 0 01-1.5 1.5v1.5a1 1 0 01-2 0V17H6.5v1.5a1 1 0 01-2 0V17A1.5 1.5 0 013 15.5v-6z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-[14px] text-white leading-tight">
          {isUpdate ? "Update GSM World App" : "Get the GSM World App"}
        </p>
        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#86efac" }}>
          {isUpdate ? "Download & install the latest version" : "Faster · Offline-ready · Instant notifications"}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5 font-black text-[11px] text-white rounded-xl px-3 py-2"
        style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.2)" }}>
        <Download size={13} />
        {isUpdate ? "Update" : "Download"}
      </div>
    </>
  );
}
