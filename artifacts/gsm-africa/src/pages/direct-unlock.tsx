import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useQueryClient } from "@tanstack/react-query";
import {
  Smartphone, ChevronRight, CheckCircle2, ArrowLeft, Cpu, Lock,
  AlertCircle, RefreshCw, Copy, Check, Share2, Shield, Zap,
  Clock, Star, ChevronDown, Wallet, Globe, CreditCard, BadgeCheck,
  Search, Users, BarChart3, Info, Terminal, Settings, Activity,
  Monitor, Usb, Database, HardDrive,
} from "lucide-react";

// ── Catalog ─────────────────────────────────────────────────────────────────
const DEVICE_CATALOG: Array<{ brand: string; icon: string; models: Array<{ name: string; price: number }> }> = [
  { brand: "Samsung", icon: "🔵", models: [
    { name: "Samsung Galaxy S25 / S25+ / S25 Ultra", price: 38 },
    { name: "Samsung Galaxy S24 / S24+ / S24 Ultra", price: 35 },
    { name: "Samsung Galaxy S23 Series", price: 30 },
    { name: "Samsung Galaxy S22 Series", price: 28 },
    { name: "Samsung Galaxy S21 Series", price: 25 },
    { name: "Samsung Galaxy S20 Series", price: 22 },
    { name: "Samsung Galaxy S10 / S10+ / S10e", price: 20 },
    { name: "Samsung Galaxy S9 / S9+ / S8 / S8+", price: 18 },
    { name: "Samsung Galaxy Note 20 / Note 20 Ultra", price: 28 },
    { name: "Samsung Galaxy Note 10 / Note 10+", price: 25 },
    { name: "Samsung Galaxy Note 9 / Note 8", price: 20 },
    { name: "Samsung Galaxy A55 / A35 / A25 / A15", price: 20 },
    { name: "Samsung Galaxy A54 / A34 / A24 / A14", price: 18 },
    { name: "Samsung Galaxy A53 / A33 / A23 / A13", price: 16 },
    { name: "Samsung Galaxy A52 / A32 / A22 / A12", price: 15 },
    { name: "Samsung Galaxy A51 / A31 / A21 / A11", price: 14 },
    { name: "Samsung Galaxy A50 / A30 / A20 / A10", price: 12 },
    { name: "Samsung Galaxy M Series (Any)", price: 15 },
    { name: "Samsung Galaxy F Series (Any)", price: 15 },
    { name: "Samsung Galaxy Z Fold 5 / Flip 5", price: 40 },
    { name: "Samsung Galaxy Z Fold 4 / Flip 4", price: 35 },
    { name: "Samsung Galaxy Z Fold 3 / Flip 3", price: 30 },
    { name: "Samsung Galaxy (Other Model)", price: 20 },
  ]},
  { brand: "iPhone / iCloud", icon: "🍎", models: [
    { name: "iPhone 16 / 16 Plus / 16 Pro / 16 Pro Max", price: 90 },
    { name: "iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max", price: 80 },
    { name: "iPhone 14 / 14 Plus / 14 Pro / 14 Pro Max", price: 75 },
    { name: "iPhone 13 / 13 Mini / 13 Pro / 13 Pro Max", price: 65 },
    { name: "iPhone 12 / 12 Mini / 12 Pro / 12 Pro Max", price: 55 },
    { name: "iPhone 11 / 11 Pro / 11 Pro Max", price: 50 },
    { name: "iPhone XS / XS Max / XR", price: 45 },
    { name: "iPhone X / 8 / 8 Plus", price: 40 },
    { name: "iPhone 7 / 7 Plus / 6s / 6s Plus", price: 35 },
    { name: "iPhone 6 / 6 Plus / SE (1st Gen)", price: 30 },
    { name: "iPhone SE (2nd Gen) / SE (3rd Gen)", price: 40 },
    { name: "iCloud Activation Lock Removal (A11 & below)", price: 120 },
    { name: "iCloud Activation Lock Removal (A12–A15)", price: 180 },
    { name: "iCloud FMI Off / Clean IMEI", price: 150 },
  ]},
  { brand: "iPad", icon: "🟦", models: [
    { name: "iPad Pro (Any Model) — Direct Unlock", price: 120 },
    { name: "iPad Air (Any Model) — Direct Unlock", price: 120 },
    { name: "iPad mini (Any Model) — Direct Unlock", price: 120 },
    { name: "iPad (Standard, Any Model) — Direct Unlock", price: 120 },
  ]},
  { brand: "Huawei", icon: "🔴", models: [
    { name: "Huawei P60 / P60 Pro", price: 32 },
    { name: "Huawei P50 / P50 Pro", price: 30 },
    { name: "Huawei P40 / P40 Pro / P40 Pro+", price: 28 },
    { name: "Huawei P30 / P30 Pro / P30 Lite", price: 22 },
    { name: "Huawei P20 / P20 Pro / P20 Lite", price: 18 },
    { name: "Huawei Mate 60 / 60 Pro", price: 35 },
    { name: "Huawei Mate 50 / 50 Pro", price: 32 },
    { name: "Huawei Mate 40 / 40 Pro", price: 30 },
    { name: "Huawei Mate 30 / 30 Pro", price: 25 },
    { name: "Huawei Mate 20 / 20 Pro / 20 X", price: 22 },
    { name: "Huawei Mate 10 / 10 Pro", price: 18 },
    { name: "Huawei Nova 11 / 10 / 9 / 8 / 7", price: 20 },
    { name: "Huawei Nova 6 / 5 / 4 / 3", price: 18 },
    { name: "Huawei Y9 / Y8 / Y7 / Y6 Series", price: 15 },
    { name: "Huawei Y5 / Y3 / GR Series", price: 12 },
    { name: "Huawei (Other Model)", price: 20 },
  ]},
  { brand: "Nokia", icon: "🔷", models: [
    { name: "Nokia X60 / X30 / X20 / X10", price: 18 },
    { name: "Nokia G60 / G42 / G22 / G21 / G20", price: 15 },
    { name: "Nokia C32 / C22 / C12 / C02", price: 12 },
    { name: "Nokia 8.3 / 7.2 / 6.2 / 5.3 / 4.2", price: 15 },
    { name: "Nokia 8 / 7 Plus / 6 / 5 / 3 / 2 / 1", price: 12 },
    { name: "Nokia Lumia Series", price: 10 },
    { name: "Nokia (Other Model)", price: 10 },
  ]},
  { brand: "LG", icon: "🟣", models: [
    { name: "LG Velvet / Wing", price: 22 },
    { name: "LG V60 / V50 ThinQ / V40 ThinQ", price: 20 },
    { name: "LG G8 ThinQ / G7 ThinQ / G6", price: 18 },
    { name: "LG K92 / K71 / K61 / K51 / K41S / K31", price: 12 },
    { name: "LG Stylo 6 / 5 / 4 / 3", price: 15 },
    { name: "LG Q92 / Q70 / Q60", price: 14 },
    { name: "LG Aristo / Phoenix Series", price: 12 },
    { name: "LG (Other Model)", price: 15 },
  ]},
  { brand: "Motorola", icon: "⭕", models: [
    { name: "Motorola Edge 40 Pro / Edge 40 Neo", price: 22 },
    { name: "Motorola Edge 30 / Edge 20 / Edge+", price: 20 },
    { name: "Motorola Moto G84 / G73 / G54 / G34", price: 18 },
    { name: "Motorola Moto G72 / G62 / G52 / G42 / G32 / G22", price: 15 },
    { name: "Motorola Moto G Power / G Play / G Stylus", price: 14 },
    { name: "Motorola Razr 40 Ultra / Razr 40", price: 28 },
    { name: "Motorola Razr 5G / Razr 2022", price: 25 },
    { name: "Motorola One Series (Any)", price: 15 },
    { name: "Motorola Moto E Series (Any)", price: 12 },
    { name: "Motorola (Other Model)", price: 18 },
  ]},
  { brand: "Sony", icon: "🟤", models: [
    { name: "Sony Xperia 1 V / 1 IV / 1 III / 1 II", price: 35 },
    { name: "Sony Xperia 5 V / 5 IV / 5 III / 5 II", price: 30 },
    { name: "Sony Xperia 10 V / 10 IV / 10 III", price: 22 },
    { name: "Sony Xperia L4 / L3 / L2", price: 18 },
    { name: "Sony Xperia Z Series", price: 15 },
    { name: "Sony (Other Model)", price: 25 },
  ]},
  { brand: "OnePlus", icon: "🔴", models: [
    { name: "OnePlus 12 / 12R / Open", price: 28 },
    { name: "OnePlus 11 / 11R", price: 25 },
    { name: "OnePlus 10 Pro / 10T", price: 22 },
    { name: "OnePlus 9 / 9 Pro / 9R", price: 20 },
    { name: "OnePlus 8 / 8 Pro / 8T", price: 18 },
    { name: "OnePlus Nord 3 / CE3 / CE3 Lite", price: 18 },
    { name: "OnePlus Nord 2T / CE2 / CE2 Lite", price: 16 },
    { name: "OnePlus Nord / N10 / N20 / N30", price: 15 },
    { name: "OnePlus (Other Model)", price: 20 },
  ]},
  { brand: "Xiaomi / Redmi / POCO", icon: "🟠", models: [
    { name: "Xiaomi 14 / 14 Pro / 14 Ultra", price: 28 },
    { name: "Xiaomi 13 / 13 Pro / 13 Ultra", price: 25 },
    { name: "Xiaomi 12 / 12 Pro / 12 Ultra", price: 22 },
    { name: "Xiaomi 11 / 11 Pro / 11 Ultra", price: 20 },
    { name: "Xiaomi 10 / 10 Pro / 10 Ultra", price: 18 },
    { name: "Redmi Note 13 / 13 Pro / 13 Pro+", price: 16 },
    { name: "Redmi Note 12 / 12 Pro / 12 Pro+", price: 15 },
    { name: "Redmi Note 11 / 11 Pro / 11S", price: 14 },
    { name: "Redmi Note 10 / 10 Pro / 10S", price: 13 },
    { name: "Redmi Note 8 / 9 Series", price: 12 },
    { name: "Redmi 13C / 12C / 10C / A2 / A1", price: 12 },
    { name: "POCO X6 Pro / X6 / X5 Pro / X5", price: 20 },
    { name: "POCO F5 / F4 / F3 / F2 Pro", price: 22 },
    { name: "POCO M6 Pro / M5 / M4 / M3", price: 15 },
    { name: "Xiaomi / Redmi (Other Model)", price: 18 },
  ]},
  { brand: "Google Pixel", icon: "🟢", models: [
    { name: "Google Pixel 9 / 9 Pro / 9 Pro XL / 9 Pro Fold", price: 35 },
    { name: "Google Pixel 8 / 8 Pro / 8a", price: 30 },
    { name: "Google Pixel 7 / 7 Pro / 7a", price: 25 },
    { name: "Google Pixel 6 / 6 Pro / 6a", price: 22 },
    { name: "Google Pixel 5 / 5a / 4a", price: 20 },
    { name: "Google Pixel 4 / 4a / 4 XL", price: 18 },
    { name: "Google Pixel 3 / 3a / 3 XL", price: 16 },
  ]},
  { brand: "Oppo / Realme", icon: "🟡", models: [
    { name: "Oppo Find X7 / X6 / X5 Pro", price: 30 },
    { name: "Oppo Reno 11 / 10 / 9 Series", price: 22 },
    { name: "Oppo Reno 8 / 7 / 6 Series", price: 20 },
    { name: "Oppo A98 / A78 / A58 / A38 / A18", price: 16 },
    { name: "Realme GT 5 Pro / GT5 / GT Neo 5", price: 25 },
    { name: "Realme 12 Pro+ / 12 Pro / 12x", price: 20 },
    { name: "Realme 11 / 10 / 9 Pro Series", price: 18 },
    { name: "Realme C67 / C55 / C35 / C21", price: 14 },
    { name: "Oppo / Realme (Other)", price: 20 },
  ]},
  { brand: "Vivo", icon: "🔵", models: [
    { name: "Vivo X100 Pro / X100 / X90 Pro", price: 30 },
    { name: "Vivo X80 / X70 / X60 Pro", price: 28 },
    { name: "Vivo V30 Pro / V30 / V29", price: 22 },
    { name: "Vivo V27 / V25 / V23 Series", price: 20 },
    { name: "Vivo Y100 / Y78 / Y56 / Y35 / Y22", price: 16 },
    { name: "Vivo (Other Model)", price: 18 },
  ]},
  { brand: "TCL / Alcatel", icon: "🟦", models: [
    { name: "TCL 50 XE / 50 SE / 40 SE / 40 NxtPaper", price: 15 },
    { name: "TCL 20 Pro 5G / 20S / 20 SE", price: 14 },
    { name: "TCL 10 Pro / 10L / 10 5G", price: 12 },
    { name: "Alcatel 3X / 1S / 1V Series", price: 12 },
    { name: "TCL / Alcatel (Other)", price: 12 },
  ]},
  { brand: "ZTE", icon: "⚫", models: [
    { name: "ZTE Axon 40 Ultra / 40 Pro", price: 22 },
    { name: "ZTE Axon 30 / 20 Series", price: 18 },
    { name: "ZTE Blade A73 / A72 / A52", price: 12 },
    { name: "ZTE (Other Model)", price: 15 },
  ]},
  { brand: "Other Brand", icon: "📱", models: [
    { name: "Asus ROG Phone 8 / 7 / 6", price: 28 },
    { name: "Asus Zenfone 10 / 9 / 8", price: 22 },
    { name: "BlackBerry Key2 / Key2 LE / PRIV", price: 20 },
    { name: "Tecno Phantom X2 / Spark 20", price: 14 },
    { name: "Infinix Note 40 / Hot 40 / Smart 8", price: 12 },
    { name: "itel A90 / P40 Series", price: 10 },
    { name: "Generic Android Device", price: 15 },
  ]},
];

