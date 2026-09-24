import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useWalletBalance } from "@/hooks/use-wallet";
import { QRCodeSVG } from "qrcode.react";
import {
  Smartphone, Lock, Shield, Zap, ChevronRight, Copy, Check,
  CheckCircle2, ArrowLeft, Clock, Star,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type DurationKey = "6h" | "1d" | "3d" | "7d" | "30d";
type Category = "All" | "Samsung" | "iPhone & iCloud" | "Android Multi-Brand" | "FRP & MDM Bypass";

type UnlockTool = {
  id: string;
  name: string;
  category: Exclude<Category, "All">;
  description: string;
  compatibility: string;
  icon: string;
  accent: string;
  basePrices: { key: DurationKey; price: number }[];
};

const DURATION_LABELS: Record<DurationKey, string> = {
  "6h": "6 Hours", "1d": "1 Day", "3d": "3 Days", "7d": "7 Days", "30d": "30 Days",
};
const DURATION_DAYS: Record<DurationKey, number> = {
  "6h": 0.25, "1d": 1, "3d": 3, "7d": 7, "30d": 30,
};
const DURATION_ORDER: DurationKey[] = ["6h", "1d", "3d", "7d", "30d"];

// ── Catalog ───────────────────────────────────────────────────────────────────
const TOOLS: UnlockTool[] = [
  // Samsung
  { id: "ultra-tool", name: "Ultra Tool", category: "Samsung", description: "Samsung network unlock, FRP bypass & IMEI repair", compatibility: "Samsung Galaxy A/M/F/S/Z series", icon: "🔵", accent: "#1565c0", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  { id: "z3x-samsung", name: "Z3X Samsung Tool Pro", category: "Samsung", description: "Full Samsung suite — unlock, flash, repair, FRP", compatibility: "All Samsung models", icon: "💎", accent: "#0d47a1", basePrices: [{ key: "6h", price: 5 }, { key: "1d", price: 10 }, { key: "3d", price: 22 }, { key: "7d", price: 38 }, { key: "30d", price: 100 }] },
  { id: "chimera-tool", name: "Chimera Tool", category: "Samsung", description: "Samsung, HTC, Nokia & Xiaomi unlock & repair", compatibility: "Samsung, HTC, Nokia, Xiaomi", icon: "🔥", accent: "#b71c1c", basePrices: [{ key: "6h", price: 5 }, { key: "1d", price: 10 }, { key: "3d", price: 22 }, { key: "7d", price: 40 }, { key: "30d", price: 110 }] },
  { id: "octoplus-samsung", name: "Octoplus Samsung", category: "Samsung", description: "Samsung & LG factory network unlock", compatibility: "Samsung Galaxy, LG", icon: "🔷", accent: "#0097a7", basePrices: [{ key: "6h", price: 5 }, { key: "1d", price: 10 }, { key: "3d", price: 22 }, { key: "7d", price: 38 }, { key: "30d", price: 100 }] },
  { id: "locksmith-pro", name: "LockSmith Pro", category: "Samsung", description: "Samsung FRP bypass & Google account removal", compatibility: "Samsung Galaxy All series", icon: "🔑", accent: "#2e7d32", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "bmt-pro", name: "BMT Pro", category: "Samsung", description: "Samsung IMEI repair & network unlock codes", compatibility: "Samsung Galaxy S/A/Note", icon: "⚙️", accent: "#455a64", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  { id: "gsm-flasher", name: "GSM Flasher Tool", category: "Samsung", description: "Samsung FRP & MDM bypass one click", compatibility: "Samsung Galaxy (Android 6–13)", icon: "⚡", accent: "#f57c00", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "samkey-tmf", name: "SamKey TMF", category: "Samsung", description: "Samsung network unlock codes via IMEI server", compatibility: "Samsung Galaxy all carriers", icon: "🗝️", accent: "#6a1b9a", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  // iPhone / iCloud
  { id: "nc-auth", name: "NC Auth Server", category: "iPhone & iCloud", description: "Apple iCloud activation lock bypass & removal", compatibility: "iPhone 6s–12 (A9–A14)", icon: "🍎", accent: "#1a1a1a", basePrices: [{ key: "6h", price: 6 }, { key: "1d", price: 12 }, { key: "3d", price: 28 }, { key: "7d", price: 50 }, { key: "30d", price: 130 }] },
  { id: "iremoval-pro", name: "iRemoval Pro", category: "iPhone & iCloud", description: "iCloud activation lock bypass & MDM removal", compatibility: "iPhone 5s–14 all models", icon: "🔒", accent: "#37474f", basePrices: [{ key: "6h", price: 6 }, { key: "1d", price: 12 }, { key: "3d", price: 28 }, { key: "7d", price: 50 }, { key: "30d", price: 130 }] },
  { id: "iactivate-server", name: "iActivate Server", category: "iPhone & iCloud", description: "Professional iCloud unlock & MDM bypass server", compatibility: "iPhone 7–13 series", icon: "✅", accent: "#2e7d32", basePrices: [{ key: "6h", price: 5 }, { key: "1d", price: 10 }, { key: "3d", price: 22 }, { key: "7d", price: 38 }, { key: "30d", price: 100 }] },
  { id: "3utools", name: "3uTools", category: "iPhone & iCloud", description: "iPhone flash, management & unlock toolkit", compatibility: "All iPhone & iPad models", icon: "🛠️", accent: "#0288d1", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "passfab-activation", name: "PassFab Activation Unlocker", category: "iPhone & iCloud", description: "iCloud & MDM bypass without Apple ID", compatibility: "iPhone 5s–12 (iOS 12–14)", icon: "🔓", accent: "#c62828", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  { id: "4ukey", name: "Tenorshare 4uKey", category: "iPhone & iCloud", description: "iOS screen lock & iCloud account bypass", compatibility: "All iPhone & iPad models", icon: "🗝️", accent: "#7b1fa2", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "unlockgo", name: "UnlockGo", category: "iPhone & iCloud", description: "iCloud activation lock & MDM bypass", compatibility: "iPhone 5–14, iOS 12–16", icon: "🚀", accent: "#00695c", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  // Android Multi-Brand
  { id: "multiunlock", name: "Multiunlock Server", category: "Android Multi-Brand", description: "Multi-brand network unlock via IMEI server", compatibility: "Samsung, LG, HTC, Motorola, ZTE", icon: "📱", accent: "#1b5e20", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  { id: "eft-pro", name: "EFT Pro", category: "Android Multi-Brand", description: "Network unlock for Samsung, Nokia, Alcatel & ZTE", compatibility: "50+ Android brands", icon: "⚡", accent: "#e65100", basePrices: [{ key: "6h", price: 5 }, { key: "1d", price: 10 }, { key: "3d", price: 22 }, { key: "7d", price: 38 }, { key: "30d", price: 100 }] },
  { id: "sigma-software", name: "Sigma Software", category: "Android Multi-Brand", description: "Qualcomm & MTK device unlock & repair", compatibility: "Huawei, Xiaomi, Oppo, Vivo, Sony", icon: "Σ", accent: "#4a148c", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  { id: "dr-fone-unlock", name: "Dr.Fone Unlock", category: "Android Multi-Brand", description: "iOS & Android multi-platform unlock solution", compatibility: "3000+ Android models & iOS", icon: "💊", accent: "#880e4f", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "fonegeek", name: "FoneGeek Unlock", category: "Android Multi-Brand", description: "iOS & Android unlock & data recovery", compatibility: "All major iOS & Android devices", icon: "🔧", accent: "#006064", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "imyfone-lockwiper", name: "iMyFone LockWiper", category: "Android Multi-Brand", description: "iOS & Android screen lock bypass", compatibility: "iPhone, iPad, Samsung, Google Pixel", icon: "🔐", accent: "#bf360c", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "xiaomi-unlock", name: "Xiaomi Unlock Server", category: "Android Multi-Brand", description: "Mi account removal & bootloader unlock", compatibility: "All Xiaomi / Redmi / POCO models", icon: "📡", accent: "#ff6f00", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "huawei-server", name: "Huawei Unlock Server", category: "Android Multi-Brand", description: "Huawei & Honor network unlock & FRP bypass", compatibility: "Huawei P/Mate/Nova/Y series, Honor", icon: "🔴", accent: "#c62828", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  // FRP & MDM Bypass
  { id: "frp-tool-pro", name: "FRP Tool Pro", category: "FRP & MDM Bypass", description: "Google FRP bypass for all Android brands", compatibility: "Samsung, Huawei, Xiaomi, Tecno, Infinix", icon: "🛡️", accent: "#1a237e", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "easy-frp", name: "Easy FRP Bypass", category: "FRP & MDM Bypass", description: "One-click FRP bypass for all Android versions", compatibility: "All Android 6–13 devices", icon: "✨", accent: "#1b5e20", basePrices: [{ key: "6h", price: 3 }, { key: "1d", price: 6 }, { key: "3d", price: 14 }, { key: "7d", price: 22 }, { key: "30d", price: 55 }] },
  { id: "android-mdm", name: "Android MDM Bypass", category: "FRP & MDM Bypass", description: "Enterprise MDM & device management removal", compatibility: "Samsung Knox, Microsoft Intune, VMware", icon: "🏢", accent: "#212121", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 8 }, { key: "3d", price: 18 }, { key: "7d", price: 30 }, { key: "30d", price: 80 }] },
  // Additional Tools
  { id: "bft-dongle", name: "BFT Dongle Tool", category: "Android Multi-Brand", description: "Multi-brand flash, FRP & network unlock via BFT dongle", compatibility: "Samsung, Huawei, Alcatel, ZTE, Motorola, LG", icon: "🔌", accent: "#37474f", basePrices: [{ key: "6h", price: 4 }, { key: "1d", price: 9 }, { key: "3d", price: 20 }, { key: "7d", price: 35 }, { key: "30d", price: 90 }] },
  { id: "unlocktool", name: "Unlocktool", category: "Android Multi-Brand", description: "Cloud-based multi-brand unlock, FRP & repair platform", compatibility: "Samsung, Xiaomi, OPPO, Huawei, Nokia, Vivo, MTK/Qualcomm", icon: "🌐", accent: "#0277bd", basePrices: [{ key: "6h", price: 5 }, { key: "1d", price: 10 }, { key: "3d", price: 22 }, { key: "7d", price: 40 }, { key: "30d", price: 100 }] },
  { id: "pandora-tool", name: "Pandora Tool", category: "Samsung", description: "Advanced Samsung network unlock, IMEI repair & FRP solution", compatibility: "Samsung Galaxy S/A/M/Note/Z series", icon: "🎯", accent: "#6a1b9a", basePrices: [{ key: "6h", price: 5 }, { key: "1d", price: 10 }, { key: "3d", price: 22 }, { key: "7d", price: 38 }, { key: "30d", price: 95 }] },
];

const CATEGORIES: Category[] = ["All", "Samsung", "iPhone & iCloud", "Android Multi-Brand", "FRP & MDM Bypass"];
const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  "All": <Zap size={13} />,
  "Samsung": <Smartphone size={13} />,
  "iPhone & iCloud": <Lock size={13} />,
  "Android Multi-Brand": <Smartphone size={13} />,
  "FRP & MDM Bypass": <Shield size={13} />,
};

const SUPPORT_WHATSAPP = "254756816951";

type FlowStep =
  | { type: "browse" }
  | { type: "detail"; tool: UnlockTool }
  | { type: "payment" }
  | { type: "mpesa_pending"; orderId: number; activationId: number; checkoutRequestId: string }
  | { type: "nowpayments_pending"; orderId: number; activationId: number; paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string }
  | { type: "manual_pending"; orderId: number; activationId: number; paymentMethod: string; details: Record<string, unknown>; total: number }
  | { type: "done"; orderId: number; activationId: number };

type PayMethod = "wallet" | "mpesa" | "nowpayments" | "binance_pay" | "usdt_manual";

export function UnlockToolsPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { isAuthenticated, token } = useAuth();
  const { toast } = useToast();
  const { data: walletBalance = 0 } = useWalletBalance();

  const [category, setCategory] = useState<Category>("All");
  const [searchQ, setSearchQ] = useState("");
  const [step, setStep] = useState<FlowStep>({ type: "browse" });
  const [selectedTool, setSelectedTool] = useState<UnlockTool | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<DurationKey | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [phone, setPhone] = useState("");
  const [npCurrency, setNpCurrency] = useState("usdttrc20");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-select tool from URL param ?tool=toolId
  useEffect(() => {
    const params = new URLSearchParams(search);
    const toolId = params.get("tool");
    if (toolId) {
      const found = TOOLS.find((t) => t.id === toolId);
      if (found) { setSelectedTool(found); setStep({ type: "detail", tool: found }); }
    }
  }, [search]);

  const filtered = useMemo(() => {
    let tools = category === "All" ? TOOLS : TOOLS.filter((t) => t.category === category);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      tools = tools.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.compatibility.toLowerCase().includes(q));
    }
    return tools;
  }, [category, searchQ]);

  const currentPrice = useMemo(() => {
    if (!selectedTool || !selectedDuration) return 0;
    return selectedTool.basePrices.find((p) => p.key === selectedDuration)?.price ?? 0;
  }, [selectedTool, selectedDuration]);

  function selectTool(tool: UnlockTool) {
    setSelectedTool(tool);
    setSelectedDuration(null);
    setPayMethod(null);
    setStep({ type: "detail", tool });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    if (step.type === "payment") { setStep({ type: "detail", tool: selectedTool! }); return; }
    setStep({ type: "browse" });
    setSelectedTool(null);
    setSelectedDuration(null);
    setPayMethod(null);
    navigate("/unlock-tools");
  }

  async function handlePlaceOrder() {
    if (!isAuthenticated) { toast({ variant: "destructive", title: "Please sign in to place an order" }); return; }
    if (!selectedTool || !selectedDuration || !payMethod) return;
    if (payMethod === "mpesa" && !phone) { toast({ variant: "destructive", title: "Enter your M-Pesa phone number" }); return; }
    if (payMethod === "nowpayments" && currentPrice < 13) { toast({ variant: "destructive", title: "NOWPayments requires minimum $13. Choose another method." }); return; }

    setLoading(true);
    try {
      const durationDays = DURATION_DAYS[selectedDuration];
      const res = await fetch("/api/unlock-rentals/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          toolId: selectedTool.id,
          toolName: selectedTool.name,
          toolCategory: selectedTool.category,
          durationDays,
          priceUsd: currentPrice,
          paymentMethod: payMethod,
          customerPhone: payMethod === "mpesa" ? phone : undefined,
          payCurrency: payMethod === "nowpayments" ? npCurrency : undefined,
        }),
      });
      const data = await res.json() as {
        orderId?: number; activationId?: number; status?: string; total?: number;
        mpesa?: { checkoutRequestId: string; message: string };
        nowpayments?: { paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string };
        custom?: { method: string; binanceId?: string; address?: string; amount?: number; reference?: string };
        error?: string;
      };
      if (!res.ok || data.error) { toast({ variant: "destructive", title: data.error ?? "Order failed" }); return; }

      if (data.status === "paid") {
        setStep({ type: "done", orderId: data.orderId!, activationId: data.activationId! });
      } else if (data.mpesa) {
        setStep({ type: "mpesa_pending", orderId: data.orderId!, activationId: data.activationId!, checkoutRequestId: data.mpesa.checkoutRequestId });
        toast({ title: "M-Pesa STK sent!", description: "Enter your PIN to complete payment." });
      } else if (data.nowpayments) {
        setStep({ type: "nowpayments_pending", orderId: data.orderId!, activationId: data.activationId!, ...data.nowpayments });
      } else if (data.custom) {
        setStep({ type: "manual_pending", orderId: data.orderId!, activationId: data.activationId!, paymentMethod: payMethod, details: data.custom as Record<string, unknown>, total: data.total ?? currentPrice });
      }
    } catch { toast({ variant: "destructive", title: "Network error. Please try again." }); }
    finally { setLoading(false); }
  }

  // NOWPayments polling
  useEffect(() => {
    if (step.type !== "nowpayments_pending") return;
    const { orderId, paymentId } = step;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/payments/nowpayments/query", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ orderId, paymentId }),
        });
        const d = await res.json() as { paymentStatus: string };
        if (d.paymentStatus === "paid") { clearInterval(interval); setStep((s) => s.type === "nowpayments_pending" ? { type: "done", orderId: s.orderId, activationId: s.activationId } : s); }
        else if (d.paymentStatus === "failed") { clearInterval(interval); toast({ title: "Payment failed", variant: "destructive" }); setStep({ type: "payment" }); }
      } catch { /* retry */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [step]);

  // M-Pesa polling
  useEffect(() => {
    if (step.type !== "mpesa_pending") return;
    const { orderId } = step;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const d = await res.json() as { order?: { paymentStatus: string } };
        if (d.order?.paymentStatus === "paid") { clearInterval(interval); setStep((s) => s.type === "mpesa_pending" ? { type: "done", orderId: s.orderId, activationId: s.activationId } : s); }
      } catch { /* retry */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [step]);

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (step.type === "done") {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-lg font-black text-gray-800">Order Placed!</h2>
          <p className="text-gray-500 text-sm">
            Your <strong>{selectedTool?.name}</strong> rental is being processed.
            You'll receive delivery within <strong>1–3 hours</strong>.
            Reference: <strong>ORDER-{step.orderId}</strong>
          </p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={() => { setStep({ type: "browse" }); setSelectedTool(null); }} className="py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-700 text-sm">Rent Another</button>
            <button onClick={() => navigate("/account/activations")} className="py-3 bg-[#1a2332] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5">View Orders <ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
    );
  }

  // ── NOWPAYMENTS QR ──────────────────────────────────────────────────────────
  if (step.type === "nowpayments_pending") {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 pb-24 sm:pb-8">
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Send Crypto Payment</p>
            <p className="text-2xl font-black text-gray-900">{step.payAmount} {step.payCurrency.toUpperCase()}</p>
            {step.expiresAt && <p className="text-[11px] text-gray-400">Expires: {new Date(step.expiresAt).toLocaleTimeString()}</p>}
            <QRCodeSVG value={step.payAddress} size={140} level="M" className="rounded-xl border-4 border-gray-100 shadow-md mt-1" />
          </div>
          {[{ label: "Payment Address", value: step.payAddress, key: "addr" }, { label: `Amount (${step.payCurrency.toUpperCase()})`, value: `${step.payAmount}`, key: "amt" }].map(({ label, value, key }) => (
            <div key={key}>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{label}</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-700 break-all">{value}</div>
                <button onClick={() => { navigator.clipboard.writeText(value); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); }} className={`shrink-0 px-3 rounded-xl text-xs font-bold flex items-center gap-1 ${copiedKey === key ? "bg-green-600 text-white" : "bg-[#1a2332] text-white"}`}>
                  {copiedKey === key ? <><Check size={12} /> Done</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
            </div>
          ))}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <p className="text-xs text-blue-700 font-medium">Checking every 30s for confirmation…</p>
          </div>
          <button onClick={() => setStep({ type: "payment" })} className="w-full py-3 border-2 border-gray-200 text-gray-700 font-bold text-sm rounded-2xl">Cancel &amp; Go Back</button>
        </div>
      </div>
    );
  }

  // ── MANUAL PAYMENT PENDING ──────────────────────────────────────────────────
  if (step.type === "manual_pending") {
    const isBinance = step.paymentMethod === "binance_pay";
    const binanceId = step.details.binanceId as string | undefined;
    const usdtAddr = step.details.address as string | undefined;
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 pb-24 sm:pb-8">
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="text-center pt-2">
            <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-2">
              <span className="text-3xl">{isBinance ? "🟡" : "💲"}</span>
            </div>
            <h2 className="text-base font-black text-gray-800">Order #{step.orderId} Placed!</h2>
            <p className="text-xs text-gray-500 mt-0.5">Send payment — we verify within 10–30 minutes.</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-gray-500">Amount Due</span><span className="font-black text-gray-900">${step.total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-gray-500">Method</span><span className="font-bold text-gray-700">{isBinance ? "Binance Pay" : "USDT TRC20"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-gray-500">Reference</span><span className="font-black text-blue-600">ORDER-{step.orderId}</span></div>
          </div>
          {isBinance && binanceId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-yellow-800 uppercase tracking-widest mb-1">Binance Pay ID</p>
              <p className="text-3xl font-black text-gray-900 tracking-widest">{binanceId}</p>
              <p className="text-[10px] text-yellow-700 mt-1">Include <strong>ORDER-{step.orderId}</strong> in the payment note.</p>
            </div>
          )}
          {!isBinance && usdtAddr && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-green-800 uppercase tracking-widest mb-1">USDT TRC20 Address</p>
              <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-2 py-2">
                <span className="font-mono text-[10px] text-gray-700 break-all flex-1">{usdtAddr}</span>
                <button onClick={() => { navigator.clipboard.writeText(usdtAddr); setCopiedKey("usdt"); setTimeout(() => setCopiedKey(null), 2000); }} className={`shrink-0 px-2 py-1 rounded text-xs font-bold ${copiedKey === "usdt" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                  {copiedKey === "usdt" ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}
          <button onClick={() => navigate("/account/activations")} className="w-full py-3 bg-[#1a2332] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
            <CheckCircle2 size={16} /> View My Orders
          </button>
        </div>
      </div>
    );
  }

  // ── M-PESA PENDING ──────────────────────────────────────────────────────────
  if (step.type === "mpesa_pending") {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 pb-24 sm:pb-8 flex items-center justify-center">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">📲</span>
          </div>
          <h2 className="text-lg font-black text-gray-800">Check Your Phone</h2>
          <p className="text-gray-500 text-sm">An M-Pesa STK Push has been sent to <strong>{phone}</strong>. Enter your PIN to complete the payment.</p>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <p className="text-xs text-blue-700 font-medium">Waiting for M-Pesa confirmation…</p>
          </div>
          <button onClick={() => navigate("/account/activations")} className="w-full py-3 bg-[#1a2332] text-white rounded-2xl font-bold text-sm">Go to My Orders</button>
        </div>
      </div>
    );
  }

  // ── MAIN FLOW ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-28 sm:pb-8">
      {/* Header */}
      <div className="bg-[#1a2332] text-white px-4 pt-5 pb-6">
        <div className="max-w-2xl mx-auto">
          {(step.type !== "browse") && (
            <button onClick={goBack} className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold mb-3 transition-colors">
              <ArrowLeft size={14} /> Back to Catalog
            </button>
          )}
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">🔧</div>
            <div>
              <h1 className="text-xl font-black">Unlock Tool Rental</h1>
              <p className="text-white/60 text-xs">26 tools · starting from <span className="text-green-400 font-bold">$3 for 6 hours</span></p>
            </div>
          </div>
          {step.type === "browse" && (
            <div className="mt-4 relative">
              <input
                type="text"
                placeholder="Search tools (e.g. Samsung, iCloud, FRP…)"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:bg-white/20 transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* ── BROWSE ── */}
        {step.type === "browse" && (
          <>
            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    category === cat ? "bg-[#1a2332] text-white border-[#1a2332]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}>
                  {CATEGORY_ICONS[cat]}{cat}
                  <span className={`text-[10px] ${category === cat ? "text-white/60" : "text-gray-400"}`}>
                    {cat === "All" ? TOOLS.length : TOOLS.filter((t) => t.category === cat).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Minimum price badge */}
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-2.5">
              <Star size={14} className="text-green-600 shrink-0" />
              <p className="text-xs text-green-700 font-semibold">Starting from <strong>$3 for 6 hours</strong> — rent only what you need, no wasted time</p>
            </div>

            {/* Tool grid */}
            <div className="grid grid-cols-1 gap-3">
              {filtered.map((tool) => {
                const lowestPrice = Math.min(...tool.basePrices.map((p) => p.price));
                return (
                  <button key={tool.id} onClick={() => selectTool(tool)}
                    className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left flex items-center gap-4 p-4 group">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm"
                      style={{ background: `${tool.accent}20`, border: `1.5px solid ${tool.accent}40` }}>
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-gray-800 text-[13px]">{tool.name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{tool.description}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">📱 {tool.compatibility}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-gray-400">from</p>
                          <p className="font-black text-green-600 text-sm">${lowestPrice}</p>
                          <p className="text-[9px] text-gray-400">6h rental</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {tool.basePrices.map((p) => (
                          <span key={p.key} className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                            {DURATION_LABELS[p.key]} ${p.price}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">No tools found. Try a different search.</p>
                <button onClick={() => { setSearchQ(""); setCategory("All"); }} className="mt-3 text-blue-500 text-sm underline">Clear filters</button>
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <Clock size={17} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-gray-700 text-sm">How unlock tool rental works</p>
                <ol className="mt-1 space-y-0.5 text-[12px] text-gray-500 list-decimal list-inside">
                  <li>Pick any unlock tool from the catalog above</li>
                  <li>Choose your duration: 6h, 1d, 3d, 7d or 30 days</li>
                  <li>Pay via M-Pesa, Wallet, USDT or Crypto</li>
                  <li>Receive access credentials within 1–3 hours</li>
                  <li>Use the tool to unlock compatible devices</li>
                </ol>
              </div>
            </div>
          </>
        )}

        {/* ── TOOL DETAIL ── */}
        {(step.type === "detail") && selectedTool && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 flex items-center gap-4 border-b border-gray-50">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-sm"
                  style={{ background: `${selectedTool.accent}20`, border: `1.5px solid ${selectedTool.accent}40` }}>
                  {selectedTool.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-base">{selectedTool.name}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">{selectedTool.description}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">📱 {selectedTool.compatibility}</p>
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Rental Duration</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DURATION_ORDER.map((key) => {
                    const tier = selectedTool.basePrices.find((p) => p.key === key);
                    if (!tier) return null;
                    const hours = DURATION_DAYS[key] * 24;
                    const perHour = tier.price / hours;
                    return (
                      <button key={key} onClick={() => setSelectedDuration(key)}
                        className={`p-3 rounded-2xl border-2 text-left transition-all ${
                          selectedDuration === key ? "border-[#1a2332] bg-[#1a2332]/5" : "border-gray-200 hover:border-gray-300"
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-black text-[13px] text-gray-800">{DURATION_LABELS[key]}</p>
                          {selectedDuration === key && <Check size={14} className="text-[#1a2332]" />}
                        </div>
                        <p className="text-xl font-black" style={{ color: selectedTool.accent }}>${tier.price}</p>
                        {key === "6h" ? (
                          <p className="text-[9px] text-green-600 font-bold mt-0.5">Best for quick jobs</p>
                        ) : (
                          <p className="text-[10px] text-gray-400 mt-0.5">${perHour.toFixed(2)}/hr avg</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedDuration && (
                  <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-semibold">Order Summary</p>
                      <p className="text-sm font-black text-blue-800 mt-0.5">{selectedTool.name} · {DURATION_LABELS[selectedDuration]}</p>
                    </div>
                    <span className="text-xl font-black text-blue-700">${currentPrice}</span>
                  </div>
                )}

                <button
                  disabled={!selectedDuration || !isAuthenticated}
                  onClick={() => setStep({ type: "payment" })}
                  className="w-full py-4 rounded-2xl font-black text-sm text-white mt-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: selectedDuration ? selectedTool.accent : "#94a3b8" }}>
                  {!isAuthenticated ? "Sign In to Continue" : !selectedDuration ? "Select a Duration" : `Continue to Payment — $${currentPrice}`}
                </button>
                {!isAuthenticated && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    <a href="/login" className="text-blue-600 font-semibold underline">Sign in</a> or <a href="/signup" className="text-blue-600 font-semibold underline">create an account</a> to rent tools
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
              <Shield size={16} className="text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-gray-700 text-sm">Safe & Verified Tools</p>
                <p className="text-[12px] text-gray-500 mt-0.5">All tools sourced from verified vendors. Need help? <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="text-green-600 font-semibold">WhatsApp us</a></p>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENT ── */}
        {step.type === "payment" && selectedTool && selectedDuration && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${selectedTool.accent}20` }}>
                {selectedTool.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-800 text-sm">{selectedTool.name}</p>
                <p className="text-xs text-gray-500">{DURATION_LABELS[selectedDuration]} rental</p>
              </div>
              <div className="text-right">
                <p className="font-black text-gray-900 text-lg">${currentPrice}</p>
                <button onClick={() => setStep({ type: "detail", tool: selectedTool })} className="text-[10px] text-blue-500 underline">Change</button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Select Payment Method</p>
              <div className="space-y-2.5">
                {/* M-Pesa */}
                <button onClick={() => setPayMethod("mpesa")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "mpesa" ? "border-green-500 bg-green-50" : "border-gray-200 bg-white hover:border-green-300"}`}>
                  <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-black text-[11px] leading-tight text-center">M<br/>PESA</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><p className="font-bold text-sm text-gray-900">M-Pesa</p><span className="text-[9px] font-black uppercase tracking-widest bg-orange-500 text-white px-1.5 py-0.5 rounded-full">POPULAR</span></div>
                    <p className="text-xs text-gray-500 mt-0.5">STK Push · Kenya · Instant</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "mpesa" ? "border-green-600 bg-green-600" : "border-gray-300"}`}>
                    {payMethod === "mpesa" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
                {payMethod === "mpesa" && (
                  <div className="px-1">
                    <input type="tel" placeholder="Phone: 254712345678" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500" />
                    <p className="text-[11px] text-gray-400 mt-1">Format: 254XXXXXXXXX (no + sign)</p>
                  </div>
                )}

                {/* Wallet */}
                <button onClick={() => setPayMethod("wallet")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "wallet" ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-300"}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-lg">💳</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-900">GSM World Wallet</p>
                    <p className="text-xs mt-0.5">
                      <span className={walletBalance < currentPrice ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>${walletBalance.toFixed(2)} available</span>
                      {walletBalance < currentPrice ? <span className="text-gray-400 ml-1">· Insufficient</span> : <span className="text-gray-400 ml-1">· Instant · No fees</span>}
                    </p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "wallet" ? "border-blue-600 bg-blue-600" : "border-gray-300"}`}>
                    {payMethod === "wallet" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>

                {/* NOWPayments (only if >= $13) */}
                {currentPrice >= 13 && (
                  <button onClick={() => setPayMethod("nowpayments")}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "nowpayments" ? "border-purple-600 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-300"}`}>
                    <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xl">₿</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-900">Crypto (NOWPayments)</p>
                      <p className="text-xs text-gray-500 mt-0.5">BTC, ETH, USDT, LTC & more</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "nowpayments" ? "border-purple-600 bg-purple-600" : "border-gray-300"}`}>
                      {payMethod === "nowpayments" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                )}
                {payMethod === "nowpayments" && (
                  <select value={npCurrency} onChange={(e) => setNpCurrency(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-500">
                    <option value="usdttrc20">USDT (TRC20)</option>
                    <option value="usdterc20">USDT (ERC20)</option>
                    <option value="btc">Bitcoin (BTC)</option>
                    <option value="eth">Ethereum (ETH)</option>
                    <option value="ltc">Litecoin (LTC)</option>
                  </select>
                )}

                {/* Binance Pay */}
                <button onClick={() => setPayMethod("binance_pay")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "binance_pay" ? "border-yellow-500 bg-yellow-50" : "border-gray-200 bg-white hover:border-yellow-300"}`}>
                  <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#1a1a1a] font-black text-[11px] leading-tight text-center">BNB<br/>PAY</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-900">Binance Pay</p>
                    <p className="text-xs text-gray-500 mt-0.5">Manual · Admin verifies within 30 min</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "binance_pay" ? "border-yellow-500 bg-yellow-500" : "border-gray-300"}`}>
                    {payMethod === "binance_pay" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>

                {/* USDT Manual */}
                <button onClick={() => setPayMethod("usdt_manual")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${payMethod === "usdt_manual" ? "border-teal-500 bg-teal-50" : "border-gray-200 bg-white hover:border-teal-300"}`}>
                  <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-black text-xs">USDT</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-900">USDT TRC20 (Manual)</p>
                    <p className="text-xs text-gray-500 mt-0.5">Send to our wallet · Admin verifies</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${payMethod === "usdt_manual" ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}>
                    {payMethod === "usdt_manual" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep({ type: "detail", tool: selectedTool })}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-700">Back</button>
              <button onClick={handlePlaceOrder}
                disabled={loading || !payMethod || (payMethod === "wallet" && walletBalance < currentPrice)}
                className="flex-[2] py-3.5 rounded-2xl font-black text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: selectedTool.accent }}>
                {loading ? "Placing Order…" : "Place Order"}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center">
              Need help? <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="text-green-600 font-semibold">WhatsApp us</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
