import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useListProducts, useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Search, ShoppingCart, Check, Cpu, X, Smartphone,
  AlertCircle, Loader2, CheckCircle2, Shield, Unlock,
  ChevronRight, AlertTriangle,
} from "lucide-react";
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

type ImeiResult = {
  imei: string;
  tac: string;
  valid: boolean;
  manufacturer: string | null;
  brand: string | null;
  model: string | null;
  marketingName: string | null;
  source: string;
  note?: string;
};

const BRAND_MAP: Record<string, string> = {
  "Apple":   "iPhone / iCloud",
  "Samsung": "Samsung",
  "Huawei":  "Huawei",
  "Google":  "Google Pixel",
  "Xiaomi":  "Xiaomi / Redmi / POCO",
  "Nokia":   "Nokia",
  "LG":      "LG",
  "Motorola":"Motorola",
  "Sony":    "Sony",
  "OnePlus": "OnePlus",
  "Oppo":    "Oppo / Realme",
  "Realme":  "Oppo / Realme",
  "Vivo":    "Vivo",
  "HTC":     "Other Brand",
  "BlackBerry": "Other Brand",
};

const ALL_BRANDS = [
  "Samsung", "Apple", "Huawei", "Xiaomi", "Nokia", "LG",
  "Motorola", "Sony", "OnePlus", "Oppo", "Vivo", "Google",
];

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

