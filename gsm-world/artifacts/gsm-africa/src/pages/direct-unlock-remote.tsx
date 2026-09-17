import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, CheckCircle2,
  ChevronDown, ChevronRight, CirclePlus, Clock3, Copy, FileText, Globe2,
  Headphones, History, Home, Mail, Phone, Plus, RefreshCw, Search,
  ShieldCheck, ShoppingCart, Smartphone, UserRound, Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { DEVICE_CATALOG } from "@/pages/direct-unlock";

type Stage = "dashboard" | "device" | "details" | "processing" | "payment" | "pending";
type PaymentMethod = "mpesa" | "nowpayments" | "binance_pay" | "usdt_manual";
type Device = { brand: string; model: string; price: number };
type Progress =
  | { kind: "mpesa"; orderId: number; checkoutRequestId: string }
  | { kind: "crypto"; orderId: number; paymentId: string; address: string; amount: number; currency: string }
  | { kind: "manual"; orderId: number; method: "binance_pay" | "usdt_manual"; binancePayId?: string | null; usdtAddress?: string | null; usdtNetwork?: string | null };
type OrderResponse = { id?: number; error?: string };

const DEVICES: Device[] = DEVICE_CATALOG.flatMap((brand) =>
  brand.models.map((model) => ({
    brand: brand.brand,
    model: model.name,
    price: model.price,
  })),
);

const PROCESSING_MS = 7 * 60 * 1000;
const money = (value: number) => `$${value.toFixed(2)}`;

function validIdentifier(value: string) {
  const clean = value.replace(/[\s-]/g, "");
  if (/^\d{15}$/.test(clean)) {
    let sum = 0;
    for (let i = 0; i < 15; i += 1) {
      let digit = Number(clean[i]);
      if (i % 2 === 1) digit *= 2;
      if (digit > 9) digit -= 9;
      sum += digit;
    }
    return sum % 10 === 0;
  }
  return /^[a-z0-9]{6,24}$/i.test(clean);
}

function StepHeader({ stage }: { stage: Stage }) {
  const labels = ["Device", "Identifier", "Processing", "Payment"];
  const index = stage === "pending" ? 4 : ["device", "details", "processing", "payment"].indexOf(stage);
  return <div className="mb-8 flex items-start">
    {labels.map((label, itemIndex) => <div key={label} className="flex flex-1 items-start last:flex-none">
      <div className="flex w-20 shrink-0 flex-col items-center gap-2 text-center">
        <span className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${itemIndex < index ? "border-primary bg-primary text-primary-foreground" : itemIndex === index ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{itemIndex < index ? <Check size={14} /> : itemIndex + 1}</span>
        <span className={`text-[10px] font-semibold ${itemIndex <= index ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
      </div>
      {itemIndex < labels.length - 1 && <span className={`mt-4 h-px flex-1 ${itemIndex < index ? "bg-primary" : "bg-border"}`} />}
    </div>)}
  </div>;
}

const DASHBOARD_ORDERS = [
  { device: "iPhone 13", identifier: "356789123456789", status: "Completed", age: "2h ago", tone: "teal" },
  { device: "Samsung Galaxy S21", identifier: "354567890123456", status: "Completed", age: "3h ago", tone: "teal" },
  { device: "iPhone 12", identifier: "353456789012345", status: "Processing", age: "5h ago", tone: "blue" },
  { device: "Xiaomi Redmi Note 10", identifier: "863456789012345", status: "Pending", age: "7h ago", tone: "amber" },
  { device: "iPhone 11", identifier: "352345678901234", status: "Completed", age: "9h ago", tone: "teal" },
] as const;

const DASHBOARD_ACTIVITY = [
  ["Sep 15, 2025 10:24 AM", "Phone Unlock", "iPhone 13", "Completed", "teal"],
  ["Sep 15, 2025 08:12 AM", "IMEI Check", "356789123456789", "Completed", "teal"],
  ["Sep 14, 2025 06:45 PM", "Phone Unlock", "Samsung S21", "Processing", "blue"],
  ["Sep 14, 2025 02:33 PM", "Phone Unlock", "Xiaomi Redmi Note 10", "Pending", "amber"],
  ["Sep 13, 2025 11:17 AM", "IMEI Check", "353456789012345", "Completed", "teal"],
] as const;

const toneClasses = {
  teal: "bg-[#00c9ad]/15 text-[#25e0c3]",
  blue: "bg-[#1676de]/20 text-[#4da4ff]",
  amber: "bg-[#f6b51b]/20 text-[#f9c83f]",
} as const;

function DashboardStatus({ status, tone }: { status: string; tone: keyof typeof toneClasses }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${toneClasses[tone]}`}>{status}</span>;
}

function DashboardBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#09cdb3] text-[#031321] shadow-[0_0_24px_rgba(9,205,179,.2)]">
        <span className="text-lg font-black">U</span>
      </span>
      <span className={compact ? "hidden sm:block" : "block"}>
        <span className="block text-[15px] font-black leading-none text-white">UnlockGSM</span>
        <span className="mt-1 block text-[9px] font-medium tracking-wide text-[#83a0bf]">Unlock Your Freedom</span>
      </span>
    </div>
  );
}

function DashboardNavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold transition-colors ${
        active ? "bg-[#00bda9]/20 text-[#2ae0c2]" : "text-[#8da2bd] hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function QuickAction({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[96px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-[#1b3a5d] bg-[#091d34] px-2 py-3 text-center transition-colors hover:border-[#00bda9]/70 hover:bg-[#0c2943]"
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}>{icon}</span>
      <span className="text-[11px] font-semibold leading-tight text-[#d7e4f3]">{label}</span>
    </button>
  );
}