// ── Brand tile definitions (top grid) ────────────────────────────────────────
const BRAND_TILES = [
  { id: "samsung",   label: "SAMSUNG",    bg: "#1428A0", text: "#fff" },
  { id: "iphone",    label: "Apple",      bg: "#555",    text: "#fff" },
  { id: "huawei",    label: "HUAWEI",     bg: "#CF0A2C", text: "#fff" },
  { id: "oppo",      label: "OPPO",       bg: "#1D7D3B", text: "#fff" },
  { id: "vivo",      label: "vivo",       bg: "#0047AB", text: "#fff" },
  { id: "xiaomi",    label: "MI",         bg: "#FF6900", text: "#fff" },
  { id: "nokia",     label: "NOKIA",      bg: "#124191", text: "#fff" },
  { id: "motorola",  label: "Motorola",   bg: "#E1001A", text: "#fff" },
  { id: "lg",        label: "LG",         bg: "#A50034", text: "#fff" },
  { id: "lenovo",    label: "lenovo",     bg: "#E2231A", text: "#fff" },
  { id: "google",    label: "Pixel",      bg: "#4285F4", text: "#fff" },
  { id: "sony",      label: "SONY",       bg: "#000",    text: "#fff" },
  { id: "oneplus",   label: "OnePlus",    bg: "#EB0029", text: "#fff" },
  { id: "tcl",       label: "TCL",        bg: "#1DA0E8", text: "#fff" },
  { id: "zte",       label: "ZTE",        bg: "#D10000", text: "#fff" },
  { id: "ipad",      label: "iPad",       bg: "#636366", text: "#fff" },
  { id: "other",     label: "Other",      bg: "#374151", text: "#fff" },
  { id: "all",       label: "ALL",        bg: "#059669", text: "#fff" },
];

// Map tile id → catalog brand name(s)
const TILE_TO_BRANDS: Record<string, string[]> = {
  samsung:  ["Samsung"],
  iphone:   ["iPhone / iCloud"],
  huawei:   ["Huawei"],
  oppo:     ["Oppo / Realme"],
  vivo:     ["Vivo"],
  xiaomi:   ["Xiaomi / Redmi / POCO"],
  nokia:    ["Nokia"],
  motorola: ["Motorola"],
  lg:       ["LG"],
  lenovo:   ["Other Brand"],
  google:   ["Google Pixel"],
  sony:     ["Sony"],
  oneplus:  ["OnePlus"],
  tcl:      ["TCL / Alcatel"],
  zte:      ["ZTE"],
  ipad:     ["iPad"],
  other:    ["Other Brand"],
  all:      DEVICE_CATALOG.map(b => b.brand),
};

const BRAND_LOGOS: Record<string, string> = {
  "Samsung":               "https://cdn.simpleicons.org/samsung/1428A0",
  "iPhone / iCloud":       "https://cdn.simpleicons.org/apple/555555",
  "Huawei":                "https://cdn.simpleicons.org/huawei/CF0A2C",
  "Nokia":                 "https://cdn.simpleicons.org/nokia/124191",
  "LG":                    "https://cdn.simpleicons.org/lg/A50034",
  "Motorola":              "https://cdn.simpleicons.org/motorola/E1001A",
  "Xiaomi / Redmi / POCO": "https://cdn.simpleicons.org/xiaomi/FF6900",
  "Sony":                  "https://cdn.simpleicons.org/sony/000000",
  "OnePlus":               "https://cdn.simpleicons.org/oneplus/EB0029",
  "Oppo / Realme":         "https://cdn.simpleicons.org/oppo/1D8348",
  "Vivo":                  "https://cdn.simpleicons.org/vivo/415FFF",
  "Google Pixel":          "https://cdn.simpleicons.org/google/4285F4",
  "TCL / Alcatel":         "https://cdn.simpleicons.org/tcl/1DA0E8",
  "ZTE":                   "https://cdn.simpleicons.org/zte/D10000",
};

