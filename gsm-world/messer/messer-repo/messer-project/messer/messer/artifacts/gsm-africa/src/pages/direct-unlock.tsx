import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useQueryClient } from "@tanstack/react-query";
import { Smartphone, ChevronRight, CheckCircle2, ArrowLeft, Cpu, Lock, AlertCircle, RefreshCw, Copy, Check, Share2 } from "lucide-react";

// ── Catalog ────────────────────────────────────────────────────────────────────
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

type Step = "brand" | "model" | "imei" | "processing" | "confirmed" | "pay";

type PayMethod = "wallet" | "mpesa" | "nowpayments" | "binance_pay" | "usdt_manual";

const PROCESSING_MSGS = [
  "Verifying IMEI / Serial number…",
  "Connecting to unlock server…",
  "Checking device carrier lock status…",
  "Fetching network unlock eligibility…",
  "Confirming unlock availability…",
  "Preparing your unlock solution…",
  "Almost ready — finalising request…",
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: Step | "done" }) {
  const steps: (Step | "done")[] = ["brand", "model", "imei", "processing", "confirmed", "pay", "done"];
  const labels = ["Brand", "Model", "IMEI", "Verify", "Pay"];
  const barSteps = ["brand", "model", "imei", "processing", "pay"];
  const idx = steps.indexOf(step);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {barSteps.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${idx > i ? "bg-green-500" : idx === i ? "bg-[#1a2332]" : "bg-gray-200"}`} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-medium">
        {labels.map(l => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

function OrderCard({ brand, model, imei }: { brand: typeof DEVICE_CATALOG[0]; model: { name: string; price: number }; imei: string }) {
  return (
    <div className="bg-[#1a2332] rounded-2xl p-4 text-white space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400">{brand.icon} {brand.brand}</p>
          <p className="font-bold text-sm leading-snug mt-0.5">{model.name}</p>
          <p className="text-[11px] text-gray-400 font-mono mt-1">{imei}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-2xl font-black text-green-400">${model.price}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function DirectUnlockPage() {
  const { token, user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { data: walletBalance = 0, refetch: refetchWallet } = useWalletBalance();
  const queryClient = useQueryClient();
  const search = useSearch();

  const [step, setStep] = useState<Step>("brand");
  const [done, setDone] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<typeof DEVICE_CATALOG[0] | null>(null);
  const [selectedModel, setSelectedModel] = useState<{ name: string; price: number } | null>(null);
  const isIPad = selectedBrand?.brand === "iPad";
  const [imei, setImei] = useState("");
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod | "">("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [manualDone, setManualDone] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Auto-select brand/model from URL params ───────────────────────────────────
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
      if (model) {
        setSelectedModel(model);
        setStep("imei");
        return;
      }
    }
    setStep("model");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function copyShareLink() {
    const brand = selectedBrand;
    const model = selectedModel;
    if (!brand) return;
    const params = new URLSearchParams({ brand: brand.brand });
    if (model) params.set("model", model.name);
    const base = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(`${base}?${params.toString()}`).then(() => {
      setLinkCopied(true);
      toast({ title: "Link copied!", description: "Share this link to pre-select the same device." });
      setTimeout(() => setLinkCopied(false), 2500);
    }).catch(() => {});
  }

  // Processing step state
  const [processingPct, setProcessingPct] = useState(0);
  const [processingIdx, setProcessingIdx] = useState(0);

  // M-Pesa state
  const [mpPhone, setMpPhone] = useState("");
  const [mpSending, setMpSending] = useState(false);
  const [mpCheckoutId, setMpCheckoutId] = useState<string | null>(null);
  const [mpChecking, setMpChecking] = useState(false);
  const [mpPollCount, setMpPollCount] = useState(0);

  // NOWPayments state
  const [npCurrency, setNpCurrency] = useState("usdttrc20");
  const [npCreating, setNpCreating] = useState(false);
  const [npPayment, setNpPayment] = useState<{ paymentId: string; payAddress: string; payAmount: number; payCurrency: string; expiresAt?: string } | null>(null);
  const [npPollCount, setNpPollCount] = useState(0);
  const [npCopied, setNpCopied] = useState(false);

  // ── Processing step: 70-second IMEI verification timer ───────────────────────
  useEffect(() => {
    if (step !== "processing") { setProcessingPct(0); setProcessingIdx(0); return; }
    const TOTAL_MS = 70_000;
    const INTERVAL_MS = 300;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100));
      const idx = Math.min(
        PROCESSING_MSGS.length - 1,
        Math.floor((elapsed / TOTAL_MS) * PROCESSING_MSGS.length)
      );
      setProcessingPct(pct);
      setProcessingIdx(idx);
      if (elapsed >= TOTAL_MS) {
        clearInterval(timer);
        setPayMethod("");
        setStep("confirmed");
      }
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [step]);

  // ── Order creation (only called after payment confirmed) ─────────────────────
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

  // ── Manual pay (Binance Pay / USDT TRC20) ──────────────────────────────────
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
      setOrderId(data.id!);
      setManualDone(true);
      toast({ title: "Order placed!", description: "Send payment and our team will verify within 10-30 min." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  // ── Wallet pay ───────────────────────────────────────────────────────────────
  async function handleWalletPay() {
    if (!selectedModel) return;
    if (walletBalance < selectedModel.price) {
      toast({ title: "Insufficient wallet balance", description: `Top up $${(selectedModel.price - walletBalance).toFixed(2)} more to proceed.`, variant: "destructive" });
      return;
    }
    try {
      const id = await createOrder("paid", "wallet");
      await refetchWallet();
      await queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      setOrderId(id!);
      setDone(true);
      toast({ title: "Order created!", description: "Payment deducted from your wallet." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  // ── M-Pesa: send STK push ────────────────────────────────────────────────────
  async function handleMpesaSend() {
    if (!mpPhone || !selectedModel) { toast({ title: "Enter your phone number", variant: "destructive" }); return; }
    setMpSending(true);
    try {
      const res = await fetch("/api/wallet/add-fund/mpesa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: mpPhone, amount: selectedModel.price }),
      });
      const d = await res.json() as { checkoutRequestId?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(d.error || "STK push failed");
      setMpCheckoutId(d.checkoutRequestId!);
      setMpPollCount(0);
      toast({ title: "STK Push sent!", description: "Enter your M-Pesa PIN to complete payment." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setMpSending(false); }
  }

  // M-Pesa: manual check
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
        setOrderId(id!);
        setDone(true);
        toast({ title: "Payment confirmed! Order created." });
      } else if (d.status === "failed") {
        toast({ title: "Payment failed", description: d.message, variant: "destructive" });
        setMpCheckoutId(null);
      } else {
        toast({ title: "Still pending", description: "Payment not confirmed yet." });
      }
    } catch { toast({ title: "Could not check status", variant: "destructive" }); }
    finally { setMpChecking(false); }
  }

  // M-Pesa: auto-poll every 8s
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
        if (d.status === "paid") {
          const id = await createOrder("paid", "mpesa");
          setOrderId(id!);
          setDone(true);
          toast({ title: "Payment confirmed! Order created automatically." });
        } else if (d.status === "failed") {
          setMpCheckoutId(null);
          toast({ title: "M-Pesa payment failed", variant: "destructive" });
        } else { setMpPollCount(c => c + 1); }
      } catch { setMpPollCount(c => c + 1); }
    }, 8000);
    return () => clearTimeout(t);
  }, [mpCheckoutId, done, mpPollCount, token, createOrder, toast]);

  // ── NOWPayments: generate address ────────────────────────────────────────────
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

  // NOWPayments: manual check
  async function handleNpCheck() {
    if (!npPayment) return;
    try {
      const res = await fetch("/api/wallet/add-fund/nowpayments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: npPayment.paymentId }),
      });
      const d = await res.json() as { status: string };
      if (d.status === "paid") {
        const id = await createOrder("paid", "nowpayments");
        setOrderId(id!);
        setDone(true);
        toast({ title: "Crypto payment confirmed! Order created." });
      } else if (d.status === "failed") {
        toast({ title: "Payment failed or expired", variant: "destructive" });
        setNpPayment(null);
      } else {
        toast({ title: "Payment not confirmed yet", description: "Try again in a moment." });
      }
    } catch { toast({ title: "Could not check status", variant: "destructive" }); }
  }

  // NOWPayments: auto-poll every 30s
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
        if (d.status === "paid") {
          const id = await createOrder("paid", "nowpayments");
          setOrderId(id!);
          setDone(true);
          toast({ title: "Crypto payment confirmed! Order created automatically." });
        } else if (d.status === "failed") {
          setNpPayment(null);
          toast({ title: "Crypto payment failed or expired", variant: "destructive" });
        } else { setNpPollCount(c => c + 1); }
      } catch { setNpPollCount(c => c + 1); }
    }, 30000);
    return () => clearTimeout(t);
  }, [npPayment, done, npPollCount, token, createOrder, toast]);

  // (USDT Direct removed — use NOWPayments for crypto payments)

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1a2332] flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">Sign In Required</h2>
        <p className="text-sm text-gray-500 mb-6">You need to be signed in to use the Direct Unlock service.</p>
        <Link href="/login"><button className="px-8 py-3 bg-[#1a2332] text-white font-bold rounded-xl text-sm">Sign In</button></Link>
        <Link href="/signup"><button className="mt-2 px-8 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl text-sm">Create Account</button></Link>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────────
  if (done && orderId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 pb-24 text-center space-y-5">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-900">Order Created!</h2>
          <p className="text-gray-500 text-sm mt-1">Order #{orderId}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left space-y-2 text-sm text-gray-700">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">What happens next</p>
          <p>1. Our team processes your unlock (usually 1–24 hrs)</p>
          <p>2. You'll get an email with your unlock code or instructions</p>
          <p>3. Track progress in My Account → Orders</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/account/orders"><button className="w-full py-3.5 bg-[#1a2332] text-white font-bold rounded-xl text-sm">View My Orders</button></Link>
          <button onClick={() => { setDone(false); setStep("brand"); setSelectedBrand(null); setSelectedModel(null); setImei(""); setNotes(""); setPayMethod(""); setMpCheckoutId(null); setMpPhone(""); setNpPayment(null); setOrderId(null); }}
            className="w-full py-3 border border-gray-200 text-gray-700 font-bold rounded-xl text-sm">
            Submit Another Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1a2332] flex items-center justify-center">
            <Cpu size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Direct Unlock</h1>
            <p className="text-xs text-gray-500">Pay to unlock · Order created automatically on confirmation</p>
          </div>
        </div>
        <ProgressBar step={step} />
      </div>

      {/* Step 1: Brand */}
      {step === "brand" && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-gray-700 mb-3">Select your device brand:</p>
          <div className="grid grid-cols-2 gap-2">
            {DEVICE_CATALOG.map((brand) => (
              <button key={brand.brand} onClick={() => { setSelectedBrand(brand); setSelectedModel(null); setStep("model"); }}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 text-left hover:border-[#1a2332] hover:shadow-md transition-all group">
                <span className="text-2xl">{brand.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 truncate">{brand.brand}</p>
                  <p className="text-[10px] text-gray-400">{brand.models.length} models</p>
                </div>
                <ChevronRight size={12} className="text-gray-300 group-hover:text-[#1a2332] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Model */}
      {step === "model" && selectedBrand && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setStep("brand")} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1a2332]"><ArrowLeft size={14} /></button>
            <div className="flex-1">
              <p className="text-xs text-gray-400 font-medium">{selectedBrand.icon} {selectedBrand.brand}</p>
              <p className="text-sm font-bold text-gray-900">Select your model:</p>
            </div>
            <button
              onClick={copyShareLink}
              title="Copy shareable link for this brand"
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-[#1a2332] hover:border-[#1a2332] transition-colors"
            >
              {linkCopied ? <Check size={11} className="text-green-600" /> : <Share2 size={11} />}
              {linkCopied ? "Copied!" : "Share"}
            </button>
          </div>
          {selectedBrand.models.map((model) => (
            <button key={model.name} onClick={() => { setSelectedModel(model); setStep("imei"); }}
              className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-left hover:border-[#1a2332] hover:shadow-sm transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Smartphone size={14} className="text-gray-500" />
                </div>
                <p className="text-sm font-medium text-gray-800">{model.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-black text-green-700">${model.price}</span>
                <ChevronRight size={12} className="text-gray-300 group-hover:text-[#1a2332]" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 3: IMEI */}
      {step === "imei" && selectedBrand && selectedModel && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => setStep("model")} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1a2332]"><ArrowLeft size={14} /></button>
            <p className="text-sm font-bold text-gray-900 flex-1">Enter device details</p>
            <button
              onClick={copyShareLink}
              title="Copy shareable link for this device"
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-[#1a2332] hover:border-[#1a2332] transition-colors"
            >
              {linkCopied ? <Check size={11} className="text-green-600" /> : <Share2 size={11} />}
              {linkCopied ? "Copied!" : "Share Link"}
            </button>
          </div>
          <OrderCard brand={selectedBrand} model={selectedModel} imei={imei || "—"} />
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">IMEI or Serial Number *</label>
            <input type="text" value={imei} onChange={(e) => setImei(e.target.value)} placeholder="Enter 15-digit IMEI or serial number"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2332] font-mono" />
            <p className="text-[11px] text-gray-400 mt-1">Dial *#06# to get your IMEI, or find it in Settings → About Phone.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. carrier, country, special instructions…"
              rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2332] resize-none" />
          </div>
          <button onClick={() => { if (!imei.trim()) { toast({ title: "IMEI/serial required", variant: "destructive" }); return; } setStep("processing"); }}
            className="w-full py-3.5 bg-[#1a2332] text-white font-bold rounded-xl text-sm">
            Continue to Payment
          </button>
        </div>
      )}

      {/* Step 3b: Processing — 70-second animated verification screen */}
      {step === "processing" && (
        <div className="space-y-4">
          <div className="bg-orange-50 border-2 border-orange-400 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-orange-500 text-lg shrink-0">⚠️</span>
            <div>
              <p className="font-black text-orange-800 text-sm">Do not close this page</p>
              <p className="text-orange-700 text-xs mt-0.5">We are verifying your device. Closing may delay your order.</p>
            </div>
          </div>

          <div className="bg-[#1a2332] rounded-2xl p-5 text-white space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-blue-400 text-lg animate-pulse">🔍</span>
              </div>
              <div>
                <p className="font-black text-base">Processing Device</p>
                <p className="text-[11px] text-gray-400 font-mono">{selectedBrand?.brand} — {selectedModel?.name}</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span className="truncate pr-2">{PROCESSING_MSGS[processingIdx]}</span>
                <span className="shrink-0 font-bold text-white">{processingPct}%</span>
              </div>
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${processingPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {PROCESSING_MSGS.map((msg, i) => (
                <div key={msg} className={`flex items-center gap-2.5 text-xs ${i < processingIdx ? "text-green-400" : i === processingIdx ? "text-white" : "text-gray-600"}`}>
                  {i < processingIdx ? (
                    <span className="shrink-0 text-green-400">✓</span>
                  ) : i === processingIdx ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0 inline-block" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-600 shrink-0 inline-block" />
                  )}
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400">This typically takes 60–70 seconds. Please wait…</p>
        </div>
      )}

      {/* Step 3c: Check Successful confirmation */}
      {step === "confirmed" && selectedBrand && selectedModel && (
        <div className="space-y-4">
          <div className="bg-green-600 rounded-2xl p-5 text-white text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto">
              <span className="text-3xl">✅</span>
            </div>
            <div>
              <p className="font-black text-xl">Check Successful</p>
              <p className="text-green-100 text-sm mt-1">{selectedBrand.brand} — {selectedModel.name}</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-4 text-left space-y-2">
              <p className="text-xs font-bold text-green-200 uppercase tracking-wider">What happens next</p>
              <p className="text-sm text-white">✓ Device verified successfully</p>
              <p className="text-sm text-white">⏱ Your order will be processed within <strong>30–60 minutes</strong> after payment</p>
              <p className="text-sm text-white">📧 Unlock details sent to your email once complete</p>
            </div>
          </div>
          <button
            onClick={() => setStep("pay")}
            className="w-full py-4 bg-[#1a2332] text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg">
            Proceed to Payment →
          </button>
        </div>
      )}

      {/* Step 4: Pay — payment happens here, order created on confirmation */}
      {step === "pay" && selectedBrand && selectedModel && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            {!mpCheckoutId && !npPayment && (
              <button onClick={() => setStep("imei")} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1a2332]"><ArrowLeft size={14} /></button>
            )}
            <p className="text-sm font-bold text-gray-900">
              {mpCheckoutId ? "Complete M-Pesa payment" : npPayment ? "Complete crypto payment" : "Choose payment method"}
            </p>
          </div>

          <OrderCard brand={selectedBrand} model={selectedModel} imei={imei} />

          {/* Method selector — hidden once a payment is in progress */}
          {!mpCheckoutId && !npPayment && (
            <div className="space-y-2">
              {([
                { id: "wallet" as PayMethod, label: "Wallet Balance", icon: "💰", sub: `Balance: $${walletBalance.toFixed(2)}${walletBalance < selectedModel.price ? " — insufficient" : ""}`, warn: walletBalance < selectedModel.price },
                { id: "binance_pay" as PayMethod, label: "Binance Pay", icon: "🟡", sub: "Manual — Admin verifies within 10-30 min", warn: false },
                { id: "usdt_manual" as PayMethod, label: "USDT TRC20 (Manual)", icon: "💲", sub: "Send to our address — Admin verifies within 10-30 min", warn: false },
                { id: "mpesa" as PayMethod, label: "M-Pesa", icon: "📱", sub: "STK push → auto-confirm → order created", warn: false },
                { id: "nowpayments" as PayMethod, label: "Crypto (NOWPayments)", icon: "₿", sub: "BTC, ETH, USDT and 100+ coins → auto-confirm → order created", warn: false },
              ] as const).map((pm) => (
                <button key={pm.id} onClick={() => setPayMethod(pm.id)}
                  className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3.5 text-left transition-all ${payMethod === pm.id ? "border-[#1a2332] bg-[#1a2332]/5" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                  <span className="text-xl">{pm.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-800">{pm.label}</p>
                    <p className={`text-[11px] ${pm.warn ? "text-orange-500" : "text-gray-400"}`}>{pm.sub}</p>
                  </div>
                  {pm.warn && <AlertCircle size={14} className="text-orange-500 shrink-0" />}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${payMethod === pm.id ? "border-[#1a2332]" : "border-gray-300"}`}>
                    {payMethod === pm.id && <div className="w-2 h-2 rounded-full bg-[#1a2332]" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Wallet ─────────────────────────────────────────────────────── */}
          {payMethod === "wallet" && !mpCheckoutId && !npPayment && (
            <button onClick={handleWalletPay} disabled={walletBalance < selectedModel.price}
              className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2">
              💰 Pay ${selectedModel.price} from Wallet
            </button>
          )}
          {payMethod === "wallet" && walletBalance < selectedModel.price && (
            <Link href="/account/add-fund">
              <button className="w-full py-3 border border-green-600 text-green-700 font-bold rounded-xl text-sm">Top Up Wallet Now</button>
            </Link>
          )}

          {/* ── M-Pesa ─────────────────────────────────────────────────────── */}
          {payMethod === "mpesa" && !mpCheckoutId && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                We'll send an STK push for <strong>${selectedModel.price}</strong> (≈ KES {(selectedModel.price * 130).toLocaleString()}). Enter your PIN to pay — order is created automatically.
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">M-Pesa Phone Number</label>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <span className="px-3 py-2.5 bg-gray-100 text-sm text-gray-600 font-medium border-r border-gray-200">+254</span>
                  <input type="tel" value={mpPhone} onChange={(e) => setMpPhone(e.target.value)} placeholder="7XX XXX XXX" className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
                </div>
              </div>
              <button onClick={handleMpesaSend} disabled={mpSending}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                {mpSending ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</> : <><Smartphone size={16} /> Send STK Push — ${selectedModel.price}</>}
              </button>
            </div>
          )}
          {payMethod === "mpesa" && mpCheckoutId && (
            <div className="bg-green-50 border border-green-300 rounded-xl p-5 space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Smartphone size={20} className="text-white" />
                </div>
                <p className="font-bold text-green-800">STK Push Sent!</p>
                <p className="text-sm text-green-700 mt-1">Enter your M-Pesa PIN. Order is created automatically on confirmation.</p>
              </div>
              <div className="flex items-center gap-2 bg-green-100 border border-green-200 rounded-lg px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                <p className="text-xs text-green-800 font-medium">
                  {mpPollCount >= 15 ? "Auto-check stopped. Use the button below." : `Checking automatically… (${mpPollCount}/15)`}
                </p>
              </div>
              <button onClick={handleMpesaCheck} disabled={mpChecking}
                className="w-full py-2.5 border border-green-500 text-green-700 hover:bg-green-100 font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {mpChecking ? <><span className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> Checking…</> : <><RefreshCw size={14} /> Check Now</>}
              </button>
              <button onClick={() => { setMpCheckoutId(null); setMpPollCount(0); }} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">Try again with different number</button>
            </div>
          )}

          {/* ── NOWPayments ─────────────────────────────────────────────────── */}
          {payMethod === "nowpayments" && !npPayment && (
            <div className="space-y-3">
              <div className="bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-xl p-3 text-sm text-gray-700">
                Pay <strong>${selectedModel.price}</strong> in crypto. Order is created automatically after confirmation.
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Pay with</label>
                <select value={npCurrency} onChange={e => setNpCurrency(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none">
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
                className="w-full py-3.5 bg-[#1a1a2e] hover:bg-[#2a2a4e] disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                {npCreating ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</> : <>₿ Generate Payment Address</>}
              </button>
            </div>
          )}
          {payMethod === "nowpayments" && npPayment && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase">Send exactly</span>
                <span className="font-black text-lg text-[#1a1a2e]">{npPayment.payAmount} {npPayment.payCurrency.toUpperCase()}</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <QRCodeSVG value={npPayment.payAddress} size={140} level="M" className="rounded-xl border-4 border-white shadow" />
                <p className="text-xs text-gray-500">Scan QR code or copy address below</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Payment address</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="font-mono text-xs text-gray-700 break-all flex-1">{npPayment.payAddress}</span>
                  <button onClick={() => { navigator.clipboard.writeText(npPayment.payAddress); setNpCopied(true); setTimeout(() => setNpCopied(false), 2000); toast({ title: "Address copied!" }); }}
                    className={`shrink-0 px-2 py-1 rounded text-xs font-bold transition-colors ${npCopied ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                    {npCopied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              {npPayment.expiresAt && <p className="text-[10px] text-orange-600">⏱ Expires: {new Date(npPayment.expiresAt).toLocaleTimeString()}</p>}
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="text-xs text-blue-700">{npPollCount >= 30 ? "Auto-check stopped." : `Checking every 30s… (${npPollCount}/30)`}</span>
              </div>
              <button onClick={handleNpCheck} className="w-full py-2.5 border border-blue-400 text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                <RefreshCw size={14} /> Check Now
              </button>
              <button onClick={() => { setNpPayment(null); setNpPollCount(0); }} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">Cancel / Change currency</button>
            </div>
          )}


          {/* ── Binance Pay ─────────────────────────────────────────────────── */}
          {payMethod === "binance_pay" && !mpCheckoutId && !npPayment && (
            manualDone && orderId ? (
              <div className="bg-white border border-green-200 rounded-2xl p-5 space-y-3 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto"><span className="text-2xl">✅</span></div>
                <p className="font-black text-lg text-gray-800">Order #{orderId} Submitted!</p>
                <p className="text-sm text-gray-500">Our team verifies your payment within <strong>10-30 minutes</strong>.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-yellow-800">Send ${selectedModel.price} USD via Binance Pay</p>
                  <div className="flex items-center gap-3 bg-white border border-yellow-200 rounded-lg px-3 py-2.5">
                    <span className="text-2xl">🟡</span>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400">Binance ID</p>
                      <p className="text-xl font-black text-gray-900 tracking-widest">490759406</p>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText("490759406"); toast({ title: "Copied!" }); }}
                      className="p-2 rounded-lg bg-yellow-100 text-yellow-700"><Copy size={14} /></button>
                  </div>
                  <p className="text-[10px] text-yellow-700">Label: GSM World — Manual Confirmation</p>
                </div>
                <button onClick={handleManualPay}
                  className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-600 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2">
                  ✅ I’ve Sent ${selectedModel.price} — Confirm Order
                </button>
              </div>
            )
          )}

          {/* ── USDT Manual ─────────────────────────────────────────────────── */}
          {payMethod === "usdt_manual" && !mpCheckoutId && !npPayment && (
            manualDone && orderId ? (
              <div className="bg-white border border-green-200 rounded-2xl p-5 space-y-3 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto"><span className="text-2xl">✅</span></div>
                <p className="font-black text-lg text-gray-800">Order #{orderId} Submitted!</p>
                <p className="text-sm text-gray-500">Our team verifies your payment within <strong>10-30 minutes</strong>.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-green-800">Send ${selectedModel.price} USDT via TRC20</p>
                  <div className="flex flex-col items-center gap-2">
                    <QRCodeSVG value="TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5" size={110} level="M" className="rounded-xl border-4 border-white shadow" />
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-2 py-2">
                    <span className="font-mono text-[10px] text-gray-700 break-all flex-1">TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5</span>
                    <button onClick={() => { navigator.clipboard.writeText("TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5"); toast({ title: "Address copied!" }); }}
                      className="shrink-0 p-1.5 rounded-lg bg-green-100 text-green-700"><Copy size={13} /></button>
                  </div>
                  <p className="text-[10px] font-bold text-green-800">Network: TRON (TRC20) only</p>
                </div>
                <button onClick={handleManualPay}
                  className="w-full py-3.5 bg-green-700 hover:bg-green-800 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2">
                  ✅ I’ve Sent ${selectedModel.price} USDT — Confirm Order
                </button>
              </div>
            )
          )}

        </div>
      )}
    </div>
  );
}
