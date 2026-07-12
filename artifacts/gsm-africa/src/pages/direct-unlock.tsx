import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Search, ChevronDown, ChevronRight, Zap, Usb, Monitor, Activity,
  Play, Square, RefreshCw, Settings, Cpu, Wifi, Lock, Shield,
  RotateCcw, Trash2, Database, HardDrive, AlertTriangle, CheckCircle,
  Terminal, Download, Upload, Loader2, Info, Star,
} from "lucide-react";

// ── Brand definitions ─────────────────────────────────────────────────────────
const BRANDS = [
  { id: "xiaomi",    label: "MI",          bg: "#FF6900", text: "#fff",    short: "Mi" },
  { id: "samsung",   label: "SAMSUNG",     bg: "#1428A0", text: "#fff",    short: "Samsung" },
  { id: "huawei",    label: "HUAWEI",      bg: "#CF0A2C", text: "#fff",    short: "Huawei" },
  { id: "oppo",      label: "OPPO",        bg: "#1D7D3B", text: "#fff",    short: "OPPO" },
  { id: "vivo",      label: "vivo",        bg: "#0047AB", text: "#fff",    short: "Vivo" },
  { id: "vsmart",    label: "VSMART",      bg: "#E30613", text: "#fff",    short: "VSmart" },
  { id: "meizu",     label: "MEIZU",       bg: "#F5A623", text: "#000",    short: "Meizu" },
  { id: "tecno",     label: "TECNO",       bg: "#00B0F0", text: "#000",    short: "Tecno" },
  { id: "asus",      label: "ASUS",        bg: "#00539b", text: "#fff",    short: "ASUS" },
  { id: "lg",        label: "LG",          bg: "#A50034", text: "#fff",    short: "LG" },
  { id: "nokia",     label: "NOKIA",       bg: "#124191", text: "#fff",    short: "Nokia" },
  { id: "lenovo",    label: "lenovo",      bg: "#E2231A", text: "#fff",    short: "Lenovo" },
  { id: "qualcomm",  label: "Snapdragon",  bg: "#3253DC", text: "#fff",    short: "Qualcomm" },
  { id: "mediatek",  label: "MEDIATEK",   bg: "#1C75BC", text: "#fff",    short: "MediaTek" },
  { id: "android",   label: "android",     bg: "#3DDC84", text: "#000",    short: "Android" },
  { id: "apple",     label: "Apple",       bg: "#555", text: "#fff",      short: "Apple" },
  { id: "infinix",   label: "Infinix",     bg: "#C8102E", text: "#fff",    short: "Infinix" },
  { id: "spreadtrum",label: "SPREADTRUM",  bg: "#666", text: "#fff",      short: "Spreadtrum" },
];

