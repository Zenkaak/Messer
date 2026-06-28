import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Share2, Smartphone, ShieldCheck, Zap, BadgeCheck,
  Copy, Check, Upload, ImageIcon, MessageCircle, ChevronRight,
  AlertTriangle, LogIn, Loader2, X, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PaymentDetails {
  usdtAddress: string | null;
  usdtNetwork: string | null;
  binancePayId: string | null;
  whatsapp: string | null;
}
interface OrderResult {
  orderId: number;
  orderCode: string;
  paymentMethod: string;
  total: number;
  paymentDetails: PaymentDetails;
  customerEmail: string;
}

// ── Device catalog ────────────────────────────────────────────────────────────
type DeviceModel = { name: string; price: number };
type BrandEntry = { label: string; icon: string; models: DeviceModel[] };

const DEVICE_CATALOG: BrandEntry[] = [
  {
    label: "Apple iPhone", icon: "🍎",
    models: [
      { name: "iPhone 4", price: 8 }, { name: "iPhone 4S", price: 8 }, { name: "iPhone 5", price: 8 },
      { name: "iPhone 5C", price: 8 }, { name: "iPhone 5S", price: 9 }, { name: "iPhone 6", price: 9 },
      { name: "iPhone 6 Plus", price: 9 }, { name: "iPhone 6S", price: 10 }, { name: "iPhone 6S Plus", price: 10 },
      { name: "iPhone SE (1st Gen)", price: 10 }, { name: "iPhone 7", price: 11 }, { name: "iPhone 7 Plus", price: 12 },
      { name: "iPhone 8", price: 12 }, { name: "iPhone 8 Plus", price: 13 }, { name: "iPhone X", price: 14 },
      { name: "iPhone XR", price: 14 }, { name: "iPhone XS", price: 15 }, { name: "iPhone XS Max", price: 15 },
      { name: "iPhone SE (2nd Gen)", price: 14 }, { name: "iPhone 11", price: 15 }, { name: "iPhone 11 Pro", price: 16 },
      { name: "iPhone 11 Pro Max", price: 16 }, { name: "iPhone 12 Mini", price: 16 }, { name: "iPhone 12", price: 17 },
      { name: "iPhone 12 Pro", price: 17 }, { name: "iPhone 12 Pro Max", price: 18 }, { name: "iPhone SE (3rd Gen)", price: 17 },
      { name: "iPhone 13 Mini", price: 18 }, { name: "iPhone 13", price: 18 }, { name: "iPhone 13 Pro", price: 19 },
      { name: "iPhone 13 Pro Max", price: 19 }, { name: "iPhone 14", price: 20 }, { name: "iPhone 14 Plus", price: 21 },
      { name: "iPhone 14 Pro", price: 22 }, { name: "iPhone 14 Pro Max", price: 23 }, { name: "iPhone 15", price: 24 },
      { name: "iPhone 15 Plus", price: 25 }, { name: "iPhone 15 Pro", price: 26 }, { name: "iPhone 15 Pro Max", price: 27 },
      { name: "iPhone 16", price: 28 }, { name: "iPhone 16 Plus", price: 29 }, { name: "iPhone 16 Pro", price: 30 },
      { name: "iPhone 16 Pro Max", price: 32 },
    ],
  },
  {
    label: "Samsung Galaxy S", icon: "🌀",
    models: [
      { name: "Galaxy S7", price: 10 }, { name: "Galaxy S7 Edge", price: 10 }, { name: "Galaxy S8", price: 12 },
      { name: "Galaxy S8+", price: 12 }, { name: "Galaxy S9", price: 13 }, { name: "Galaxy S9+", price: 13 },
      { name: "Galaxy S10e", price: 14 }, { name: "Galaxy S10", price: 14 }, { name: "Galaxy S10+", price: 15 },
      { name: "Galaxy S10 5G", price: 15 }, { name: "Galaxy S20", price: 16 }, { name: "Galaxy S20+", price: 17 },
      { name: "Galaxy S20 Ultra", price: 17 }, { name: "Galaxy S20 FE", price: 15 }, { name: "Galaxy S21", price: 17 },
      { name: "Galaxy S21+", price: 18 }, { name: "Galaxy S21 Ultra", price: 19 }, { name: "Galaxy S21 FE", price: 16 },
      { name: "Galaxy S22", price: 19 }, { name: "Galaxy S22+", price: 20 }, { name: "Galaxy S22 Ultra", price: 22 },
      { name: "Galaxy S23", price: 21 }, { name: "Galaxy S23+", price: 22 }, { name: "Galaxy S23 Ultra", price: 24 },
      { name: "Galaxy S23 FE", price: 19 }, { name: "Galaxy S24", price: 23 }, { name: "Galaxy S24+", price: 25 },
      { name: "Galaxy S24 Ultra", price: 27 }, { name: "Galaxy S24 FE", price: 21 }, { name: "Galaxy S25", price: 26 },
      { name: "Galaxy S25+", price: 28 }, { name: "Galaxy S25 Ultra", price: 30 },
    ],
  },
  {
    label: "Samsung Galaxy A", icon: "📱",
    models: [
      { name: "Galaxy A03", price: 10 }, { name: "Galaxy A03s", price: 10 }, { name: "Galaxy A04", price: 10 },
      { name: "Galaxy A04s", price: 10 }, { name: "Galaxy A05", price: 10 }, { name: "Galaxy A05s", price: 10 },
      { name: "Galaxy A13", price: 11 }, { name: "Galaxy A14", price: 11 }, { name: "Galaxy A15", price: 12 },
      { name: "Galaxy A23", price: 12 }, { name: "Galaxy A24", price: 12 }, { name: "Galaxy A25", price: 13 },
      { name: "Galaxy A33 5G", price: 13 }, { name: "Galaxy A34 5G", price: 14 }, { name: "Galaxy A35 5G", price: 15 },
      { name: "Galaxy A50", price: 12 }, { name: "Galaxy A51", price: 13 }, { name: "Galaxy A52", price: 14 },
      { name: "Galaxy A53 5G", price: 15 }, { name: "Galaxy A54 5G", price: 16 }, { name: "Galaxy A55 5G", price: 17 },
      { name: "Galaxy A70", price: 13 }, { name: "Galaxy A71", price: 14 }, { name: "Galaxy A72", price: 15 },
      { name: "Galaxy A73 5G", price: 16 },
    ],
  },
  {
    label: "Samsung Galaxy Note", icon: "✏️",
    models: [
      { name: "Galaxy Note 8", price: 13 }, { name: "Galaxy Note 9", price: 14 }, { name: "Galaxy Note 10", price: 16 },
      { name: "Galaxy Note 10+", price: 17 }, { name: "Galaxy Note 10 Lite", price: 14 },
      { name: "Galaxy Note 20", price: 18 }, { name: "Galaxy Note 20 Ultra", price: 20 },
    ],
  },
  {
    label: "Samsung Galaxy Z", icon: "🔀",
    models: [
      { name: "Galaxy Z Flip", price: 20 }, { name: "Galaxy Z Flip 3", price: 22 }, { name: "Galaxy Z Flip 4", price: 24 },
      { name: "Galaxy Z Flip 5", price: 26 }, { name: "Galaxy Z Flip 6", price: 28 }, { name: "Galaxy Z Fold 2", price: 25 },
      { name: "Galaxy Z Fold 3", price: 27 }, { name: "Galaxy Z Fold 4", price: 30 }, { name: "Galaxy Z Fold 5", price: 33 },
      { name: "Galaxy Z Fold 6", price: 35 },
    ],
  },
  {
    label: "Samsung Galaxy M", icon: "💫",
    models: [
      { name: "Galaxy M12", price: 10 }, { name: "Galaxy M13", price: 10 }, { name: "Galaxy M14", price: 11 },
      { name: "Galaxy M23", price: 11 }, { name: "Galaxy M33 5G", price: 12 }, { name: "Galaxy M34 5G", price: 13 },
      { name: "Galaxy M52 5G", price: 13 }, { name: "Galaxy M53 5G", price: 14 }, { name: "Galaxy M54 5G", price: 15 },
    ],
  },
];

