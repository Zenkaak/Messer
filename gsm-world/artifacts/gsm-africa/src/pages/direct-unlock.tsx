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
  Search, Users, BarChart3, Info,
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

type Step = "brand" | "model" | "imei" | "processing" | "confirmed" | "pay";
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

// ── Step stepper ─────────────────────────────────────────────────────────────
const STEPS: { key: Step | "done"; label: string; short: string }[] = [
  { key: "brand",      label: "Select Brand",  short: "Brand"  },
  { key: "model",      label: "Select Model",  short: "Model"  },
  { key: "imei",       label: "Device Info",   short: "IMEI"   },
  { key: "processing", label: "Verification",  short: "Verify" },
  { key: "pay",        label: "Payment",       short: "Pay"    },
];
const STEP_ORDER: (Step | "done")[] = ["brand","model","imei","processing","confirmed","pay","done"];

function StepBar({ step }: { step: Step | "done" }) {
  const cur = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((s, i) => {
        const sIdx = STEP_ORDER.indexOf(s.key as Step);
        const isDone = cur > sIdx || (s.key === "processing" && cur >= STEP_ORDER.indexOf("confirmed"));
        const isActive = cur === sIdx || (s.key === "processing" && cur === STEP_ORDER.indexOf("confirmed"));
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none min-w-0">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black transition-all border-2 ${
                isDone
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                  : isActive
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "bg-white border-slate-200 text-slate-400"
              }`}>
                {isDone ? <Check size={13} strokeWidth={3} /> : <span>{i + 1}</span>}
              </div>
              <span className={`text-[9px] font-bold tracking-wide uppercase hidden sm:block ${
                isActive ? "text-blue-600" : isDone ? "text-emerald-600" : "text-slate-400"
              }`}>{s.short}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1.5 mt-[-10px] sm:mt-[-18px] transition-all duration-500 ${
                isDone ? "bg-emerald-400" : "bg-slate-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Trust badge row ──────────────────────────────────────────────────────────
function TrustBadges() {
  return (
    <div className="flex flex-wrap gap-3">
      {[
        { icon: <Shield size={12} />, label: "SSL Secured" },
        { icon: <BadgeCheck size={12} />, label: "15,000+ Unlocked" },
        { icon: <Clock size={12} />, label: "Avg. 2–24 hrs" },
        { icon: <Globe size={12} />, label: "Worldwide" },
      ].map(b => (
        <div key={b.label} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-semibold">
          {b.icon}
          {b.label}
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function InfoSidebar({ walletBalance, selectedModel }: { walletBalance: number; selectedModel: { name: string; price: number } | null }) {
  return (
    <aside className="w-full md:w-72 lg:w-80 shrink-0 space-y-4">
      {/* Service card */}
      <div className="rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 text-white" style={{ background: "linear-gradient(135deg,#1e3a5f 0%,#1a2d4a 60%,#0f1d2e 100%)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
              <Cpu size={20} className="text-white" />
            </div>
            <div>
              <p className="font-black text-base leading-none">Direct Unlock</p>
              <p className="text-blue-200 text-[11px] mt-0.5 font-medium">Professional Network Unlock</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: "Devices", value: "15K+" },
              { label: "Success Rate", value: "99.2%" },
              { label: "Avg Time", value: "4 hrs" },
              { label: "Support", value: "24/7" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                <p className="text-white font-black text-lg leading-none">{s.value}</p>
                <p className="text-blue-200/70 text-[10px] mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5">
            <Wallet size={14} className="text-blue-200 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-blue-200/70 text-[10px] font-medium">Wallet Balance</p>
              <p className="text-white font-black text-sm">${walletBalance.toFixed(2)}</p>
            </div>
            <Link href="/account/add-fund">
              <button className="text-[10px] font-bold bg-white/15 hover:bg-white/25 text-white px-2 py-1 rounded-lg transition-colors">Top Up</button>
            </Link>
          </div>
        </div>
        {/* Current order summary */}
        {selectedModel && (
          <div className="bg-white border-t border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Current Order</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 truncate flex-1 pr-2">{selectedModel.name}</p>
              <p className="text-lg font-black text-emerald-600 shrink-0">${selectedModel.price}</p>
            </div>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Info size={12} className="text-blue-500" /> How It Works
        </p>
        <div className="space-y-3">
          {[
            { n: "1", title: "Select Device", desc: "Choose your brand and model from our catalog" },
            { n: "2", title: "Enter IMEI", desc: "Dial *#06# to find it or check Settings → About" },
            { n: "3", title: "Verify & Pay",  desc: "Secure IMEI check, then pay using your preferred method" },
            { n: "4", title: "Receive Code",  desc: "Unlock code or instructions sent to your email within 2–24 hrs" },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">{s.n}</div>
              <div>
                <p className="text-[12px] font-bold text-slate-800">{s.title}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2.5">
        <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-2">
          <Shield size={12} className="text-emerald-500" /> Security & Trust
        </p>
        {[
          { icon: <Shield size={13} className="text-emerald-500" />, text: "256-bit SSL encryption on all requests" },
          { icon: <BadgeCheck size={13} className="text-blue-500" />, text: "GSMA-compliant carrier unlock process" },
          { icon: <Users size={13} className="text-purple-500" />, text: "15,000+ successful unlocks completed" },
          { icon: <Star size={13} className="text-yellow-500" />, text: "4.9/5 average customer rating" },
          { icon: <Zap size={13} className="text-orange-500" />, text: "Permanent unlock — no relocking ever" },
        ].map((t, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0">{t.icon}</span>
            <p className="text-[11px] text-slate-600 leading-snug">{t.text}</p>
          </div>
        ))}
      </div>

      {/* Support */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-black text-blue-800 mb-1">Need Help?</p>
        <p className="text-[11px] text-blue-600 mb-3">Our support team is available 24/7 for unlock assistance.</p>
        <a href="/chat" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold py-2 px-4 rounded-xl transition-colors">
          <Smartphone size={13} /> Live Chat Support
        </a>
      </div>
    </aside>
  );
}

// ── Brand logo helper ────────────────────────────────────────────────────────
function BrandLogo({ brand }: { brand: typeof DEVICE_CATALOG[0] }) {
  const url = BRAND_LOGOS[brand.brand];
  const [err, setErr] = useState(false);
  if (url && !err) {
    return <img src={url} alt={brand.brand} className="w-8 h-8 object-contain" onError={() => setErr(true)} />;
  }
  return <span className="text-2xl leading-none">{brand.icon}</span>;
}

// ── Order summary card ───────────────────────────────────────────────────────
function OrderSummaryCard({ brand, model, imei }: { brand: typeof DEVICE_CATALOG[0]; model: { name: string; price: number }; imei: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: "linear-gradient(135deg,#1e3a5f,#243b55)" }}>
        <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
          <BrandLogo brand={brand} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider">{brand.brand}</p>
          <p className="text-sm font-black text-white truncate">{model.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-blue-200/60 font-medium">Price</p>
          <p className="text-xl font-black text-emerald-400">${model.price}</p>
        </div>
      </div>
      {imei && imei !== "—" && (
        <div className="px-4 py-2.5 flex items-center gap-2 bg-slate-50 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">IMEI</span>
          <span className="font-mono text-[11px] text-slate-600 truncate">{imei}</span>
          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
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
  const [imei, setImei] = useState("");
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod | "">("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [manualDone, setManualDone] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [imeiCopied, setImeiCopied] = useState(false);

  // Auto-select from URL params
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
    setStep("model");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function copyShareLink() {
    if (!selectedBrand) return;
    const params = new URLSearchParams({ brand: selectedBrand.brand });
    if (selectedModel) params.set("model", selectedModel.name);
    const base = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(`${base}?${params.toString()}`).then(() => {
      setLinkCopied(true);
      toast({ title: "Link copied!", description: "Share this link to pre-select the same device." });
      setTimeout(() => setLinkCopied(false), 2500);
    }).catch(() => {});
  }

  // Processing state
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

  // Processing 70s timer
  useEffect(() => {
    if (step !== "processing") { setProcessingPct(0); setProcessingIdx(0); return; }
    const TOTAL_MS = 70_000;
    const INTERVAL_MS = 300;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100));
      const idx = Math.min(PROCESSING_MSGS.length - 1, Math.floor((elapsed / TOTAL_MS) * PROCESSING_MSGS.length));
      setProcessingPct(pct);
      setProcessingIdx(idx);
      if (elapsed >= TOTAL_MS) { clearInterval(timer); setPayMethod(""); setStep("confirmed"); }
    }, INTERVAL_MS);
    return () => clearInterval(timer);
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
      setOrderId(data.id!);
      setManualDone(true);
      toast({ title: "Order placed!", description: "Send payment and our team will verify within 10-30 min." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  // Wallet pay
  async function handleWalletPay() {
    if (!selectedModel) return;
    if (walletBalance < selectedModel.price) {
      toast({ title: "Insufficient wallet balance", description: `Top up $${(selectedModel.price - walletBalance).toFixed(2)} more to proceed.`, variant: "destructive" });
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
      setOrderId(id!);
      setDone(true);
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
      const d = await res.json() as { checkoutRequestId?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(d.error || "STK push failed");
      setMpCheckoutId(d.checkoutRequestId!);
      setMpPollCount(0);
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
        setOrderId(id!); setDone(true);
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
        if (d.status === "paid") {
          const id = await createOrder("paid", "mpesa");
          setOrderId(id!); setDone(true);
          toast({ title: "Payment confirmed! Order created automatically." });
        } else if (d.status === "failed") {
          setMpCheckoutId(null);
          toast({ title: "M-Pesa payment failed", variant: "destructive" });
        } else { setMpPollCount(c => c + 1); }
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
      if (d.status === "paid") {
        const id = await createOrder("paid", "nowpayments");
        setOrderId(id!); setDone(true);
        toast({ title: "Crypto payment confirmed! Order created." });
      } else if (d.status === "failed") {
        toast({ title: "Payment failed or expired", variant: "destructive" });
        setNpPayment(null);
      } else {
        toast({ title: "Payment not confirmed yet", description: "Try again in a moment." });
      }
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
        if (d.status === "paid") {
          const id = await createOrder("paid", "nowpayments");
          setOrderId(id!); setDone(true);
          toast({ title: "Crypto payment confirmed! Order created automatically." });
        } else if (d.status === "failed") {
          setNpPayment(null);
          toast({ title: "Crypto payment failed or expired", variant: "destructive" });
        } else { setNpPollCount(c => c + 1); }
      } catch { setNpPollCount(c => c + 1); }
    }, 30000);
    return () => clearTimeout(t);
  }, [npPayment, done, npPollCount, token, createOrder, toast]);

  // ── Not authenticated ──────────────────────────────────────────────────────
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

  // ── Done screen ────────────────────────────────────────────────────────────
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
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-sm text-slate-700">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">What happens next</p>
              <p className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5 shrink-0">✓</span> Our team processes your unlock request</p>
              <p className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5 shrink-0">✓</span> You'll receive your unlock code via email</p>
              <p className="flex items-start gap-2"><span className="text-emerald-500 font-bold mt-0.5 shrink-0">✓</span> Track progress in My Account → Orders</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/account/orders"><button className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors">View My Orders</button></Link>
              <button onClick={() => { setDone(false); setStep("brand"); setSelectedBrand(null); setSelectedModel(null); setImei(""); setNotes(""); setPayMethod(""); setMpCheckoutId(null); setMpPhone(""); setNpPayment(null); setOrderId(null); setBrandSearch(""); setManualDone(false); }}
                className="w-full py-3 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-sm transition-colors">
                Submit Another Unlock
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Hero header */}
      <div className="text-white py-7 px-4" style={{ background: "linear-gradient(135deg,#1e3a5f 0%,#1a2d4a 60%,#0f1d2e 100%)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Cpu size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black leading-none">Direct Unlock Service</h1>
              <p className="text-blue-200/80 text-[12px] mt-0.5">Professional carrier unlock for any device, worldwide</p>
            </div>
            {(selectedBrand || step !== "brand") && (
              <button onClick={copyShareLink}
                className="ml-auto flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors">
                {linkCopied ? <Check size={11} /> : <Share2 size={11} />}
                {linkCopied ? "Copied!" : "Share"}
              </button>
            )}
          </div>
          <TrustBadges />
        </div>
      </div>

      {/* Step bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto">
          <StepBar step={step} />
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 py-6 pb-28">
        <div className="flex flex-col md:flex-row gap-6 items-start">

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ── Step 1: Brand ── */}
            {step === "brand" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-black text-slate-900 text-base">Select Your Device Brand</h2>
                  <p className="text-slate-500 text-[12px] mt-0.5">{DEVICE_CATALOG.length} brands supported — choose the manufacturer of your device</p>
                </div>
                <div className="p-4">
                  {/* Search */}
                  <div className="relative mb-4">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      placeholder="Search brand…"
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {DEVICE_CATALOG
                      .filter(b => !brandSearch || b.brand.toLowerCase().includes(brandSearch.toLowerCase()))
                      .map(brand => (
                        <button
                          key={brand.brand}
                          onClick={() => { setSelectedBrand(brand); setSelectedModel(null); setStep("model"); setBrandSearch(""); }}
                          className="group flex items-center gap-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl p-3 text-left transition-all hover:shadow-md"
                        >
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                            <BrandLogo brand={brand} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-black text-slate-800 leading-tight truncate">{brand.brand}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{brand.models.length} models</p>
                          </div>
                          <ChevronRight size={13} className="text-slate-300 group-hover:text-blue-500 shrink-0 transition-colors" />
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Model ── */}
            {step === "model" && selectedBrand && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                  <button onClick={() => setStep("brand")}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors shrink-0">
                    <ArrowLeft size={14} />
                  </button>
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <BrandLogo brand={selectedBrand} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-black text-slate-900 text-base leading-none">{selectedBrand.brand}</h2>
                    <p className="text-slate-500 text-[12px] mt-0.5">Select your exact model</p>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-full shrink-0">{selectedBrand.models.length} models</span>
                </div>
                <div className="p-3 space-y-1.5 max-h-[540px] overflow-y-auto">
                  {selectedBrand.models.map((model) => {
                    const tier = model.price >= 100 ? "premium" : model.price >= 50 ? "high" : model.price >= 25 ? "mid" : "budget";
                    const tierColors: Record<string, string> = { premium: "bg-purple-100 text-purple-700", high: "bg-blue-100 text-blue-700", mid: "bg-emerald-100 text-emerald-700", budget: "bg-slate-100 text-slate-500" };
                    const tierLabel: Record<string, string> = { premium: "Premium", high: "High-end", mid: "Mid-range", budget: "Budget" };
                    return (
                      <button key={model.name}
                        onClick={() => { setSelectedModel(model); setStep("imei"); }}
                        className="w-full flex items-center gap-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl px-4 py-3 text-left transition-all group hover:shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">
                          <Smartphone size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <p className="text-[13px] font-semibold text-slate-800 flex-1 min-w-0 truncate">{model.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${tierColors[tier]}`}>{tierLabel[tier]}</span>
                          <span className="text-base font-black text-emerald-600">${model.price}</span>
                          <ChevronRight size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 3: IMEI ── */}
            {step === "imei" && selectedBrand && selectedModel && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                    <button onClick={() => setStep("model")}
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors shrink-0">
                      <ArrowLeft size={14} />
                    </button>
                    <div>
                      <h2 className="font-black text-slate-900 text-base leading-none">Device Information</h2>
                      <p className="text-slate-500 text-[12px] mt-0.5">Enter your IMEI number to continue</p>
                    </div>
                  </div>
                  <div className="p-5 space-y-5">
                    <OrderSummaryCard brand={selectedBrand} model={selectedModel} imei={imei || "—"} />
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">IMEI or Serial Number <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type="text"
                          value={imei}
                          onChange={e => setImei(e.target.value)}
                          placeholder="Enter 15-digit IMEI (e.g. 123456789012345)"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 pr-10"
                        />
                        {imei.length >= 14 && (
                          <button onClick={() => { setImeiCopied(true); navigator.clipboard.writeText(imei); setTimeout(() => setImeiCopied(false), 1500); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                            {imeiCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                        <Info size={12} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-blue-700">Dial <strong className="font-mono">*#06#</strong> to get your IMEI, or go to Settings → About Phone → IMEI Information.</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">Notes <span className="text-slate-300">(optional)</span></label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="e.g. carrier name, country, special instructions…"
                        rows={2}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 resize-none"
                      />
                    </div>
                    <button
                      onClick={() => { if (!imei.trim()) { toast({ title: "IMEI / serial number required", variant: "destructive" }); return; } setStep("processing"); }}
                      className="w-full py-4 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
                      style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
                      <Shield size={16} />
                      Verify Device &amp; Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

                        {/* ── Step 3b: Processing — fullscreen professional dashboard ── */}
            {step === "processing" && (
              <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "linear-gradient(160deg,#060b18 0%,#07101f 50%,#060b15 100%)", overflowY: "auto" }}>

                {/* Header bar */}
                <div className="flex items-center justify-between px-4 py-3.5 sticky top-0"
                  style={{ background: "rgba(6,11,24,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(59,130,246,0.12)", zIndex: 10 }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-black text-white text-[13px] leading-none">GSM World</p>
                      <p className="text-[9px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: "#6366f1" }}>Secure Verification Portal</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
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

                  {/* Device identity card */}
                  <div className="rounded-2xl overflow-hidden"
                    style={{ background: "linear-gradient(135deg,#0d1b35,#0f1f3d)", border: "1px solid rgba(59,130,246,0.2)", boxShadow: "0 4px 32px rgba(37,99,235,0.15)" }}>
                    <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(59,130,246,0.1)" }}>
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.2),rgba(99,102,241,0.12))", border: "1px solid rgba(99,102,241,0.25)" }}>
                        {BRAND_LOGOS[selectedBrand?.brand ?? ""]
                          ? <img src={BRAND_LOGOS[selectedBrand?.brand ?? ""]} alt="" className="w-8 h-8 object-contain" />
                          : <span className="text-xl">{selectedBrand?.icon}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-[14px] truncate">{selectedModel?.name}</p>
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: "#6366f1" }}>{selectedBrand?.brand}</p>
                      </div>
                      <div className="shrink-0">
                        <div className="px-2.5 py-1 rounded-full text-[10px] font-black"
                          style={{ background: "rgba(251,191,36,0.12)", color: "#f59e0b", border: "1px solid rgba(251,191,36,0.25)" }}>
                          IN PROGRESS
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-2.5 flex items-center gap-2">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      <p className="text-[11px] font-mono" style={{ color: "#475569" }}>IMEI: <span style={{ color: "#94a3b8" }}>{imei}</span></p>
                    </div>
                  </div>

                  {/* Queue position + ETA strip */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Queue Position", value: `#${Math.max(1, 4 - Math.floor(processingPct / 30))}`, color: "#f59e0b", sub: "in unlock queue" },
                      { label: "Est. Completion", value: processingPct < 50 ? "~18 min" : processingPct < 85 ? "~6 min" : "~1 min", color: "#60a5fa", sub: "at current rate" },
                      { label: "Server Region", value: "AF-01", color: "#a78bfa", sub: "GSM cluster" },
                    ].map(({ label, value, color, sub }) => (
                      <div key={label} className="rounded-xl px-2 py-2.5 flex flex-col items-center text-center"
                        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-[13px] font-black leading-none" style={{ color }}>{value}</p>
                        <p className="text-[8px] font-black uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                        <p className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>{sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Circular progress + stage checklist */}
                  <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-5">

                      {/* SVG ring */}
                      <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
                        <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                          <circle cx="48" cy="48" r="40" fill="none"
                            stroke="url(#ringGrad)" strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 40}
                            strokeDashoffset={2 * Math.PI * 40 * (1 - processingPct / 100)}
                            style={{ transition: "stroke-dashoffset 0.4s ease" }} />
                          <defs>
                            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#3b82f6" />
                              <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="font-black text-xl text-white leading-none">{processingPct}%</span>
                          <span className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "#6366f1" }}>done</span>
                        </div>
                      </div>

                      {/* Stage checklist */}
                      <div className="flex-1 space-y-2">
                        {[
                          { label: "IMEI Validated",     threshold: 10 },
                          { label: "Network Auth OK",    threshold: 30 },
                          { label: "Carrier DB Queried", threshold: 55 },
                          { label: "Blacklist Cleared",  threshold: 75 },
                          { label: "Code Generated",     threshold: 95 },
                        ].map(({ label, threshold }) => {
                          const done = processingPct >= threshold;
                          const active = !done && processingPct >= threshold - 20;
                          return (
                            <div key={label} className="flex items-center gap-2">
                              <div className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                                style={{
                                  background: done ? "rgba(16,185,129,0.18)" : active ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                                  border: done ? "1.5px solid rgba(16,185,129,0.5)" : active ? "1.5px solid rgba(251,191,36,0.4)" : "1.5px solid rgba(255,255,255,0.08)",
                                }}>
                                {done
                                  ? <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  : active
                                    ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                    : <span className="w-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />}
                              </div>
                              <p className={`text-[11px] font-semibold ${done ? "line-through" : ""}`}
                                style={{ color: done ? "#10b981" : active ? "#fbbf24" : "#374151" }}>
                                {label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Thin segmented bar */}
                    <div className="mt-4">
                      <div className="flex gap-0.5 h-1">
                        {Array.from({ length: 30 }).map((_, i) => (
                          <div key={i} className="flex-1 rounded-full transition-all duration-300"
                            style={{
                              background: (i + 1) * (100 / 30) <= processingPct
                                ? "linear-gradient(90deg,#3b82f6,#10b981)"
                                : i * (100 / 30) < processingPct
                                  ? "rgba(59,130,246,0.35)"
                                  : "rgba(255,255,255,0.04)",
                            }} />
                        ))}
                      </div>
                      <p className="text-[10px] font-mono mt-1.5 text-center" style={{ color: "#334155" }}>
                        {processingPct < 100 ? "Verifying global carrier databases..." : "Verification complete"}
                      </p>
                    </div>
                  </div>

                  {/* Keep-open warning */}
                  <div className="flex items-start gap-3 rounded-2xl px-4 py-3"
                    style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
                    <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black text-[12px]" style={{ color: "#fbbf24" }}>Keep this page open</p>
                      <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: "#78350f" }}>
                        Closing or refreshing will interrupt verification. You may need to restart.
                      </p>
                    </div>
                  </div>

                  {/* Live terminal */}
                  <div className="rounded-2xl overflow-hidden" style={{ background: "#090f1a", border: "1px solid rgba(99,102,241,0.15)" }}>
                    <div className="flex items-center gap-2 px-3.5 py-2.5"
                      style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
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
                            <span className={`text-[10px] leading-snug ${
                              isLast && processingPct < 100 ? "text-sky-300" : isGreen ? "text-emerald-400" : isAuth ? "text-blue-300" : isImei ? "text-purple-300" : "text-slate-600"
                            }`}>{msg}</span>
                          </div>
                        );
                      })}
                      {processingPct < 100 && <span className="text-blue-400 text-[11px] animate-pulse font-mono">▌</span>}
                    </div>
                  </div>

                  {/* Trust badges */}
                  <div className="grid grid-cols-3 gap-2 pb-6">
                    {[
                      { icon: "🔒", label: "256-bit SSL", sub: "Encrypted" },
                      { icon: "🌍", label: "15,000+",    sub: "Devices Unlocked" },
                      { icon: "⚡",        label: "2–24 hrs",  sub: "Avg Delivery" },
                    ].map(t => (
                      <div key={t.label} className="flex flex-col items-center gap-0.5 rounded-xl py-3"
                        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-[18px] leading-none mb-0.5">{t.icon}</span>
                        <p className="font-black text-[11px]" style={{ color: "#e2e8f0" }}>{t.label}</p>
                        <p className="text-[9px] uppercase tracking-wide font-bold" style={{ color: "#374151" }}>{t.sub}</p>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            )}

            {/* ── Step 3c: Confirmed ── */}
            {step === "confirmed" && selectedBrand && selectedModel && (
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden shadow-xl border border-emerald-200">
                  <div className="p-6 text-white text-center space-y-4" style={{ background: "linear-gradient(135deg,#059669 0%,#047857 50%,#065f46 100%)" }}>
                    <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={32} className="text-white" />
                    </div>
                    <div>
                      <p className="font-black text-2xl tracking-tight">Device Verified!</p>
                      <p className="text-emerald-100 text-sm mt-1">{selectedBrand.brand} — {selectedModel.name}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { icon: "✓", label: "IMEI Valid" },
                        { icon: "✓", label: "Not Blacklisted" },
                        { icon: "✓", label: "Eligible" },
                      ].map(b => (
                        <div key={b.label} className="bg-white/10 border border-white/15 rounded-xl py-2 px-1">
                          <p className="text-emerald-300 font-black text-lg leading-none">{b.icon}</p>
                          <p className="text-white/80 text-[10px] mt-1 font-semibold">{b.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between bg-white/10 border border-white/15 rounded-xl px-4 py-3">
                      <p className="text-emerald-100/80 text-sm font-medium">Unlock Price</p>
                      <p className="text-2xl font-black text-white">${selectedModel.price}</p>
                    </div>
                  </div>
                  <div className="bg-white px-5 py-4 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">What happens after payment</p>
                    {[
                      { icon: <Clock size={13} className="text-blue-500" />, text: "Unlock processed within 30 min – 24 hrs" },
                      { icon: <Zap size={13} className="text-yellow-500" />, text: "Unlock code sent to your registered email" },
                      { icon: <Shield size={13} className="text-emerald-500" />, text: "Permanent unlock — works on all carriers" },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="shrink-0">{s.icon}</span>
                        <p className="text-[12px] text-slate-600">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setStep("pay")}
                  className="w-full py-4 text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 shadow-xl transition-all hover:shadow-2xl"
                  style={{ background: "linear-gradient(135deg,#1e3a5f,#0f1d2e)" }}>
                  <CreditCard size={18} />
                  Proceed to Payment →
                </button>
              </div>
            )}

            {/* ── Step 4: Pay ── */}
            {step === "pay" && selectedBrand && selectedModel && (
              <div className="space-y-4">
                {/* Back / title */}
                <div className="flex items-center gap-3">
                  {!mpCheckoutId && !npPayment && (
                    <button onClick={() => setStep("imei")}
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors shrink-0">
                      <ArrowLeft size={14} />
                    </button>
                  )}
                  <div>
                    <h2 className="font-black text-slate-900 text-base leading-none">
                      {mpCheckoutId ? "Complete M-Pesa Payment" : npPayment ? "Complete Crypto Payment" : "Choose Payment Method"}
                    </h2>
                    <p className="text-slate-500 text-[12px] mt-0.5">Order is created automatically after payment is confirmed</p>
                  </div>
                </div>

                <OrderSummaryCard brand={selectedBrand} model={selectedModel} imei={imei} />

                {/* Payment method selector */}
                {!mpCheckoutId && !npPayment && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3 border-b border-slate-100">
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Payment Methods</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {([
                        { id: "wallet" as PayMethod, label: "Wallet Balance", icon: <Wallet size={16} className="text-emerald-600" />, sub: `Balance: $${walletBalance.toFixed(2)}${walletBalance < selectedModel.price ? " — insufficient" : ""}`, warn: walletBalance < selectedModel.price, badge: "Instant" },
                        { id: "mpesa" as PayMethod, label: "M-Pesa", icon: <Smartphone size={16} className="text-green-600" />, sub: "STK push to your phone — auto-confirm", warn: false, badge: "Auto" },
                        { id: "nowpayments" as PayMethod, label: "Crypto (NOWPayments)", icon: <span className="text-lg leading-none font-black text-slate-700">₿</span>, sub: "BTC, ETH, USDT and 100+ coins — auto-confirm", warn: false, badge: "Auto" },
                        { id: "binance_pay" as PayMethod, label: "Binance Pay", icon: <span className="text-lg leading-none">🟡</span>, sub: "Manual verification within 10-30 min", warn: false, badge: "Manual" },
                        { id: "usdt_manual" as PayMethod, label: "USDT TRC20 (Manual)", icon: <span className="text-lg leading-none">💲</span>, sub: "Send to our address — manual verification", warn: false, badge: "Manual" },
                      ] as const).map(pm => (
                        <button key={pm.id} onClick={() => setPayMethod(pm.id)}
                          className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-left transition-all ${
                            payMethod === pm.id
                              ? "border-blue-400 bg-blue-50 shadow-sm"
                              : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                          }`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${payMethod === pm.id ? "bg-white border-blue-200" : "bg-white border-slate-100"}`}>
                            {pm.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-slate-800">{pm.label}</p>
                            <p className={`text-[11px] ${pm.warn ? "text-orange-500 font-semibold" : "text-slate-400"}`}>{pm.sub}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              pm.badge === "Instant" ? "bg-emerald-100 text-emerald-700" :
                              pm.badge === "Auto" ? "bg-blue-100 text-blue-700" :
                              "bg-slate-100 text-slate-500"
                            }`}>{pm.badge}</span>
                            {pm.warn && <AlertCircle size={14} className="text-orange-500" />}
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${payMethod === pm.id ? "border-blue-500" : "border-slate-300"}`}>
                              {payMethod === pm.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Wallet ── */}
                {payMethod === "wallet" && !mpCheckoutId && !npPayment && (
                  <div className="space-y-2">
                    <button onClick={handleWalletPay} disabled={walletBalance < selectedModel.price}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-lg">
                      <Wallet size={16} /> Pay ${selectedModel.price} from Wallet
                    </button>
                    {walletBalance < selectedModel.price && (
                      <Link href="/account/add-fund">
                        <button className="w-full py-3 border border-emerald-400 text-emerald-700 hover:bg-emerald-50 font-bold rounded-xl text-sm transition-colors">Top Up Wallet Now</button>
                      </Link>
                    )}
                  </div>
                )}

                {/* ── M-Pesa ── */}
                {payMethod === "mpesa" && !mpCheckoutId && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                      We'll send an STK push for <strong>${selectedModel.price}</strong> (≈ KES {(selectedModel.price * 130).toLocaleString()}). Enter your PIN to pay.
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">M-Pesa Phone Number</label>
                      <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400">
                        <span className="px-3 py-3 bg-slate-50 text-sm text-slate-600 font-bold border-r border-slate-200">+254</span>
                        <input type="tel" value={mpPhone} onChange={e => setMpPhone(e.target.value)} placeholder="7XX XXX XXX" className="flex-1 px-3 py-3 text-sm focus:outline-none bg-white" />
                      </div>
                    </div>
                    <button onClick={handleMpesaSend} disabled={mpSending}
                      className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                      {mpSending
                        ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                        : <><Smartphone size={15} /> Send STK Push — ${selectedModel.price}</>}
                    </button>
                  </div>
                )}
                {payMethod === "mpesa" && mpCheckoutId && (
                  <div className="bg-white border border-green-200 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="text-center">
                      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Smartphone size={22} className="text-green-600" />
                      </div>
                      <p className="font-black text-green-800 text-lg">STK Push Sent!</p>
                      <p className="text-sm text-green-700 mt-1">Enter your M-Pesa PIN. Order created automatically on confirmation.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                      <p className="text-[12px] text-green-800 font-medium">
                        {mpPollCount >= 15 ? "Auto-check stopped. Use button below." : `Checking automatically… (${mpPollCount}/15)`}
                      </p>
                    </div>
                    <button onClick={handleMpesaCheck} disabled={mpChecking}
                      className="w-full py-3 border border-green-500 text-green-700 hover:bg-green-50 font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                      {mpChecking ? <><span className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /> Checking…</> : <><RefreshCw size={14} /> Check Payment Now</>}
                    </button>
                    <button onClick={() => { setMpCheckoutId(null); setMpPollCount(0); }} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600">Try again with a different number</button>
                  </div>
                )}

                {/* ── NOWPayments ── */}
                {payMethod === "nowpayments" && !npPayment && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700">
                      Pay <strong>${selectedModel.price}</strong> in cryptocurrency. Order is created automatically after on-chain confirmation.
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Select Cryptocurrency</label>
                      <select value={npCurrency} onChange={e => setNpCurrency(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50">
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
                      className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                      {npCreating ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</> : <>₿ Generate Payment Address</>}
                    </button>
                  </div>
                )}
                {payMethod === "nowpayments" && npPayment && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Send exactly</span>
                      <span className="font-black text-xl text-slate-900">{npPayment.payAmount} {npPayment.payCurrency.toUpperCase()}</span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <QRCodeSVG value={npPayment.payAddress} size={144} level="M" className="rounded-2xl border-4 border-white shadow-lg" />
                      <p className="text-xs text-slate-500">Scan or copy the address below</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Payment Address</p>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <span className="font-mono text-[11px] text-slate-700 break-all flex-1">{npPayment.payAddress}</span>
                        <button onClick={() => { navigator.clipboard.writeText(npPayment.payAddress); setNpCopied(true); setTimeout(() => setNpCopied(false), 2000); toast({ title: "Address copied!" }); }}
                          className={`shrink-0 p-1.5 rounded-lg text-xs font-bold transition-colors ${npCopied ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
                          {npCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                    {npPayment.expiresAt && <p className="text-[11px] text-orange-600 font-medium">⏱ Expires: {new Date(npPayment.expiresAt).toLocaleTimeString()}</p>}
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                      <span className="text-[12px] text-blue-700">{npPollCount >= 30 ? "Auto-check stopped." : `Checking every 30s… (${npPollCount}/30)`}</span>
                    </div>
                    <button onClick={handleNpCheck} className="w-full py-3 border border-blue-300 text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                      <RefreshCw size={14} /> Check Payment
                    </button>
                    <button onClick={() => { setNpPayment(null); setNpPollCount(0); }} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600">Cancel / Change currency</button>
                  </div>
                )}

                {/* ── Binance Pay ── */}
                {payMethod === "binance_pay" && !mpCheckoutId && !npPayment && (
                  manualDone && orderId ? (
                    <div className="bg-white border border-green-200 rounded-2xl p-6 space-y-3 text-center shadow-sm">
                      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={28} className="text-green-600" /></div>
                      <p className="font-black text-lg text-slate-800">Order #{orderId} Submitted!</p>
                      <p className="text-sm text-slate-500">Our team verifies your payment within <strong>10-30 minutes</strong>.</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
                        <p className="text-[12px] font-bold text-yellow-800">Send ${selectedModel.price} USD via Binance Pay</p>
                        <div className="flex items-center gap-3 bg-white border border-yellow-200 rounded-xl px-4 py-3">
                          <span className="text-2xl">🟡</span>
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-400 font-medium">Binance Pay ID</p>
                            <p className="text-2xl font-black text-slate-900 tracking-widest">490759406</p>
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText("490759406"); toast({ title: "Copied!" }); }}
                            className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center hover:bg-yellow-200 transition-colors">
                            <Copy size={14} />
                          </button>
                        </div>
                        <p className="text-[11px] text-yellow-700">Payment label: <strong>GSM World Unlock</strong></p>
                      </div>
                      <button onClick={handleManualPay}
                        className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-lg">
                        <CheckCircle2 size={16} /> I've Sent ${selectedModel.price} — Place Order
                      </button>
                    </div>
                  )
                )}

                {/* ── USDT Manual ── */}
                {payMethod === "usdt_manual" && !mpCheckoutId && !npPayment && (
                  manualDone && orderId ? (
                    <div className="bg-white border border-green-200 rounded-2xl p-6 space-y-3 text-center shadow-sm">
                      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={28} className="text-green-600" /></div>
                      <p className="font-black text-lg text-slate-800">Order #{orderId} Submitted!</p>
                      <p className="text-sm text-slate-500">Our team verifies your payment within <strong>10-30 minutes</strong>.</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                        <p className="text-[12px] font-bold text-emerald-800">Send ${selectedModel.price} USDT via TRC20 Network</p>
                        <div className="flex flex-col items-center gap-3">
                          <QRCodeSVG value="TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5" size={120} level="M" className="rounded-2xl border-4 border-white shadow-lg" />
                          <p className="text-[11px] text-slate-500">Scan QR or copy address below</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-2.5">
                          <span className="font-mono text-[11px] text-slate-700 break-all flex-1">TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5</span>
                          <button onClick={() => { navigator.clipboard.writeText("TNgDQqmgQo5soUH8pGv6LgB69zCVCS7gq5"); toast({ title: "Address copied!" }); }}
                            className="shrink-0 p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                            <Copy size={12} />
                          </button>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-start gap-2">
                          <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-red-700 font-medium">TRC20 only — Sending via ERC20 will result in loss of funds.</p>
                        </div>
                      </div>
                      <button onClick={handleManualPay}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-lg">
                        <CheckCircle2 size={16} /> I've Sent ${selectedModel.price} USDT — Place Order
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

          </div>

          {/* ── Sidebar (desktop) ── */}
          <div className="hidden md:block">
            <InfoSidebar walletBalance={walletBalance} selectedModel={selectedModel} />
          </div>

        </div>

        {/* ── Mobile sidebar info strip ── */}
        <div className="md:hidden mt-6 space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield size={11} className="text-emerald-500" /> Why choose GSM World?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: <BadgeCheck size={13} className="text-blue-500" />, text: "15,000+ unlocked" },
                { icon: <Clock size={13} className="text-orange-500" />, text: "2–24 hr delivery" },
                { icon: <Shield size={13} className="text-emerald-500" />, text: "Permanent unlock" },
                { icon: <Star size={13} className="text-yellow-500" />, text: "4.9/5 rating" },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                  {t.icon}
                  <span className="text-[11px] font-semibold text-slate-700">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-slate-500" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Wallet Balance</p>
                <p className="text-slate-800 font-black text-sm">${walletBalance.toFixed(2)}</p>
              </div>
            </div>
            <Link href="/account/add-fund">
              <button className="text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors">Top Up</button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