// ── Device models per brand ───────────────────────────────────────────────────
const DEVICE_MODELS: Record<string, Array<{ name: string; chip: string; price: number }>> = {
  xiaomi: [
    { name: "Xiaomi Mi Note", chip: "Snapdragon 615", price: 22 },
    { name: "Xiaomi Mi Note 2", chip: "Snapdragon 821", price: 25 },
    { name: "Xiaomi Mi Note 3", chip: "Snapdragon 660", price: 25 },
    { name: "Xiaomi Mi Note Pro", chip: "Snapdragon 810", price: 28 },
    { name: "Xiaomi Mi Pad 4", chip: "Snapdragon 660", price: 20 },
    { name: "Xiaomi Poco C3", chip: "MT6768", price: 15 },
    { name: "Xiaomi Poco M2", chip: "MT6768", price: 16 },
    { name: "Xiaomi Poco M3", chip: "Snapdragon 662", price: 18 },
    { name: "Xiaomi PocoPhone F1", chip: "Snapdragon 845", price: 22 },
    { name: "Xiaomi Redmi 10X 5G", chip: "Dimensity 820", price: 20 },
    { name: "Xiaomi Redmi Note 12", chip: "Snapdragon 685", price: 20 },
    { name: "Xiaomi 13 Pro", chip: "Snapdragon 8 Gen 2", price: 35 },
    { name: "Xiaomi 14 Ultra", chip: "Snapdragon 8 Gen 3", price: 40 },
  ],
  samsung: [
    { name: "Samsung Galaxy S25 Ultra", chip: "Snapdragon 8 Elite", price: 45 },
    { name: "Samsung Galaxy S24 / S24+", chip: "Exynos 2400", price: 38 },
    { name: "Samsung Galaxy S23 Series", chip: "Snapdragon 8 Gen 2", price: 32 },
    { name: "Samsung Galaxy S22 Series", chip: "Exynos 2200", price: 28 },
    { name: "Samsung Galaxy A55", chip: "Exynos 1480", price: 22 },
    { name: "Samsung Galaxy A54 5G", chip: "Exynos 1380", price: 20 },
    { name: "Samsung Galaxy A35", chip: "Exynos 1380", price: 18 },
    { name: "Samsung Galaxy A15", chip: "Dimensity 6100+", price: 15 },
    { name: "Samsung Galaxy M55 5G", chip: "Snapdragon 7 Gen 1", price: 20 },
    { name: "Samsung Galaxy Z Fold 6", chip: "Snapdragon 8 Gen 3", price: 50 },
    { name: "Samsung Galaxy Z Flip 6", chip: "Snapdragon 8 Gen 3", price: 40 },
    { name: "Samsung Galaxy Note 20 Ultra", chip: "Exynos 990", price: 30 },
  ],
  huawei: [
    { name: "Huawei P60 Pro", chip: "Kirin 9000S", price: 35 },
    { name: "Huawei P50 Pro", chip: "Kirin 9000", price: 30 },
    { name: "Huawei P40 Pro+", chip: "Kirin 990 5G", price: 28 },
    { name: "Huawei Mate 60 Pro", chip: "Kirin 9010", price: 38 },
    { name: "Huawei Mate 50 Pro", chip: "Snapdragon 8+ Gen 1", price: 32 },
    { name: "Huawei Nova 11 Pro", chip: "Snapdragon 778G", price: 22 },
    { name: "Huawei Y9s", chip: "Kirin 710F", price: 15 },
    { name: "Huawei MediaPad T3", chip: "Kirin 655", price: 18 },
  ],
  oppo: [
    { name: "OPPO Find X7 Ultra", chip: "Dimensity 9300", price: 38 },
    { name: "OPPO Reno 11 Pro", chip: "Dimensity 8200", price: 25 },
    { name: "OPPO A98 5G", chip: "Snapdragon 695", price: 18 },
    { name: "OPPO A58", chip: "Dimensity 700", price: 15 },
  ],
  vivo: [
    { name: "Vivo X100 Pro", chip: "Dimensity 9300", price: 38 },
    { name: "Vivo V29 Pro", chip: "Dimensity 8200", price: 25 },
    { name: "Vivo Y36 5G", chip: "Snapdragon 695", price: 18 },
  ],
  apple: [
    { name: "iPhone 16 Pro Max", chip: "A18 Pro", price: 95 },
    { name: "iPhone 16 / 16 Plus", chip: "A18", price: 85 },
    { name: "iPhone 15 Pro Max", chip: "A17 Pro", price: 82 },
    { name: "iPhone 15 / 15 Plus", chip: "A16", price: 75 },
    { name: "iPhone 14 Pro Max", chip: "A16 Bionic", price: 70 },
    { name: "iPhone 14 / 14 Plus", chip: "A15 Bionic", price: 65 },
    { name: "iPhone 13 Series", chip: "A15 Bionic", price: 60 },
    { name: "iPhone 12 Series", chip: "A14 Bionic", price: 50 },
    { name: "iCloud Lock Removal (A11-)", chip: "iCloud", price: 120 },
    { name: "iCloud Lock Removal (A12+)", chip: "iCloud", price: 180 },
  ],
  mediatek: [
    { name: "MTK Universal (Any brand)", chip: "MediaTek", price: 18 },
    { name: "Dimensity 9300 Device", chip: "Dimensity 9300", price: 28 },
    { name: "Dimensity 8200 Device", chip: "Dimensity 8200", price: 22 },
    { name: "MT6768 Device", chip: "MT6768", price: 15 },
    { name: "MT6765 Device", chip: "MT6765", price: 12 },
  ],
  qualcomm: [
    { name: "Snapdragon 8 Gen 3 Device", chip: "SD 8 Gen 3", price: 38 },
    { name: "Snapdragon 8 Gen 2 Device", chip: "SD 8 Gen 2", price: 35 },
    { name: "Snapdragon 888 Device", chip: "SD 888", price: 28 },
    { name: "Snapdragon 778G Device", chip: "SD 778G", price: 22 },
  ],
  infinix: [
    { name: "Infinix Note 40 Pro", chip: "Helio G99 Ultimate", price: 18 },
    { name: "Infinix Hot 40 Pro", chip: "Helio G99", price: 14 },
    { name: "Infinix Smart 8", chip: "Helio G36", price: 10 },
  ],
  tecno: [
    { name: "Tecno Phantom V Fold", chip: "Dimensity 9000", price: 35 },
    { name: "Tecno Camon 30 Pro", chip: "Dimensity 8200 Ultra", price: 20 },
    { name: "Tecno Spark 20 Pro", chip: "Helio G99", price: 14 },
  ],
  android: [
    { name: "Generic Android (FRP Bypass)", chip: "Any", price: 15 },
    { name: "Generic Android (Factory Reset)", chip: "Any", price: 12 },
    { name: "Generic Android (Screen Lock)", chip: "Any", price: 18 },
  ],
  lg: [
    { name: "LG V60 ThinQ 5G", chip: "Snapdragon 865", price: 25 },
    { name: "LG Wing 5G", chip: "Snapdragon 765G", price: 22 },
    { name: "LG G8X ThinQ", chip: "Snapdragon 855", price: 20 },
  ],
  nokia: [
    { name: "Nokia X30 5G", chip: "Snapdragon 695", price: 20 },
    { name: "Nokia G60 5G", chip: "Snapdragon 695", price: 18 },
    { name: "Nokia C32", chip: "Helio G37", price: 12 },
  ],
  lenovo: [
    { name: "Lenovo Legion Phone 3", chip: "Snapdragon 8+ Gen 1", price: 32 },
    { name: "Lenovo Tab P12 Pro", chip: "Snapdragon 870", price: 28 },
    { name: "Lenovo K15 Pro", chip: "Snapdragon 662", price: 16 },
  ],
  vsmart: [
    { name: "VSmart Star 4", chip: "Snapdragon 665", price: 14 },
    { name: "VSmart Live 4", chip: "Snapdragon 675", price: 18 },
  ],
  meizu: [
    { name: "Meizu 21 Pro", chip: "Snapdragon 8 Gen 3", price: 35 },
    { name: "Meizu 20", chip: "Snapdragon 8 Gen 2", price: 30 },
    { name: "Meizu Note 8", chip: "Snapdragon 632", price: 15 },
  ],
  asus: [
    { name: "ASUS ROG Phone 8 Pro", chip: "Snapdragon 8 Gen 3", price: 40 },
    { name: "ASUS Zenfone 10", chip: "Snapdragon 8 Gen 2", price: 32 },
    { name: "ASUS ROG Phone 7", chip: "Snapdragon 8 Gen 2", price: 38 },
  ],
  spreadtrum: [
    { name: "Spreadtrum SC7731E Device", chip: "SC7731E", price: 10 },
    { name: "Spreadtrum SC9832E Device", chip: "SC9832E", price: 12 },
    { name: "Spreadtrum Generic FRP Bypass", chip: "Spreadtrum", price: 10 },
  ],
};

