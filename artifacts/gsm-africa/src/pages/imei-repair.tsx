import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Share2, Smartphone, ShieldCheck, Zap, BadgeCheck,
  Copy, Check, Upload, ImageIcon, MessageCircle, ChevronRight,
  AlertTriangle, LogIn, Loader2, X,
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
type BrandEntry = { label: string; models: DeviceModel[] };

const DEVICE_CATALOG: BrandEntry[] = [
  {
    label: "Apple iPhone",
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
    label: "Samsung Galaxy S",
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
    label: "Samsung Galaxy A",
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
    label: "Samsung Galaxy Note",
    models: [
      { name: "Galaxy Note 8", price: 13 }, { name: "Galaxy Note 9", price: 14 }, { name: "Galaxy Note 10", price: 16 },
      { name: "Galaxy Note 10+", price: 17 }, { name: "Galaxy Note 10 Lite", price: 14 },
      { name: "Galaxy Note 20", price: 18 }, { name: "Galaxy Note 20 Ultra", price: 20 },
    ],
  },
  {
    label: "Samsung Galaxy Z",
    models: [
      { name: "Galaxy Z Flip", price: 20 }, { name: "Galaxy Z Flip 3", price: 22 }, { name: "Galaxy Z Flip 4", price: 24 },
      { name: "Galaxy Z Flip 5", price: 26 }, { name: "Galaxy Z Flip 6", price: 28 }, { name: "Galaxy Z Fold 2", price: 25 },
      { name: "Galaxy Z Fold 3", price: 27 }, { name: "Galaxy Z Fold 4", price: 30 }, { name: "Galaxy Z Fold 5", price: 33 },
      { name: "Galaxy Z Fold 6", price: 35 },
    ],
  },
  {
    label: "Samsung Galaxy M",
    models: [
      { name: "Galaxy M12", price: 10 }, { name: "Galaxy M13", price: 10 }, { name: "Galaxy M14", price: 11 },
      { name: "Galaxy M23", price: 11 }, { name: "Galaxy M33 5G", price: 12 }, { name: "Galaxy M34 5G", price: 13 },
      { name: "Galaxy M52 5G", price: 13 }, { name: "Galaxy M53 5G", price: 14 }, { name: "Galaxy M54 5G", price: 15 },
    ],
  },
];

// ── Luhn IMEI validator ───────────────────────────────────────────────────────
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

// ── Shared UI helpers ─────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  overflow: "hidden",
  marginBottom: 14,
};

const cardHeader = (dotColor: string): React.CSSProperties => ({
  padding: "13px 18px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  gap: 8,
});

const dot = (color: string): React.CSSProperties => ({
  width: 7,
  height: 7,
  background: color,
  borderRadius: "50%",
});

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