function DashboardStage({ onStartUnlock }: { onStartUnlock: () => void }) {
  const { user } = useAuth();
  const displayName = user?.name?.trim() || user?.username?.trim() || "Timothy Cheruiyot";
  const firstName = displayName.split(/\s+/)[0];
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="direct-dashboard min-h-[100dvh] bg-[#061322] text-white">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[235px] flex-col border-r border-[#16304d] bg-[#061322] px-4 py-5 lg:flex">
        <DashboardBrand />
        <nav className="mt-10 space-y-1">
          <DashboardNavItem icon={<Home size={16} />} label="Dashboard" active />
          <DashboardNavItem icon={<Smartphone size={16} />} label="New Unlock" onClick={onStartUnlock} />
          <DashboardNavItem icon={<FileText size={16} />} label="Orders" />
          <DashboardNavItem icon={<Search size={16} />} label="IMEI Check" />
          <DashboardNavItem icon={<Wallet size={16} />} label="Balance & Payments" />
          <DashboardNavItem icon={<History size={16} />} label="History" />
          <DashboardNavItem icon={<Headphones size={16} />} label="Support" />
        </nav>
        <div className="mt-auto rounded-xl border border-[#344459] bg-[#111b28] p-4">
          <span className="text-xl">♛</span>
          <p className="mt-3 text-xs font-bold text-white">Premium Service</p>
          <p className="mt-2 text-[10px] leading-5 text-[#9badc4]">Fast, Secure and Reliable Phone Unlocking Worldwide.</p>
          <button type="button" onClick={onStartUnlock} className="mt-3 rounded-lg bg-[#09cdb3] px-3 py-2 text-[10px] font-bold text-[#03202a]">
            Get Started <ArrowRight className="ml-1 inline" size={12} />
          </button>
        </div>
        <p className="mt-5 px-1 text-[9px] leading-4 text-[#637a95]">UnlockGSM v1.0.0<br />© 2025 UnlockGSM. All rights reserved.</p>
      </aside>

      <div className="lg:pl-[235px]">
        <header className="flex h-[68px] items-center justify-between border-b border-[#16304d] px-4 sm:px-8 lg:px-10">
          <div className="lg:hidden"><DashboardBrand compact /></div>
          <div className="hidden text-xs text-[#6e89a5] lg:block">Client dashboard</div>
          <div className="flex items-center gap-4">
            <button type="button" aria-label="Notifications" className="relative text-[#a1b2c7] hover:text-white">
              <Bell size={18} />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#fa4b51]" />
            </button>
            <div className="hidden h-7 w-px bg-[#1b3857] sm:block" />
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#075d68] text-sm font-bold text-[#6ef1dc]">{initials}</span>
              <span className="hidden sm:block">
                <span className="block text-[11px] font-bold text-white">{displayName}</span>
                <span className="mt-0.5 block text-[9px] text-[#7891ac]">Business Account</span>
              </span>
              <ChevronDown size={14} className="text-[#7891ac]" />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1370px] px-4 pb-24 pt-5 sm:px-8 sm:pt-7 lg:px-10 lg:pb-10">
          <div className="mb-5">
            <h1 className="text-[21px] font-bold tracking-[-.03em] sm:text-2xl">Good morning, {firstName} <span className="text-base">👋</span></h1>
            <p className="mt-1 text-[11px] text-[#7891ac] sm:text-xs">Here&apos;s what&apos;s happening with your account today.</p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_255px]">
            <div className="min-w-0">
              <section className="relative overflow-hidden rounded-2xl border border-[#00bda9]/70 bg-[linear-gradient(135deg,#092b37_0%,#082335_52%,#07192b_100%)] p-4 sm:p-5">
                <div className="absolute -right-12 -top-28 h-64 w-64 rounded-full border border-[#00c9ad]/20 bg-[#00c9ad]/10 blur-sm" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[12px] text-[#d5e7ef]"><span>Wallet Balance</span><span className="text-[#5d89a6]">◉</span></div>
                    <p className="mt-1 text-[34px] font-bold leading-none tracking-[-.05em] sm:text-[38px]">$124.50</p>
                    <p className="mt-2 text-[12px] text-[#63e3ce]"><ArrowUpRight className="mr-1 inline" size={15} strokeWidth={3} />+12% <span className="text-[#89a3b8]">from last week</span></p>
                  </div>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#00c9ad]/15 text-[#17ddc0]"><Wallet size={23} /></span>
                </div>
                <div className="relative mt-5 grid grid-cols-3 border-t border-white/10 pt-4">
                  {[
                    ["Total Orders", "48", "+8%", <FileText key="orders" size={17} />],
                    ["Completed", "42", "+10%", <CheckCircle2 key="completed" size={17} />],
                    ["Pending", "6", "Needs attention", <Clock3 key="pending" size={17} />],
                  ].map(([label, value, change, icon], index) => (
                    <div key={String(label)} className={`flex items-start gap-2 px-2 first:pl-0 sm:px-4 ${index > 0 ? "border-l border-white/10" : ""}`}>
                      <span className={`hidden h-8 w-8 shrink-0 place-items-center rounded-lg sm:grid ${index === 0 ? "bg-[#0c79d3]/25 text-[#46a8ff]" : index === 1 ? "bg-[#8552d5]/30 text-[#b283ff]" : "bg-[#a26f10]/30 text-[#f4c133]"}`}>{icon}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] text-[#91a8c2]">{label}</span>
                        <span className="mt-1 block text-lg font-bold leading-none">{value}</span>
                        <span className={`mt-1 block truncate text-[9px] ${index === 2 ? "text-[#f4c133]" : "text-[#14d7b8]"}`}>{index === 2 && <AlertCircle className="mr-0.5 inline" size={10} />}{change}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-4 rounded-2xl border border-[#153554] bg-[#081a2e] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold">Quick Actions</h2>
                  <button type="button" onClick={onStartUnlock} className="text-[11px] font-semibold text-[#16d9bd]">View all <ArrowRight className="ml-1 inline" size={13} /></button>
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <QuickAction icon={<Smartphone size={20} />} label={<>Check IMEI<br />Status</>} accent="bg-[#00aa79]/60 text-[#6df2c4]" />
                  <QuickAction icon={<ShoppingCart size={20} />} label={<>Place<br />Order</>} accent="bg-[#075cc1] text-[#73b8ff]" onClick={onStartUnlock} />
                  <QuickAction icon={<CirclePlus size={20} />} label={<>New Unlock<br />Request</>} accent="bg-[#7f3fc1] text-[#dfaeff]" onClick={onStartUnlock} />
                  <QuickAction icon={<History size={20} />} label={<>Order<br />History</>} accent="bg-[#294679] text-[#b8d0ff]" />
                </div>
              </section>

              <section className="mt-4 hidden overflow-hidden rounded-2xl border border-[#153554] bg-[#081a2e] lg:block">
                <div className="flex items-center justify-between border-b border-[#153554] px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold"><ArrowUpRight size={17} className="text-[#12d6bb]" /> Orders Overview</h2>
                  <button type="button" className="rounded-lg border border-[#1e4265] px-3 py-1.5 text-[10px] text-[#a2b7ce]">Last 7 days <ChevronDown className="ml-1 inline" size={12} /></button>
                </div>
                <div className="relative h-44 px-4 pb-4 pt-3">
                  <div className="absolute inset-x-5 top-5 space-y-8 border-t border-dashed border-[#183a5d]">
                    <span className="block border-t border-dashed border-[#183a5d]" />
                    <span className="block border-t border-dashed border-[#183a5d]" />
                    <span className="block border-t border-dashed border-[#183a5d]" />
                  </div>
                  <svg viewBox="0 0 700 150" preserveAspectRatio="none" className="relative h-full w-full">
                    <defs><linearGradient id="orders-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#00c9ad" stopOpacity=".38" /><stop offset="1" stopColor="#00c9ad" stopOpacity="0" /></linearGradient></defs>
                    <path d="M0,118 C55,100 80,108 125,95 C170,82 185,84 230,67 C275,50 315,62 350,64 C390,66 420,77 458,66 C500,54 520,44 565,35 C610,25 650,28 700,9 L700,150 L0,150 Z" fill="url(#orders-fill)" />
                    <path d="M0,118 C55,100 80,108 125,95 C170,82 185,84 230,67 C275,50 315,62 350,64 C390,66 420,77 458,66 C500,54 520,44 565,35 C610,25 650,28 700,9" fill="none" stroke="#0bd2b8" strokeWidth="2.5" />
                  </svg>
                  <div className="absolute bottom-0 inset-x-5 flex justify-between text-[9px] text-[#708aa6]"><span>Sep 9</span><span>Sep 10</span><span>Sep 11</span><span>Sep 12</span><span>Sep 13</span><span>Sep 14</span><span>Sep 15</span></div>
                </div>
              </section>

              <section className="mt-4 overflow-hidden rounded-2xl border border-[#153554] bg-[#081a2e]">
                <div className="flex items-center justify-between border-b border-[#153554] px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold"><Clock3 size={17} className="text-[#14d7b8]" /> Recent Orders</h2>
                  <Link href="/orders/lookup" className="text-[11px] font-semibold text-[#16d9bd]">View all <ArrowRight className="ml-1 inline" size={13} /></Link>
                </div>
                <div className="divide-y divide-[#153554]">
                  {DASHBOARD_ORDERS.map((order) => (
                    <div key={order.identifier} className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#122b48] text-[#b4d1ef]"><Smartphone size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-[#e5eef8]">{order.device}</span>
                        <span className="mt-0.5 block truncate font-mono text-[9px] text-[#708baa]">{order.identifier}</span>
                      </span>
                      <DashboardStatus status={order.status} tone={order.tone} />
                      <span className="hidden w-12 text-right text-[9px] text-[#7891ac] sm:block">{order.age}</span>
                      <ChevronRight size={14} className="text-[#56718f]" />
                    </div>
                  ))}
                </div>
                <Link href="/orders/lookup" className="block border-t border-[#153554] px-4 py-3 text-[10px] font-bold text-[#16d9bd]">View all orders <ArrowRight className="ml-1 inline" size={12} /></Link>
              </section>
            </div>

            <aside className="hidden space-y-4 xl:block">
              <section className="rounded-2xl border border-[#00bda9]/70 bg-[linear-gradient(145deg,#092c37,#071b2b)] p-4">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#00c9ad]/15 text-[#20e0c3]"><Plus size={20} /></span>
                <h2 className="mt-3 text-sm font-bold">New Unlock Request</h2>
                <p className="mt-1 text-[10px] leading-5 text-[#93abc2]">Start a new phone unlocking order in just a few steps.</p>
                <button type="button" onClick={onStartUnlock} className="mt-4 w-full rounded-lg bg-[#09cdb3] py-2.5 text-[11px] font-bold text-[#03202a]">Start Now <ArrowRight className="ml-1 inline" size={13} /></button>
              </section>
              <section className="rounded-2xl border border-[#153554] bg-[#081a2e] p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><span className="text-[#ffe140]">ϟ</span> Quick Actions</h2>
                <div className="space-y-1">
                  {[
                    [<Search size={15} />, "Check IMEI Status"],
                    [<History size={15} />, "View Order History"],
                    [<Wallet size={15} />, "Add Funds"],
                    [<Headphones size={15} />, "Contact Support"],
                  ].map(([icon, label]) => <button type="button" key={String(label)} onClick={label === "Check IMEI Status" ? onStartUnlock : undefined} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left text-[11px] text-[#b4c6da] hover:text-white">{icon}<span className="flex-1">{label}</span><ChevronRight size={13} className="text-[#59728e]" /></button>)}
                </div>
              </section>
              <section className="rounded-2xl border border-[#153554] bg-[#081a2e] p-4">
                <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Your Balance</h2><Wallet size={17} className="text-[#14d7b8]" /></div>
                <p className="mt-3 text-2xl font-bold">$124.50 <span className="rounded-full bg-[#00c9ad]/15 px-2 py-1 align-middle text-[9px] text-[#19d9bc]">+12%</span></p>
                <button type="button" onClick={onStartUnlock} className="mt-3 w-full rounded-lg border border-[#126a6e] bg-[#07333d] py-2 text-[10px] font-bold text-[#18d5bb]">Manage Balance <ArrowRight className="ml-1 inline" size={12} /></button>
              </section>
              <section className="rounded-2xl border border-[#153554] bg-[#081a2e] p-4">
                <Headphones size={20} className="text-[#19d9bc]" />
                <h2 className="mt-3 text-sm font-bold">Need Help?</h2>
                <p className="mt-1 text-[10px] leading-5 text-[#8fa5bc]">Our support team is here to assist you 24/7.</p>
                <button type="button" className="mt-3 w-full rounded-lg border border-[#1e4265] py-2 text-[10px] font-bold text-[#18d5bb]">Contact Support</button>
              </section>
            </aside>
          </div>

          <section className="mt-4 hidden overflow-hidden rounded-2xl border border-[#153554] bg-[#081a2e] lg:block">
            <div className="flex items-center justify-between border-b border-[#153554] px-4 py-3">
              <h2 className="text-sm font-bold">Latest Activity</h2>
              <button type="button" className="text-[10px] font-semibold text-[#16d9bd]">View all <ArrowRight className="ml-1 inline" size={12} /></button>
            </div>
            <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr] px-4 py-2 text-[9px] font-semibold text-[#718aa5]">
              <span>Date &amp; Time</span><span>Service</span><span>Device</span><span>Status</span>
            </div>
            <div className="divide-y divide-[#153554]">
              {DASHBOARD_ACTIVITY.map(([date, service, device, status, tone]) => <div key={`${date}-${service}`} className="grid grid-cols-[1.25fr_1fr_1fr_1fr] items-center px-4 py-2 text-[9px] text-[#b1c4d9]"><span>{date}</span><span>{service}</span><span>{device}</span><span><DashboardStatus status={status} tone={tone} /></span></div>)}
            </div>
          </section>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[#153554] bg-[#061322]/95 px-2 py-2 backdrop-blur lg:hidden">
          <button type="button" className="flex min-w-14 flex-col items-center gap-1 text-[#16d9bd]"><Home size={19} /><span className="text-[9px] font-semibold">Home</span></button>
          <button type="button" className="flex min-w-14 flex-col items-center gap-1 text-[#8aa1bc]"><FileText size={18} /><span className="text-[9px] font-semibold">Orders</span></button>
          <button type="button" onClick={onStartUnlock} className="-mt-6 grid h-14 w-14 place-items-center rounded-full border-4 border-[#061322] bg-[#09cdb3] text-[#03202a] shadow-[0_0_24px_rgba(9,205,179,.35)]"><Plus size={26} /></button>
          <button type="button" className="flex min-w-14 flex-col items-center gap-1 text-[#8aa1bc]"><Wallet size={18} /><span className="text-[9px] font-semibold">Wallet</span></button>
          <button type="button" className="flex min-w-14 flex-col items-center gap-1 text-[#8aa1bc]"><UserRound size={18} /><span className="text-[9px] font-semibold">Profile</span></button>
        </nav>
      </div>
    </div>
  );
}

function DeviceStage({ selected, onSelect, onContinue }: { selected: Device | null; onSelect: (device: Device) => void; onContinue: () => void }) {
  const brands = useMemo(() => Array.from(new Set(DEVICES.map((device) => device.brand))), []);
  const [brand, setBrand] = useState(brands[0]);
  const devices = DEVICES.filter((device) => device.brand === brand);
  return <div>
    <p className="mono mb-3 text-[11px] uppercase tracking-[.16em] text-primary">Step 01 / device</p>
    <h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">Choose the device to unlock.</h1>
    <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">Select the exact device and price. You’ll enter its IMEI or serial number next—no USB connection is needed.</p>
    <div className="mt-7 flex gap-2 overflow-x-auto pb-1">{brands.map((item) => <button type="button" key={item} onClick={() => setBrand(item)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${brand === item ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{item}</button>)}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{devices.map((device) => <button type="button" key={device.model} onClick={() => onSelect(device)} className={`flex items-center justify-between rounded-2xl border p-4 text-left ${selected?.model === device.model ? "border-primary bg-secondary/70" : "border-border bg-card hover:border-primary/50"}`}><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Smartphone size={19} /></span><span className="min-w-0"><span className="block truncate text-sm font-bold">{device.model}</span><span className="mt-1 block text-xs text-muted-foreground">{device.brand} direct unlock</span></span></span><span className="mono ml-3 shrink-0 text-sm font-medium">{money(device.price)}</span></button>)}</div>
    <div className="mt-7 flex justify-end border-t border-border pt-6"><button type="button" disabled={!selected} onClick={onContinue} className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40">Continue <ArrowRight size={16} /></button></div>
  </div>;
}

function DetailsStage({ device, identifier, email, setIdentifier, setEmail, onBack, onContinue }: { device: Device; identifier: string; email: string; setIdentifier: (value: string) => void; setEmail: (value: string) => void; onBack: () => void; onContinue: () => void }) {
  const [touched, setTouched] = useState(false);
  const identifierOk = validIdentifier(identifier);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return <div>
    <p className="mono mb-3 text-[11px] uppercase tracking-[.16em] text-primary">Step 02 / identifier</p>
    <h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">Enter the device details.</h1>
    <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">After you submit these details, the secure remote unlock process runs for about 5–8 minutes.</p>
    <div className="mt-7 rounded-2xl border border-primary/20 bg-secondary/60 p-4"><div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-primary"><Smartphone size={18} /></span><span className="truncate text-sm font-bold">{device.brand} · {device.model}</span></span><span className="mono shrink-0 text-sm">{money(device.price)}</span></div></div>
    <div className="mt-6 space-y-5">
      <label className="block"><span className="mb-2 block text-sm font-bold">IMEI or serial number</span><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} onBlur={() => setTouched(true)} placeholder="15-digit IMEI or device serial" className={`field h-12 w-full rounded-xl border bg-card px-4 font-mono text-sm ${touched && !identifierOk ? "border-destructive" : "border-input"}`} />{touched && !identifierOk ? <span className="mt-2 block text-xs text-destructive">Enter a valid 15-digit IMEI or a serial number with at least 6 characters.</span> : <span className="mt-2 block text-xs text-muted-foreground">Find the IMEI by dialing *#06# or in Settings → About. Serial numbers are accepted for supported devices.</span>}</label>
      <label className="block"><span className="mb-2 block text-sm font-bold">Email for unlock details</span><div className="relative"><Mail className="absolute left-3 top-3.5 text-muted-foreground" size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => setTouched(true)} placeholder="you@example.com" className={`field h-12 w-full rounded-xl border bg-card pl-10 pr-4 text-sm ${touched && !emailOk ? "border-destructive" : "border-input"}`} /></div><span className="mt-2 block text-xs text-muted-foreground">Once payment is confirmed, the unlock details will be sent here.</span></label>
    </div>
    <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-border pt-6 sm:flex-row"><button type="button" onClick={onBack} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground"><ArrowLeft size={16} /> Back</button><button type="button" disabled={!identifierOk || !emailOk} onClick={onContinue} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40">Start secure check <ArrowRight size={16} /></button></div>
  </div>;
}

function ProcessingStage({ device, onDone }: { device: Device; onDone: () => void }) {
  const [remaining, setRemaining] = useState(PROCESSING_MS);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const next = Math.max(0, PROCESSING_MS - (Date.now() - started));
      setRemaining(next);
      if (next === 0) { window.clearInterval(timer); onDone(); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onDone]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "Your unlock process is still running. Keep this page open."; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const progress = Math.min(99, Math.round(((PROCESSING_MS - remaining) / PROCESSING_MS) * 100));
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
  return <div>
    <p className="mono mb-3 text-[11px] uppercase tracking-[.16em] text-primary">Step 03 / processing</p>
    <h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">Your unlock is processing.</h1>
    <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">We’re running the secure remote unlock check for {device.brand} {device.model}. This normally takes 5–8 minutes.</p>
    <div className="mt-8 rounded-2xl border border-primary/20 bg-secondary/60 p-6"><div className="flex items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card text-primary"><RefreshCw size={22} className="animate-spin" /></span><span><span className="block text-sm font-bold">Secure verification in progress</span><span className="mt-1 block text-xs text-muted-foreground">{minutes}:{seconds} remaining · {device.model}</span></span><span className="mono ml-auto text-sm text-primary">{progress}%</span></div><div className="mt-6 h-2 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><span>Checking eligibility</span><span>Estimated 5–8 minutes</span></div></div>
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e9cda5] bg-[#fff5e5] p-4 text-sm leading-6 text-[#704a22]"><Clock3 className="mt-0.5 shrink-0" size={18} /><span><strong>Do not close or refresh this page.</strong> The secure process must stay open until it finishes. You’ll see the final device price and payment options next.</span></div>
  </div>;
}

function PaymentStage({ device, email, onBack, onSubmit, submitting, error }: { device: Device; email: string; onBack: () => void; onSubmit: (method: PaymentMethod, value?: string) => void; submitting: boolean; error: string | null }) {
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("usdttrc20");
  const cryptoDisabled = device.price < 13;
  const methods: Array<{ id: PaymentMethod; label: string; description: string; icon: ReactNode }> = [
    { id: "mpesa", label: "M-Pesa", description: "STK push with automatic confirmation", icon: <Phone size={18} /> },
    { id: "nowpayments", label: "Crypto", description: cryptoDisabled ? "Available for orders of $13 or more" : "USDT, Bitcoin, Ethereum and more", icon: <Globe2 size={18} /> },
    { id: "binance_pay", label: "Binance Pay", description: "Manual confirmation after you send payment", icon: <span>🟡</span> },
    { id: "usdt_manual", label: "USDT TRC20", description: "Manual transfer with payment reference", icon: <span>💲</span> },
  ];
  return <div>
    <p className="mono mb-3 text-[11px] uppercase tracking-[.16em] text-primary">Step 04 / payment</p>
    <h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">Pay for the selected device.</h1>
    <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">The amount below is the price for your selected device. Unlock details are released only after payment is confirmed.</p>
    <div className="mt-7 flex items-center justify-between rounded-2xl border border-border bg-secondary/60 p-5"><span><span className="block text-xs uppercase tracking-wider text-muted-foreground">Direct unlock</span><span className="mt-2 block text-sm font-bold">{device.brand} · {device.model}</span><span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Mail size={13} /> {email}</span></span><span className="mono text-2xl font-medium">{money(device.price)}</span></div>
    <div className="mt-6 space-y-3">{methods.map((item) => <button type="button" key={item.id} disabled={item.id === "nowpayments" && cryptoDisabled} onClick={() => setMethod(item.id)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${item.id === "nowpayments" && cryptoDisabled ? "cursor-not-allowed opacity-50" : method === item.id ? "border-primary bg-secondary/60" : "border-border bg-card"}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">{item.icon}</span><span><span className="block text-sm font-bold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span></span>{method === item.id && <Check className="ml-auto text-primary" size={17} />}</button>)}</div>
    {method === "mpesa" && <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">M-Pesa phone number</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="2547XXXXXXXX" className="field h-12 w-full rounded-xl border border-input bg-card px-4 text-sm" /></label>}
    {method === "nowpayments" && <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">Cryptocurrency</span><select value={currency} onChange={(event) => setCurrency(event.target.value)} className="field h-12 w-full rounded-xl border border-input bg-card px-4 text-sm"><option value="usdttrc20">USDT (TRC20)</option><option value="usdterc20">USDT (ERC20)</option><option value="btc">Bitcoin</option><option value="eth">Ethereum</option><option value="ltc">Litecoin</option></select></label>}
    {error && <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-border pt-6 sm:flex-row"><button type="button" onClick={onBack} disabled={submitting} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground"><ArrowLeft size={16} /> Back</button><button type="button" onClick={() => onSubmit(method, method === "mpesa" ? phone : method === "nowpayments" ? currency : undefined)} disabled={submitting || (method === "mpesa" && !phone.trim())} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40">{submitting ? "Starting payment…" : `Pay ${money(device.price)}`} {!submitting && <ArrowRight size={16} />}</button></div>
  </div>;
}

function PendingStage({ device, email, identifier, progress, confirmed, onReset }: { device: Device; email: string; identifier: string; progress: Progress; confirmed: boolean; onReset: () => void }) {
  const reference = progress ? `GSM-${progress.orderId}` : `GSM-${identifier.slice(-6).toUpperCase()}`;
  return <div className="text-center">
    <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${confirmed ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>{confirmed ? <Check size={31} /> : <RefreshCw size={27} className="animate-spin" />}</span>
    <p className="mono mt-6 text-[11px] uppercase tracking-[.16em] text-primary">{confirmed ? "Payment confirmed" : "Payment started"}</p>
    <h1 className="display-font mt-3 text-[clamp(2rem,5vw,3.3rem)] font-bold leading-[.98] tracking-[-.06em]">{confirmed ? <>Payment confirmed,<br />your email is next.</> : <>Complete your payment,<br />then we&apos;ll email you.</>}</h1>
    <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground">{confirmed ? <>Your payment is confirmed. Unlock details for <strong className="text-foreground">{device.model}</strong> will be sent to <strong className="text-foreground">{email}</strong>.</> : <>Your request is reserved for <strong className="text-foreground">{email}</strong>. Complete payment and we&apos;ll send the unlock details once it is confirmed.</>}</p>
    {!confirmed && progress?.kind === "mpesa" && <div className="mx-auto mt-7 max-w-lg rounded-2xl border border-primary/20 bg-secondary/60 p-5 text-left"><p className="text-sm font-bold">Check your phone</p><p className="mt-2 text-xs leading-5 text-muted-foreground">An M-Pesa STK push was sent. Enter your PIN; this page checks for confirmation automatically.</p></div>}
    {!confirmed && progress?.kind === "crypto" && <div className="mx-auto mt-7 max-w-lg rounded-2xl border border-primary/20 bg-secondary/60 p-5 text-left"><p className="text-sm font-bold">Send {progress.amount} {progress.currency.toUpperCase()}</p><p className="mt-3 break-all rounded-lg bg-card p-3 font-mono text-[11px] text-muted-foreground">{progress.address}</p><button type="button" onClick={() => void navigator.clipboard?.writeText(progress.address)} className="mt-3 flex items-center gap-1 text-xs font-bold text-primary"><Copy size={13} /> Copy payment address</button></div>}
    {!confirmed && progress?.kind === "manual" && <div className="mx-auto mt-7 max-w-lg rounded-2xl border border-[#e9cda5] bg-[#fff5e5] p-5 text-left text-xs leading-5 text-[#704a22]"><p className="font-bold">{progress.method === "binance_pay" ? "Binance Pay instructions" : "USDT TRC20 instructions"}</p><p className="mt-2">{progress.method === "binance_pay" ? `Send ${money(device.price)} to Binance ID ${progress.binancePayId || "the payment ID in your email"}.` : `Send ${money(device.price)} to ${progress.usdtAddress || "the USDT address in your email"} on ${progress.usdtNetwork || "TRC20"}.`}</p><p className="mt-2">Include <strong>{reference}</strong> as the payment reference.</p></div>}
    <div className="mx-auto mt-7 max-w-lg rounded-2xl border border-border bg-secondary/50 p-5 text-left"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Request reference</span><button type="button" onClick={() => void navigator.clipboard?.writeText(reference)} className="flex items-center gap-1 text-xs font-bold text-primary"><Copy size={13} /> Copy</button></div><p className="mono mt-2 text-lg">{reference}</p><div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs"><span><span className="block text-muted-foreground">Device</span><strong className="mt-1 block">{device.model}</strong></span><span><span className="block text-muted-foreground">Amount</span><strong className="mono mt-1 block">{money(device.price)}</strong></span></div></div>
    {!confirmed && <div className="mx-auto mt-5 flex max-w-lg items-start gap-3 rounded-xl border border-[#e9cda5] bg-[#fff5e5] p-4 text-left text-xs leading-5 text-[#704a22]"><Clock3 size={16} className="mt-0.5 shrink-0" /><span><strong>Payment still needs confirmation.</strong> Once confirmed, the unlock details will be sent to your email.</span></div>}
    <button type="button" onClick={onReset} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold"><RefreshCw size={16} /> Start another unlock</button>
  </div>;
}

export function DirectUnlockRemotePage() {
  const [stage, setStage] = useState<Stage>("dashboard");
  const [device, setDevice] = useState<Device | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [progress, setProgress] = useState<Progress>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== "pending" || !progress || progress.kind === "manual" || confirmed) return;
    const interval = window.setInterval(async () => {
      const endpoint = progress.kind === "mpesa" ? "/api/payments/mpesa/query" : "/api/payments/nowpayments/query";
      const body = progress.kind === "mpesa" ? { orderId: progress.orderId, checkoutRequestId: progress.checkoutRequestId } : { orderId: progress.orderId, paymentId: progress.paymentId };
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const result = await response.json() as { paymentStatus?: string };
        if (result.paymentStatus === "paid") { setConfirmed(true); window.clearInterval(interval); }
        if (result.paymentStatus === "failed") { setError("Payment was not completed. Start again or choose another payment method."); window.clearInterval(interval); }
      } catch { /* retry on the next interval */ }
    }, progress.kind === "mpesa" ? 5000 : 30000);
    return () => window.clearInterval(interval);
  }, [stage, progress, confirmed]);

  const reset = () => { setStage("device"); setDevice(null); setIdentifier(""); setEmail(""); setProgress(null); setConfirmed(false); setError(null); };
  const submitPayment = async (method: PaymentMethod, value?: string) => {
    if (!device) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        sessionId: `direct-unlock-${Date.now()}`, customerEmail: email, paymentMethod: method,
        paymentStatus: method === "binance_pay" || method === "usdt_manual" ? "pending_payment_confirmation" : "pending",
        total: device.price.toFixed(2), currency: "USD", deviceIdentifier: identifier.trim(), orderType: "unlock",
        notes: `Direct unlock request for ${device.brand} ${device.model}. Identifier: ${identifier.trim()}`,
        items: [{ productId: 0, productName: `${device.brand} Direct Unlock — ${device.model}`, price: device.price.toFixed(2), quantity: 1 }],
      }) });
      const order = await response.json() as OrderResponse;
      if (!response.ok || !order.id) throw new Error(order.error || "We could not create your unlock request.");
      if (method === "mpesa") {
        const triggerResponse = await fetch(`/api/orders/${order.id}/mpesa/trigger`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: value, email }) });
        const trigger = await triggerResponse.json() as { checkoutRequestId?: string; error?: string };
        if (!triggerResponse.ok || !trigger.checkoutRequestId) throw new Error(trigger.error || "We could not start the M-Pesa payment.");
        setProgress({ kind: "mpesa", orderId: order.id, checkoutRequestId: trigger.checkoutRequestId });
      } else if (method === "nowpayments") {
        const cryptoResponse = await fetch(`/api/orders/${order.id}/nowpayments/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, payCurrency: value }) });
        const crypto = await cryptoResponse.json() as { paymentId?: string; payAddress?: string; payAmount?: number; payCurrency?: string; error?: string };
        if (!cryptoResponse.ok || !crypto.paymentId || !crypto.payAddress || !crypto.payAmount || !crypto.payCurrency) throw new Error(crypto.error || "We could not create the crypto payment.");
        setProgress({ kind: "crypto", orderId: order.id, paymentId: crypto.paymentId, address: crypto.payAddress, amount: crypto.payAmount, currency: crypto.payCurrency });
      } else {
        const configResponse = await fetch("/api/payment-config");
        const config = await configResponse.json() as { binancePayId?: string | null; usdtAddress?: string | null; usdtNetwork?: string | null };
        setProgress({ kind: "manual", orderId: order.id, method, ...config });
      }
      setStage("pending");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not start payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "dashboard") {
    return <DashboardStage onStartUnlock={() => setStage("device")} />;
  }

  return <div className="app-shell min-h-[100dvh]">
    <header className="topbar"><div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-5 sm:px-8"><div><p className="display-font text-lg font-bold">GSM World</p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Direct unlock service</p></div><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15} className="text-primary" /> Secure remote service</span></div></header>
    <main className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8 sm:py-12"><StepHeader stage={stage} /><div className="panel rounded-[1.35rem] p-5 sm:p-8 lg:p-10">
      {stage === "device" && <DeviceStage selected={device} onSelect={setDevice} onContinue={() => setStage("details")} />}
      {stage === "details" && device && <DetailsStage device={device} identifier={identifier} email={email} setIdentifier={setIdentifier} setEmail={setEmail} onBack={() => setStage("device")} onContinue={() => setStage("processing")} />}
      {stage === "processing" && device && <ProcessingStage device={device} onDone={() => setStage("payment")} />}
      {stage === "payment" && device && <PaymentStage device={device} email={email} onBack={() => setStage("processing")} onSubmit={submitPayment} submitting={submitting} error={error} />}
      {stage === "pending" && device && progress && <PendingStage device={device} email={email} identifier={identifier} progress={progress} confirmed={confirmed} onReset={reset} />}
    </div></main>
  </div>;
}