// ── Operations per mode ───────────────────────────────────────────────────────
const OPERATIONS: Record<string, Array<{ label: string; icon: React.ReactNode; color: string; desc: string }>> = {
  "BROM|EDL": [
    { label: "[EDL] UNLOCK BOOTLOADER", icon: <Lock size={13} />, color: "#888", desc: "Unlocks the bootloader via Emergency Download mode" },
    { label: "[EDL] FACTORY RESET", icon: <RotateCcw size={13} />, color: "#FFB800", desc: "Performs factory reset via EDL mode" },
    { label: "[EDL] ERASE FRP", icon: <Shield size={13} />, color: "#FFB800", desc: "Erases Factory Reset Protection lock" },
    { label: "[EDL] RESET | DISABLE MI CLOUD", icon: <Cpu size={13} />, color: "#FFB800", desc: "Disables Mi Cloud account lock" },
    { label: "[EDL] BACKUP EFS", icon: <Database size={13} />, color: "#888", desc: "Backs up EFS partition (IMEI/baseband)" },
    { label: "[EDL] RESTORE EFS", icon: <HardDrive size={13} />, color: "#888", desc: "Restores EFS from backup" },
    { label: "[EDL] WIPE EFS", icon: <Trash2 size={13} />, color: "#888", desc: "Wipes EFS partition — use with caution!" },
  ],
  "FASTBOOT": [
    { label: "[ADB] UNLOCK BOOTLOADER", icon: <Lock size={13} />, color: "#00C8E0", desc: "ADB fastboot bootloader unlock" },
    { label: "[FASTBOOT] OEM UNLOCK", icon: <Shield size={13} />, color: "#00C8E0", desc: "OEM unlock via fastboot command" },
    { label: "[FASTBOOT] FLASH TWRP", icon: <Download size={13} />, color: "#00C8E0", desc: "Flash TWRP recovery via fastboot" },
    { label: "[FASTBOOT] FORMAT DATA", icon: <Trash2 size={13} />, color: "#FFB800", desc: "Format userdata partition" },
    { label: "[FASTBOOT] ERASE CACHE", icon: <RefreshCw size={13} />, color: "#FFB800", desc: "Erase cache partition" },
    { label: "[FASTBOOT] REBOOT RECOVERY", icon: <RotateCcw size={13} />, color: "#888", desc: "Reboot device into recovery" },
  ],
  "RECOVERY": [
    { label: "[ADB] SIDELOAD FILE", icon: <Upload size={13} />, color: "#00C8E0", desc: "Sideload update package via ADB" },
    { label: "[ADB] WIPE DATA", icon: <Trash2 size={13} />, color: "#FFB800", desc: "Wipe /data partition" },
    { label: "[ADB] WIPE CACHE", icon: <RefreshCw size={13} />, color: "#888", desc: "Wipe /cache partition" },
    { label: "[ADB] REMOVE PATTERN", icon: <Lock size={13} />, color: "#00C8E0", desc: "Remove screen pattern lock via ADB" },
    { label: "[ADB] FRP BYPASS", icon: <Shield size={13} />, color: "#00C8E0", desc: "Bypass Factory Reset Protection" },
  ],
  "FUNCTIONS": [
    { label: "[COM+ADB] READ INFO", icon: <Info size={13} />, color: "#00C8E0", desc: "Read full device information" },
    { label: "[COM] FACTORY RESET", icon: <RotateCcw size={13} />, color: "#FFB800", desc: "Factory reset via COM port" },
    { label: "[COM] ENTER DOWNLOAD", icon: <Download size={13} />, color: "#00C8E0", desc: "Force device into download mode" },
    { label: "[COM] REMOVE FRP [2025]", icon: <Shield size={13} />, color: "#FFB800", desc: "Remove FRP lock — 2025 method" },
    { label: "[COM] CHANGE CSC", icon: <Cpu size={13} />, color: "#888", desc: "Change CSC / region code" },
    { label: "[MTP] INSTALL DRIVER", icon: <HardDrive size={13} />, color: "#888", desc: "Install MTP USB drivers" },
    { label: "[MTP] FRP BYPASS", icon: <Shield size={13} />, color: "#00C8E0", desc: "Bypass FRP via MTP mode" },
    { label: "[ADB] REMOVE PASSCODE", icon: <Lock size={13} />, color: "#00C8E0", desc: "Remove screen passcode via ADB" },
    { label: "[ADB] ERASE FRP", icon: <Trash2 size={13} />, color: "#FFB800", desc: "Erase FRP data via ADB shell" },
    { label: "[ADB] SET DUAL SIMS", icon: <Settings size={13} />, color: "#888", desc: "Configure dual SIM settings via ADB" },
  ],
  "DIAG": [
    { label: "[DIAG] READ IMEI", icon: <Terminal size={13} />, color: "#00C8E0", desc: "Read IMEI via diagnostic port" },
    { label: "[DIAG] WRITE IMEI", icon: <Upload size={13} />, color: "#FFB800", desc: "Write/Repair IMEI via diagnostic" },
    { label: "[DIAG] UNLOCK NETWORK", icon: <Wifi size={13} />, color: "#00C8E0", desc: "Unlock carrier/network restrictions" },
    { label: "[DIAG] REMOVE FRP", icon: <Shield size={13} />, color: "#FFB800", desc: "Remove FRP via diagnostic mode" },
    { label: "[DIAG] FACTORY RESET", icon: <RotateCcw size={13} />, color: "#FFB800", desc: "Factory reset via diagnostic port" },
  ],
  "META": [
    { label: "[META] READ INFO", icon: <Info size={13} />, color: "#00C8E0", desc: "Read device info in META mode" },
    { label: "[META] FORMAT ALL", icon: <Trash2 size={13} />, color: "#FFB800", desc: "Format all partitions via META mode" },
    { label: "[META] ERASE FRP", icon: <Shield size={13} />, color: "#FFB800", desc: "Erase FRP in META mode" },
    { label: "[META] RESTORE NV", icon: <HardDrive size={13} />, color: "#888", desc: "Restore NV data from backup" },
  ],
};

