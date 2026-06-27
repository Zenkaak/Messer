import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Smartphone, ChevronRight, Shield, ArrowLeft, CheckCircle2,
  Loader2, AlertTriangle, Copy, Check, Search, Clock, Share2,
  Upload, ImageIcon, X, LogIn,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// ─── Device Catalog with Prices ──────────────────────────────────────────────

type DeviceModel = { name: string; price: number };
type Brand = { label: string; models: DeviceModel[] };

const DEVICE_CATALOG: Brand[] = [
  {
    label: "Apple iPhone",
    models: [
      { name: "iPhone 4", price: 8 },
      { name: "iPhone 4S", price: 8 },
      { name: "iPhone 5", price: 8 },
      { name: "iPhone 5C", price: 8 },
      { name: "iPhone 5S", price: 9 },
      { name: "iPhone 6", price: 9 },
      { name: "iPhone 6 Plus", price: 9 },
      { name: "iPhone 6S", price: 10 },
      { name: "iPhone 6S Plus", price: 10 },
      { name: "iPhone SE (1st Gen)", price: 10 },
      { name: "iPhone 7", price: 11 },
      { name: "iPhone 7 Plus", price: 12 },
      { name: "iPhone 8", price: 12 },
      { name: "iPhone 8 Plus", price: 13 },
      { name: "iPhone X", price: 14 },
      { name: "iPhone XR", price: 14 },
      { name: "iPhone XS", price: 15 },
      { name: "iPhone XS Max", price: 15 },
      { name: "iPhone SE (2nd Gen)", price: 14 },
      { name: "iPhone 11", price: 15 },
      { name: "iPhone 11 Pro", price: 16 },
      { name: "iPhone 11 Pro Max", price: 16 },
      { name: "iPhone 12 Mini", price: 16 },
      { name: "iPhone 12", price: 17 },
      { name: "iPhone 12 Pro", price: 17 },
      { name: "iPhone 12 Pro Max", price: 18 },
      { name: "iPhone SE (3rd Gen)", price: 17 },
      { name: "iPhone 13 Mini", price: 18 },
      { name: "iPhone 13", price: 18 },
      { name: "iPhone 13 Pro", price: 19 },
      { name: "iPhone 13 Pro Max", price: 19 },
      { name: "iPhone 14", price: 20 },
      { name: "iPhone 14 Plus", price: 21 },
      { name: "iPhone 14 Pro", price: 22 },
      { name: "iPhone 14 Pro Max", price: 23 },
      { name: "iPhone 15", price: 24 },
      { name: "iPhone 15 Plus", price: 25 },
      { name: "iPhone 15 Pro", price: 26 },
      { name: "iPhone 15 Pro Max", price: 27 },
      { name: "iPhone 16", price: 28 },
      { name: "iPhone 16 Plus", price: 29 },
      { name: "iPhone 16 Pro", price: 30 },
      { name: "iPhone 16 Pro Max", price: 32 },
    ],
  },
  {
    label: "Samsung Galaxy S",
    models: [
      { name: "Galaxy S7", price: 10 },
      { name: "Galaxy S7 Edge", price: 10 },
      { name: "Galaxy S8", price: 12 },
      { name: "Galaxy S8+", price: 12 },
      { name: "Galaxy S9", price: 13 },
      { name: "Galaxy S9+", price: 13 },
      { name: "Galaxy S10e", price: 14 },
      { name: "Galaxy S10", price: 14 },
      { name: "Galaxy S10+", price: 15 },
      { name: "Galaxy S10 5G", price: 15 },
      { name: "Galaxy S20", price: 16 },
      { name: "Galaxy S20+", price: 17 },
      { name: "Galaxy S20 Ultra", price: 17 },
      { name: "Galaxy S20 FE", price: 15 },
      { name: "Galaxy S21", price: 17 },
      { name: "Galaxy S21+", price: 18 },
      { name: "Galaxy S21 Ultra", price: 19 },
      { name: "Galaxy S21 FE", price: 16 },
      { name: "Galaxy S22", price: 19 },
      { name: "Galaxy S22+", price: 20 },
      { name: "Galaxy S22 Ultra", price: 22 },
      { name: "Galaxy S23", price: 21 },
      { name: "Galaxy S23+", price: 22 },
      { name: "Galaxy S23 Ultra", price: 24 },
      { name: "Galaxy S23 FE", price: 19 },
      { name: "Galaxy S24", price: 23 },
      { name: "Galaxy S24+", price: 25 },
      { name: "Galaxy S24 Ultra", price: 27 },
      { name: "Galaxy S24 FE", price: 21 },
      { name: "Galaxy S25", price: 26 },
      { name: "Galaxy S25+", price: 28 },
      { name: "Galaxy S25 Ultra", price: 30 },
    ],
  },
  {
    label: "Samsung Galaxy A",
    models: [
      { name: "Galaxy A03", price: 10 },
      { name: "Galaxy A03s", price: 10 },
      { name: "Galaxy A04", price: 10 },
      { name: "Galaxy A04s", price: 10 },
      { name: "Galaxy A05", price: 10 },
      { name: "Galaxy A05s", price: 10 },
      { name: "Galaxy A13", price: 11 },
      { name: "Galaxy A14", price: 11 },
      { name: "Galaxy A15", price: 12 },
      { name: "Galaxy A23", price: 12 },
      { name: "Galaxy A24", price: 12 },
      { name: "Galaxy A25", price: 13 },
      { name: "Galaxy A33 5G", price: 13 },
      { name: "Galaxy A34 5G", price: 14 },
      { name: "Galaxy A35 5G", price: 15 },
      { name: "Galaxy A50", price: 12 },
      { name: "Galaxy A51", price: 13 },
      { name: "Galaxy A52", price: 14 },
      { name: "Galaxy A53 5G", price: 15 },
      { name: "Galaxy A54 5G", price: 16 },
      { name: "Galaxy A55 5G", price: 17 },
      { name: "Galaxy A70", price: 13 },
      { name: "Galaxy A71", price: 14 },
      { name: "Galaxy A72", price: 15 },
      { name: "Galaxy A73 5G", price: 16 },
    ],
  },
  {
    label: "Samsung Galaxy Note",
    models: [
      { name: "Galaxy Note 8", price: 13 },
      { name: "Galaxy Note 9", price: 14 },
      { name: "Galaxy Note 10", price: 16 },
      { name: "Galaxy Note 10+", price: 17 },
      { name: "Galaxy Note 10 Lite", price: 14 },
      { name: "Galaxy Note 20", price: 18 },
      { name: "Galaxy Note 20 Ultra", price: 20 },
    ],
  },
  {
    label: "Samsung Galaxy Z",
    models: [
      { name: "Galaxy Z Flip", price: 20 },
      { name: "Galaxy Z Flip 3", price: 22 },
      { name: "Galaxy Z Flip 4", price: 24 },
      { name: "Galaxy Z Flip 5", price: 26 },
      { name: "Galaxy Z Flip 6", price: 28 },
      { name: "Galaxy Z Fold 2", price: 25 },
      { name: "Galaxy Z Fold 3", price: 27 },
      { name: "Galaxy Z Fold 4", price: 30 },
      { name: "Galaxy Z Fold 5", price: 33 },
      { name: "Galaxy Z Fold 6", price: 35 },
    ],
  },
  {
    label: "Samsung Galaxy M",
    models: [
      { name: "Galaxy M12", price: 10 },
      { name: "Galaxy M13", price: 10 },
      { name: "Galaxy M14", price: 11 },
      { name: "Galaxy M23", price: 11 },
      { name: "Galaxy M33 5G", price: 12 },
      { name: "Galaxy M34 5G", price: 13 },
      { name: "Galaxy M52 5G", price: 13 },
      { name: "Galaxy M53 5G", price: 14 },
      { name: "Galaxy M54 5G", price: 15 },
    ],
  },
  {
    label: "Huawei",
    models: [
      { name: "Huawei P30", price: 12 },
      { name: "Huawei P30 Pro", price: 14 },
      { name: "Huawei P40", price: 13 },
      { name: "Huawei P40 Pro", price: 15 },
      { name: "Huawei P50", price: 14 },
      { name: "Huawei P50 Pro", price: 16 },
      { name: "Huawei Mate 20", price: 12 },
      { name: "Huawei Mate 20 Pro", price: 14 },
      { name: "Huawei Mate 30 Pro", price: 15 },
      { name: "Huawei Mate 40 Pro", price: 16 },
      { name: "Huawei Nova 7i", price: 11 },
      { name: "Huawei Nova 8", price: 12 },
      { name: "Huawei Nova 9", price: 12 },
      { name: "Huawei Y9s", price: 10 },
      { name: "Huawei Y9 Prime 2019", price: 10 },
    ],
  },
  {
    label: "Xiaomi / Redmi / POCO",
    models: [
      { name: "Redmi Note 10", price: 10 },
      { name: "Redmi Note 10 Pro", price: 11 },
      { name: "Redmi Note 11", price: 10 },
      { name: "Redmi Note 11 Pro", price: 11 },
      { name: "Redmi Note 12", price: 10 },
      { name: "Redmi Note 12 Pro", price: 11 },
      { name: "Redmi Note 13", price: 11 },
      { name: "Redmi Note 13 Pro", price: 12 },
      { name: "Redmi 10", price: 10 },
      { name: "Redmi 12", price: 10 },
      { name: "Xiaomi 12", price: 14 },
      { name: "Xiaomi 12 Pro", price: 15 },
      { name: "Xiaomi 13", price: 15 },
      { name: "Xiaomi 13 Pro", price: 16 },
      { name: "Xiaomi 14", price: 17 },
      { name: "Xiaomi 14 Pro", price: 18 },
      { name: "POCO X3", price: 11 },
      { name: "POCO X4 Pro", price: 12 },
      { name: "POCO X5 Pro", price: 12 },
      { name: "POCO F5", price: 13 },
      { name: "POCO F5 Pro", price: 14 },
    ],
  },
  {
    label: "OnePlus",
    models: [
      { name: "OnePlus 8", price: 12 },
      { name: "OnePlus 8 Pro", price: 13 },
      { name: "OnePlus 8T", price: 12 },
      { name: "OnePlus 9", price: 13 },
      { name: "OnePlus 9 Pro", price: 14 },
      { name: "OnePlus 9R", price: 12 },
      { name: "OnePlus 10 Pro", price: 15 },
      { name: "OnePlus 10T", price: 14 },
      { name: "OnePlus 11", price: 16 },
      { name: "OnePlus 12", price: 18 },
      { name: "OnePlus Nord", price: 11 },
      { name: "OnePlus Nord 2", price: 12 },
      { name: "OnePlus Nord 3", price: 13 },
      { name: "OnePlus Nord CE 3", price: 12 },
    ],
  },
  {
    label: "Oppo / Realme",
    models: [
      { name: "Oppo A54", price: 10 },
      { name: "Oppo A74", price: 11 },
      { name: "Oppo A78", price: 11 },
      { name: "Oppo A96", price: 11 },
      { name: "Oppo Reno 6", price: 12 },
      { name: "Oppo Reno 7", price: 13 },
      { name: "Oppo Reno 8", price: 13 },
      { name: "Oppo Reno 10", price: 14 },
      { name: "Oppo Find X5", price: 15 },
      { name: "Oppo Find X6 Pro", price: 17 },
      { name: "Realme 9", price: 10 },
      { name: "Realme 10", price: 10 },
      { name: "Realme 11", price: 11 },
      { name: "Realme GT 2", price: 13 },
      { name: "Realme GT Neo 3", price: 12 },
      { name: "Realme GT 3", price: 13 },
    ],
  },
  {
    label: "Google Pixel",
    models: [
      { name: "Pixel 5", price: 12 },
      { name: "Pixel 5a", price: 12 },
      { name: "Pixel 6", price: 14 },
      { name: "Pixel 6 Pro", price: 15 },
      { name: "Pixel 6a", price: 13 },
      { name: "Pixel 7", price: 15 },
      { name: "Pixel 7 Pro", price: 16 },
      { name: "Pixel 7a", price: 14 },
      { name: "Pixel 8", price: 17 },
      { name: "Pixel 8 Pro", price: 18 },
      { name: "Pixel 8a", price: 15 },
      { name: "Pixel 9", price: 19 },
      { name: "Pixel 9 Pro", price: 21 },
      { name: "Pixel 9 Pro XL", price: 22 },
      { name: "Pixel 9 Pro Fold", price: 28 },
    ],
  },
  {
    label: "Nokia",
    models: [
      { name: "Nokia G21", price: 9 },
      { name: "Nokia G22", price: 9 },
      { name: "Nokia G50", price: 10 },
      { name: "Nokia G60", price: 10 },
      { name: "Nokia X20", price: 10 },
      { name: "Nokia X30", price: 11 },
      { name: "Nokia 5.4", price: 9 },
      { name: "Nokia 6.3", price: 9 },
      { name: "Nokia 7.2", price: 10 },
      { name: "Nokia 8.3 5G", price: 11 },
    ],
  },
  {
    label: "Motorola",
    models: [
      { name: "Moto G32", price: 10 },
      { name: "Moto G42", price: 10 },
      { name: "Moto G52", price: 10 },
      { name: "Moto G62 5G", price: 11 },
      { name: "Moto G72", price: 11 },
      { name: "Moto G82 5G", price: 12 },
      { name: "Moto G84 5G", price: 12 },
      { name: "Moto G200 5G", price: 13 },
      { name: "Moto Edge 20", price: 12 },
      { name: "Moto Edge 30", price: 13 },
      { name: "Moto Edge 40", price: 14 },
      { name: "Moto Edge 50 Pro", price: 15 },
      { name: "Moto Razr 40", price: 18 },
      { name: "Moto Razr 40 Ultra", price: 22 },
    ],
  },
  {
    label: "Sony",
    models: [
      { name: "Xperia 1 III", price: 15 },
      { name: "Xperia 1 IV", price: 17 },
      { name: "Xperia 1 V", price: 19 },
      { name: "Xperia 5 III", price: 14 },
      { name: "Xperia 5 IV", price: 15 },
      { name: "Xperia 5 V", price: 16 },
      { name: "Xperia 10 IV", price: 12 },
      { name: "Xperia 10 V", price: 13 },
    ],
  },
  {
    label: "Vivo",
    models: [
      { name: "Vivo Y72 5G", price: 10 },
      { name: "Vivo Y76 5G", price: 11 },
      { name: "Vivo Y33s", price: 10 },
      { name: "Vivo V21", price: 11 },
      { name: "Vivo V23", price: 12 },
      { name: "Vivo V25 Pro", price: 13 },
      { name: "Vivo X80", price: 15 },
      { name: "Vivo X90 Pro", price: 17 },
    ],
  },
  {
    label: "LG",
    models: [
      { name: "LG G8 ThinQ", price: 10 },
      { name: "LG G8X ThinQ", price: 11 },
      { name: "LG V50 ThinQ", price: 11 },
      { name: "LG V60 ThinQ", price: 12 },
      { name: "LG Wing", price: 13 },
      { name: "LG Velvet", price: 11 },
      { name: "LG Stylo 6", price: 10 },
      { name: "LG K52", price: 9 },
      { name: "LG K61", price: 10 },
    ],
  },
  {
    label: "Tecno",
    models: [
      { name: "Tecno Camon 19", price: 10 },
      { name: "Tecno Camon 20", price: 11 },
      { name: "Tecno Camon 30", price: 12 },
      { name: "Tecno Phantom X2", price: 14 },
      { name: "Tecno Phantom V Fold", price: 20 },
      { name: "Tecno Pova 5", price: 10 },
      { name: "Tecno Spark 10", price: 9 },
      { name: "Tecno Spark 20", price: 9 },
    ],
  },
  {
    label: "Infinix",
    models: [
      { name: "Infinix Note 12", price: 10 },
      { name: "Infinix Note 30", price: 11 },
      { name: "Infinix Note 40", price: 12 },
      { name: "Infinix Hot 20", price: 9 },
      { name: "Infinix Hot 30", price: 9 },
      { name: "Infinix Hot 40", price: 10 },
      { name: "Infinix Zero 20", price: 11 },
      { name: "Infinix Zero 30 5G", price: 13 },
    ],
  },
  {
    label: "Itel",
    models: [
      { name: "Itel S23", price: 8 },
      { name: "Itel S23+", price: 8 },
      { name: "Itel P40", price: 8 },
      { name: "Itel A60", price: 8 },
      { name: "Itel A70", price: 8 },
    ],
  },
  {
    label: "Other Brand",
    models: [
      { name: "Other / Not Listed", price: 12 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function apiBase(): string {
  return (import.meta.env.BASE_URL as string).replace(/\/$/, "");
}

const SELECT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#e2e8f0",
  borderRadius: "12px",
  padding: "12px 16px",
  width: "100%",
  fontSize: "14px",
  outline: "none",
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  paddingRight: "40px",
  cursor: "pointer",
};

type PayMethod = "usdt_manual" | "mpesa" | "binance_pay" | "wallet";

type OrderResult = {
  orderId: number;
  orderCode: string;
  paymentMethod: string;
  total: number;
  paymentDetails?: {
    usdtAddress?: string;
    usdtNetwork?: string;
    binancePayId?: string;
    mpesaPhone?: string;
    whatsapp?: string;
  };
};

// ─── Main Component ───────────────────────────────────────────────────────────

type Step = "select" | "payment" | "done";

type TrackResult = {
  orderId: number;
  orderCode: string;
  paymentStatus: string;
  status?: string;
  brand?: string;
  model?: string;
  imei: string | null;
  device: string | null;
  total: string;
  currency: string;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export function ImeiRepairPage() {
  const [, navigate] = useLocation();
  const { user, token, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"register" | "track">("register");
  const [step, setStep] = useState<Step>("select");

  // Device selection
  const [brandLabel, setBrandLabel] = useState("");
  const [modelName, setModelName] = useState("");

  const brand = DEVICE_CATALOG.find(b => b.label === brandLabel) ?? null;
  const model = brand?.models.find(m => m.name === modelName) ?? null;

  const [imei, setImei] = useState("");
  const [imeiError, setImeiError] = useState("");

  // Payment step
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("usdt_manual");
  const [submitting, setSubmitting] = useState(false);

  // Done step
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Screenshot upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Share
  const [shareSuccess, setShareSuccess] = useState(false);

  // Track order
  const [trackCode, setTrackCode] = useState("");
  const [trackEmail, setTrackEmail] = useState(user?.email ?? "");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      if (!email) setEmail(user.email);
      if (!trackEmail) setTrackEmail(user.email);
    }
  }, [user]);

  // Reset model when brand changes
  useEffect(() => { setModelName(""); }, [brandLabel]);

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: "IMEI Repair & Registration", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      });
    }
  }

  async function handleTrackOrder() {
    const code = trackCode.trim().toUpperCase();
    const em = trackEmail.trim().toLowerCase();
    if (!code) { setTrackError("Enter your order code (e.g. IR-AB12CD34)"); return; }
    if (!em || !em.includes("@")) { setTrackError("Enter the email used when registering"); return; }
    setTrackLoading(true);
    setTrackResult(null);
    setTrackError(null);
    try {
      const res = await fetch(`${apiBase()}/api/imei-repair/status/${encodeURIComponent(code)}?email=${encodeURIComponent(em)}`);
      const data = await res.json() as TrackResult & { error?: string };
      if (!res.ok) { setTrackError(data.error ?? "Order not found"); setTrackLoading(false); return; }
      setTrackResult(data);
    } catch {
      setTrackError("Network error — please try again");
    } finally {
      setTrackLoading(false);
    }
  }

  function handleRegister() {
    const val = imei.replace(/[\s\-]/g, "");
    if (!model) { toast({ title: "Select a model first", variant: "destructive" }); return; }
    if (!val) { setImeiError("Please enter your IMEI number"); return; }
    if (!luhnValid(val)) { setImeiError("Invalid IMEI — the check digit doesn't match. Dial *#06# to get your IMEI."); return; }
    setImeiError("");

    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please log in to place an order.", variant: "destructive" });
      navigate("/login");
      return;
    }

    setStep("payment");
    window.scrollTo(0, 0);
  }

  async function handlePay() {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please log in to place an order.", variant: "destructive" });
      navigate("/login");
      return;
    }
    if (!email.trim() || !email.includes("@")) { toast({ title: "Enter a valid email address", variant: "destructive" }); return; }
    if (!model || !brand) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase()}/api/imei-repair/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          brand: brand.label,
          model: model.name,
          imei: imei.replace(/[\s\-]/g, ""),
          price: model.price,
          customerEmail: email.trim().toLowerCase(),
          customerPhone: phone.trim() || undefined,
          paymentMethod: payMethod,
        }),
      });

      const data = await res.json() as OrderResult & { error?: string };
      if (!res.ok) { toast({ title: data.error ?? "Registration failed. Please try again.", variant: "destructive" }); setSubmitting(false); return; }

      setOrderResult(data);
      setStep("done");
      window.scrollTo(0, 0);
    } catch {
      toast({ title: "Network error — please check your connection.", variant: "destructive" });
      setSubmitting(false);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (JPG, PNG, etc.)");
      return;
    }
    setUploadFile(file);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUploadScreenshot() {
    if (!uploadFile || !orderResult) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("orderCode", orderResult.orderCode);
      formData.append("type", "payment_proof");

      const res = await fetch(`${apiBase()}/api/imei-repair/upload-proof`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (res.ok) {
        setUploadDone(true);
        toast({ title: "Screenshot uploaded!", description: "We'll verify your payment shortly." });
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setUploadError(d.error ?? "Upload failed — please try WhatsApp instead.");
      }
    } catch {
      setUploadError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Shared header ──────────────────────────────────────────────────────────
  const Header = ({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) => (
    <div className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
      style={{ background: "rgba(6,11,21,0.95)", borderBottom: "1px solid rgba(59,130,246,0.12)", backdropFilter: "blur(12px)" }}>
      <button onClick={onBack}
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <ArrowLeft size={16} className="text-slate-400" />
      </button>
      <div className="flex-1">
        <p className="font-black text-sm text-white">{title}</p>
        <p className="text-[10px]" style={{ color: "#475569" }}>{sub}</p>
      </div>
      <button
        onClick={handleShare}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
        title="Share this page"
        style={{ background: shareSuccess ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", border: shareSuccess ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.1)" }}>
        {shareSuccess ? <Check size={15} className="text-green-400" /> : <Share2 size={15} className="text-slate-400" />}
      </button>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider"
        style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.25)" }}>
        <Shield size={10} /> SECURE
      </div>
    </div>
  );

  // ── Step 1: Select Device ──────────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="min-h-screen pb-20" style={{ background: "#060b15", color: "#e2e8f0" }}>
        <Header title="IMEI Repair" sub="Select your device to register" onBack={() => navigate("/imei")} />

        <div className="px-4 pt-5">
          {/* Tab switcher */}
          <div className="flex rounded-xl overflow-hidden mb-5" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {([["register", "Register Device"], ["track", "Track Order"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className="flex-1 py-2.5 text-[11px] font-black transition-all"
                style={{
                  background: view === v ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "rgba(255,255,255,0.03)",
                  color: view === v ? "#fff" : "#475569",
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Track Order view */}
          {view === "track" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[11px] font-black uppercase tracking-wider mb-3" style={{ color: "#475569" }}>Order Code</p>
                <input
                  value={trackCode}
                  onChange={e => setTrackCode(e.target.value)}
                  placeholder="IR-XXXX"
                  className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />
              </div>
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[11px] font-black uppercase tracking-wider mb-3" style={{ color: "#475569" }}>Email Used at Registration</p>
                <input
                  value={trackEmail}
                  onChange={e => setTrackEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                />
              </div>
              {trackError && (
                <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                  <p className="text-[12px] text-red-400">{trackError}</p>
                </div>
              )}
              {trackResult && (
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <div className="flex items-center gap-2">
                    <Clock size={14} style={{ color: "#93c5fd" }} />
                    <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: "#93c5fd" }}>Order Status</p>
                  </div>
                  <div className="space-y-2 text-[12px]">
                    <div className="flex justify-between"><span style={{ color: "#475569" }}>Order Code</span><span className="font-bold text-white">{trackResult.orderCode}</span></div>
                    <div className="flex justify-between"><span style={{ color: "#475569" }}>Device</span><span className="font-bold text-white">{trackResult.brand} {trackResult.model}</span></div>
                    <div className="flex justify-between"><span style={{ color: "#475569" }}>IMEI</span><span className="font-mono text-white">{trackResult.imei}</span></div>
                    <div className="flex justify-between"><span style={{ color: "#475569" }}>Status</span>
                      <span className="font-black" style={{ color: (trackResult.status ?? trackResult.paymentStatus) === "completed" ? "#4ade80" : (trackResult.status ?? trackResult.paymentStatus) === "processing" ? "#fbbf24" : "#93c5fd" }}>
                        {(trackResult.status ?? trackResult.paymentStatus ?? "").toUpperCase()}
                      </span>
                    </div>
                    {trackResult.completedAt && (
                      <div className="flex justify-between"><span style={{ color: "#475569" }}>Completed</span><span className="text-white">{new Date(trackResult.completedAt).toLocaleDateString()}</span></div>
                    )}
                  </div>
                </div>
              )}
              <button onClick={handleTrackOrder} disabled={trackLoading}
                className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", opacity: trackLoading ? 0.7 : 1 }}>
                {trackLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {trackLoading ? "Checking…" : "Check Status"}
              </button>
            </div>
          )}

          {/* Register view */}
          {view === "register" && (
            <>
              {/* Progress indicator */}
              <div className="flex items-center gap-2 mb-5">
                {["Device", "Payment", "Done"].map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5 flex-1">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                      style={{ background: i === 0 ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "rgba(255,255,255,0.06)", color: i === 0 ? "#fff" : "#475569", border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.1)" }}>
                      {i + 1}
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: i === 0 ? "#93c5fd" : "#334155" }}>{label}</span>
                    {i < 2 && <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />}
                  </div>
                ))}
              </div>

              {/* Login notice */}
              {!isAuthenticated && (
                <div className="rounded-xl px-4 py-3 flex items-center gap-3 mb-5"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <LogIn size={15} style={{ color: "#fbbf24" }} className="shrink-0" />
                  <div className="flex-1">
                    <p className="text-[12px] font-bold" style={{ color: "#fbbf24" }}>Sign in to place an order</p>
                    <p className="text-[11px]" style={{ color: "#78716c" }}>You can browse devices below, but login is required to submit.</p>
                  </div>
                  <button onClick={() => navigate("/login")}
                    className="text-[11px] font-black px-3 py-1.5 rounded-lg shrink-0"
                    style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24" }}>
                    Log In
                  </button>
                </div>
              )}

              {/* Brand dropdown */}
              <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: "#475569" }}>1. Select Brand</p>
              <div className="relative mb-4">
                <select
                  value={brandLabel}
                  onChange={e => setBrandLabel(e.target.value)}
                  style={SELECT_STYLE}>
                  <option value="" style={{ background: "#0f172a" }}>— Choose a brand —</option>
                  {DEVICE_CATALOG.map(b => (
                    <option key={b.label} value={b.label} style={{ background: "#0f172a" }}>{b.label}</option>
                  ))}
                </select>
              </div>

              {/* Model dropdown */}
              {brand && (
                <>
                  <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: "#475569" }}>2. Select Model</p>
                  <div className="relative mb-4">
                    <select
                      value={modelName}
                      onChange={e => setModelName(e.target.value)}
                      style={SELECT_STYLE}>
                      <option value="" style={{ background: "#0f172a" }}>— Choose a model —</option>
                      {brand.models.map(m => (
                        <option key={m.name} value={m.name} style={{ background: "#0f172a" }}>
                          {m.name} — ${m.price}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* IMEI input */}
              {model && (
                <>
                  {/* Price badge */}
                  <div className="rounded-xl px-4 py-3 flex items-center justify-between mb-4"
                    style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <Smartphone size={14} style={{ color: "#60a5fa" }} />
                      <span className="text-[12px] font-semibold text-white">{model.name}</span>
                    </div>
                    <span className="font-black text-[16px]" style={{ color: "#4ade80" }}>${model.price} USD</span>
                  </div>

                  <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: "#475569" }}>3. Enter IMEI Number</p>
                  <div className="rounded-2xl p-4 mb-2"
                    style={{ background: "rgba(10,22,48,0.98)", border: "1px solid rgba(59,130,246,0.22)" }}>
                    <p className="text-[11px] mb-2" style={{ color: "#64748b" }}>
                      Dial <span className="font-mono font-bold" style={{ color: "#60a5fa" }}>*#06#</span> to get your 15-digit IMEI
                    </p>
                    <input
                      type="tel"
                      value={imei}
                      onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 15); setImei(v); setImeiError(""); }}
                      onKeyDown={e => { if (e.key === "Enter") handleRegister(); }}
                      placeholder="Enter 15-digit IMEI…"
                      maxLength={15}
                      className="w-full px-3.5 py-3 rounded-xl text-sm focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", caretColor: "#60a5fa", fontFamily: "monospace", letterSpacing: "0.1em" }}
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] font-mono" style={{ color: imei.length === 15 ? "#4ade80" : imei.length > 0 ? "#f59e0b" : "#334155" }}>
                        {imei.length}/15
                      </span>
                      {imei.length === 15 && luhnValid(imei) && (
                        <span className="text-[10px] font-bold text-green-400 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Valid IMEI
                        </span>
                      )}
                    </div>
                    {imeiError && (
                      <div className="mt-2 flex items-start gap-2 rounded-xl p-2.5"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-300">{imeiError}</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleRegister}
                    className="w-full py-4 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 mt-3"
                    style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
                    {isAuthenticated ? (
                      <>Register &amp; Proceed to Payment <ChevronRight size={16} /></>
                    ) : (
                      <><LogIn size={16} /> Log In to Continue</>
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Step 2: Payment ────────────────────────────────────────────────────────
  if (step === "payment") {
    return (
      <div className="min-h-screen pb-20" style={{ background: "#060b15", color: "#e2e8f0" }}>
        <Header title="Checkout" sub={`${model?.name} — IMEI Repair`} onBack={() => setStep("select")} />

        <div className="px-4 pt-5">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-5">
            {["Device", "Payment", "Done"].map((label, i) => (
              <div key={label} className="flex items-center gap-1.5 flex-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{ background: i === 1 ? "linear-gradient(135deg,#3b82f6,#6366f1)" : i < 1 ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)", color: i === 1 ? "#fff" : i < 1 ? "#4ade80" : "#475569", border: i === 1 || i < 1 ? "none" : "1px solid rgba(255,255,255,0.1)" }}>
                  {i < 1 ? <Check size={10} /> : i + 1}
                </div>
                <span className="text-[10px] font-bold" style={{ color: i === 1 ? "#93c5fd" : i < 1 ? "#4ade80" : "#334155" }}>{label}</span>
                {i < 2 && <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />}
              </div>
            ))}
          </div>

          {/* Order summary */}
          <div className="rounded-2xl p-4 mb-4"
            style={{ background: "rgba(10,22,48,0.98)", border: "1px solid rgba(59,130,246,0.22)" }}>
            <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: "#475569" }}>Order Summary</p>
            {[
              { label: "Service", value: "IMEI Repair" },
              { label: "Device", value: model?.name ?? "" },
              { label: "Brand", value: brand?.label ?? "" },
              { label: "IMEI", value: imei },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between mb-1.5">
                <span className="text-[11px]" style={{ color: "#475569" }}>{label}</span>
                <span className="text-[11px] font-semibold text-white font-mono">{value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2.5 mt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="font-black text-[12px]" style={{ color: "#94a3b8" }}>Total</span>
              <span className="font-black text-[18px]" style={{ color: "#4ade80" }}>${model?.price} USD</span>
            </div>
          </div>

          {/* Contact info */}
          <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: "#475569" }}>Your Email</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3.5 py-3 rounded-xl text-sm mb-3 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9" }}
          />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone number (optional)"
            className="w-full px-3.5 py-3 rounded-xl text-sm mb-4 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9" }}
          />

          {/* Payment method */}
          <p className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: "#475569" }}>Payment Method</p>
          <div className="space-y-2 mb-5">
            {([
              { key: "usdt_manual", label: "USDT (TRC-20 / ERC-20)", sub: "Fastest, lowest fee" },
              { key: "binance_pay", label: "Binance Pay", sub: "Scan QR in Binance app" },
              { key: "mpesa", label: "M-Pesa", sub: "Kenya Safaricom STK Push" },
              { key: "wallet", label: "Wallet Balance", sub: "Use your account balance" },
            ] as { key: PayMethod; label: string; sub: string }[]).map(({ key, label, sub }) => (
              <button key={key} onClick={() => setPayMethod(key)}
                className="w-full rounded-xl px-3.5 py-3 flex items-center gap-3 text-left transition-all"
                style={{
                  background: payMethod === key ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
                  border: payMethod === key ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
                }}>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: payMethod === key ? "#60a5fa" : "#334155" }}>
                  {payMethod === key && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#60a5fa" }} />}
                </div>
                <div>
                  <p className="font-bold text-[12px]" style={{ color: payMethod === key ? "#93c5fd" : "#e2e8f0" }}>{label}</p>
                  <p className="text-[10px]" style={{ color: "#475569" }}>{sub}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handlePay}
            disabled={submitting || !email.trim()}
            className="w-full py-4 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            {submitting ? "Submitting…" : "Submit Order"}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Confirmation ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-20" style={{ background: "#060b15", color: "#e2e8f0" }}>
      <Header title="Order Confirmed" sub={`Order ${orderResult?.orderCode ?? ""}`} onBack={() => { setStep("select"); setBrandLabel(""); setModelName(""); setImei(""); setOrderResult(null); }} />

      <div className="px-4 pt-5">
        {/* Success banner */}
        <div className="rounded-2xl p-5 mb-5 text-center"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.4)" }}>
            <CheckCircle2 size={28} className="text-green-400" />
          </div>
          <p className="font-black text-lg text-white mb-1">Order Registered!</p>
          <p className="text-[12px]" style={{ color: "#64748b" }}>
            Order #{orderResult?.orderId} · {model?.name} IMEI Repair
          </p>
          {orderResult?.orderCode && (
            <p className="mt-1.5 font-mono font-bold text-sm" style={{ color: "#93c5fd" }}>
              Code: {orderResult.orderCode}
            </p>
          )}
        </div>

        {/* Payment instructions */}
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: "rgba(10,22,48,0.98)", border: "1px solid rgba(59,130,246,0.22)" }}>
          <p className="text-[11px] font-black uppercase tracking-wider mb-3" style={{ color: "#475569" }}>
            Payment Instructions
          </p>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[12px]" style={{ color: "#94a3b8" }}>Amount Due</span>
            <span className="font-black text-[18px]" style={{ color: "#4ade80" }}>${model?.price} USD</span>
          </div>

          {(payMethod === "usdt_manual") && orderResult?.paymentDetails?.usdtAddress && (
            <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[10px] font-bold mb-1.5" style={{ color: "#475569" }}>USDT Wallet Address ({orderResult.paymentDetails.usdtNetwork ?? "TRC-20"})</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] break-all font-mono" style={{ color: "#93c5fd" }}>
                  {orderResult.paymentDetails.usdtAddress}
                </code>
                <button onClick={() => copyToClipboard(orderResult!.paymentDetails!.usdtAddress!, "usdt")}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
                  {copied === "usdt" ? <Check size={13} className="text-green-400" /> : <Copy size={13} className="text-blue-400" />}
                </button>
              </div>
            </div>
          )}

          {payMethod === "binance_pay" && orderResult?.paymentDetails?.binancePayId && (
            <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-[10px] font-bold mb-1.5" style={{ color: "#475569" }}>Binance Pay ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[13px] font-black font-mono" style={{ color: "#f59e0b" }}>
                  {orderResult.paymentDetails.binancePayId}
                </code>
                <button onClick={() => copyToClipboard(orderResult!.paymentDetails!.binancePayId!, "binance")}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  {copied === "binance" ? <Check size={13} className="text-green-400" /> : <Copy size={13} style={{ color: "#f59e0b" }} />}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl p-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
              After sending payment, your order will be processed within <span className="font-bold text-white">24–48 hours</span>.
              Check your email <span className="font-bold text-white">{email}</span> for confirmation.
            </p>
          </div>
        </div>

        {/* ── Payment Screenshot Upload ─────────────────────────────────── */}
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "#475569" }}>
            Upload Payment Screenshot
          </p>
          <p className="text-[11px] mb-4" style={{ color: "#334155" }}>
            Attach proof of payment to speed up verification.
          </p>

          {uploadDone ? (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-green-400">Screenshot uploaded!</p>
                <p className="text-[11px]" style={{ color: "#4b5563" }}>We'll verify your payment shortly.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Drop / tap zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {uploadPreview ? (
                <div className="relative mb-3">
                  <img src={uploadPreview} alt="Payment proof" className="w-full rounded-xl object-cover max-h-48" />
                  <button
                    onClick={() => { setUploadFile(null); setUploadPreview(null); setUploadError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    <X size={13} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 rounded-xl flex flex-col items-center gap-2 transition-all mb-3"
                  style={{ background: "rgba(59,130,246,0.05)", border: "2px dashed rgba(59,130,246,0.25)" }}>
                  <ImageIcon size={24} style={{ color: "#3b82f6" }} />
                  <p className="text-[12px] font-bold" style={{ color: "#60a5fa" }}>Tap to choose screenshot</p>
                  <p className="text-[10px]" style={{ color: "#334155" }}>JPG, PNG, WEBP accepted</p>
                </button>
              )}

              {uploadError && (
                <div className="rounded-xl px-3 py-2 flex items-center gap-2 mb-3"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertTriangle size={12} className="text-red-400 shrink-0" />
                  <p className="text-[11px] text-red-400">{uploadError}</p>
                </div>
              )}

              {uploadFile && (
                <button
                  onClick={handleUploadScreenshot}
                  disabled={uploading}
                  className="w-full py-3.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  {uploading ? "Uploading…" : "Send Screenshot"}
                </button>
              )}

              {!uploadFile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2"
                  style={{ color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)", background: "transparent" }}>
                  <Upload size={13} /> Choose File
                </button>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <button onClick={() => setView("track")}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            Track This Order
          </button>
          <button onClick={() => { setStep("select"); setBrandLabel(""); setModelName(""); setImei(""); setOrderResult(null); setUploadFile(null); setUploadPreview(null); setUploadDone(false); }}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center"
            style={{ color: "#64748b" }}>
            Register Another Device
          </button>
        </div>
      </div>
    </div>
  );
}