function FreeLookupSection() {
  const [, navigate] = useLocation();
  const [imei, setImei] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImeiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  function apiBase() {
    return (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  }

  async function handleCheck() {
    const val = imei.replace(/[\s\-]/g, "").trim();
    if (!val) return;

    if (!luhnValid(val)) {
      setError("Invalid IMEI — the check digit doesn't match. Dial *#06# on your device to get the correct IMEI.");
      setResult(null);
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setSelectedBrand("");

    try {
      const res = await fetch(`${apiBase()}/api/imei/lookup?imei=${encodeURIComponent(val)}`);
      const data = await res.json() as ImeiResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Lookup failed. Please try again.");
      } else {
        setResult(data);
        const detected = data.brand ?? data.manufacturer ?? null;
        if (detected && BRAND_MAP[detected]) {
          setSelectedBrand(detected);
        }
      }
    } catch {
      if (luhnValid(val)) {
        setResult({
          imei: val, tac: val.slice(0, 8), valid: true,
          manufacturer: null, brand: null, model: null, marketingName: null,
          source: "luhn-only",
          note: "IMEI format is valid. Device model info temporarily unavailable.",
        });
      } else {
        setError("Network error — please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleUnlock() {
    const catalogBrand = selectedBrand ? (BRAND_MAP[selectedBrand] ?? null) : null;
    const q = catalogBrand ? `?brand=${encodeURIComponent(catalogBrand)}&imei=${encodeURIComponent(result?.imei ?? "")}` : "";
    navigate(`/direct-unlock${q}`);
  }

  const displayBrand = result?.brand ?? result?.manufacturer ?? null;
  const displayModel = result?.marketingName ?? result?.model ?? null;

  return (
    <div className="mx-4 mt-4 mb-1 rounded-2xl overflow-hidden" style={{ background: "rgba(15,30,50,0.9)", border: "1px solid rgba(20,184,166,0.25)" }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ background: "linear-gradient(135deg,rgba(13,46,46,0.95),rgba(15,95,95,0.6))", borderBottom: "1px solid rgba(20,184,166,0.2)" }}>
        <Shield size={15} className="text-teal-400" />
        <p className="font-black text-sm text-white">Free IMEI Check &amp; Blacklist Verifier</p>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(20,184,166,0.2)", color: "#5eead4", border: "1px solid rgba(20,184,166,0.3)" }}>FREE</span>
      </div>

      <div className="p-4">
        <p className="text-[11px] mb-3" style={{ color: "#64748b" }}>
          Enter any 15-digit IMEI to check device info &amp; network lock status instantly.
        </p>

        {/* Input row */}
        <div className="flex gap-2">
          <input
            type="tel"
            value={imei}
            onChange={e => { setImei(e.target.value); setResult(null); setError(null); }}
            onKeyDown={e => { if (e.key === "Enter") handleCheck(); }}
            placeholder="Enter 15-digit IMEI (e.g. 358401059999991)"
            maxLength={20}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#f1f5f9",
              caretColor: "#5eead4",
            }}
          />
          <button
            onClick={handleCheck}
            disabled={loading || imei.replace(/[\s\-]/g, "").length < 15}
            className="px-4 py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-all flex items-center gap-1.5"
            style={{ background: "linear-gradient(135deg,#0f766e,#0d9488)" }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? "Checking…" : "Check"}
          </button>
        </div>

        <p className="text-[10px] mt-1.5" style={{ color: "#475569" }}>
          Tip: dial <span className="font-mono font-bold text-teal-400">*#06#</span> on your device to get the IMEI.
        </p>

        {/* Error */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl p-3"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-300">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-3 space-y-3">
            {/* Valid badge + device info */}
            <div className="rounded-xl p-3.5 space-y-3"
              style={{ background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                <p className="text-[13px] font-black text-white">Valid IMEI — Format Confirmed</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InfoTile label="IMEI" value={result.imei} />
                <InfoTile label="TAC Code" value={result.tac} />
                {displayBrand && <InfoTile label="Brand" value={displayBrand} />}
                {displayModel && <InfoTile label="Model" value={displayModel} />}
              </div>
              {result.note && (
                <p className="text-[10px] italic" style={{ color: "#64748b" }}>{result.note}</p>
              )}
            </div>

            {/* Blacklist / Network Lock Status */}
            <div className="rounded-xl p-3.5"
              style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
                <p className="text-[12px] font-black text-yellow-300">Blacklist &amp; Network Lock Status</p>
              </div>
              <div className="space-y-1.5">
                <StatusRow label="IMEI Validity" status="pass" text="Clean — check digit matches" />
                <StatusRow label="Blacklist Check" status="unknown" text="Requires carrier verification" />
                <StatusRow label="Network Lock"   status="unknown" text="Status unknown without carrier" />
              </div>
              <p className="text-[10px] mt-2.5" style={{ color: "#94a3b8" }}>
                Carrier blacklist and network lock checks require a direct query to your mobile operator. Our unlock service removes all types of carrier locks regardless of status.
              </p>
            </div>

            {/* Brand selector if not detected */}
            {!displayBrand && (
              <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[11px] font-bold text-white mb-2">Select your device brand to continue:</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_BRANDS.map(b => (
                    <button key={b}
                      onClick={() => setSelectedBrand(b === selectedBrand ? "" : b)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                      style={{
                        background: selectedBrand === b ? "rgba(20,184,166,0.25)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${selectedBrand === b ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.1)"}`,
                        color: selectedBrand === b ? "#5eead4" : "#94a3b8",
                      }}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleUnlock}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
              <Unlock size={16} />
              Unlock My Device Now
              <ChevronRight size={15} />
            </button>
            {(displayBrand || selectedBrand) && (
              <p className="text-[10px] text-center" style={{ color: "#475569" }}>
                → Unlocking {displayBrand ?? selectedBrand} devices starting from $10
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#475569" }}>{label}</p>
      <p className="text-[12px] font-bold text-white truncate mt-0.5">{value}</p>
    </div>
  );
}

function StatusRow({ label, status, text }: { label: string; status: "pass" | "fail" | "unknown"; text: string }) {
  const colors = {
    pass:    { dot: "#22c55e", text: "#86efac" },
    fail:    { dot: "#ef4444", text: "#fca5a5" },
    unknown: { dot: "#f59e0b", text: "#fcd34d" },
  }[status];
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.dot }} />
      <span className="text-[11px] font-bold" style={{ color: "#cbd5e1", minWidth: 130 }}>{label}:</span>
      <span className="text-[11px]" style={{ color: colors.text }}>{text}</span>
    </div>
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
    <div className="flex flex-col min-h-full pb-8" style={{ background: "#0a0f1a" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#0d2e2e 0%,#0f5f5f 100%)" }} className="px-4 pt-5 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Cpu size={18} className="text-teal-300" />
          <h1 className="text-white font-black text-lg">IMEI Services</h1>
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(20,184,166,0.2)", border: "1px solid rgba(20,184,166,0.3)", color: "#5eead4" }}>
            {allImei.length} Services
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: "rgba(94,234,212,0.6)" }}>
          IMEI check, blacklist removal, IMEI repair &amp; FRP unlock by IMEI/SN for all devices
        </p>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search device or service type…"
            className="w-full pl-9 pr-9 py-3 rounded-2xl text-sm focus:outline-none"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#f1f5f9" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Free IMEI Checker Tool */}
      <FreeLookupSection />

      {/* Service type tabs */}
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#475569" }}>Paid IMEI Services</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SERVICE_TABS.map((tab, i) => (
            <button key={tab.label} onClick={() => { setActiveTab(i); setSearch(""); }}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-colors"
              style={{
                background: activeTab === i ? "#0f766e" : "rgba(255,255,255,0.06)",
                color: activeTab === i ? "#fff" : "#94a3b8",
                border: `1px solid ${activeTab === i ? "#0f766e" : "rgba(255,255,255,0.1)"}`,
              }}>
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
            <Cpu size={44} style={{ color: "#1e293b" }} />
            <p className="font-bold" style={{ color: "#475569" }}>No services found</p>
            {search && (
              <button onClick={() => setSearch("")} className="text-sm font-bold" style={{ color: "#14b8a6" }}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, products]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-black" style={{ color: "#e2e8f0" }}>{cat}</p>
                <span className="text-[10px]" style={{ color: "#475569" }}>{products.length} services</span>
              </div>
              <div className="space-y-2">
                {products.map(p => (
                  <Link href={`/products/${p.id}`} key={p.id}>
                    <div className="rounded-2xl px-3.5 py-3 flex items-center gap-3 transition-all active:scale-95"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ background: "linear-gradient(135deg,#0f766e,#0d9488)" }}>
                        <img src={p.imageUrl ?? undefined} alt={p.name} className="w-full h-full object-contain p-1"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold line-clamp-2 leading-snug" style={{ color: "#f1f5f9" }}>{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${typeColor(cat)}`}>
                            {typeLabel(cat)}
                          </span>
                          <span className="text-[11px] font-black" style={{ color: "#14b8a6" }}>${p.price.toFixed(2)}</span>
                          {!p.inStock && <span className="text-[9px] font-bold text-red-400">Out of stock</span>}
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
          <p className="text-center text-[11px] py-2" style={{ color: "#475569" }}>
            {searched.length} service{searched.length !== 1 ? "s" : ""} shown
          </p>
        )}
      </div>
    </div>
  );
}