// ── Log line types ────────────────────────────────────────────────────────────
type LogLine = { text: string; color: string; ts: string };

function nowTs() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
}

function generateLogs(brand: string, model: string, operation: string): LogLine[] {
  const ts = nowTs();
  const lines: LogLine[] = [
    { text: `GSM World Tool v2025.07.12 — ${operation}`, color: "#FFB800", ts },
    { text: `Target: ${model} (${brand})`, color: "#00C8E0", ts },
    { text: "Scanning for device...", color: "#aaa", ts },
    { text: "Connecting to device... OK", color: "#4CAF50", ts },
    { text: `Reading device info...`, color: "#aaa", ts },
    { text: `Model Number: ${model.split(" ").pop()}`, color: "#fff", ts },
    { text: `Bootloader: Locked`, color: "#FF6B6B", ts },
    { text: `OS Version: Android 14`, color: "#fff", ts },
    { text: `Serial: GW${Math.random().toString(36).slice(2,10).toUpperCase()}`, color: "#fff", ts },
    { text: `Starting ${operation}...`, color: "#FFB800", ts },
    { text: "Processing...", color: "#aaa", ts },
    { text: "Sending unlock sequence...", color: "#aaa", ts },
    { text: "Verifying signature... OK", color: "#4CAF50", ts },
    { text: "Writing unlock token...", color: "#aaa", ts },
    { text: "✔ Operation completed successfully!", color: "#4CAF50", ts },
    { text: `Result: DONE — ${model}`, color: "#4CAF50", ts },
  ];
  return lines;
}