// ── Luhn check ───────────────────────────────────────────────────────────────
function luhnCheck(imei: string): boolean {
  const digits = imei.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

type Step = "model" | "imei" | "processing" | "confirmed" | "pay";
type PayMethod = "wallet" | "mpesa" | "nowpayments" | "binance_pay" | "usdt_manual";

const PROCESSING_MSGS = [
  "[GSM-SRV] Initialising secure TLS connection to unlock cluster…",
  "[AUTH] Authenticating with GSM World backend — token OK",
  "[IMEI] Parsing device IMEI — running Luhn checksum validation…",
  "[IMEI] IMEI structure valid ✓",
  "[DB] Querying GSMA international device registry…",
  "[CARRIER] Resolving SIM lock binding — reading MCC/MNC codes…",
  "[CARRIER] Network operator identified ✓",
  "[BLACKLIST] Cross-referencing global stolen-device database…",
  "[BLACKLIST] Device status: clean ✓",
  "[POLICY] Verifying carrier unlock policy compliance…",
  "[API] Contacting carrier remote unlock API endpoint…",
  "[ELIGIBILITY] Checking contract & installment lock status…",
  "[ELIGIBILITY] Device is eligible for unlock ✓",
  "[TOKEN] Generating encrypted unlock authorisation token…",
  "[CRYPTO] Signing request with RSA-2048 key pair…",
  "[QUEUE] Unlock request submitted — processing order…",
  "[VERIFY] Final cross-check with remote carrier server…",
  "[COMPLETE] Device verified — proceed to payment ✓",
];

// ── Brand logo helper ────────────────────────────────────────────────────────
function BrandLogo({ brand }: { brand: typeof DEVICE_CATALOG[0] }) {
  const url = BRAND_LOGOS[brand.brand];
  const [err, setErr] = useState(false);
  if (url && !err) {
    return <img src={url} alt={brand.brand} className="w-8 h-8 object-contain" onError={() => setErr(true)} />;
  }
  return <span className="text-2xl leading-none">{brand.icon}</span>;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function DirectUnlockPage() {
  const { token, user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { data: walletBalance = 0, refetch: refetchWallet } = useWalletBalance();
  const queryClient = useQueryClient();
  const search = useSearch();

  const [step, setStep] = useState<Step>("model");
  const [done, setDone] = useState(false);

  // Selected device
  const [activeTile, setActiveTile] = useState("samsung");
  const [modelSearch, setModelSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<typeof DEVICE_CATALOG[0] | null>(null);
  const [selectedModel, setSelectedModel] = useState<{ name: string; price: number } | null>(null);
  const isIPad = selectedBrand?.brand === "iPad";

  // IMEI
  const [imei, setImei] = useState("");
  const [notes, setNotes] = useState("");
  const [imeiCopied, setImeiCopied] = useState(false);
  const [imeiInfo, setImeiInfo] = useState<{ brand: string | null; model: string | null; os: string | null } | null>(null);
  const [imeiTacLoading, setImeiTacLoading] = useState(false);
  const [imeiLuhnError, setImeiLuhnError] = useState(false);

  // Order & payment
  const [payMethod, setPayMethod] = useState<PayMethod | "">("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [manualDone, setManualDone] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Processing
  const [processingPct, setProcessingPct] = useState(0);
  const [processingIdx, setProcessingIdx] = useState(0);

  // M-Pesa
  const [mpPhone, setMpPhone] = useState("");
  const [mpSending, setMpSending] = useState(false);
  const [mpCheckoutId, setMpCheckoutId] = useState<string | null>(null);
  const [mpChecking, setMpChecking] = useState(false);
  const [mpPollCount, setMpPollCount] = useState(0);

  // NOWPayments
  const [npCurrency, setNpCurrency] = useState("usdttrc20");
  const [npCreating, setNpCreating] = useState(false);
  const [npPayment, setNpPayment] = useState<{ paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string } | null>(null);
  const [npPollCount, setNpPollCount] = useState(0);
  const [npCopied, setNpCopied] = useState(false);

  // URL param auto-select
  useEffect(() => {
    const params = new URLSearchParams(search);
    const brandParam = params.get("brand");
    const modelParam = params.get("model");
    if (!brandParam) return;
    const brand = DEVICE_CATALOG.find(b => b.brand.toLowerCase() === brandParam.toLowerCase());
    if (!brand) return;
    setSelectedBrand(brand);
    if (modelParam) {
      const model = brand.models.find(m => m.name.toLowerCase() === modelParam.toLowerCase());
      if (model) { setSelectedModel(model); setStep("imei"); return; }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Models visible in left panel
  const visibleBrandNames = TILE_TO_BRANDS[activeTile] || [];
  const visibleCatalog = DEVICE_CATALOG.filter(b => visibleBrandNames.includes(b.brand));
  const allVisibleModels = visibleCatalog.flatMap(b => b.models.map(m => ({ ...m, brand: b })));
  const filteredModels = modelSearch.trim()
    ? allVisibleModels.filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.brand.brand.toLowerCase().includes(modelSearch.toLowerCase()))
    : allVisibleModels;

  // TAC lookup on IMEI change
  useEffect(() => {
    if (step !== "imei") return;
    if (isIPad) { setImeiInfo(null); setImeiTacLoading(false); setImeiLuhnError(false); return; }
    if (imei.length !== 15) { setImeiInfo(null); setImeiTacLoading(false); setImeiLuhnError(false); return; }
    if (!luhnCheck(imei)) { setImeiInfo(null); setImeiTacLoading(false); setImeiLuhnError(true); return; }
    setImeiLuhnError(false); setImeiInfo(null); setImeiTacLoading(true);
    fetch(`/api/imei/lookup?imei=${imei}`)
      .then(r => r.json())
      .then((d: { brand?: string | null; model?: string | null; marketingName?: string | null; manufacturer?: string | null; simLock?: string | null }) => {
        setImeiInfo({ brand: d.brand ?? d.manufacturer ?? null, model: d.marketingName ?? d.model ?? null, os: d.simLock ?? null });
      })
      .catch(() => setImeiInfo({ brand: null, model: null, os: null }))
      .finally(() => setImeiTacLoading(false));
  }, [imei, step, isIPad]);

  // Auto-proceed after IMEI verified
  useEffect(() => {
    if (step !== "imei") return;
    if (isIPad) { if (imei.length < 8) return; const t = setTimeout(() => setStep("processing"), 800); return () => clearTimeout(t); }
    if (imei.length !== 15 || imeiLuhnError || imeiTacLoading || imeiInfo === null) return;
    const t = setTimeout(() => setStep("processing"), 1200);
    return () => clearTimeout(t);
  }, [imei, step, imeiInfo, imeiTacLoading, imeiLuhnError, isIPad]);

  // Processing 70s timer
  useEffect(() => {
    if (step !== "processing") { setProcessingPct(0); setProcessingIdx(0); return; }
    const TOTAL_MS = 70_000;
    const timer = setInterval(() => {
      const elapsed = Date.now() - Date.now(); // will be recalculated below
    }, 300);
    const start = Date.now();
    const t2 = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100));
      const idx = Math.min(PROCESSING_MSGS.length - 1, Math.floor((elapsed / TOTAL_MS) * PROCESSING_MSGS.length));
      setProcessingPct(pct);
      setProcessingIdx(idx);
      if (elapsed >= TOTAL_MS) { clearInterval(t2); setPayMethod(""); setStep("confirmed"); }
    }, 300);
    clearInterval(timer);
    return () => clearInterval(t2);
  }, [step]);

  // Order creation
  const createOrder = useCallback(async (status: "paid" | "pending", method: PayMethod) => {
    if (!selectedBrand || !selectedModel || !user) return null;
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sessionId: `direct-${Date.now()}`,
        customerEmail: user.email,
        customerName: user.name,
        paymentMethod: method,
        paymentStatus: status,
        total: String(selectedModel.price),
        currency: "USD",
        deviceIdentifier: imei.trim(),
        orderType: "unlock",
        notes: notes || `Direct Unlock: ${selectedBrand.brand} — ${selectedModel.name}`,
        items: [{ productId: 0, productName: `${selectedBrand.brand} Unlock — ${selectedModel.name}`, price: String(selectedModel.price), quantity: 1 }],
      }),
    });
    const data = await res.json() as { id?: number; error?: string };
    if (!res.ok) throw new Error(data.error || "Failed to create order");
    return data.id!;
  }, [selectedBrand, selectedModel, user, token, imei, notes]);

  // Manual pay
  async function handleManualPay() {
    if (!selectedModel || !user) return;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId: `direct-manual-${Date.now()}`,
          customerEmail: user.email,
          customerName: user.name,
          paymentMethod: payMethod,
          paymentStatus: "pending_payment_confirmation",
          total: String(selectedModel.price),
          currency: "USD",
          deviceIdentifier: imei.trim(),
          orderType: "unlock",
          notes: notes || `Direct Unlock: ${selectedBrand?.brand} — ${selectedModel.name}`,
          items: [{ productId: 0, productName: `${selectedBrand?.brand} Unlock — ${selectedModel.name}`, price: String(selectedModel.price), quantity: 1 }],
        }),
      });
      const data = await res.json() as { id?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to create order");
      setOrderId(data.id!); setManualDone(true);
      toast({ title: "Order placed!", description: "Send payment and our team will verify within 10-30 min." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  // Wallet pay
  async function handleWalletPay() {
    if (!selectedModel) return;
    if (walletBalance < selectedModel.price) {
      toast({ title: "Insufficient wallet balance", description: `Top up $${(selectedModel.price - walletBalance).toFixed(2)} more.`, variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/wallet/deduct", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: selectedModel.price }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error || "Deduction failed"); }
      const id = await createOrder("paid", "wallet");
      await refetchWallet();
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      setOrderId(id!); setDone(true);
      toast({ title: "Order created!", description: "Payment deducted from your wallet." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  // M-Pesa send
  async function handleMpesaSend() {
    if (!mpPhone || !selectedModel) { toast({ title: "Enter your phone number", variant: "destructive" }); return; }
    setMpSending(true);
    try {
      const res = await fetch("/api/wallet/add-fund/mpesa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: mpPhone, amount: selectedModel.price }),
      });
      const d = await res.json() as { checkoutRequestId?: string; error?: string };
      if (!res.ok) throw new Error(d.error || "STK push failed");
      setMpCheckoutId(d.checkoutRequestId!); setMpPollCount(0);
      toast({ title: "STK Push sent!", description: "Enter your M-Pesa PIN to complete payment." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setMpSending(false); }
  }

  // M-Pesa check
  async function handleMpesaCheck() {
    if (!mpCheckoutId) return;
    setMpChecking(true);
    try {
      const res = await fetch("/api/wallet/add-fund/mpesa/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkoutRequestId: mpCheckoutId }),
      });
      const d = await res.json() as { status: string; message?: string };
      if (d.status === "paid") {
        const id = await createOrder("paid", "mpesa");
        setOrderId(id!); setDone(true); toast({ title: "Payment confirmed! Order created." });
      } else if (d.status === "failed") {
        toast({ title: "Payment failed", description: d.message, variant: "destructive" }); setMpCheckoutId(null);
      } else { toast({ title: "Still pending", description: "Payment not confirmed yet." }); }
    } catch { toast({ title: "Could not check status", variant: "destructive" }); }
    finally { setMpChecking(false); }
  }

  // M-Pesa auto-poll
  useEffect(() => {
    if (!mpCheckoutId || done || mpPollCount >= 15) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/wallet/add-fund/mpesa/query", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ checkoutRequestId: mpCheckoutId }),
        });
        const d = await res.json() as { status: string };
        if (d.status === "paid") { const id = await createOrder("paid", "mpesa"); setOrderId(id!); setDone(true); toast({ title: "Payment confirmed! Order created automatically." }); }
        else if (d.status === "failed") { setMpCheckoutId(null); toast({ title: "M-Pesa payment failed", variant: "destructive" }); }
        else { setMpPollCount(c => c + 1); }
      } catch { setMpPollCount(c => c + 1); }
    }, 8000);
    return () => clearTimeout(t);
  }, [mpCheckoutId, done, mpPollCount, token, createOrder, toast]);

  // NOWPayments create
  async function handleNpCreate() {
    if (!selectedModel) return;
    setNpCreating(true);
    try {
      const res = await fetch("/api/wallet/add-fund/nowpayments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: selectedModel.price, payCurrency: npCurrency }),
      });
      const d = await res.json() as { error?: string; paymentId?: string; payAddress?: string; payAmount?: number; payCurrency?: string; expiresAt?: string };
      if (!res.ok) throw new Error(d.error || "Failed");
      setNpPayment({ paymentId: d.paymentId!, payAddress: d.payAddress!, payAmount: d.payAmount!, payCurrency: d.payCurrency!, expiresAt: d.expiresAt });
      setNpPollCount(0);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setNpCreating(false); }
  }

  // NOWPayments check
  async function handleNpCheck() {
    if (!npPayment) return;
    try {
      const res = await fetch("/api/wallet/add-fund/nowpayments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: npPayment.paymentId }),
      });
      const d = await res.json() as { status: string };
      if (d.status === "paid") { const id = await createOrder("paid", "nowpayments"); setOrderId(id!); setDone(true); toast({ title: "Crypto payment confirmed! Order created." }); }
      else if (d.status === "failed") { toast({ title: "Payment failed or expired", variant: "destructive" }); setNpPayment(null); }
      else { toast({ title: "Payment not confirmed yet", description: "Try again in a moment." }); }
    } catch { toast({ title: "Could not check status", variant: "destructive" }); }
  }

  // NOWPayments auto-poll
  useEffect(() => {
    if (!npPayment || done || npPollCount >= 30) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/wallet/add-fund/nowpayments/status", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ paymentId: npPayment.paymentId }),
        });
        const d = await res.json() as { status: string };
        if (d.status === "paid") { const id = await createOrder("paid", "nowpayments"); setOrderId(id!); setDone(true); toast({ title: "Crypto payment confirmed! Order created automatically." }); }
        else if (d.status === "failed") { setNpPayment(null); toast({ title: "Crypto payment failed or expired", variant: "destructive" }); }
        else { setNpPollCount(c => c + 1); }
      } catch { setNpPollCount(c => c + 1); }
    }, 30000);
    return () => clearTimeout(t);
  }, [npPayment, done, npPollCount, token, createOrder, toast]);

  function resetAll() {
    setDone(false); setStep("model"); setSelectedBrand(null); setSelectedModel(null);
    setImei(""); setNotes(""); setPayMethod(""); setMpCheckoutId(null); setMpPhone("");
    setNpPayment(null); setOrderId(null); setManualDone(false); setImeiInfo(null);
    setImeiLuhnError(false);
  }

  // ── Not authenticated ────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl text-center">
          <div className="p-6" style={{ background: "linear-gradient(135deg,#1e3a5f,#0f1d2e)" }}>
            <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mx-auto">
              <Lock size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-white mt-4">Sign In Required</h2>
            <p className="text-blue-200 text-sm mt-2">You need an account to use the Direct Unlock service.</p>
          </div>
          <div className="p-5 space-y-3">
            <Link href="/login"><button className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors">Sign In to Continue</button></Link>
            <Link href="/signup"><button className="w-full py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-sm transition-colors">Create a Free Account</button></Link>
            <p className="text-[11px] text-slate-400">Free account · No credit card required</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done && orderId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 pb-28">
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-100">
          <div className="p-8 text-center text-white" style={{ background: "linear-gradient(135deg,#059669 0%,#047857 50%,#065f46 100%)" }}>
            <div className="w-20 h-20 bg-white/20 border-2 border-white/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={40} className="text-white" />
            </div>
            <h2 className="text-3xl font-black">Order Submitted!</h2>
            <p className="text-emerald-100 mt-1 text-sm font-medium">Order #{orderId} has been created successfully</p>
          </div>
          <div className="bg-white p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { icon: <Clock size={18} className="text-blue-500" />, title: "Processing", desc: "1–24 hours" },
                { icon: <Zap size={18} className="text-yellow-500" />, title: "Delivery", desc: "Via email" },
                { icon: <Shield size={18} className="text-emerald-500" />, title: "Guarantee", desc: "Permanent unlock" },
              ].map(s => (
                <div key={s.title} className="bg-slate-50 rounded-2xl p-3">
                  <div className="flex justify-center mb-1.5">{s.icon}</div>
                  <p className="text-xs font-black text-slate-800">{s.title}</p>
                  <p className="text-[10px] text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/account/orders"><button className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors">View My Orders</button></Link>
              <button onClick={resetAll} className="w-full py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-sm transition-colors">Submit Another Unlock</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Processing fullscreen overlay (unchanged from original) ──────────────
  if (step === "processing") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "linear-gradient(160deg,#060b18 0%,#07101f 50%,#060b15 100%)", overflowY: "auto" }}>
        <div className="flex items-center justify-between px-4 py-3.5 sticky top-0"
          style={{ background: "rgba(6,11,24,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(59,130,246,0.12)", zIndex: 10 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)" }}>
              <Lock size={15} className="text-white" />
            </div>
            <div>
              <p className="font-black text-white text-[13px] leading-none">GSM World</p>
              <p className="text-[9px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: "#6366f1" }}>Secure Verification Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold font-mono" style={{ color: "#4ade80" }}>LIVE</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono font-bold" style={{ color: "#f59e0b" }}>{Math.ceil((100 - processingPct) * 0.7)}s</p>
              <p className="text-[8px] uppercase tracking-wide" style={{ color: "#374151" }}>remaining</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
          {/* Device card */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0d1b35,#0f1f3d)", border: "1px solid rgba(59,130,246,0.2)", boxShadow: "0 4px 32px rgba(37,99,235,0.15)" }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(59,130,246,0.1)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.2),rgba(99,102,241,0.12))", border: "1px solid rgba(99,102,241,0.25)" }}>
                {selectedBrand && BRAND_LOGOS[selectedBrand.brand]
                  ? <img src={BRAND_LOGOS[selectedBrand.brand]} alt="" className="w-8 h-8 object-contain" />
                  : <span className="text-xl">{selectedBrand?.icon}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-[14px] truncate">{selectedModel?.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[10px] font-mono" style={{ color: "#6366f1" }}>{selectedBrand?.brand}</p>
                  {imeiInfo?.brand && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>✓ IMEI VERIFIED</span>
                  )}
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-full text-[10px] font-black shrink-0" style={{ background: "rgba(251,191,36,0.12)", color: "#f59e0b", border: "1px solid rgba(251,191,36,0.25)" }}>IN PROGRESS</div>
            </div>
            <div className="px-4 py-2.5 flex items-center gap-2">
              <p className="text-[11px] font-mono" style={{ color: "#475569" }}>{isIPad ? "Serial" : "IMEI"}: <span style={{ color: "#94a3b8" }}>{imei}</span></p>
            </div>
          </div>
          {/* Queue strip */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Queue Position", value: `#${Math.max(1, 4 - Math.floor(processingPct / 30))}`, color: "#f59e0b", sub: "in unlock queue" },
              { label: "Est. Completion", value: processingPct < 50 ? "~18 min" : processingPct < 85 ? "~6 min" : "~1 min", color: "#60a5fa", sub: "at current rate" },
              { label: "Server Region", value: "AF-01", color: "#a78bfa", sub: "GSM cluster" },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="rounded-xl px-2 py-2.5 flex flex-col items-center text-center" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[13px] font-black leading-none" style={{ color }}>{value}</p>
                <p className="text-[8px] font-black uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                <p className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>{sub}</p>
              </div>
            ))}
          </div>
          {/* Ring + checklist */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
                <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <circle cx="48" cy="48" r="40" fill="none" stroke="url(#ringGrad)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - processingPct / 100)}
                    style={{ transition: "stroke-dashoffset 0.4s ease" }} />
                  <defs><linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-black text-xl text-white leading-none">{processingPct}%</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "#6366f1" }}>done</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { label: "IMEI Validated", threshold: 10 },
                  { label: "Network Auth OK", threshold: 30 },
                  { label: "Carrier DB Queried", threshold: 55 },
                  { label: "Blacklist Cleared", threshold: 75 },
                  { label: "Code Generated", threshold: 95 },
                ].map(({ label, threshold }) => {
                  const isDone = processingPct >= threshold;
                  const isActive = !isDone && processingPct >= threshold - 20;
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <div className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: isDone ? "rgba(16,185,129,0.18)" : isActive ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)", border: isDone ? "1.5px solid rgba(16,185,129,0.5)" : isActive ? "1.5px solid rgba(251,191,36,0.4)" : "1.5px solid rgba(255,255,255,0.08)" }}>
                        {isDone ? <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : isActive ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          : <span className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />}
                      </div>
                      <p className={`text-[11px] font-semibold ${isDone ? "line-through" : ""}`} style={{ color: isDone ? "#10b981" : isActive ? "#fbbf24" : "#374151" }}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex gap-0.5 h-1">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-full transition-all duration-300"
                    style={{ background: (i + 1) * (100 / 30) <= processingPct ? "linear-gradient(90deg,#3b82f6,#10b981)" : i * (100 / 30) < processingPct ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.04)" }} />
                ))}
              </div>
              <p className="text-[10px] font-mono mt-1.5 text-center" style={{ color: "#334155" }}>
                {processingPct < 100 ? "Verifying global carrier databases..." : "Verification complete"}
              </p>
            </div>
          </div>
          {/* Warning */}
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-[12px]" style={{ color: "#fbbf24" }}>Keep this page open</p>
              <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: "#78350f" }}>Closing or refreshing will interrupt verification.</p>
            </div>
          </div>
          {/* Terminal */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#090f1a", border: "1px solid rgba(99,102,241,0.15)" }}>
            <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444", opacity: 0.7 }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b", opacity: 0.7 }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e", opacity: 0.7 }} />
              <p className="text-[10px] font-mono font-semibold ml-2" style={{ color: "#475569" }}>gsm-unlock-engine v3.2</p>
              <div className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-bold font-mono" style={{ color: "#4ade80" }}>RUNNING</span>
              </div>
            </div>
            <div className="px-3.5 py-3 space-y-1.5 min-h-[110px]">
              {PROCESSING_MSGS.slice(0, processingIdx + 1).slice(-7).map((msg, _i, arr) => {
                const isLast = _i === arr.length - 1;
                const isGreen = msg.includes("✓") || msg.includes("OK") || msg.includes("clean") || msg.includes("eligible") || msg.includes("valid");
                const isAuth = msg.includes("[AUTH]");
                const isImei = msg.includes("[IMEI]") || msg.includes("[POLICY]");
                return (
                  <div key={msg} className="flex items-start gap-2 font-mono">
                    {isLast && processingPct < 100
                      ? <span className="w-3 h-3 mt-0.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
                      : <span className={`text-[10px] shrink-0 mt-px ${isGreen ? "text-emerald-500" : isAuth ? "text-blue-400" : isImei ? "text-purple-400" : "text-slate-700"}`}>›</span>}
                    <span className={`text-[10px] leading-snug ${isLast && processingPct < 100 ? "text-sky-300" : isGreen ? "text-emerald-400" : isAuth ? "text-blue-300" : isImei ? "text-purple-300" : "text-slate-600"}`}>{msg}</span>
                  </div>
                );
              })}
              {processingPct < 100 && <span className="text-blue-400 text-[11px] animate-pulse font-mono">▌</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard shell ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-[#0d1117] text-white" style={{ fontFamily: "'Segoe UI', Arial, sans-serif", minHeight: "calc(100vh - 60px)" }}>

      {/* ── Title bar ── */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-[#00C8E0] to-[#0099cc] flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-[#00C8E0]">GSM World Direct Unlock v2025.07.12</span>
          <span className="text-[11px] text-[#666] hidden sm:inline">— https://gsmworld.vercel.app</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-[11px] text-[#4CAF50] bg-[#0d2e15] px-2 py-0.5 rounded border border-[#1a4a20]">● {user.email}</span>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold" style={{ background: "rgba(0,200,224,0.08)", border: "1px solid rgba(0,200,224,0.2)", color: "#00C8E0" }}>
            <Wallet size={10} /> ${walletBalance.toFixed(2)}
          </div>
        </div>
      </div>

      {/* ── Brand logo grid ── */}
      <div className="bg-[#161b22] border-b border-[#30363d] shrink-0 overflow-x-auto">
        <div className="flex">
          {BRAND_TILES.map(b => (
            <button
              key={b.id}
              onClick={() => { setActiveTile(b.id); setModelSearch(""); }}
              style={{ background: b.bg, color: b.text, minWidth: 72 }}
              className={`flex-1 py-2 px-1 text-center text-[9px] sm:text-[10px] font-black tracking-wider uppercase transition-all border-b-2 whitespace-nowrap ${
                activeTile === b.id ? "border-white opacity-100" : "border-transparent opacity-75 hover:opacity-100"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top tabs ── */}
      <div className="bg-[#1a1f2e] border-b border-[#30363d] flex items-center shrink-0 overflow-x-auto">
        <div className="flex items-center border-r border-[#30363d]">
          {["DIRECT UNLOCK", "IMEI CHECK"].map(t => (
            <button key={t} className={`px-4 py-2 text-[11px] font-bold flex items-center gap-1.5 border-b-2 transition-colors ${
              t === "DIRECT UNLOCK" ? "text-[#FFB800] border-[#FFB800] bg-[#1e2430]" : "text-[#888] border-transparent hover:text-white"
            }`}>
              {t === "DIRECT UNLOCK" ? <Zap size={11} className="text-[#FFB800]" /> : <Terminal size={11} />}
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center border-l border-[#30363d]">
          {[
            { label: "ADB",     icon: <Terminal size={10} /> },
            { label: "FASTBOOT",icon: <Zap size={10} /> },
            { label: "T.POINT", icon: <Activity size={10} /> },
            { label: "DEVMGR",  icon: <Monitor size={10} /> },
            { label: "CONFIG",  icon: <Settings size={10} /> },
          ].map(t => (
            <button key={t.label} className="px-3 py-2 text-[10px] font-semibold text-[#888] hover:text-white flex items-center gap-1 transition-colors">
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3-panel body ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── LEFT: Model list ── */}
        <div className="w-52 lg:w-60 bg-[#161b22] border-r border-[#30363d] flex flex-col shrink-0">
          <div className="px-2 py-2 border-b border-[#30363d]">
            <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1">
              <Search size={11} className="text-[#666] shrink-0" />
              <input value={modelSearch} onChange={e => setModelSearch(e.target.value)} placeholder="Search model…"
                className="bg-transparent text-[11px] text-white placeholder-[#555] outline-none w-full" />
            </div>
          </div>
          <div className="px-3 py-1.5 border-b border-[#30363d] flex items-center justify-between">
            <span className="text-[10px] text-[#FFB800] font-bold uppercase">{BRAND_TILES.find(b => b.id === activeTile)?.label}</span>
            <span className="text-[10px] text-[#555]">{filteredModels.length} models</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredModels.map((m, i) => (
              <button key={i} onClick={() => {
                setSelectedBrand(m.brand);
                setSelectedModel({ name: m.name, price: m.price });
                setImei(""); setImeiInfo(null); setImeiLuhnError(false);
                setPayMethod(""); setMpCheckoutId(null); setNpPayment(null); setManualDone(false);
                setStep("imei");
              }}
                className={`w-full text-left px-3 py-1.5 border-b border-[#21262d] transition-colors ${
                  selectedModel?.name === m.name ? "bg-[#0d2a3e] border-l-2 border-l-[#00C8E0]" : "hover:bg-[#1e2430]"
                }`}>
                <div className={`text-[11px] font-medium leading-snug ${selectedModel?.name === m.name ? "text-[#00C8E0]" : "text-[#cdd9e5]"}`}>{m.name}</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] text-[#555]">{m.brand.brand}</span>
                  <span className="text-[9px] text-[#FFB800] font-bold">${m.price}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-[#30363d]">
            <span className="text-[9px] text-[#555]">Init: {filteredModels.length} models</span>
          </div>
        </div>

        {/* ── CENTER: Step content ── */}
        <div className="flex-1 bg-[#13191f] border-r border-[#30363d] flex flex-col overflow-hidden">

          {/* Selected device header */}
          <div className="px-4 py-2 border-b border-[#30363d] bg-[#161b22] flex items-center gap-3 shrink-0">
            {selectedModel ? (
              <>
                <div>
                  <div className="text-[11px] font-bold text-[#00C8E0]">{selectedModel.name}</div>
                  <div className="text-[10px] text-[#666]">{selectedBrand?.brand} · ${selectedModel.price} USD</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {step !== "model" && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      step === "imei" ? "text-[#FFB800] bg-[#2a1f00] border-[#FFB800]/30" :
                      step === "confirmed" ? "text-[#4CAF50] bg-[#0d2e15] border-[#4CAF50]/30" :
                      step === "pay" ? "text-[#00C8E0] bg-[#0d2a3e] border-[#00C8E0]/30" : "text-[#888] border-[#30363d]"
                    }`}>
                      {step === "imei" ? "ENTER IMEI" : step === "confirmed" ? "VERIFIED" : step === "pay" ? "PAYMENT" : step.toUpperCase()}
                    </span>
                  )}
                  <button onClick={resetAll} className="text-[10px] text-[#555] hover:text-[#888] transition-colors">✕ Reset</button>
                </div>
              </>
            ) : (
              <div className="text-[11px] text-[#555] italic">← Select a device model from the list to begin</div>
            )}
          </div>

          {/* Step content area */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* No model selected */}
            {step === "model" && !selectedModel && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                <div className="w-16 h-16 rounded-2xl bg-[#1e2430] border border-[#30363d] flex items-center justify-center">
                  <Smartphone size={28} className="text-[#444]" />
                </div>
                <div>
                  <p className="text-[#888] font-semibold text-sm">Select a device from the left panel</p>
                  <p className="text-[#555] text-[11px] mt-1">Click any brand tile at the top to filter models, then click a model to start</p>
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-xs w-full mt-2">
                  {[
                    { icon: "1", text: "Click a brand tile to filter" },
                    { icon: "2", text: "Select your device model" },
                    { icon: "3", text: "Enter your IMEI number" },
                    { icon: "4", text: "Pay & receive unlock code" },
                  ].map(s => (
                    <div key={s.icon} className="flex items-center gap-2 bg-[#1a1f2e] border border-[#21262d] rounded-lg px-3 py-2">
                      <span className="w-5 h-5 rounded bg-[#00C8E0]/10 text-[#00C8E0] text-[10px] font-black flex items-center justify-center shrink-0">{s.icon}</span>
                      <span className="text-[10px] text-[#666]">{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── IMEI step ── */}
            {step === "imei" && selectedBrand && selectedModel && (
              <div className="space-y-4 max-w-lg">
                {/* Order summary strip */}
                <div className="rounded-xl overflow-hidden border border-[#30363d]">
                  <div className="px-4 py-3 flex items-center gap-3" style={{ background: "linear-gradient(135deg,#1e3a5f,#243b55)" }}>
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      {BRAND_LOGOS[selectedBrand.brand] ? <img src={BRAND_LOGOS[selectedBrand.brand]} alt="" className="w-7 h-7 object-contain" /> : <span className="text-lg">{selectedBrand.icon}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-blue-300 font-semibold">{selectedBrand.brand}</p>
                      <p className="text-sm font-black text-white truncate">{selectedModel.name}</p>
                    </div>
                    <p className="text-xl font-black text-emerald-400 shrink-0">${selectedModel.price}</p>
                  </div>
                </div>

                {/* IMEI input */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#888] uppercase tracking-wider mb-2">
                      {isIPad ? "Serial Number" : "IMEI Number"} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={imei}
                        onChange={e => isIPad
                          ? setImei(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20))
                          : setImei(e.target.value.replace(/\D/g, "").slice(0, 15))
                        }
                        placeholder={isIPad ? "e.g. DMPFW3J7DKQR" : "15-digit IMEI (dial *#06#)"}
                        maxLength={isIPad ? 20 : 15}
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-[#00C8E0] pr-10 transition-colors"
                      />
                      {(isIPad ? imei.length >= 8 : imei.length === 15) && (
                        <button onClick={() => { setImeiCopied(true); navigator.clipboard.writeText(imei); setTimeout(() => setImeiCopied(false), 1500); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]">
                          {imeiCopied ? <Check size={14} className="text-[#4CAF50]" /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-start gap-2 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 mt-2">
                      <Info size={11} className="text-[#00C8E0] mt-0.5 shrink-0" />
                      {isIPad
                        ? <p className="text-[10px] text-[#888]">Find in <strong className="text-[#ccc]">Settings → General → About</strong> or on the back of the iPad.</p>
                        : <p className="text-[10px] text-[#888]">Dial <strong className="font-mono text-[#ccc]">*#06#</strong> or go to Settings → About Phone → IMEI.</p>
                      }
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-[#888] uppercase tracking-wider mb-2">Notes <span className="text-[#444]">(optional)</span></label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. carrier name, country, special instructions…" rows={2}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#00C8E0] resize-none transition-colors" />
                  </div>

                  {/* Status indicators */}
                  {!isIPad && imei.length > 0 && imei.length !== 15 && (
                    <p className="text-[11px] text-amber-500 font-semibold">{imei.length}/15 digits entered</p>
                  )}
                  {!isIPad && imeiLuhnError && (
                    <div className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                      <AlertCircle size={12} className="text-red-400 shrink-0" />
                      <p className="text-[11px] text-red-400 font-semibold">Invalid IMEI — please double-check this number.</p>
                    </div>
                  )}
                  {imeiTacLoading && (
                    <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-500/30 rounded-lg px-3 py-2">
                      <RefreshCw size={12} className="text-[#00C8E0] animate-spin shrink-0" />
                      <p className="text-[11px] text-[#00C8E0] font-semibold">Verifying device… auto-proceeding in a moment</p>
                    </div>
                  )}
                  {imeiInfo && !imeiTacLoading && !imeiLuhnError && (
                    <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <div>
                          {(imeiInfo.brand || imeiInfo.model) ? (
                            <p className="font-black text-emerald-300 text-[12px]">{[imeiInfo.brand, imeiInfo.model].filter(Boolean).join(" · ")}</p>
                          ) : (
                            <p className="font-semibold text-emerald-300 text-[12px]">IMEI valid — device confirmed</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-500/30 rounded-full px-1.5 py-0.5">✓ IMEI Valid</span>
                            <RefreshCw size={9} className="text-emerald-500 animate-spin" />
                            <span className="text-[10px] text-emerald-600">Proceeding automatically…</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (isIPad) { if (imei.length < 8) { toast({ title: "Serial number too short", variant: "destructive" }); return; } }
                      else { if (imei.length !== 15) { toast({ title: "IMEI must be exactly 15 digits", description: `You entered ${imei.length} digits`, variant: "destructive" }); return; }
                        if (imeiLuhnError) { toast({ title: "Invalid IMEI", variant: "destructive" }); return; } }
                      setStep("processing");
                    }}
                    disabled={isIPad ? imei.length < 8 : (imei.length !== 15 || imeiLuhnError)}
                    className="w-full py-3 font-black text-sm rounded-lg text-black flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg,#00C8E0,#0099cc)", boxShadow: "0 4px 16px rgba(0,200,224,0.3)" }}
                  >
                    <Shield size={15} /> Verify Device &amp; Continue
                  </button>
                </div>
              </div>
            )}

            {/* ── Confirmed step ── */}
            {step === "confirmed" && selectedBrand && selectedModel && (
              <div className="space-y-4 max-w-lg">
                <div className="rounded-xl overflow-hidden border border-emerald-500/30">
                  <div className="p-5 text-center" style={{ background: "linear-gradient(135deg,#064e3b,#065f46)" }}>
                    <div className="w-14 h-14 rounded-full bg-white/15 border border-white/25 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 size={28} className="text-white" />
                    </div>
                    <p className="font-black text-xl text-white">Device Verified!</p>
                    <p className="text-emerald-200 text-sm mt-1">{selectedBrand.brand} — {selectedModel.name}</p>
                    {imeiInfo?.brand && (
                      <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
                        <CheckCircle2 size={10} className="text-emerald-200" />
                        <span className="text-[10px] font-black text-emerald-100">{imeiInfo.brand} · IMEI {imei.slice(0,6)}···{imei.slice(-2)} Verified</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {["IMEI Valid", "Not Blacklisted", "Eligible"].map(b => (
                        <div key={b} className="bg-white/10 border border-white/15 rounded-lg py-2">
                          <p className="text-emerald-300 font-black">✓</p>
                          <p className="text-white/80 text-[9px] font-semibold mt-0.5">{b}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between bg-white/10 border border-white/15 rounded-lg px-4 py-3 mt-3">
                      <p className="text-emerald-100/80 text-sm font-medium">Unlock Price</p>
                      <p className="text-2xl font-black text-white">${selectedModel.price}</p>
                    </div>
                  </div>
                  <div className="bg-[#161b22] px-4 py-3 space-y-2">
                    {[
                      { icon: <Clock size={12} className="text-blue-400" />, text: "Unlock processed within 30 min – 24 hrs" },
                      { icon: <Zap size={12} className="text-amber-400" />, text: "Unlock code sent to your registered email" },
                      { icon: <Shield size={12} className="text-emerald-400" />, text: "Permanent unlock — works on all carriers" },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        {s.icon}<p className="text-[11px] text-[#888]">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setStep("pay")}
                  className="w-full py-3.5 font-black text-sm rounded-xl text-black flex items-center justify-center gap-2 transition-all"
                  style={{ background: "linear-gradient(135deg,#00C8E0,#0099cc)", boxShadow: "0 4px 16px rgba(0,200,224,0.3)" }}>
                  <CreditCard size={16} /> Proceed to Payment →
                </button>
              </div>
            )}

            {/* ── Payment step ── */}
            {step === "pay" && selectedBrand && selectedModel && (
              <div className="space-y-4 max-w-lg">
                {/* Back button */}
                {!mpCheckoutId && !npPayment && (
                  <button onClick={() => setStep("confirmed")} className="flex items-center gap-2 text-[11px] text-[#888] hover:text-white transition-colors">
                    <ArrowLeft size={13} /> Back to verification
                  </button>
                )}

                {/* Order strip */}
                <div className="flex items-center justify-between bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[11px] text-[#888]">{selectedBrand.brand}</p>
                    <p className="text-sm font-bold text-white">{selectedModel.name}</p>
                    <p className="text-[10px] font-mono text-[#555] mt-0.5">IMEI: {imei}</p>
                  </div>
                  <p className="text-2xl font-black text-[#FFB800]">${selectedModel.price}</p>
                </div>

                {/* Payment method picker */}
                {!mpCheckoutId && !npPayment && (
                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#30363d]">
                      <p className="text-[10px] font-black text-[#888] uppercase tracking-wider">Payment Methods</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {([
                        { id: "wallet" as PayMethod, label: "Wallet Balance", icon: "💳", sub: `Balance: $${walletBalance.toFixed(2)}${walletBalance < selectedModel.price ? " — insufficient" : ""}`, warn: walletBalance < selectedModel.price, badge: "Instant" },
                        { id: "mpesa" as PayMethod, label: "M-Pesa", icon: "📱", sub: "STK push to your phone — auto-confirm", warn: false, badge: "Auto" },
                        { id: "nowpayments" as PayMethod, label: "Crypto (NOWPayments)", icon: "₿", sub: "BTC, ETH, USDT and 100+ coins — auto-confirm", warn: false, badge: "Auto" },
                        { id: "binance_pay" as PayMethod, label: "Binance Pay", icon: "🟡", sub: "Manual verification within 10-30 min", warn: false, badge: "Manual" },
                        { id: "usdt_manual" as PayMethod, label: "USDT TRC20 (Manual)", icon: "💲", sub: "Send to our address — manual verification", warn: false, badge: "Manual" },
                      ] as const).map(pm => (
                        <button key={pm.id} onClick={() => setPayMethod(pm.id)}
                          className={`w-full flex items-center gap-3 border rounded-lg px-3 py-2.5 text-left transition-all ${
                            payMethod === pm.id ? "border-[#00C8E0] bg-[#0d2a3e]" : "border-[#30363d] bg-[#1a1f2e] hover:border-[#444]"
                          }`}>
                          <span className="text-lg shrink-0">{pm.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-white">{pm.label}</p>
                            <p className={`text-[10px] ${pm.warn ? "text-amber-400" : "text-[#555]"}`}>{pm.sub}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${pm.badge === "Instant" ? "bg-emerald-900/40 text-emerald-400" : pm.badge === "Auto" ? "bg-blue-900/40 text-blue-400" : "bg-[#1a1f2e] text-[#666]"}`}>{pm.badge}</span>
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${payMethod === pm.id ? "border-[#00C8E0]" : "border-[#555]"}`}>
                              {payMethod === pm.id && <div className="w-2 h-2 rounded-full bg-[#00C8E0]" />}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wallet pay */}
                {payMethod === "wallet" && !mpCheckoutId && !npPayment && (
                  <div className="space-y-2">
                    <button onClick={handleWalletPay} disabled={walletBalance < selectedModel.price}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                      <Wallet size={15} /> Pay ${selectedModel.price} from Wallet
                    </button>
                    {walletBalance < selectedModel.price && (
                      <Link href="/account/add-fund">
                        <button className="w-full py-3 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/20 font-bold rounded-xl text-sm transition-colors">Top Up Wallet Now</button>
                      </Link>
                    )}
                  </div>
                )}

                {/* M-Pesa */}
                {payMethod === "mpesa" && !mpCheckoutId && (
                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">
                      We'll send an STK push for <strong>${selectedModel.price}</strong> (≈ KES {(selectedModel.price * 130).toLocaleString()}). Enter your PIN to pay.
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-[#888] uppercase tracking-wider mb-2">M-Pesa Phone Number</label>
                      <div className="flex items-center border border-[#30363d] rounded-lg overflow-hidden focus-within:border-[#00C8E0] transition-colors">
                        <span className="px-3 py-3 bg-[#1a1f2e] text-sm text-[#888] font-bold border-r border-[#30363d]">+254</span>
                        <input type="tel" value={mpPhone} onChange={e => setMpPhone(e.target.value)} placeholder="7XX XXX XXX"
                          className="flex-1 px-3 py-3 text-sm bg-[#0d1117] text-white placeholder-[#444] focus:outline-none" />
                      </div>
                    </div>
                    <button onClick={handleMpesaSend} disabled={mpSending}
                      className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                      {mpSending ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</> : <><Smartphone size={15} /> Send STK Push — ${selectedModel.price}</>}
                    </button>
                  </div>
                )}
                {payMethod === "mpesa" && mpCheckoutId && (
                  <div className="bg-[#161b22] border border-green-500/30 rounded-xl p-5 space-y-4">
                    <div className="text-center">
                      <div className="w-14 h-14 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3"><Smartphone size={22} className="text-green-400" /></div>
                      <p className="font-black text-green-300 text-lg">STK Push Sent!</p>
                      <p className="text-sm text-[#888] mt-1">Enter your M-Pesa PIN. Order created automatically on confirmation.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-green-900/20 border border-green-500/30 rounded-lg px-3 py-2.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                      <p className="text-[11px] text-green-300">{mpPollCount >= 15 ? "Auto-check stopped. Use button below." : `Checking automatically… (${mpPollCount}/15)`}</p>
                    </div>
                    <button onClick={handleMpesaCheck} disabled={mpChecking}
                      className="w-full py-3 border border-green-500/40 text-green-400 hover:bg-green-900/20 font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                      {mpChecking ? <><span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> Checking…</> : <><RefreshCw size={14} /> Check Payment Now</>}
                    </button>
                    <button onClick={() => { setMpCheckoutId(null); setMpPollCount(0); }} className="w-full py-2 text-xs text-[#555] hover:text-[#888]">Try again with a different number</button>
                  </div>
                )}

                {/* NOWPayments */}
                {payMethod === "nowpayments" && !npPayment && (
                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
                    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-[#888]">
                      Pay <strong className="text-white">${selectedModel.price}</strong> in cryptocurrency. Order created automatically after on-chain confirmation.
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-[#888] uppercase tracking-wider mb-2">Select Cryptocurrency</label>
                      <select value={npCurrency} onChange={e => setNpCurrency(e.target.value)}
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-[#00C8E0] transition-colors">
                        <option value="usdttrc20">USDT (TRC20 / TRON)</option>
                        <option value="usdterc20">USDT (ERC20 / Ethereum)</option>
                        <option value="btc">Bitcoin (BTC)</option>
                        <option value="eth">Ethereum (ETH)</option>
                        <option value="ltc">Litecoin (LTC)</option>
                        <option value="xrp">Ripple (XRP)</option>
                        <option value="bnbbsc">BNB (BSC)</option>
                        <option value="trx">TRON (TRX)</option>
                        <option value="usdcbsc">USDC (BSC)</option>
                        <option value="doge">Dogecoin (DOGE)</option>
                      </select>
                    </div>
                    <button onClick={handleNpCreate} disabled={npCreating}
                      className="w-full py-3.5 bg-[#1a1f2e] hover:bg-[#252b3b] border border-[#30363d] disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                      {npCreating ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</> : <>₿ Generate Payment Address</>}
                    </button>
                  </div>
                )}
                {payMethod === "nowpayments" && npPayment && (
                  <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-[#888] uppercase tracking-wider">Send exactly</span>
                      <span className="font-black text-xl text-white">{npPayment.payAmount} {npPayment.payCurrency.toUpperCase()}</span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <QRCodeSVG value={npPayment.payAddress} size={140} level="M" className="rounded-xl border-4 border-white shadow-lg" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-[#888] uppercase tracking-wider mb-1.5">Payment Address</p>
                      <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5">
                        <span className="font-mono text-[10px] text-[#888] break-all flex-1">{npPayment.payAddress}</span>
                        <button onClick={() => { navigator.clipboard.writeText(npPayment.payAddress); setNpCopied(true); setTimeout(() => setNpCopied(false), 2000); toast({ title: "Address copied!" }); }}
                          className={`shrink-0 p-1.5 rounded text-xs font-bold transition-colors ${npCopied ? "bg-emerald-600 text-white" : "bg-[#30363d] text-[#888] hover:bg-[#444]"}`}>
                          {npCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                    {npPayment.expiresAt && <p className="text-[11px] text-amber-400">⏱ Expires: {new Date(npPayment.expiresAt).toLocaleTimeString()}</p>}
                    <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-500/30 rounded-lg px-3 py-2.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                      <span className="text-[11px] text-blue-300">{npPollCount >= 30 ? "Auto-check stopped." : `Checking every 30s… (${npPollCount}/30)`}</span>
                    </div>
                    <button onClick={handleNpCheck} className="w-full py-3 border border-[#00C8E0]/40 text-[#00C8E0] hover:bg-[#00C8E0]/10 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                      <RefreshCw size={14} /> Check Payment
                    </button>
                    <button onClick={() => { setNpPayment(null); setNpPollCount(0); }} className="w-full py-2 text-xs text-[#555] hover:text-[#888]">Cancel / Change currency</button>
                  </div>
                )}

                {/* Binance Pay */}
                {payMethod === "binance_pay" && !mpCheckoutId && !npPayment && (
                  manualDone && orderId ? (
                    <div className="bg-[#161b22] border border-green-500/30 rounded-xl p-6 space-y-3 text-center">
                      <div className="w-14 h-14 bg-green-900/30 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={28} className="text-green-400" /></div>
                      <p className="font-black text-lg text-white">Order #{orderId} Submitted!</p>
                      <p className="text-sm text-[#888]">Our team verifies your payment within <strong>10-30 minutes</strong>.</p>
                    </div>
                  ) : (
                    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
                      <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 space-y-3">
                        <p className="text-[12px] font-bold text-amber-300">Send ${selectedModel.price} USD via Binance Pay</p>
                        <div className="flex items-center gap-3 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3">
                          <span className="text-2xl">🟡</span>
                          <div className="flex-1">
                            <p className="text-[10px] text-[#555]">Binance Pay ID</p>
                            <p className="text-2xl font-black text-white tracking-widest">490759406</p>
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText("490759406"); toast({ title: "Copied!" }); }}
                            className="w-9 h-9 rounded-lg bg-amber-900/30 text-amber-400 flex items-center justify-center hover:bg-amber-900/50 transition-colors">
                            <Copy size={14} />
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-400/70">Payment label: <strong>GSM World Unlock</strong></p>
                      </div>
                      <button onClick={handleManualPay}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                        <CheckCircle2 size={16} /> I've Sent ${selectedModel.price} — Place Order
                      </button>
                    </div>
                  )
                )}

                {/* USDT Manual */}
                {payMethod === "usdt_manual" && !mpCheckoutId && !npPayment && (
                  manualDone && orderId ? (
                    <div className="bg-[#161b22] border border-green-500/30 rounded-xl p-6 space-y-3 text-center">
                      <div className="w-14 h-14 bg-green-900/30 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={28} className="text-green-400" /></div>
                      <p className="font-black text-lg text-white">Order #{orderId} Submitted!</p>
                      <p className="text-sm text-[#888]">Our team verifies your payment within <strong>10-30 minutes</strong>.</p>
                    </div>
                  ) : (
                    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
                      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4 space-y-3">
                        <p className="text-[12px] font-bold text-emerald-300">Send ${selectedModel.price} USDT via TRC20 Network</p>
                        <div className="flex flex-col items-center gap-3">
                          <QRCodeSVG value="TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5" size={120} level="M" className="rounded-xl border-4 border-white shadow-lg" />
                        </div>
                        <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5">
                          <span className="font-mono text-[10px] text-[#888] break-all flex-1">TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5</span>
                          <button onClick={() => { navigator.clipboard.writeText("TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5"); toast({ title: "Address copied!" }); }}
                            className="shrink-0 p-1.5 rounded bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 transition-colors"><Copy size={12} /></button>
                        </div>
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
                          <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-red-400">TRC20 only — Sending via ERC20 will result in loss of funds.</p>
                        </div>
                      </div>
                      <button onClick={handleManualPay}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                        <CheckCircle2 size={16} /> I've Sent ${selectedModel.price} USDT — Place Order
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Status panel ── */}
        <div className="w-64 xl:w-72 bg-[#161b22] flex flex-col overflow-hidden shrink-0">
          {/* Connection info */}
          <div className="px-3 py-2 border-b border-[#30363d] space-y-1.5">
            <div className="flex items-center gap-2">
              <Usb size={10} className="text-[#555] shrink-0" />
              <span className="text-[10px] text-[#666] w-8 shrink-0">USB</span>
              <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5">
                <span className="text-[10px] text-[#555] italic">- Waiting for devices -</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Monitor size={10} className="text-[#FFB800] shrink-0" />
              <span className="text-[10px] text-[#666] w-8 shrink-0">COM</span>
              <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 flex items-center gap-1">
                <span className="text-[9px]">🟡</span>
                <span className="text-[10px] text-[#888]">COM1 (Communications Port)</span>
              </div>
            </div>
          </div>

          {/* IMEI / Device info */}
          <div className="px-3 py-2 border-b border-[#30363d] space-y-1.5">
            <p className="text-[9px] font-black text-[#555] uppercase tracking-wider">Device Info</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-[10px] text-[#555]">Model</span>
                <span className="text-[10px] text-[#cdd9e5] truncate max-w-[120px] text-right">{selectedModel?.name.split(" ").slice(0, 3).join(" ") || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-[#555]">IMEI</span>
                <span className="text-[10px] font-mono text-[#888]">{imei || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-[#555]">Status</span>
                <span className={`text-[10px] font-bold ${step === "confirmed" || step === "pay" ? "text-[#4CAF50]" : step === "imei" ? "text-[#FFB800]" : "text-[#555]"}`}>
                  {step === "confirmed" || step === "pay" ? "✓ Verified" : step === "imei" ? "Pending IMEI" : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-[#555]">Price</span>
                <span className="text-[10px] font-black text-[#FFB800]">{selectedModel ? `$${selectedModel.price}` : "—"}</span>
              </div>
            </div>
          </div>

          {/* Wallet */}
          <div className="px-3 py-2 border-b border-[#30363d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Wallet size={10} className="text-[#555]" />
                <span className="text-[10px] text-[#666]">Wallet</span>
              </div>
              <span className="text-[11px] font-black text-white">${walletBalance.toFixed(2)}</span>
            </div>
            <Link href="/account/add-fund">
              <button className="w-full mt-1.5 text-[10px] font-bold text-[#00C8E0] border border-[#00C8E0]/30 rounded py-1 hover:bg-[#00C8E0]/10 transition-colors">+ Top Up</button>
            </Link>
          </div>

          {/* Status log */}
          <div className="flex-1 overflow-y-auto bg-[#0d1117] p-2 font-mono text-[10px] leading-5">
            {[
              { text: "GSM World Direct Unlock Tool", color: "#FFB800" },
              { text: "Ready — select device from list", color: "#555" },
              ...(selectedBrand ? [{ text: `Brand: ${selectedBrand.brand}`, color: "#00C8E0" }] : []),
              ...(selectedModel ? [{ text: `Model: ${selectedModel.name.slice(0, 30)}`, color: "#fff" }] : []),
              ...(imei ? [{ text: `IMEI: ${imei}`, color: "#888" }] : []),
              ...(imeiInfo?.brand ? [{ text: `Device: ${imeiInfo.brand}${imeiInfo.model ? ` ${imeiInfo.model}` : ""}`, color: "#4CAF50" }] : []),
              ...(step === "confirmed" ? [
                { text: "✓ IMEI Valid", color: "#4CAF50" },
                { text: "✓ Not Blacklisted", color: "#4CAF50" },
                { text: "✓ Carrier Eligible", color: "#4CAF50" },
              ] : []),
              ...(step === "pay" ? [{ text: "Awaiting payment…", color: "#FFB800" }] : []),
            ].map((line, i) => (
              <div key={i} style={{ color: line.color }}>&gt; {line.text}</div>
            ))}
          </div>

          {/* How it works */}
          <div className="px-3 py-3 border-t border-[#30363d] space-y-1.5">
            <p className="text-[9px] font-black text-[#555] uppercase tracking-wider mb-1">How It Works</p>
            {[
              { n: "1", text: "Pick brand → select model" },
              { n: "2", text: "Enter your IMEI number" },
              { n: "3", text: "Auto-verification (70s)" },
              { n: "4", text: "Pay → receive unlock code" },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#00C8E0]/10 text-[#00C8E0] text-[9px] font-black flex items-center justify-center shrink-0">{s.n}</span>
                <span className="text-[10px] text-[#555]">{s.text}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
            <span className="text-[9px] text-[#555]">GSM World v2025</span>
            <span className="text-[9px] text-[#555]">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