const inputStyle = (active = false, error = false): React.CSSProperties => ({
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${error ? "rgba(239,68,68,0.5)" : active ? "rgba(14,165,233,0.45)" : "rgba(255,255,255,0.1)"}`,
  borderRadius: 12,
  color: "#e2e8f0",
  fontSize: 14,
  boxSizing: "border-box" as const,
  outline: "none",
  fontFamily: "inherit",
});

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 6,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ImeiRepairPage() {
  const [, navigate] = useLocation();
  const { user, token, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // form
  const [brandLabel, setBrandLabel] = useState("");
  const [modelName, setModelName] = useState("");
  const [imei, setImei] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState<"binance_pay" | "usdt_manual">("binance_pay");

  // ui
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

  // derived
  const brandEntry = DEVICE_CATALOG.find(b => b.label === brandLabel);
  const models = brandEntry?.models ?? [];
  const selectedModel = models.find(m => m.name === modelName);
  const price = selectedModel?.price ?? null;
  const imeiTouched = imei.length > 0;
  const imeiValid = isValidImei(imei);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
      toast({ title: "Copied!", description: text.slice(0, 30) + (text.length > 30 ? "…" : "") });
    });
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "IMEI Repair & Registration — GSM World", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShared(true);
        setTimeout(() => setShared(false), 2500);
        toast({ title: "Link copied!" });
      });
    }
  }

  function handleFile(file: File | null) {
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = e => setUploadPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) { navigate("/login"); return; }
    if (!brandLabel || !modelName || !imeiValid || !email) return;

    setLoading(true);
    setFormError("");
    try {
      const res = await fetch("/api/imei-repair/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          brand: brandLabel,
          model: modelName,
          imei,
          customerEmail: email,
          customerPhone: phone || undefined,
          paymentMethod: payMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Something went wrong. Please try again."); return; }
      setOrder({ ...data, customerEmail: email });
    } catch {
      setFormError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!uploadFile || !order) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("orderId", String(order.orderId));
      fd.append("orderCode", order.orderCode);
      const res = await fetch("/api/uploads/payment-proof", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (res.ok) {
        setUploadDone(true);
        toast({ title: "Screenshot sent!", description: "We'll verify your payment shortly." });
      } else {
        toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", description: "Network error.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  // ── ORDER CONFIRMATION VIEW ───────────────────────────────────────────────
  if (order) {
    const pd = order.paymentDetails;
    const showBinance = order.paymentMethod === "binance_pay" && pd.binancePayId;
    const showUsdt = order.paymentMethod === "usdt_manual" && pd.usdtAddress;
    const waUrl = pd.whatsapp
      ? `https://wa.me/${pd.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I placed IMEI Repair Order ${order.orderCode} for ${modelName}. Please assist.`)}`
      : null;

    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#06101e 0%,#0d1f3c 60%,#101827 100%)", paddingBottom: 48, color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* Nav */}
        <div style={{ background: "rgba(6,16,30,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => navigate("/")} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, padding: 8, color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>Order Confirmed</span>
        </div>

        <div style={{ padding: "20px 16px 0" }}>

          {/* Success hero */}
          <div style={{ background: "linear-gradient(135deg,rgba(5,150,105,0.18) 0%,rgba(16,185,129,0.08) 100%)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: 22, padding: "28px 20px 24px", textAlign: "center", marginBottom: 14, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: "rgba(16,185,129,0.06)", borderRadius: "50%" }} />
            <div style={{ width: 64, height: 64, background: "linear-gradient(135deg,#059669,#10b981)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}>
              <BadgeCheck size={32} color="white" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f0fdf4", marginBottom: 4 }}>Order Registered!</div>
            <div style={{ fontSize: 13, color: "#6ee7b7", marginBottom: 16 }}>
              #{order.orderId} · {modelName} IMEI Repair
            </div>
            {/* Order code pill */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.35)", borderRadius: 14, padding: "10px 18px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 1 }}>CODE</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#38bdf8", fontFamily: "monospace", letterSpacing: 3 }}>{order.orderCode}</span>
              <button
                onClick={() => copyText(order.orderCode, "code")}
                style={{ background: "none", border: "none", color: copied === "code" ? "#10b981" : "#64748b", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
                title="Copy order code"
              >
                {copied === "code" ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>

          {/* Payment card */}
          <div style={card}>
            <div style={cardHeader("#f59e0b")}>
              <div style={dot("#f59e0b")} />
              <span style={sectionLabel}>Payment Instructions</span>
            </div>
            <div style={{ padding: "18px 18px 4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>Amount Due</span>
                <span style={{ fontSize: 30, fontWeight: 900, color: "#10b981", fontFamily: "monospace" }}>${order.total}<span style={{ fontSize: 15, fontWeight: 600, color: "#6ee7b7" }}> USD</span></span>
              </div>

              {showBinance && pd.binancePayId && (
                <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "15px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    🟡 Binance Pay ID
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: "#fcd34d", fontFamily: "monospace", letterSpacing: 1 }}>{pd.binancePayId}</span>
                    <button
                      onClick={() => copyText(pd.binancePayId!, "binance")}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "8px 14px", color: copied === "binance" ? "#10b981" : "#f59e0b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                    >
                      {copied === "binance" ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                    </button>
                  </div>
                </div>
              )}

              {showUsdt && pd.usdtAddress && (
                <div style={{ background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 16, padding: "15px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    💠 USDT · {pd.usdtNetwork}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#7dd3fc", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.6, flex: 1 }}>{pd.usdtAddress}</span>
                    <button
                      onClick={() => copyText(pd.usdtAddress!, "usdt")}
                      style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", borderRadius: 10, padding: "8px 12px", color: copied === "usdt" ? "#10b981" : "#38bdf8", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}
                    >
                      {copied === "usdt" ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "13px 15px", marginBottom: 18, fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
                After sending payment, your order will be processed within{" "}
                <strong style={{ color: "#e2e8f0" }}>24–48 hours</strong>.{" "}
                Check <strong style={{ color: "#38bdf8" }}>{order.customerEmail}</strong> for confirmation.
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 16, padding: "14px 20px", textDecoration: "none", color: "#4ade80", fontWeight: 700, fontSize: 14, marginBottom: 14 }}
            >
              <MessageCircle size={18} />
              Chat on WhatsApp for Support
            </a>
          )}

          {/* Upload proof */}
          <div style={card}>
            <div style={cardHeader("#6366f1")}>
              <div style={dot("#6366f1")} />
              <span style={sectionLabel}>Upload Payment Screenshot</span>
            </div>
            <div style={{ padding: "16px 18px 20px" }}>
              {uploadDone ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
                  <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#059669,#10b981)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(16,185,129,0.3)" }}>
                    <BadgeCheck size={28} color="white" />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>Screenshot received!</div>
                  <div style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>We'll verify your payment and process your order shortly.</div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px" }}>Attach proof of payment to speed up verification.</p>
                  {uploadPreview ? (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
                        <img src={uploadPreview} alt="Payment proof" style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }} />
                        <button
                          onClick={() => { setUploadFile(null); setUploadPreview(null); }}
                          style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => fileRef.current?.click()}
                      style={{ border: `2px dashed ${dragOver ? "#6366f1" : "rgba(99,102,241,0.3)"}`, borderRadius: 16, padding: "30px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", background: dragOver ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)", marginBottom: 14, transition: "all 0.2s" }}
                    >
                      <ImageIcon size={40} color="#6366f1" strokeWidth={1.5} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#818cf8" }}>Tap to choose screenshot</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>JPG, PNG, WEBP accepted</span>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={e => handleFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  )}
                  <button
                    onClick={uploadFile ? handleUpload : () => fileRef.current?.click()}
                    disabled={uploading}
                    style={{ width: "100%", padding: "13px 0", background: uploadFile ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "rgba(255,255,255,0.05)", border: `1px solid ${uploadFile ? "transparent" : "rgba(255,255,255,0.1)"}`, borderRadius: 13, color: uploadFile ? "#fff" : "#64748b", fontWeight: 700, fontSize: 14, cursor: uploading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: uploadFile ? "0 4px 16px rgba(99,102,241,0.35)" : "none", transition: "all 0.2s" }}
                  >
                    {uploading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</> : uploadFile ? <><Upload size={16} /> Send Screenshot</> : <><Upload size={16} /> Choose File</>}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  const canSubmit = isAuthenticated && !!brandLabel && !!modelName && imeiValid && !!email;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#06101e 0%,#0d1f3c 60%,#101827 100%)", paddingBottom: 48, color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Nav */}
      <div style={{ background: "rgba(6,16,30,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(-1 as unknown as string)} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, padding: 8, color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>IMEI Repair & Registration</span>
        </div>
        <button
          onClick={handleShare}
          title="Share page"
          style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, padding: "8px 12px", color: shared ? "#10b981" : "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, transition: "color 0.2s" }}
        >
          {shared ? <><Check size={14} /> Copied</> : <Share2 size={16} />}
        </button>
      </div>

      <div style={{ padding: "18px 16px 0" }}>

        {/* Hero banner */}
        <div style={{ background: "linear-gradient(135deg,#0f2744 0%,#1a2d5a 50%,#142040 100%)", borderRadius: 22, padding: "22px 20px", marginBottom: 14, border: "1px solid rgba(56,189,248,0.12)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, background: "rgba(56,189,248,0.05)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: -50, left: -20, width: 180, height: 180, background: "rgba(99,102,241,0.04)", borderRadius: "50%" }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, position: "relative" }}>
            <div style={{ width: 54, height: 54, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 6px 20px rgba(14,165,233,0.3)" }}>
              <Smartphone size={26} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#f0f9ff", marginBottom: 5 }}>IMEI Repair & Registration</div>
              <div style={{ fontSize: 13, color: "#7dd3fc", lineHeight: 1.6, marginBottom: 12 }}>
                Fix blacklisted, lost, or invalid IMEI numbers with our certified service.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {[
                  { Icon: Zap, label: "24–48h Turnaround" },
                  { Icon: ShieldCheck, label: "Secure & Verified" },
                  { Icon: BadgeCheck, label: "Money-back Guarantee" },
                ].map(({ Icon, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "4px 11px" }}>
                    <Icon size={11} color="#94a3b8" />
                    <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Login gate */}
        {!isAuthenticated && (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <span style={{ flex: 1, fontSize: 13, color: "#fcd34d", fontWeight: 500 }}>Sign in to place an order</span>
            <button
              onClick={() => navigate("/login")}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, padding: "7px 13px", color: "#f59e0b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <LogIn size={13} /> Log In
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* Device */}
          <div style={card}>
            <div style={cardHeader("#0ea5e9")}>
              <div style={dot("#0ea5e9")} />
              <span style={sectionLabel}>Select Device</span>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>Brand</label>
                <select
                  value={brandLabel}
                  onChange={e => { setBrandLabel(e.target.value); setModelName(""); }}
                  style={{ ...inputStyle(!!brandLabel), cursor: "pointer" }}
                  required
                >
                  <option value="" style={{ background: "#1e293b" }}>Select brand…</option>
                  {DEVICE_CATALOG.map(b => (
                    <option key={b.label} value={b.label} style={{ background: "#1e293b" }}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Model</label>
                <select
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  disabled={!brandLabel}
                  style={{ ...inputStyle(!!modelName), cursor: brandLabel ? "pointer" : "not-allowed", opacity: brandLabel ? 1 : 0.5 }}
                  required
                >
                  <option value="" style={{ background: "#1e293b" }}>{brandLabel ? "Select model…" : "Select brand first"}</option>
                  {models.map(m => (
                    <option key={m.name} value={m.name} style={{ background: "#1e293b" }}>{m.name} — ${m.price}</option>
                  ))}
                </select>
              </div>

              {price !== null && (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#6ee7b7", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 2 }}>Service Price</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{brandLabel} · {modelName}</div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: "#10b981", fontFamily: "monospace" }}>${price}</div>
                </div>
              )}
            </div>
          </div>

          {/* IMEI */}
          <div style={card}>
            <div style={cardHeader("#6366f1")}>
              <div style={dot("#6366f1")} />
              <span style={sectionLabel}>Device IMEI</span>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ position: "relative" }}>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  value={imei}
                  onChange={e => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
                  placeholder="Enter 15-digit IMEI"
                  style={{ ...inputStyle(imeiTouched && imeiValid, imeiTouched && !imeiValid), paddingRight: 44, fontSize: 18, fontFamily: "monospace", letterSpacing: 2 }}
                  required
                />
                {imeiTouched && (
                  <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: imeiValid ? "#10b981" : "#ef4444", display: "flex", alignItems: "center" }}>
                    {imeiValid ? <BadgeCheck size={18} /> : <X size={18} />}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 11, color: imeiTouched ? (imeiValid ? "#10b981" : "#ef4444") : "#475569" }}>
                  {!imeiTouched
                    ? "Dial *#06# to find your IMEI"
                    : imeiValid
                      ? "Valid IMEI"
                      : imei.length < 15
                        ? `${15 - imei.length} more digit${15 - imei.length === 1 ? "" : "s"} needed`
                        : "Invalid IMEI — check digit mismatch"}
                </span>
                <span style={{ fontSize: 11, color: "#334155" }}>{imei.length}/15</span>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div style={card}>
            <div style={cardHeader("#f59e0b")}>
              <div style={dot("#f59e0b")} />
              <span style={sectionLabel}>Contact Details</span>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>Email address <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={inputStyle(!!email)}
                  required
                />
                <div style={{ fontSize: 11, color: "#475569", marginTop: 5 }}>Order confirmation will be sent here</div>
              </div>
              <div>
                <label style={fieldLabel}>Phone number <span style={{ color: "#334155" }}>(optional)</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  style={inputStyle(!!phone)}
                />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div style={card}>
            <div style={cardHeader("#10b981")}>
              <div style={dot("#10b981")} />
              <span style={sectionLabel}>Payment Method</span>
            </div>
            <div style={{ padding: "14px 18px 18px", display: "flex", gap: 10 }}>
              {([
                { value: "binance_pay" as const, label: "Binance Pay", sub: "Fast & secure", emoji: "🟡" },
                { value: "usdt_manual" as const, label: "USDT Transfer", sub: "TRC-20 / ERC-20", emoji: "💠" },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPayMethod(opt.value)}
                  style={{ flex: 1, padding: "13px 10px", background: payMethod === opt.value ? "rgba(14,165,233,0.13)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${payMethod === opt.value ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 14, cursor: "pointer", transition: "all 0.2s", textAlign: "center" as const }}
                >
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: payMethod === opt.value ? "#38bdf8" : "#94a3b8", marginBottom: 2 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {formError && (
            <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, color: "#fca5a5", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={15} color="#ef4444" />
              {formError}
            </div>
          )}

          {/* Submit */}
          <button
            type={isAuthenticated ? "submit" : "button"}
            onClick={!isAuthenticated ? () => navigate("/login") : undefined}
            disabled={loading || (isAuthenticated && !canSubmit)}
            style={{
              width: "100%",
              padding: "16px 0",
              background: loading
                ? "rgba(14,165,233,0.4)"
                : !isAuthenticated
                  ? "linear-gradient(135deg,#d97706,#b45309)"
                  : canSubmit
                    ? "linear-gradient(135deg,#0ea5e9,#0369a1)"
                    : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 16,
              color: canSubmit || !isAuthenticated ? "#fff" : "#475569",
              fontWeight: 800,
              fontSize: 16,
              cursor: loading || (isAuthenticated && !canSubmit) ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: canSubmit ? "0 4px 24px rgba(14,165,233,0.3)" : "none",
              transition: "all 0.25s",
              letterSpacing: 0.3,
            }}
          >
            {loading ? (
              <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Registering Order…</>
            ) : !isAuthenticated ? (
              <><LogIn size={18} /> Log In to Continue</>
            ) : price !== null ? (
              <><ChevronRight size={18} /> Place Order · ${price} USD</>
            ) : (
              "Place Order"
            )}
          </button>

          <p style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 12, lineHeight: 1.5 }}>
            By placing an order you agree to our terms of service. Payments are non-refundable after processing begins.
          </p>

        </form>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #1e293b; color: #e2e8f0; }
        input::placeholder { color: #475569; }
      `}</style>
    </div>
  );
}