// ── Main component ────────────────────────────────────────────────────────────
export function DirectUnlockPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();

  // State
  const [selectedBrand, setSelectedBrand] = useState<string>("samsung");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState<{ name: string; chip: string; price: number } | null>(null);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("FUNCTIONS");
  const [topTab, setTopTab] = useState<"ODIN FLASH" | "FUNCTIONS">("FUNCTIONS");
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress1, setProgress1] = useState(0);
  const [progress2, setProgress2] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([
    { text: "GSM World Tool — Ready", color: "#FFB800", ts: nowTs() },
    { text: "Connect device via USB cable", color: "#aaa", ts: nowTs() },
    { text: "Select device model from the list", color: "#aaa", ts: nowTs() },
    { text: "Choose an operation and press START", color: "#aaa", ts: nowTs() },
  ]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Cleanup
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // Compute models list
  const allModels = selectedBrand ? (DEVICE_MODELS[selectedBrand] || []) : Object.values(DEVICE_MODELS).flat();
  const filteredModels = searchQuery.trim()
    ? Object.entries(DEVICE_MODELS).flatMap(([b, ms]) =>
        ms.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())).map(m => ({ ...m, brand: b }))
      )
    : allModels.map(m => ({ ...m, brand: selectedBrand }));

  const brandLabel = BRANDS.find(b => b.id === selectedBrand)?.label || selectedBrand;

  // Get tab list based on brand/top-tab
  const tabOptions = selectedBrand === "xiaomi"
    ? ["BROM|EDL", "FASTBOOT", "RECOVERY", "FUNCTION", "DIAG", "META"]
    : selectedBrand === "samsung"
    ? ["FUNCTIONS", "FASTBOOT", "DIAG", "META"]
    : selectedBrand === "mediatek"
    ? ["BROM|EDL", "META", "FASTBOOT", "DIAG"]
    : ["FUNCTIONS", "FASTBOOT", "RECOVERY", "DIAG"];

  // Auto-set activeTab when brand changes
  useEffect(() => {
    setActiveTab(tabOptions[0]);
    setSelectedOp(null);
  }, [selectedBrand]);

  const currentOps = OPERATIONS[activeTab] || OPERATIONS["FUNCTIONS"];

  function handleStart() {
    if (!selectedModel) {
      toast({ title: "Select a model", description: "Please select a device model from the list first." });
      return;
    }
    if (!selectedOp) {
      toast({ title: "Select an operation", description: "Please click an operation button first." });
      return;
    }
    if (!user) {
      toast({ title: "Login required", description: "Please login to place an order.", variant: "destructive" });
      return;
    }
    setShowOrderModal(true);
  }

  function simulateRun() {
    setRunning(true);
    setProgress1(0);
    setProgress2(0);
    const newLogs = generateLogs(brandLabel, selectedModel!.name, selectedOp!);
    setLogs([]);
    let i = 0;
    intervalRef.current = setInterval(() => {
      if (i < newLogs.length) {
        setLogs(prev => [...prev, newLogs[i]]);
        setProgress1(Math.min(100, ((i + 1) / newLogs.length) * 100));
        setProgress2(Math.min(100, ((i + 1) / newLogs.length) * 85));
        i++;
      } else {
        clearInterval(intervalRef.current!);
        setRunning(false);
        setProgress1(100);
        setProgress2(100);
      }
    }, 320);
  }

  function handleStop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setLogs(prev => [...prev, { text: "⛔ Stopped by user.", color: "#FF6B6B", ts: nowTs() }]);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col select-none" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* ── Title bar ── */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-[#00C8E0] to-[#0099cc] flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-[#00C8E0]">GSM WORLD Tool v2025.07.12</span>
          <span className="text-[11px] text-[#666] hidden sm:inline">— https://gsmworld.vercel.app</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-[11px] text-[#4CAF50] bg-[#0d2e15] px-2 py-0.5 rounded border border-[#1a4a20]">
              ● {user.email}
            </span>
          )}
          {!user && (
            <Link href="/login">
              <button className="text-[11px] text-[#00C8E0] border border-[#00C8E0]/40 px-2 py-0.5 rounded hover:bg-[#00C8E0]/10 transition-colors">
                Login
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Brand logo grid ── */}
      <div className="bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="grid grid-cols-9 sm:grid-cols-9 md:grid-cols-9" style={{ gridTemplateColumns: "repeat(9, 1fr)" }}>
          {BRANDS.map(b => (
            <button
              key={b.id}
              onClick={() => { setSelectedBrand(b.id); setSearchQuery(""); }}
              style={{ background: b.bg, color: b.text }}
              className={`py-2 px-1 text-center text-[9px] sm:text-[10px] font-black tracking-wider uppercase transition-all border-b-2 ${
                selectedBrand === b.id ? "border-white opacity-100 scale-y-105 relative z-10" : "border-transparent opacity-80 hover:opacity-100"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top-level mode tabs ── */}
      <div className="bg-[#1a1f2e] border-b border-[#30363d] flex items-center gap-0 shrink-0 overflow-x-auto">
        {/* Left: mode tabs */}
        <div className="flex items-center gap-0 border-r border-[#30363d]">
          {(selectedBrand === "xiaomi" ? ["MI FLASH", "SECURITY"] : ["ODIN FLASH", "FUNCTIONS"]).map(t => (
            <button
              key={t}
              onClick={() => setTopTab(t as any)}
              className={`px-4 py-2 text-[11px] font-bold flex items-center gap-1.5 transition-colors border-b-2 ${
                topTab === t ? "text-[#FFB800] border-[#FFB800] bg-[#1e2430]" : "text-[#888] border-transparent hover:text-white"
              }`}
            >
              {t === "MI FLASH" || t === "ODIN FLASH" ? <Zap size={11} className="text-[#FFB800]" /> : <Lock size={11} className="text-[#FFB800]" />}
              {t}
            </button>
          ))}
        </div>
        {/* Right: sub-tabs */}
        <div className="flex items-center gap-0 px-2">
          {tabOptions.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === tab ? "text-white border-[#00C8E0] bg-[#1e2430]" : "text-[#666] border-transparent hover:text-[#aaa]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {/* Right toolbar */}
        <div className="ml-auto flex items-center gap-0 border-l border-[#30363d]">
          {["ADB", "FASTBOOT", "T.POINT", "DEVMGR", "CONFIG"].map(t => (
            <button key={t} className="px-3 py-2 text-[10px] font-semibold text-[#888] hover:text-white flex items-center gap-1 transition-colors">
              {t === "ADB" && <Terminal size={10} />}
              {t === "FASTBOOT" && <Zap size={10} />}
              {t === "T.POINT" && <Activity size={10} />}
              {t === "DEVMGR" && <Monitor size={10} />}
              {t === "CONFIG" && <Settings size={10} />}
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main 3-panel body ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT: Device list ── */}
        <div className="w-52 lg:w-60 bg-[#161b22] border-r border-[#30363d] flex flex-col shrink-0">
          {/* Search */}
          <div className="px-2 py-2 border-b border-[#30363d]">
            <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1">
              <Search size={11} className="text-[#666] shrink-0" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-[11px] text-white placeholder-[#555] outline-none w-full"
              />
            </div>
          </div>

          {/* Brand label + model count */}
          <div className="px-3 py-1.5 border-b border-[#30363d] flex items-center justify-between">
            <span className="text-[10px] text-[#FFB800] font-bold uppercase">{brandLabel}</span>
            <span className="text-[10px] text-[#555]">{filteredModels.length} models</span>
          </div>

          {/* Model list */}
          <div className="flex-1 overflow-y-auto">
            {filteredModels.map((m, i) => (
              <button
                key={i}
                onClick={() => setSelectedModel(m)}
                className={`w-full text-left px-3 py-1.5 border-b border-[#21262d] transition-colors ${
                  selectedModel?.name === m.name
                    ? "bg-[#0d2a3e] border-l-2 border-l-[#00C8E0]"
                    : "hover:bg-[#1e2430]"
                }`}
              >
                <div className={`text-[11px] font-medium leading-snug ${selectedModel?.name === m.name ? "text-[#00C8E0]" : "text-[#cdd9e5]"}`}>
                  {m.name}
                </div>
                <div className="text-[9px] text-[#555] mt-0.5">{m.chip}</div>
              </button>
            ))}
          </div>

          {/* Status bar */}
          <div className="px-3 py-1.5 border-t border-[#30363d]">
            <span className="text-[9px] text-[#555]">Init: {filteredModels.length} models</span>
          </div>
        </div>

        {/* ── CENTER: Operations ── */}
        <div className="flex-1 bg-[#13191f] border-r border-[#30363d] flex flex-col overflow-hidden">
          {/* Selected model info */}
          {selectedModel ? (
            <div className="px-4 py-2 border-b border-[#30363d] bg-[#161b22] flex items-center gap-3">
              <div>
                <div className="text-[11px] font-bold text-[#00C8E0]">{selectedModel.name}</div>
                <div className="text-[10px] text-[#666]">{selectedModel.chip} · ${selectedModel.price} USD</div>
              </div>
              <div className="ml-auto">
                <span className="text-[10px] text-[#4CAF50] bg-[#0d2e15] px-2 py-0.5 rounded border border-[#1a4a20]">SELECTED</span>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 border-b border-[#30363d] bg-[#161b22]">
              <div className="text-[11px] text-[#555] italic">← Select a device model from the list</div>
            </div>
          )}

          {/* Operations list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {currentOps.map((op, i) => (
              <button
                key={i}
                onClick={() => setSelectedOp(op.label)}
                disabled={running}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded border transition-all text-left group ${
                  selectedOp === op.label
                    ? "bg-[#0d2a3e] border-[#00C8E0] shadow-[0_0_8px_rgba(0,200,224,0.2)]"
                    : "bg-[#1a1f2e] border-[#21262d] hover:border-[#30363d] hover:bg-[#1e2430]"
                } ${running && selectedOp !== op.label ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <span style={{ color: op.color }} className="shrink-0">{op.icon}</span>
                <span className={`text-[11px] font-semibold ${selectedOp === op.label ? "text-white" : "text-[#8b949e] group-hover:text-[#cdd9e5]"}`}>
                  {op.label}
                </span>
                {selectedOp === op.label && (
                  <ChevronRight size={11} className="ml-auto text-[#00C8E0]" />
                )}
              </button>
            ))}
          </div>

          {/* Operation description */}
          {selectedOp && (
            <div className="px-4 py-2 border-t border-[#30363d] bg-[#0d1117]">
              <p className="text-[10px] text-[#666] italic">
                {currentOps.find(o => o.label === selectedOp)?.desc}
              </p>
            </div>
          )}

          {/* Bottom controls */}
          <div className="px-4 py-3 border-t border-[#30363d] bg-[#161b22] flex items-center gap-3">
            <div className="text-[10px] text-[#555] flex-1">EMMC</div>
            <div className="flex items-center gap-2">
              {!running ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#00C8E0] to-[#0099cc] hover:from-[#00b8d0] hover:to-[#0088bb] text-black font-black text-[11px] px-5 py-2 rounded transition-all shadow-lg shadow-[#00C8E0]/20"
                >
                  <Play size={12} fill="currentColor" />
                  START
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 bg-[#c92a2a] hover:bg-[#a02020] text-white font-black text-[11px] px-5 py-2 rounded transition-all"
                >
                  <Square size={12} fill="currentColor" />
                  STOP
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Connection + Logs ── */}
        <div className="w-72 xl:w-80 bg-[#161b22] flex flex-col overflow-hidden shrink-0">
          {/* USB / COM */}
          <div className="px-3 py-2 border-b border-[#30363d] space-y-1.5">
            <div className="flex items-center gap-2">
              <Usb size={11} className="text-[#666] shrink-0" />
              <span className="text-[10px] text-[#888] w-10 shrink-0">USB</span>
              <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5">
                <span className="text-[10px] text-[#666] italic">- Waiting for devices -</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Monitor size={11} className="text-[#FFB800] shrink-0" />
              <span className="text-[10px] text-[#888] w-10 shrink-0">COM</span>
              <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 flex items-center gap-1">
                <span className="text-[10px] text-[#FFB800]">🟡</span>
                <span className="text-[10px] text-[#cdd9e5]">COM1 (Communications Port)</span>
              </div>
            </div>
          </div>

          {/* Log output */}
          <div ref={logRef} className="flex-1 overflow-y-auto bg-[#0d1117] p-2 font-mono text-[10px] leading-5">
            {logs.map((line, i) => (
              <div key={i} style={{ color: line.color }}>
                <span className="text-[#444] mr-1">[{line.ts}]</span>
                {line.text}
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-1 text-[#666]">
                <Loader2 size={10} className="animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>

          {/* Progress bars */}
          <div className="px-3 py-3 border-t border-[#30363d] space-y-2">
            <div className="space-y-1">
              <div className="h-4 bg-[#0d1117] border border-[#30363d] rounded overflow-hidden relative">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${progress1}%`, background: "linear-gradient(90deg, #FFB800, #ff8800)" }}
                />
                {progress1 > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-black mix-blend-screen">
                    {Math.round(progress1)}%
                  </span>
                )}
              </div>
              <div className="h-4 bg-[#0d1117] border border-[#30363d] rounded overflow-hidden relative">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${progress2}%`, background: "linear-gradient(90deg, #FFB800, #ff6600)" }}
                />
                {progress2 > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-black mix-blend-screen">
                    {Math.round(progress2)}%
                  </span>
                )}
              </div>
            </div>

            {/* Stop button */}
            {running && (
              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 bg-[#c92a2a] hover:bg-[#a02020] text-white font-bold text-[11px] py-1.5 rounded transition-colors"
              >
                <Square size={10} fill="currentColor" /> STOP
              </button>
            )}
          </div>

          {/* Status footer */}
          <div className="px-3 py-1.5 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
            <span className="text-[9px] text-[#555]">GSM World Tool</span>
            <span className="text-[9px] text-[#555]">{new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Order confirmation modal ── */}
      {showOrderModal && selectedModel && selectedOp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-[#30363d] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00C8E0]/10 flex items-center justify-center">
                <Zap size={16} className="text-[#00C8E0]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Confirm Service Order</h3>
                <p className="text-[10px] text-[#666]">Review your order before proceeding to checkout</p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="bg-[#0d1117] rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#888]">Device</span>
                  <span className="text-white font-semibold">{selectedModel.name}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#888]">Chipset</span>
                  <span className="text-white">{selectedModel.chip}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#888]">Service</span>
                  <span className="text-[#00C8E0] font-semibold">{selectedOp}</span>
                </div>
                <div className="border-t border-[#30363d] pt-2 flex justify-between text-[12px]">
                  <span className="text-[#FFB800] font-bold">Total</span>
                  <span className="text-[#FFB800] font-black">${selectedModel.price}.00 USD</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[10px] text-[#666] bg-[#1a1f2e] rounded-lg p-3">
                <Info size={11} className="text-[#00C8E0] shrink-0 mt-0.5" />
                <span>After payment, our team processes your order manually. Estimated delivery: 1–24 hours. You'll receive updates via email.</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#30363d] flex gap-3">
              <button
                onClick={() => setShowOrderModal(false)}
                className="flex-1 py-2 text-[11px] font-semibold text-[#888] border border-[#30363d] rounded-lg hover:bg-[#1e2430] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowOrderModal(false);
                  simulateRun();
                  // Navigate to checkout with pre-filled product info
                  setTimeout(() => {
                    window.location.href = `/checkout?service=${encodeURIComponent(selectedOp!)}&device=${encodeURIComponent(selectedModel!.name)}&price=${selectedModel!.price}`;
                  }, 200);
                }}
                className="flex-1 py-2 text-[11px] font-bold bg-gradient-to-r from-[#00C8E0] to-[#0099cc] text-black rounded-lg hover:from-[#00b8d0] transition-all"
              >
                Proceed to Checkout →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
