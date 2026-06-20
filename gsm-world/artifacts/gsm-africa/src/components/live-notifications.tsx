import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Wallet, Wrench, Star, Unlock, Zap } from "lucide-react";

interface LiveNotif {
  id: number;
  type: "unlock" | "credit" | "rental" | "review" | "bulk";
  icon: React.ReactNode;
  title: string;
  sub: string;
  color: string;
  glow: string;
}

const NOTIF_POOL: Omit<LiveNotif, "id">[] = [
  { type: "unlock", icon: <Unlock size={14} />, title: "iPhone 15 Pro Unlocked", sub: "Nairobi, Kenya · just now", color: "#4ade80", glow: "rgba(74,222,128,0.18)" },
  { type: "credit", icon: <Wallet size={14} />, title: "Credits Recharged", sub: "$50 added · Lagos, Nigeria", color: "#60a5fa", glow: "rgba(96,165,250,0.18)" },
  { type: "rental", icon: <Wrench size={14} />, title: "Tool Rental: IMEI Check", sub: "Kampala, Uganda · 2 min ago", color: "#c084fc", glow: "rgba(192,132,252,0.18)" },
  { type: "unlock", icon: <CheckCircle2 size={14} />, title: "Samsung S24 Ultra Done", sub: "Dar es Salaam, TZ · just now", color: "#4ade80", glow: "rgba(74,222,128,0.18)" },
  { type: "review", icon: <Star size={14} fill="#fbbf24" />, title: "5★ Review Received", sub: "\"Super fast!\" — Moses O.", color: "#fbbf24", glow: "rgba(251,191,36,0.18)" },
  { type: "unlock", icon: <Unlock size={14} />, title: "iCloud Lock Removed", sub: "Accra, Ghana · 1 min ago", color: "#4ade80", glow: "rgba(74,222,128,0.18)" },
  { type: "credit", icon: <Wallet size={14} />, title: "Credits Recharged", sub: "$20 added · Abidjan, CI", color: "#60a5fa", glow: "rgba(96,165,250,0.18)" },
  { type: "rental", icon: <Wrench size={14} />, title: "Tool Rental: FRP Bypass", sub: "Cairo, Egypt · 3 min ago", color: "#c084fc", glow: "rgba(192,132,252,0.18)" },
  { type: "unlock", icon: <CheckCircle2 size={14} />, title: "Pixel 8 Carrier Freed", sub: "Kigali, Rwanda · just now", color: "#4ade80", glow: "rgba(74,222,128,0.18)" },
  { type: "bulk", icon: <Zap size={14} />, title: "Bulk Order: 12 Devices", sub: "Reseller · Johannesburg", color: "#fb923c", glow: "rgba(251,146,60,0.18)" },
  { type: "unlock", icon: <Unlock size={14} />, title: "iPhone 14 Pro Unlocked", sub: "Lusaka, Zambia · just now", color: "#4ade80", glow: "rgba(74,222,128,0.18)" },
  { type: "review", icon: <Star size={14} fill="#fbbf24" />, title: "5★ Review Received", sub: "\"Legit service!\" — Amara K.", color: "#fbbf24", glow: "rgba(251,191,36,0.18)" },
  { type: "credit", icon: <Wallet size={14} />, title: "Credits Recharged", sub: "$100 added · Nairobi, KE", color: "#60a5fa", glow: "rgba(96,165,250,0.18)" },
  { type: "unlock", icon: <CheckCircle2 size={14} />, title: "OnePlus 12 Unlocked", sub: "Addis Ababa, ET · 2 min ago", color: "#4ade80", glow: "rgba(74,222,128,0.18)" },
  { type: "rental", icon: <Wrench size={14} />, title: "Tool Rental: SIM Unlock", sub: "Kampala, Uganda · 1 min ago", color: "#c084fc", glow: "rgba(192,132,252,0.18)" },
  { type: "unlock", icon: <Unlock size={14} />, title: "Samsung Tab S9 Freed", sub: "Dakar, Senegal · just now", color: "#4ade80", glow: "rgba(74,222,128,0.18)" },
  { type: "bulk", icon: <Zap size={14} />, title: "Bulk Order: 5 iPhones", sub: "Reseller · Lagos, Nigeria", color: "#fb923c", glow: "rgba(251,146,60,0.18)" },
  { type: "review", icon: <Star size={14} fill="#fbbf24" />, title: "5★ Review Received", sub: "\"Fast & reliable\" — Janet M.", color: "#fbbf24", glow: "rgba(251,191,36,0.18)" },
  { type: "unlock", icon: <Unlock size={14} />, title: "Xiaomi 14 Pro Unlocked", sub: "Harare, Zimbabwe · just now", color: "#4ade80", glow: "rgba(74,222,128,0.18)" },
  { type: "credit", icon: <Wallet size={14} />, title: "Credits Recharged", sub: "$30 added · Maputo, MZ", color: "#60a5fa", glow: "rgba(96,165,250,0.18)" },
];

let poolIndex = Math.floor(Math.random() * NOTIF_POOL.length);
let nextId = 1;

export function LiveNotifications() {
  const [current, setCurrent] = useState<LiveNotif | null>(null);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismiss() {
    setExiting(true);
    setTimeout(() => { setVisible(false); setExiting(false); setCurrent(null); }, 340);
  }

  useEffect(() => {
    function show() {
      const entry = NOTIF_POOL[poolIndex % NOTIF_POOL.length];
      poolIndex++;
      const notif: LiveNotif = { ...entry, id: nextId++ };
      setCurrent(notif);
      setVisible(true);
      setExiting(false);

      timerRef.current = setTimeout(() => {
        setExiting(true);
        setTimeout(() => {
          setVisible(false);
          setExiting(false);
          setCurrent(null);
          timerRef.current = setTimeout(show, 2800 + Math.random() * 1800);
        }, 340);
      }, 4200);
    }

    const init = setTimeout(show, 1800 + Math.random() * 1200);
    return () => {
      clearTimeout(init);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!current || !visible) return null;

  return (
    <div
      className="fixed z-[150] pointer-events-auto cursor-pointer select-none"
      style={{
        bottom: 80,
        left: 12,
        right: 12,
        maxWidth: 300,
        transform: exiting
          ? "translateY(12px) scale(0.96)"
          : "translateY(0) scale(1)",
        opacity: exiting ? 0 : 1,
        transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.32s ease",
        animation: !exiting ? "liveNotifIn 0.35s cubic-bezier(0.22,1,0.36,1)" : undefined,
      }}
      onClick={dismiss}
    >
      <div
        className="flex items-center gap-3 px-3.5 py-3 rounded-2xl"
        style={{
          background: "rgba(6,11,21,0.94)",
          border: `1px solid ${current.color}30`,
          backdropFilter: "blur(20px)",
          boxShadow: `0 8px 32px ${current.glow}, 0 2px 8px rgba(0,0,0,0.5)`,
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `${current.glow}`,
            border: `1px solid ${current.color}40`,
            color: current.color,
          }}
        >
          {current.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-black leading-tight truncate" style={{ color: "#f1f5f9" }}>
            {current.title}
          </p>
          <p className="text-[10px] leading-tight truncate" style={{ color: "rgba(255,255,255,0.38)" }}>
            {current.sub}
          </p>
        </div>
        <div
          className="w-2 h-2 rounded-full shrink-0 animate-pulse"
          style={{ background: current.color }}
        />
      </div>
      <style>{`
        @keyframes liveNotifIn {
          from { transform: translateY(14px) scale(0.94); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