function isValidImei(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(imei[i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// ── Colours & tokens ──────────────────────────────────────────────────────────
const BG = "linear-gradient(180deg,#06101e 0%,#0b1a35 100%)";
const ACCENT = "#3b82f6";
const ACCENT_GLOW = "rgba(59,130,246,0.35)";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";

// ── Progress bar ──────────────────────────────────────────────────────────────
const STEPS = ["Device", "IMEI", "Details", "Review"];

function StepBar({ current }: { current: number }) {
  return (
    <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", gap: 0 }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: done ? ACCENT : active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.06)",
                border: `2px solid ${done ? ACCENT : active ? ACCENT : "rgba(255,255,255,0.12)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: active ? `0 0 0 4px ${ACCENT_GLOW}` : "none",
                transition: "all 0.3s",
              }}>
                {done
                  ? <Check size={14} color="white" />
                  : <span style={{ fontSize: 12, fontWeight: 800, color: active ? ACCENT : "#475569" }}>{i + 1}</span>
                }
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? ACCENT : done ? "#94a3b8" : "#334155", whiteSpace: "nowrap", letterSpacing: 0.3 }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? ACCENT : "rgba(255,255,255,0.08)", margin: "0 4px", marginBottom: 18, borderRadius: 2, transition: "background 0.3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Select input ──────────────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder: string; disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: 8 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{ width: "100%", padding: "13px 40px 13px 16px", background: value ? "rgba(59,130,246,0.07)" : SURFACE, border: `1.5px solid ${value ? "rgba(59,130,246,0.4)" : BORDER}`, borderRadius: 14, color: value ? "#e2e8f0" : "#475569", fontSize: 15, cursor: disabled ? "not-allowed" : "pointer", appearance: "none", WebkitAppearance: "none", outline: "none", transition: "border-color 0.2s", opacity: disabled ? 0.4 : 1, boxSizing: "border-box" }}
        >
          <option value="" style={{ background: "#1e293b" }}>{placeholder}</option>
          {options.map(o => <option key={o.value} value={o.value} style={{ background: "#1e293b" }}>{o.label}</option>)}
        </select>
        <ChevronRight size={15} color="#475569" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%) rotate(90deg)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

// ── Text input ────────────────────────────────────────────────────────────────
function TextField({ label, type = "text", value, onChange, placeholder, note, rightEl, monospace, inputMode }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder: string; note?: string; rightEl?: React.ReactNode; monospace?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: 8 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          style={{ width: "100%", padding: rightEl ? "13px 48px 13px 16px" : "13px 16px", background: value ? "rgba(59,130,246,0.07)" : SURFACE, border: `1.5px solid ${value ? "rgba(59,130,246,0.4)" : BORDER}`, borderRadius: 14, color: "#e2e8f0", fontSize: monospace ? 18 : 15, fontFamily: monospace ? "'SF Mono','Fira Code','Courier New',monospace" : "inherit", letterSpacing: monospace ? 2 : "normal", outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.2s" }}
        />
        {rightEl && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>{rightEl}</div>
        )}
      </div>
      {note && <div style={{ fontSize: 11, color: "#475569", marginTop: 6, paddingLeft: 2 }}>{note}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ImeiRepairPage() {
  const [, navigate] = useLocation();
  const { user, token, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // wizard
  const [step, setStep] = useState(0); // 0-3 = form steps, "done" = confirmation

  // form data
  const [brandLabel, setBrandLabel] = useState("");
  const [modelName, setModelName] = useState("");
  const [imei, setImei] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState<"binance_pay" | "usdt_manual">("binance_pay");

  // state
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  // upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const brandEntry = DEVICE_CATALOG.find(b => b.label === brandLabel);
  const models = brandEntry?.models ?? [];
  const selectedModel = models.find(m => m.name === modelName);
  const price = selectedModel?.price ?? null;
  const imeiTouched = imei.length > 0;
  const imeiValid = isValidImei(imei);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2500);
      toast({ title: "Copied to clipboard" });
    });
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) { navigator.share({ title: "IMEI Repair — GSM World", url }).catch(() => {}); }
    else { navigator.clipboard.writeText(url).then(() => { setShared(true); setTimeout(() => setShared(false), 2500); toast({ title: "Link copied!" }); }); }
  }

  function handleFile(file: File | null) {
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = e => setUploadPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!isAuthenticated) { navigate("/login"); return; }
    setLoading(true);
    setFormError("");
    try {
      const res = await fetch("/api/imei-repair/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ brand: brandLabel, model: modelName, imei, customerEmail: email, customerPhone: phone || undefined, paymentMethod: payMethod }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Something went wrong."); return; }
      setOrder({ ...data, customerEmail: email });
    } catch { setFormError("Network error — please try again."); }
    finally { setLoading(false); }
  }

  async function handleUpload() {
    if (!uploadFile || !order) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("orderId", String(order.orderId));
      fd.append("orderCode", order.orderCode);
      const res = await fetch("/api/uploads/payment-proof", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      if (res.ok) { setUploadDone(true); toast({ title: "Screenshot sent!", description: "We'll verify your payment shortly." }); }
      else { toast({ title: "Upload failed", variant: "destructive" }); }
    } catch { toast({ title: "Upload error", variant: "destructive" }); }
    finally { setUploading(false); }
  }

  // ── Common page shell ─────────────────────────────────────────────────────
  function Shell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: "#e2e8f0", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 60 }}>
        {/* Nav */}
        <div style={{ background: "rgba(6,16,30,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${BORDER}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => order ? navigate("/") : step > 0 ? setStep(step - 1) : navigate(-1 as unknown as string)} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, padding: 8, color: "#94a3b8", cursor: "pointer", display: "flex" }}>
              <ArrowLeft size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>{title}</span>
          </div>
          <button onClick={handleShare} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, padding: "8px 12px", color: shared ? "#10b981" : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
            {shared ? <><Check size={13} /> Copied</> : <Share2 size={15} />}
          </button>
        </div>
        {children}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
          .page-card { animation: fadeUp 0.3s ease; }
          select option { background:#1e293b; color:#e2e8f0; }
          input::placeholder { color:#334155; }
          select:focus, input:focus { border-color: rgba(59,130,246,0.6) !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
        `}</style>
      </div>
    );
  }

  // ── CONFIRMATION (done) ───────────────────────────────────────────────────
  if (order) {
    const pd = order.paymentDetails;
    const showBinance = order.paymentMethod === "binance_pay" && pd.binancePayId;
    const showUsdt = order.paymentMethod === "usdt_manual" && pd.usdtAddress;
    const waUrl = pd.whatsapp ? `https://wa.me/${pd.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, IMEI Repair Order ${order.orderCode} for ${modelName}. Please assist.`)}` : null;

    return (
      <Shell title="Order Confirmed">
        <div style={{ padding: "24px 18px 0" }} className="page-card">

          {/* Success block */}
          <div style={{ background: "linear-gradient(135deg,rgba(5,150,105,0.18),rgba(16,185,129,0.06))", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 24, padding: "32px 20px 28px", textAlign: "center", marginBottom: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -50, right: -50, width: 160, height: 160, background: "rgba(16,185,129,0.05)", borderRadius: "50%" }} />
            <div style={{ width: 72, height: 72, background: "linear-gradient(135deg,#059669,#10b981)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 12px 32px rgba(16,185,129,0.4)" }}>
              <BadgeCheck size={36} color="white" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#f0fdf4", marginBottom: 6, letterSpacing: -0.5 }}>Order Registered!</div>
            <div style={{ fontSize: 14, color: "#6ee7b7", marginBottom: 20 }}>#{order.orderId} · {modelName} IMEI Repair</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: "12px 20px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>Order Code</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#38bdf8", fontFamily: "monospace", letterSpacing: 3 }}>{order.orderCode}</div>
              </div>
              <button onClick={() => copyText(order.orderCode, "code")} style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 10, padding: "8px 12px", color: copied === "code" ? "#10b981" : "#38bdf8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                {copied === "code" ? <><Check size={13} /> Saved</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
          </div>

          {/* Amount + payment */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ padding: "16px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Amount Due</div>
                <div style={{ fontSize: 11, color: "#475569" }}>Send exact amount</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#10b981", fontFamily: "monospace" }}>${order.total}<span style={{ fontSize: 14, color: "#6ee7b7", fontWeight: 700 }}> USD</span></div>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div style={{ padding: "14px 20px 18px" }}>
              {showBinance && pd.binancePayId && (
                <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)", borderRadius: 16, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    🟡 Binance Pay ID
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: "#fcd34d", fontFamily: "monospace", letterSpacing: 1 }}>{pd.binancePayId}</span>
                    <button onClick={() => copyText(pd.binancePayId!, "binance")} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "9px 14px", color: copied === "binance" ? "#10b981" : "#f59e0b", cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {copied === "binance" ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                    </button>
                  </div>
                </div>
              )}
              {showUsdt && pd.usdtAddress && (
                <div style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.18)", borderRadius: 16, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>💠 USDT · {pd.usdtNetwork}</div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#7dd3fc", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.65, flex: 1 }}>{pd.usdtAddress}</span>
                    <button onClick={() => copyText(pd.usdtAddress!, "usdt")} style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", borderRadius: 10, padding: "9px 12px", color: copied === "usdt" ? "#10b981" : "#38bdf8", cursor: "pointer", flexShrink: 0 }}>
                      {copied === "usdt" ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 14, fontSize: 13, color: "#64748b", lineHeight: 1.7, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: `1px solid ${BORDER}` }}>
                After payment, your order will be processed in <strong style={{ color: "#e2e8f0" }}>24–48 hours</strong>.
                Confirmation email → <strong style={{ color: "#38bdf8" }}>{order.customerEmail}</strong>
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 16, padding: "14px 20px", textDecoration: "none", color: "#4ade80", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
              <MessageCircle size={18} /> Chat on WhatsApp for Support
            </a>
          )}

          {/* Upload */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, background: "#a78bfa", borderRadius: "50%" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Upload Payment Screenshot</span>
            </div>
            <div style={{ padding: "16px 20px 20px" }}>
              {uploadDone ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,#059669,#10b981)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
                    <BadgeCheck size={30} color="white" />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981", marginBottom: 6 }}>Screenshot received!</div>
                  <div style={{ fontSize: 13, color: "#475569" }}>We'll verify and process your order shortly.</div>
                </div>
              ) : (
                <>
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b" }}>Attach proof of payment to speed up verification.</p>
                  {uploadPreview ? (
                    <div style={{ marginBottom: 14, position: "relative", borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
                      <img src={uploadPreview} alt="preview" style={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block" }} />
                      <button onClick={() => { setUploadFile(null); setUploadPreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => fileRef.current?.click()}
                      style={{ border: `2px dashed ${dragOver ? "#a78bfa" : "rgba(167,139,250,0.28)"}`, borderRadius: 18, padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", background: dragOver ? "rgba(167,139,250,0.07)" : "transparent", marginBottom: 14, transition: "all 0.2s" }}
                    >
                      <ImageIcon size={44} color="#7c3aed" strokeWidth={1.4} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>Tap to choose screenshot</span>
                      <span style={{ fontSize: 12, color: "#475569" }}>JPG, PNG, WEBP accepted</span>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files?.[0] ?? null)} />
                    </div>
                  )}
                  <button
                    onClick={uploadFile ? handleUpload : () => fileRef.current?.click()}
                    disabled={uploading}
                    style={{ width: "100%", padding: "14px 0", background: uploadFile ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "rgba(255,255,255,0.05)", border: `1px solid ${uploadFile ? "transparent" : BORDER}`, borderRadius: 14, color: uploadFile ? "#fff" : "#475569", fontWeight: 800, fontSize: 15, cursor: uploading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: uploadFile ? "0 4px 18px rgba(124,58,237,0.4)" : "none", transition: "all 0.2s" }}
                  >
                    {uploading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</> : uploadFile ? <><Upload size={16} /> Send Screenshot</> : <><Upload size={16} /> Choose File</>}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </Shell>
    );
  }

  // ── STEP 0 — Select Device ────────────────────────────────────────────────
  if (step === 0) {
    const canNext = !!brandLabel && !!modelName;
    return (
      <Shell title="IMEI Repair">
        <StepBar current={0} />
        <div style={{ padding: "24px 18px 0" }} className="page-card">
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 6, letterSpacing: -0.5 }}>Select your device</div>
            <div style={{ fontSize: 14, color: "#64748b" }}>Choose the brand and model of the phone you need repaired.</div>
          </div>

          <SelectField
            label="Brand"
            value={brandLabel}
            onChange={v => { setBrandLabel(v); setModelName(""); }}
            options={DEVICE_CATALOG.map(b => ({ value: b.label, label: `${b.icon}  ${b.label}` }))}
            placeholder="Select brand…"
          />

          <SelectField
            label="Model"
            value={modelName}
            onChange={setModelName}
            options={models.map(m => ({ value: m.name, label: `${m.name}  —  $${m.price}` }))}
            placeholder={brandLabel ? "Select model…" : "Select a brand first"}
            disabled={!brandLabel}
          />

          {price !== null && (
            <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.05))", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 18, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#6ee7b7", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Service Price</div>
                <div style={{ fontSize: 13, color: "#475569" }}>{modelName}</div>
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: "#10b981", fontFamily: "monospace" }}>${price}</div>
            </div>
          )}

          {/* Trust strip */}
          <div style={{ display: "flex", gap: 8, marginBottom: 28, marginTop: 18 }}>
            {[
              { Icon: Zap, label: "24–48h", sub: "Turnaround" },
              { Icon: ShieldCheck, label: "Secure", sub: "Verified" },
              { Icon: BadgeCheck, label: "Guarantee", sub: "Money-back" },
            ].map(({ Icon, label, sub }) => (
              <div key={label} style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
                <Icon size={18} color={ACCENT} style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0" }}>{label}</div>
                <div style={{ fontSize: 10, color: "#475569" }}>{sub}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep(1)}
            disabled={!canNext}
            style={{ width: "100%", padding: "16px 0", background: canNext ? `linear-gradient(135deg,${ACCENT},#1d4ed8)` : "rgba(255,255,255,0.05)", border: "none", borderRadius: 16, color: canNext ? "#fff" : "#334155", fontWeight: 800, fontSize: 16, cursor: canNext ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: canNext ? `0 6px 24px ${ACCENT_GLOW}` : "none", transition: "all 0.25s" }}
          >
            Continue <ArrowRight size={18} />
          </button>
        </div>
      </Shell>
    );
  }

  // ── STEP 1 — IMEI ─────────────────────────────────────────────────────────
  if (step === 1) {
    const imeiStatus = !imeiTouched ? "idle" : imeiValid ? "valid" : imei.length < 15 ? "partial" : "invalid";
    const statusColor = { idle: "#475569", valid: "#10b981", partial: "#f59e0b", invalid: "#ef4444" }[imeiStatus];
    const statusMsg = { idle: "Dial *#06# on your phone to find it", valid: "Valid IMEI ✓", partial: `${15 - imei.length} more digit${15 - imei.length !== 1 ? "s" : ""} needed`, invalid: "Invalid IMEI — please check and re-enter" }[imeiStatus];
    return (
      <Shell title="IMEI Repair">
        <StepBar current={1} />
        <div style={{ padding: "24px 18px 0" }} className="page-card">
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 6, letterSpacing: -0.5 }}>Enter your IMEI</div>
            <div style={{ fontSize: 14, color: "#64748b" }}>The 15-digit IMEI uniquely identifies your device.</div>
          </div>

          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "20px 18px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>IMEI Number</div>
            <div style={{ position: "relative" }}>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={15}
                value={imei}
                onChange={e => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="000000000000000"
                autoFocus
                style={{ width: "100%", padding: "16px 50px 16px 18px", background: "rgba(0,0,0,0.2)", border: `2px solid ${imeiTouched ? statusColor : BORDER}`, borderRadius: 14, color: "#f1f5f9", fontSize: 22, fontFamily: "monospace", letterSpacing: 4, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              />
              {imeiTouched && (
                <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", color: statusColor }}>
                  {imeiValid ? <BadgeCheck size={22} /> : imei.length < 15 ? null : <X size={22} />}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>{statusMsg}</span>
              <span style={{ fontSize: 12, color: "#334155", fontFamily: "monospace" }}>{imei.length}/15</span>
            </div>
            {/* IMEI digit display */}
            {imei.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 14, flexWrap: "wrap" }}>
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} style={{ width: "calc(100%/15 - 4px)", minWidth: 16, height: 4, borderRadius: 2, background: i < imei.length ? (imeiValid ? "#10b981" : ACCENT) : "rgba(255,255,255,0.08)", transition: "background 0.1s" }} />
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.14)", borderRadius: 14, padding: "13px 16px", marginBottom: 28 }}>
            <div style={{ fontSize: 13, color: "#7dd3fc", lineHeight: 1.7 }}>
              <strong style={{ color: "#38bdf8" }}>How to find your IMEI:</strong><br />
              Dial <strong style={{ fontFamily: "monospace", color: "#f1f5f9" }}>*#06#</strong> on your phone — the IMEI appears automatically. You can also find it in <strong style={{ color: "#f1f5f9" }}>Settings → About Phone</strong>.
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!imeiValid}
            style={{ width: "100%", padding: "16px 0", background: imeiValid ? `linear-gradient(135deg,${ACCENT},#1d4ed8)` : "rgba(255,255,255,0.05)", border: "none", borderRadius: 16, color: imeiValid ? "#fff" : "#334155", fontWeight: 800, fontSize: 16, cursor: imeiValid ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: imeiValid ? `0 6px 24px ${ACCENT_GLOW}` : "none", transition: "all 0.25s" }}
          >
            Continue <ArrowRight size={18} />
          </button>
        </div>
      </Shell>
    );
  }

  // ── STEP 2 — Contact + Payment ────────────────────────────────────────────
  if (step === 2) {
    const canNext = !!email && email.includes("@");
    return (
      <Shell title="IMEI Repair">
        <StepBar current={2} />
        <div style={{ padding: "24px 18px 0" }} className="page-card">
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 6, letterSpacing: -0.5 }}>Your details</div>
            <div style={{ fontSize: 14, color: "#64748b" }}>Where should we send your order confirmation?</div>
          </div>

          <TextField label="Email address *" type="email" value={email} onChange={setEmail} placeholder="your@email.com" note="Order confirmation and updates will be sent here" />
          <TextField label="Phone number (optional)" type="tel" value={phone} onChange={setPhone} placeholder="+1 234 567 8900" note="For WhatsApp updates if needed" />

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 12 }}>Payment Method</div>
            <div style={{ display: "flex", gap: 10 }}>
              {([
                { value: "binance_pay" as const, emoji: "🟡", title: "Binance Pay", sub: "Scan & pay instantly" },
                { value: "usdt_manual" as const, emoji: "💠", title: "USDT Transfer", sub: "TRC-20 / ERC-20" },
              ]).map(opt => {
                const active = payMethod === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => setPayMethod(opt.value)} style={{ flex: 1, padding: "16px 12px", background: active ? "rgba(59,130,246,0.12)" : SURFACE, border: `2px solid ${active ? ACCENT : BORDER}`, borderRadius: 18, cursor: "pointer", textAlign: "center" as const, transition: "all 0.2s", boxShadow: active ? `0 0 0 3px ${ACCENT_GLOW}` : "none" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: active ? "#93c5fd" : "#94a3b8", marginBottom: 3 }}>{opt.title}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{opt.sub}</div>
                    {active && <div style={{ marginTop: 8, width: 24, height: 24, background: ACCENT, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "8px auto 0" }}><Check size={13} color="white" /></div>}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => canNext && setStep(3)}
            disabled={!canNext}
            style={{ width: "100%", padding: "16px 0", background: canNext ? `linear-gradient(135deg,${ACCENT},#1d4ed8)` : "rgba(255,255,255,0.05)", border: "none", borderRadius: 16, color: canNext ? "#fff" : "#334155", fontWeight: 800, fontSize: 16, cursor: canNext ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: canNext ? `0 6px 24px ${ACCENT_GLOW}` : "none", transition: "all 0.25s" }}
          >
            Continue <ArrowRight size={18} />
          </button>
        </div>
      </Shell>
    );
  }

  // ── STEP 3 — Review + Submit ──────────────────────────────────────────────
  const payLabels: Record<string, string> = { binance_pay: "🟡 Binance Pay", usdt_manual: "💠 USDT Transfer" };
  const reviewRows = [
    { label: "Device", value: `${brandLabel} ${modelName}` },
    { label: "IMEI", value: imei },
    { label: "Price", value: `$${price} USD` },
    { label: "Email", value: email },
    ...(phone ? [{ label: "Phone", value: phone }] : []),
    { label: "Payment", value: payLabels[payMethod] ?? payMethod },
  ];

  return (
    <Shell title="IMEI Repair">
      <StepBar current={3} />
      <div style={{ padding: "24px 18px 0" }} className="page-card">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 6, letterSpacing: -0.5 }}>Review your order</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>Everything look correct? Place your order to proceed.</div>
        </div>

        {/* Summary card */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
          {reviewRows.map((row, i) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: i < reviewRows.length - 1 ? `1px solid ${BORDER}` : "none", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: row.label === "Price" ? "#10b981" : "#e2e8f0", textAlign: "right", maxWidth: "55%", wordBreak: "break-all", fontFamily: row.label === "IMEI" ? "monospace" : "inherit" }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Price highlight */}
        <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06))", border: "1px solid rgba(16,185,129,0.22)", borderRadius: 18, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6ee7b7", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Total to Pay</div>
            <div style={{ fontSize: 12, color: "#475569" }}>After order confirmation</div>
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: "#10b981", fontFamily: "monospace" }}>${price}</div>
        </div>

        {/* Login gate */}
        {!isAuthenticated && (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <span style={{ flex: 1, fontSize: 13, color: "#fcd34d", fontWeight: 600 }}>You need to be signed in to place an order</span>
            <button onClick={() => navigate("/login")} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 10, padding: "8px 14px", color: "#f59e0b", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              <LogIn size={14} /> Sign In
            </button>
          </div>
        )}

        {formError && (
          <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 14, color: "#fca5a5", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={14} color="#ef4444" /> {formError}
          </div>
        )}

        <button
          onClick={isAuthenticated ? handleSubmit : () => navigate("/login")}
          disabled={loading}
          style={{ width: "100%", padding: "17px 0", background: loading ? "rgba(59,130,246,0.4)" : isAuthenticated ? `linear-gradient(135deg,${ACCENT},#1d4ed8)` : "linear-gradient(135deg,#d97706,#b45309)", border: "none", borderRadius: 16, color: "#fff", fontWeight: 900, fontSize: 17, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: isAuthenticated && !loading ? `0 8px 28px ${ACCENT_GLOW}` : "none", transition: "all 0.25s", letterSpacing: 0.2 }}
        >
          {loading
            ? <><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Placing Order…</>
            : !isAuthenticated
              ? <><LogIn size={20} /> Sign In to Place Order</>
              : <><BadgeCheck size={20} /> Place Order · ${price} USD</>
          }
        </button>

        <p style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 14, lineHeight: 1.6 }}>
          Payments are non-refundable once processing begins. By placing this order you agree to our terms of service.
        </p>
      </div>
    </Shell>
  );
}
