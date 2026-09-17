import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertCircle,
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Circle,
  Clock3,
  Copy,
  FileText,
  Globe2,
  Headphones,
  History,
  Home,
  ListChecks,
  LockKeyhole,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import { DEVICE_CATALOG } from "@/pages/direct-unlock";
import { useAuth } from "@/hooks/use-auth";
import { useWalletBalance } from "@/hooks/use-wallet";
import { useNotifications } from "@/context/notification-context";

type Stage = "dashboard" | "device" | "details" | "processing" | "payment" | "pending";
type PaymentMethod = "mpesa" | "nowpayments" | "binance_pay" | "usdt_manual";
type Device = { brand: string; model: string; price: number };
type Progress =
  | { kind: "mpesa"; orderId: number; checkoutRequestId: string }
  | { kind: "crypto"; orderId: number; paymentId: string; address: string; amount: number; currency: string }
  | { kind: "manual"; orderId: number; method: "binance_pay" | "usdt_manual"; binancePayId?: string | null; usdtAddress?: string | null; usdtNetwork?: string | null };
type OrderResponse = { id?: number; error?: string };

const PREPARATION_MS = 5 * 60 * 1000;
const PREPARATION_STEPS = [
  { code: "IMEI", title: "Validate identifier", detail: "Checking the IMEI checksum or serial format you entered.", log: "Identifier format and checksum accepted" },
  { code: "MODEL", title: "Match device service", detail: "Confirming the device family and the quoted unlock price.", log: "Device profile matched to selected service" },
  { code: "AUTH", title: "Prepare unlock request", detail: "Creating a request linked to your signed-in account.", log: "Account-linked request prepared for remote queue" },
  { code: "PAY", title: "Open payment options", detail: "M-Pesa and crypto payment choices will be available next.", log: "Payment session ready — awaiting customer selection" },
];
const money = (value: number) => `$${value.toFixed(2)}`;

type DashboardOrder = {
  id: number;
  paymentStatus: string;
  deviceIdentifier?: string | null;
  orderType?: string | null;
  createdAt?: string | null;
  items?: Array<{ productName?: string | null }>;
};

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

function StageHeader({ stage }: { stage: Stage }) {
  const labels = ["Device", "IMEI / Serial", "Checks", "Payment"];
  const index = stage === "pending" ? 4 : ["device", "details", "processing", "payment"].indexOf(stage);
  return (
    <div className="mb-4 rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] sm:px-7 sm:py-5">
      <div className="mb-4 flex items-center gap-2"><LockKeyhole size={14} className="text-[#008b99]" /><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#008b99]">Secure request flow</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">Complete each step to submit your unlock.</p></div></div>
      <div className="flex items-start">
        {labels.map((label, itemIndex) => (
          <div key={label} className="flex min-w-0 flex-1 items-start last:flex-none">
            <div className="flex min-w-[58px] flex-1 flex-col items-center gap-2 text-center sm:min-w-[82px]">
              <span aria-current={itemIndex === index ? "step" : undefined} className={`grid h-8 w-8 place-items-center rounded-full border text-[10px] font-black transition-all ${itemIndex < index ? "border-[#0d2638] bg-[#0d2638] text-white" : itemIndex === index ? "border-[#00bda9] bg-[#dffaf5] text-[#008b99] ring-4 ring-[#e9fcf8]" : "border-slate-200 bg-slate-50 text-slate-400"}`}>{itemIndex < index ? <Check size={14} strokeWidth={3} /> : itemIndex + 1}</span>
              <span className={`text-[9px] font-bold leading-tight sm:text-[10px] ${itemIndex <= index ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
            </div>
            {itemIndex < labels.length - 1 && <span className={`mt-4 h-px flex-1 ${itemIndex < index ? "bg-[#0d2638]" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  teal: "bg-[#00c9ad]/15 text-[#25e0c3]",
  blue: "bg-[#1676de]/20 text-[#4da4ff]",
  amber: "bg-[#f6b51b]/20 text-[#f9c83f]",
} as const;

function dashboardStatus(status: string): { label: string; tone: keyof typeof STATUS_STYLES } {
  if (status === "paid" || status === "completed" || status === "delivered") {
    return { label: "Completed", tone: "teal" };
  }
  if (status === "processing" || status === "active") {
    return { label: "Processing", tone: "blue" };
  }
  if (status === "pending_payment_confirmation") {
    return { label: "Awaiting Payment", tone: "amber" };
  }
  if (status === "cancelled" || status === "failed" || status === "refunded") {
    return { label: status[0].toUpperCase() + status.slice(1), tone: "amber" };
  }
  return { label: "Pending", tone: "amber" };
}

function orderIsCompleted(status: string) {
  return status === "paid" || status === "completed" || status === "delivered";
}

function orderIsOpen(status: string) {
  return !orderIsCompleted(status) && !["cancelled", "failed", "refunded"].includes(status);
}

function orderAge(createdAt?: string | null) {
  if (!createdAt) return "—";
  const elapsed = Math.max(0, Date.now() - new Date(createdAt).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DashboardStatus({ status, tone }: { status: string; tone: keyof typeof STATUS_STYLES }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_STYLES[tone]}`}>{status}</span>;
}

function DashboardEntry({ accountName, token, onStartUnlock }: { accountName: string; token: string | null; onStartUnlock: () => void }) {
  const firstName = accountName.split(/\s+/)[0] || "there";
  const initials = accountName.slice(0, 1).toUpperCase();
  const [, navigate] = useLocation();
  const { data: balance, isLoading: balanceLoading, isError: balanceError } = useWalletBalance();
  const { unreadCount } = useNotifications();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadOrders() {
      if (!token) {
        setOrders([]);
        setOrdersLoading(false);
        return;
      }
      setOrdersLoading(true);
      setOrdersError(false);
      try {
        const response = await fetch("/api/orders/my", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json() as DashboardOrder[] | { error?: string };
        if (!response.ok || !Array.isArray(data)) throw new Error("Could not load orders");
        if (!cancelled) setOrders(data);
      } catch {
        if (!cancelled) {
          setOrders([]);
          setOrdersError(true);
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }
    void loadOrders();
    return () => { cancelled = true; };
  }, [token]);

  const completedOrders = orders.filter((order) => orderIsCompleted(order.paymentStatus)).length;
  const openOrders = orders.filter((order) => orderIsOpen(order.paymentStatus)).length;
  const balanceLabel = balanceLoading ? "…" : balanceError ? "—" : money(Number(balance ?? 0));

  return (
    <div className="min-h-[100dvh] bg-[#061322] text-white">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[235px] flex-col border-r border-[#16304d] bg-[#061322] px-4 py-5 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#09cdb3] text-lg font-black text-[#031321]">U</span>
          <span><span className="block text-[15px] font-black leading-none">UnlockGSM</span><span className="mt-1 block text-[9px] text-[#83a0bf]">Unlock Your Freedom</span></span>
        </div>
        <nav className="mt-10 space-y-1">
          {[
            [<Home size={16} />, "Dashboard", true],
            [<Smartphone size={16} />, "New Unlock", false],
            [<FileText size={16} />, "Orders", false],
            [<Search size={16} />, "IMEI Check", false],
            [<Wallet size={16} />, "Balance & Payments", false],
            [<History size={16} />, "History", false],
            [<Headphones size={16} />, "Support", false],
           ].map(([icon, label, active]) => <button type="button" key={String(label)} onClick={label === "New Unlock" ? onStartUnlock : label === "Orders" || label === "History" ? () => navigate("/account/orders") : label === "Balance & Payments" ? () => navigate("/account/wallet") : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold ${active ? "bg-[#00bda9]/20 text-[#2ae0c2]" : "text-[#8da2bd] hover:bg-white/5 hover:text-white"}`}>{icon}<span>{label}</span></button>)}
        </nav>
        <div className="mt-auto rounded-xl border border-[#344459] bg-[#111b28] p-4">
          <span className="text-xl">♛</span>
          <p className="mt-3 text-xs font-bold">Premium Service</p>
          <p className="mt-2 text-[10px] leading-5 text-[#9badc4]">Fast, Secure and Reliable Phone Unlocking Worldwide.</p>
          <button type="button" onClick={onStartUnlock} className="mt-3 rounded-lg bg-[#09cdb3] px-3 py-2 text-[10px] font-bold text-[#03202a]">Get Started <ArrowRight className="ml-1 inline" size={12} /></button>
        </div>
        <p className="mt-5 px-1 text-[9px] leading-4 text-[#637a95]">UnlockGSM v1.0.0<br />© 2025 UnlockGSM. All rights reserved.</p>
      </aside>

      <div className="lg:pl-[235px]">
        <header className="flex h-[68px] items-center justify-between border-b border-[#16304d] px-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-2.5 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#09cdb3] text-lg font-black text-[#031321]">U</span><span className="text-[15px] font-black">UnlockGSM</span></div>
          <span className="hidden text-xs text-[#6e89a5] lg:block">Client dashboard</span>
          <div className="flex items-center gap-4">
             <button type="button" aria-label="Notifications" onClick={() => navigate("/account/notifications")} className="relative text-[#a1b2c7]"><Bell size={18} />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-3 min-w-3 place-items-center rounded-full bg-[#fa4b51] px-0.5 text-[8px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>
            <div className="hidden h-7 w-px bg-[#1b3857] sm:block" />
             <button type="button" aria-label="Open profile" onClick={() => navigate("/account/profile")} className="flex items-center gap-2.5 rounded-lg p-1 text-left hover:bg-white/5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#075d68] text-sm font-bold text-[#6ef1dc]">{initials}</span><span className="hidden sm:block"><span className="block text-[11px] font-bold">{accountName}</span><span className="mt-0.5 block text-[9px] text-[#7891ac]">Business Account</span></span><ChevronDown size={14} className="text-[#7891ac]" /></button>
          </div>
        </header>

        <main className="mx-auto max-w-[1370px] px-4 pb-24 pt-5 sm:px-8 sm:pt-7 lg:px-10 lg:pb-10">
          <div className="mb-5"><h1 className="text-[21px] font-bold tracking-[-.03em] sm:text-2xl">Good morning, {firstName} <span className="text-base">👋</span></h1><p className="mt-1 text-[11px] text-[#7891ac] sm:text-xs">Here&apos;s what&apos;s happening with your account today.</p></div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_255px]">
            <div className="min-w-0">
              <section className="relative overflow-hidden rounded-2xl border border-[#00bda9]/70 bg-[linear-gradient(135deg,#092b37_0%,#082335_52%,#07192b_100%)] p-4 sm:p-5">
                <div className="absolute -right-12 -top-28 h-64 w-64 rounded-full border border-[#00c9ad]/20 bg-[#00c9ad]/10" />
                 <div className="relative flex items-start justify-between"><div><div className="flex items-center gap-2 text-[12px] text-[#d5e7ef]">Wallet Balance <span className="text-[#5d89a6]">◉</span></div><p className="mt-1 text-[34px] font-bold leading-none tracking-[-.05em] sm:text-[38px]">{balanceLabel}</p><p className="mt-2 text-[12px] text-[#89a3b8]">Live account balance</p></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#00c9ad]/15 text-[#17ddc0]"><Wallet size={23} /></span></div>
                 <div className="relative mt-5 grid grid-cols-3 border-t border-white/10 pt-4">{[["Total Orders", ordersLoading ? "…" : ordersError ? "—" : String(orders.length), <FileText key="orders" size={17} />], ["Completed", ordersLoading ? "…" : ordersError ? "—" : String(completedOrders), <CheckCircle2 key="completed" size={17} />], ["Pending", ordersLoading ? "…" : ordersError ? "—" : String(openOrders), <Clock3 key="pending" size={17} />]].map(([label, value, icon], index) => <div key={String(label)} className={`flex items-start gap-2 px-2 first:pl-0 sm:px-4 ${index > 0 ? "border-l border-white/10" : ""}`}><span className={`hidden h-8 w-8 shrink-0 place-items-center rounded-lg sm:grid ${index === 0 ? "bg-[#0c79d3]/25 text-[#46a8ff]" : index === 1 ? "bg-[#8552d5]/30 text-[#b283ff]" : "bg-[#a26f10]/30 text-[#f4c133]"}`}>{icon}</span><span className="min-w-0"><span className="block truncate text-[10px] text-[#91a8c2]">{label}</span><span className="mt-1 block text-lg font-bold leading-none">{value}</span><span className={`mt-1 block truncate text-[9px] ${index === 2 ? "text-[#f4c133]" : "text-[#14d7b8]"}`}>{index === 2 ? "Open account orders" : "From your account"}</span></span></div>)}</div>
              </section>

              <section className="mt-4 rounded-2xl border border-[#153554] bg-[#081a2e] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-bold">Quick Actions</h2><button type="button" onClick={onStartUnlock} className="text-[11px] font-semibold text-[#16d9bd]">View all <ArrowRight className="ml-1 inline" size={13} /></button></div>
                <div className="flex gap-2 sm:gap-3">{[[<Smartphone size={20} />, "Check IMEI", "bg-[#00aa79]/60 text-[#6df2c4]", false], [<ShoppingCart size={20} />, "Place Order", "bg-[#075cc1] text-[#73b8ff]", true], [<CirclePlus size={20} />, "New Unlock", "bg-[#7f3fc1] text-[#dfaeff]", true], [<History size={20} />, "Order History", "bg-[#294679] text-[#b8d0ff]", false]].map(([icon, label, accent, active]) => <button type="button" key={String(label)} onClick={active ? onStartUnlock : undefined} className="group flex min-h-[96px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-[#1b3a5d] bg-[#091d34] px-1 py-3 text-center hover:border-[#00bda9]/70"><span className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}>{icon}</span><span className="text-[11px] font-semibold leading-tight text-[#d7e4f3]">{label}</span></button>)}</div>
              </section>

              <section className="mt-4 overflow-hidden rounded-2xl border border-[#153554] bg-[#081a2e]">
                 <div className="flex items-center justify-between border-b border-[#153554] px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-bold"><Clock3 size={17} className="text-[#14d7b8]" /> Recent Orders</h2><Link href="/account/orders" className="text-[11px] font-semibold text-[#16d9bd]">View all <ArrowRight className="ml-1 inline" size={13} /></Link></div>
                 <div className="divide-y divide-[#153554]">{ordersLoading ? <div className="px-4 py-8 text-center text-xs text-[#7891ac]">Loading your orders…</div> : ordersError ? <div className="px-4 py-8 text-center text-xs text-[#f4c133]">Your orders could not be loaded.</div> : orders.length === 0 ? <div className="px-4 py-8 text-center text-xs text-[#7891ac]">No orders found for this account.</div> : orders.slice(0, 5).map((order) => { const status = dashboardStatus(order.paymentStatus); const device = order.items?.[0]?.productName || (order.orderType === "unlock" ? "Direct Unlock" : `Order #${order.id}`); return <button type="button" key={order.id} onClick={() => navigate(`/account/orders#order-${order.id}`)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[.03] sm:px-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#122b48] text-[#b4d1ef]"><Smartphone size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-[#e5eef8]">{device}</span><span className="mt-0.5 block truncate font-mono text-[9px] text-[#708baa]">{order.deviceIdentifier || `Order #${order.id}`}</span></span><DashboardStatus status={status.label} tone={status.tone} /><span className="hidden w-12 text-right text-[9px] text-[#7891ac] sm:block">{orderAge(order.createdAt)}</span><ChevronRight size={14} className="text-[#56718f]" /></button>; })}</div>
                 <Link href="/account/orders" className="block border-t border-[#153554] px-4 py-3 text-[10px] font-bold text-[#16d9bd]">View all orders <ArrowRight className="ml-1 inline" size={12} /></Link>
              </section>
            </div>

            <aside className="hidden space-y-4 xl:block">
              <section className="rounded-2xl border border-[#00bda9]/70 bg-[linear-gradient(145deg,#092c37,#071b2b)] p-4"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#00c9ad]/15 text-[#20e0c3]"><Plus size={20} /></span><h2 className="mt-3 text-sm font-bold">New Unlock Request</h2><p className="mt-1 text-[10px] leading-5 text-[#93abc2]">Start a new phone unlocking order in just a few steps.</p><button type="button" onClick={onStartUnlock} className="mt-4 w-full rounded-lg bg-[#09cdb3] py-2.5 text-[11px] font-bold text-[#03202a]">Start Now <ArrowRight className="ml-1 inline" size={13} /></button></section>
              <section className="rounded-2xl border border-[#153554] bg-[#081a2e] p-4"><h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><span className="text-[#ffe140]">ϟ</span> Quick Actions</h2>{[["Check IMEI Status", true], ["View Order History", false], ["Add Funds", false], ["Contact Support", false]].map(([label, active]) => <button type="button" key={String(label)} onClick={active ? onStartUnlock : undefined} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left text-[11px] text-[#b4c6da] hover:text-white"><Search size={15} /><span className="flex-1">{label}</span><ChevronRight size={13} className="text-[#59728e]" /></button>)}</section>
               <section className="rounded-2xl border border-[#153554] bg-[#081a2e] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Your Balance</h2><Wallet size={17} className="text-[#14d7b8]" /></div><p className="mt-3 text-2xl font-bold">{balanceLabel}</p><button type="button" onClick={() => navigate("/account/wallet")} className="mt-3 w-full rounded-lg border border-[#126a6e] bg-[#07333d] py-2 text-[10px] font-bold text-[#18d5bb]">Manage Balance <ArrowRight className="ml-1 inline" size={12} /></button></section>
            </aside>
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[#153554] bg-[#061322]/95 px-2 py-2 backdrop-blur lg:hidden">
          <button type="button" className="flex min-w-14 flex-col items-center gap-1 text-[#16d9bd]"><Home size={19} /><span className="text-[9px] font-semibold">Home</span></button>
           <button type="button" onClick={() => navigate("/account/orders")} className="flex min-w-14 flex-col items-center gap-1 text-[#8aa1bc]"><FileText size={18} /><span className="text-[9px] font-semibold">Orders</span></button>
          <button type="button" onClick={onStartUnlock} className="-mt-6 grid h-14 w-14 place-items-center rounded-full border-4 border-[#061322] bg-[#09cdb3] text-[#03202a] shadow-[0_0_24px_rgba(9,205,179,.35)]"><Plus size={26} /></button>
           <button type="button" onClick={() => navigate("/account/wallet")} className="flex min-w-14 flex-col items-center gap-1 text-[#8aa1bc]"><Wallet size={18} /><span className="text-[9px] font-semibold">Wallet</span></button>
           <button type="button" onClick={() => navigate("/account/profile")} className="flex min-w-14 flex-col items-center gap-1 text-[#8aa1bc]"><UserRound size={18} /><span className="text-[9px] font-semibold">Profile</span></button>
        </nav>
      </div>
    </div>
  );
}

function AccountPill({ email }: { email: string }) {
  return (
    <div className="flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs text-white">
      <UserRound size={14} className="shrink-0 text-cyan-300" />
      <span className="truncate text-white/75">{email}</span>
      <span className="hidden shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 sm:inline">SIGNED IN</span>
    </div>
  );
}

function DeviceStage({ selected, onSelect }: { selected: Device | null; onSelect: (device: Device) => void }) {
  const brands = useMemo(() => DEVICE_CATALOG.map((brand) => brand.brand), []);
  const [brand, setBrand] = useState(brands[0]);
  const [search, setSearch] = useState("");
  const currentBrand = DEVICE_CATALOG.find((item) => item.brand === brand) ?? DEVICE_CATALOG[0];
  const devices = currentBrand.models.filter((model) => model.name.toLowerCase().includes(search.toLowerCase().trim()));
  const totalServices = DEVICE_CATALOG.reduce((total, item) => total + item.models.length, 0);

  return (
    <div className="space-y-4">
      <section className="relative min-h-[250px] overflow-hidden rounded-[18px] border border-[#19cbb6]/70 bg-[#071d2b] px-5 py-6 text-white shadow-[0_16px_36px_rgba(7,29,43,0.22)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_83%_15%,rgba(0,214,193,.28),transparent_25%),linear-gradient(120deg,transparent_45%,rgba(21,104,139,.18)_46%,transparent_65%)]" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#00c9ad]/15 blur-3xl" />
        <div className="relative z-10 max-w-[62%] sm:max-w-[54%] lg:max-w-[58%]">
          <p className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#53dfcf]"><ShieldCheck size={13} /> Direct unlock service desk</p>
          <h1 className="mt-3 text-[clamp(1.9rem,4vw,3rem)] font-black leading-[1.02] tracking-[-0.05em]">Choose your <span className="text-[#15d9c2]">device service</span></h1>
          <p className="mt-3 max-w-xl text-[11px] leading-5 text-slate-300 sm:text-xs">Select a brand and model to start. We will open the secure identifier form immediately, with the exact service price shown before you continue.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#00c9ad]/15 text-[#55e5d5]"><ShieldCheck size={15} /></span><span><b className="block text-xs font-black">{brands.length}+</b><small className="block text-[8px] uppercase tracking-wider text-slate-400">Brands</small></span></div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#00c9ad]/15 text-[#55e5d5]"><Zap size={15} /></span><span><b className="block text-xs font-black">{totalServices}+</b><small className="block text-[8px] uppercase tracking-wider text-slate-400">Services</small></span></div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#00c9ad]/15 text-[#55e5d5]"><Globe2 size={15} /></span><span><b className="block text-xs font-black">Live</b><small className="block text-[8px] uppercase tracking-wider text-slate-400">Catalog availability</small></span></div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-[-20px] right-[8%] hidden h-[215px] w-[280px] sm:block">
          <div className="absolute bottom-0 right-5 h-[205px] w-[96px] rotate-[10deg] rounded-[20px] border-2 border-slate-400/60 bg-[linear-gradient(145deg,#dbe8ed_0%,#607b8a_38%,#0a2531_100%)] shadow-2xl"><span className="absolute left-2 top-3 h-10 w-8 rounded-lg bg-slate-900/80 shadow-inner" /><span className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-white/40" /></div>
          <div className="absolute bottom-[-4px] right-[88px] z-10 h-[232px] w-[104px] rotate-[-3deg] rounded-[20px] border-2 border-slate-300/60 bg-[linear-gradient(145deg,#ecf2f5,#6e8997_42%,#112c39)] shadow-2xl"><span className="absolute left-2 top-3 h-11 w-9 rounded-lg bg-slate-900/90 shadow-inner" /><span className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-white/40" /></div>
          <div className="absolute bottom-[-28px] right-[166px] z-20 h-[220px] w-[100px] rotate-[-15deg] rounded-[20px] border-2 border-slate-300/70 bg-[linear-gradient(145deg,#dae4ea,#8399a4_42%,#152d39)] shadow-2xl"><span className="absolute left-2 top-3 h-10 w-8 rounded-lg bg-slate-900/90 shadow-inner" /><span className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-white/40" /></div>
          <div className="absolute right-[-4px] top-20 h-px w-20 bg-[#00e7d1] shadow-[0_0_16px_#00e7d1]" /><span className="absolute right-0 top-[72px] font-mono text-[9px] font-bold uppercase tracking-widest text-[#52e9d7]">Fast<br />Secure<br />Reliable</span>
        </div>
      </section>

      <section className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.07)] sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3">
          {brands.map((item) => {
            const active = brand === item;
            const count = DEVICE_CATALOG.find((entry) => entry.brand === item)?.models.length ?? 0;
            return <button type="button" key={item} onClick={() => { setBrand(item); setSearch(""); }} className={`flex min-w-[88px] items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[10px] font-bold transition-all sm:min-w-[104px] ${active ? "border-[#00bda9] bg-[#e8fbf8] text-[#007c89] shadow-sm" : "border-slate-100 bg-white text-slate-500 hover:border-[#b8ebe4] hover:text-[#007c89]"}`}><span className={`grid h-6 w-6 place-items-center rounded-md text-[8px] font-black ${active ? "bg-[#00bda9] text-white" : "bg-slate-100 text-slate-400"}`}>{item.slice(0, 2).toUpperCase()}</span><span className="truncate">{item.split(" /")[0]}</span><span className="hidden font-mono text-[9px] opacity-60 sm:inline">{count}</span></button>;
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"><Search size={15} className="shrink-0 text-[#008b99]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${currentBrand.brand} models...`} className="min-w-0 flex-1 bg-transparent text-[11px] font-medium text-slate-800 outline-none placeholder:text-slate-400" /><span className="font-mono text-[9px] text-slate-400">{devices.length} results</span></div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-bold text-slate-500 sm:min-w-[140px]"><span>{currentBrand.brand} models</span><span className="rounded-full bg-[#e8fbf8] px-2 py-0.5 font-mono text-[9px] text-[#007c89]">{devices.length}</span></div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-sm font-black text-slate-900">Select a model</p><p className="mt-1 text-[10px] text-slate-500">Models are listed as tabs. Select one to open the identifier form.</p></div><span className="hidden items-center gap-1.5 text-[10px] font-bold text-[#008b99] sm:flex"><Circle size={8} fill="currentColor" /> Live services</span></div>
        <div className="mt-3 overflow-x-auto pb-1">
          {devices.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Search size={21} className="mx-auto text-slate-400" /><p className="mt-3 text-sm font-bold text-slate-700">No matching services</p><p className="mt-1 text-xs text-slate-500">Try a different model name or clear the search.</p></div> : <div className="flex min-w-max gap-2">
            {devices.map((model) => {
              const device = { brand: currentBrand.brand, model: model.name, price: model.price };
              const isSelected = selected?.brand === device.brand && selected.model === device.model;
              return <button type="button" key={model.name} onClick={() => onSelect(device)} className={`group flex min-w-[180px] max-w-[235px] flex-col gap-2 rounded-xl border px-3 py-3 text-left transition-all sm:min-w-[205px] ${isSelected ? "border-[#00bda9] bg-[#edfcf9] shadow-[0_8px_18px_rgba(0,189,169,0.12)]" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#8edfd5] hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)]"}`}><span className="flex items-start justify-between gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${isSelected ? "bg-[#00bda9] text-white" : "bg-slate-100 text-slate-500 group-hover:bg-[#e8fbf8] group-hover:text-[#008b99]"}`}><Smartphone size={14} /></span><ChevronRight size={14} className={isSelected ? "mt-1 text-[#008b99]" : "mt-1 text-slate-300 group-hover:text-[#008b99]"} /></span><span className="min-h-[30px] text-[11px] font-black leading-4 text-slate-800">{model.name}</span><span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600"><CheckCircle2 size={11} /> Verified service</span><span className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2"><span className="truncate text-[8px] font-medium text-slate-400">Network unlock · All regions</span><span className="shrink-0 rounded-full bg-[#e2faf5] px-2 py-1 font-mono text-[9px] font-black text-[#007c89]">{money(model.price)}</span></span></button>;
            })}
          </div>}
        </div>
        <div className="mt-5 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Select a model to continue</span><div className="h-px flex-1 bg-slate-200" /></div>
      </section>
    </div>
  );
}

function DetailsStage({ device, identifier, accountEmail, setIdentifier, onBack, onContinue }: { device: Device; identifier: string; accountEmail: string; setIdentifier: (value: string) => void; onBack: () => void; onContinue: () => void }) {
  const [touched, setTouched] = useState(false);
  const identifierOk = validIdentifier(identifier);
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mono mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-primary">Step 02 / device identifier</p>
      <h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">Tell us which device is yours.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Enter the IMEI or serial number for the selected device. We use it to validate the request before showing payment options.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Selected service</span>
          <p className="mt-2 text-sm font-bold">{device.model}</p>
          <p className="mt-1 text-xs text-muted-foreground">{device.brand}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:min-w-[150px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price</span>
          <p className="mono mt-2 text-2xl font-bold">{money(device.price)}</p>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="mb-2 block text-sm font-bold">IMEI or serial number</span>
        <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} onBlur={() => setTouched(true)} autoFocus placeholder="15-digit IMEI or device serial" className={`h-14 w-full rounded-xl border bg-card px-4 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 ${touched && !identifierOk ? "border-destructive" : "border-input"}`} />
        {touched && !identifierOk ? <span className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><AlertCircle size={13} /> Enter a valid 15-digit IMEI or a serial number with at least 6 characters.</span> : <span className="mt-2 block text-xs leading-5 text-muted-foreground">Find your IMEI by dialing *#06# or in Settings → About. iPad and supported devices can use a serial number.</span>}
      </label>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Mail size={16} /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold">Unlock details will go to your account</p>
          <p className="mt-1 truncate text-sm text-primary">{accountEmail}</p>
          <p className="mt-1 text-xs text-muted-foreground">You are signed in. There is no need to enter your email again.</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-border pt-6 sm:flex-row">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Change device</button>
        <button type="button" disabled={!identifierOk} onClick={onContinue} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">Run device checks <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function ProcessingStage({ device, identifier, onDone }: { device: Device; identifier: string; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const progress = Math.min(100, Math.round((elapsed / PREPARATION_MS) * 100));
  const completed = Math.min(PREPARATION_STEPS.length, Math.floor((progress / 100) * PREPARATION_STEPS.length));
  const activeIndex = Math.min(PREPARATION_STEPS.length - 1, completed);
  const remaining = Math.max(0, Math.ceil((PREPARATION_MS - elapsed) / 1000));
  const remainingLabel = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const next = Math.min(PREPARATION_MS, Date.now() - started);
      setElapsed(next);
      if (next >= PREPARATION_MS) {
        window.clearInterval(timer);
        onDone();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [onDone]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#008b99]">REMOTE UNLOCK SERVER / LIVE JOB</p>
          <h1 className="text-2xl font-black tracking-tight text-[#1a2332] sm:text-3xl">Verifying device eligibility</h1>
          <p className="mt-2 text-sm text-gray-500">The service request is being prepared for <strong className="text-gray-800">{device.model}</strong>. Payment appears after this server check completes.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 sm:self-auto">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> SERVER CHECK IN PROGRESS
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(250px,.55fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#26344b] bg-[#111827] shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#1a2332] px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white"><span className="h-2 w-2 rounded-full bg-emerald-400" /> GSM remote queue</div>
            <span className="font-mono text-[10px] text-white/45">JOB / {identifier.slice(-6).toUpperCase()}</span>
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div><p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300/70">Current operation</p><p className="mt-2 text-lg font-bold text-white">{PREPARATION_STEPS[activeIndex].title}</p><p className="mt-1 max-w-md text-xs leading-5 text-white/55">{PREPARATION_STEPS[activeIndex].detail}</p></div>
              <div className="text-right"><p className="font-mono text-3xl font-black text-cyan-300">{remainingLabel}</p><p className="font-mono text-[9px] uppercase tracking-widest text-white/40">remaining</p></div>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-white/45"><span>{progress}% complete</span><span>minimum verification time 05:00</span></div>

            <div className="mt-7 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40"><span className="text-emerald-400">$</span> server activity</div>
              <div className="space-y-2 font-mono text-[11px] leading-5">
                <p className="text-emerald-300/80">[00:00:00] connection established · secure queue online</p>
                {PREPARATION_STEPS.map((step, index) => {
                  const done = index < completed;
                  const active = index === activeIndex;
                  return <p key={step.code} className={done ? "text-emerald-300" : active ? "text-cyan-300" : "text-white/25"}>{`[${step.code}] ${done ? `✓ ${step.log}` : active ? `> ${step.detail}` : "waiting for previous operation"}`}{active && <span className="ml-1 animate-pulse">▌</span>}</p>;
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500"><Smartphone size={15} className="text-[#008b99]" /> Job details</div>
          <div className="mt-5 rounded-xl bg-gray-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Device</p>
            <p className="mt-2 text-sm font-black text-gray-800">{device.model}</p>
            <p className="mt-1 text-xs text-gray-500">{device.brand} direct unlock</p>
          </div>
          <div className="mt-3 space-y-3 border-b border-gray-100 pb-4 text-xs">
            <div className="flex justify-between gap-3"><span className="text-gray-400">Identifier</span><span className="font-mono text-gray-700">{identifier.slice(0, 4)}••••{identifier.slice(-4)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-gray-400">Service price</span><span className="font-mono font-bold text-gray-800">{money(device.price)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-gray-400">Account</span><span className="max-w-[140px] truncate text-gray-700">signed in</span></div>
          </div>
          <div className="mt-4 space-y-3">
            {PREPARATION_STEPS.map((step, index) => {
              const done = index < completed;
              const active = index === activeIndex;
              return <div key={step.code} className="flex items-center gap-3"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-100 text-emerald-600" : active ? "border-2 border-cyan-500 text-cyan-600" : "border border-gray-200 text-gray-300"}`}>{done ? <Check size={12} /> : active ? <RefreshCw size={11} className="animate-spin" /> : <Circle size={8} />}</span><span className={`text-xs font-semibold ${done || active ? "text-gray-700" : "text-gray-400"}`}>{step.title}</span></div>;
            })}
          </div>
        </aside>
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-700"><Clock3 size={15} className="mt-0.5 shrink-0" /><span><strong>Why five minutes?</strong> Remote unlock providers need a verification window before they return the eligible service options. Keep this page open; the payment screen will open automatically when the job is ready.</span></div>
    </div>
  );
}

function PaymentStage({ device, accountEmail, onBack, onSubmit, submitting, error }: { device: Device; accountEmail: string; onBack: () => void; onSubmit: (method: PaymentMethod, value?: string) => void; submitting: boolean; error: string | null }) {
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
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mono mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-primary">Step 04 / payment</p>
      <h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">Choose how to pay.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Your request is ready. Pay the quoted amount below and the unlock details will be sent to your signed-in account.</p>
      <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><span className="text-[10px] font-bold uppercase tracking-wider text-primary">Direct unlock request</span><p className="mt-2 text-sm font-bold">{device.brand} · {device.model}</p><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Mail size={13} /> {accountEmail}</p></div>
        <span className="mono text-3xl font-bold">{money(device.price)}</span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {methods.map((item) => <button type="button" key={item.id} disabled={item.id === "nowpayments" && cryptoDisabled} onClick={() => setMethod(item.id)} className={`flex min-h-[92px] items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${item.id === "nowpayments" && cryptoDisabled ? "cursor-not-allowed opacity-50" : method === item.id ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card hover:border-primary/50"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${method === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>{item.icon}</span><span><span className="block text-sm font-bold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span></span>{method === item.id && <Check className="ml-auto shrink-0 text-primary" size={17} />}</button>)}
      </div>
      {method === "mpesa" && <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">M-Pesa phone number</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="2547XXXXXXXX" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>}
      {method === "nowpayments" && <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">Cryptocurrency</span><select value={currency} onChange={(event) => setCurrency(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="usdttrc20">USDT (TRC20)</option><option value="usdterc20">USDT (ERC20)</option><option value="btc">Bitcoin</option><option value="eth">Ethereum</option><option value="ltc">Litecoin</option></select></label>}
      {error && <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle size={17} className="mt-0.5 shrink-0" /> {error}</p>}
      <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-border pt-6 sm:flex-row"><button type="button" onClick={onBack} disabled={submitting} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to checks</button><button type="button" onClick={() => onSubmit(method, method === "mpesa" ? phone : method === "nowpayments" ? currency : undefined)} disabled={submitting || (method === "mpesa" && !phone.trim())} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{submitting ? "Starting payment…" : `Pay ${money(device.price)}`} {!submitting && <ArrowRight size={16} />}</button></div>
    </div>
  );
}

function PendingStage({ device, accountEmail, identifier, progress, confirmed, onReset }: { device: Device; accountEmail: string; identifier: string; progress: Progress; confirmed: boolean; onReset: () => void }) {
  const reference = `GSM-${progress.orderId || identifier.slice(-6).toUpperCase()}`;
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${confirmed ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>{confirmed ? <Check size={31} /> : <RefreshCw size={27} className="animate-spin" />}</span>
      <p className="mono mt-6 text-[11px] font-bold uppercase tracking-[.18em] text-primary">{confirmed ? "Payment confirmed" : "Payment started"}</p>
      <h1 className="display-font mt-3 text-[clamp(2rem,5vw,3.3rem)] font-bold leading-[.98] tracking-[-.06em]">{confirmed ? <>Payment confirmed.<br />We&apos;re finishing your unlock.</> : <>Complete payment<br />to finish your request.</>}</h1>
      <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground">{confirmed ? <>Your payment is confirmed. We&apos;ll send the unlock details for <strong className="text-foreground">{device.model}</strong> to <strong className="text-foreground">{accountEmail}</strong>.</> : <>Your request is reserved for <strong className="text-foreground">{accountEmail}</strong>. Once payment is confirmed, we&apos;ll send the unlock details there.</>}</p>
      {!confirmed && progress.kind === "mpesa" && <div className="mx-auto mt-7 rounded-2xl border border-primary/25 bg-primary/5 p-5 text-left"><p className="text-sm font-bold">Check your phone</p><p className="mt-2 text-xs leading-5 text-muted-foreground">An M-Pesa STK push was sent. Enter your PIN; this page checks for confirmation automatically.</p></div>}
      {!confirmed && progress.kind === "crypto" && <div className="mx-auto mt-7 rounded-2xl border border-primary/25 bg-primary/5 p-5 text-left"><p className="text-sm font-bold">Send {progress.amount} {progress.currency.toUpperCase()}</p><div className="mt-3 flex items-center gap-2 rounded-lg bg-card p-3"><span className="min-w-0 flex-1 break-all font-mono text-[11px] text-muted-foreground">{progress.address}</span><button type="button" onClick={() => void navigator.clipboard?.writeText(progress.address)} className="shrink-0 rounded-md p-2 text-primary hover:bg-secondary"><Copy size={14} /></button></div></div>}
      {!confirmed && progress.kind === "manual" && <div className="mx-auto mt-7 rounded-2xl border border-[#e9cda5] bg-[#fff5e5] p-5 text-left text-xs leading-5 text-[#704a22]"><p className="font-bold">{progress.method === "binance_pay" ? "Binance Pay instructions" : "USDT TRC20 instructions"}</p><p className="mt-2">{progress.method === "binance_pay" ? `Send ${money(device.price)} to Binance ID ${progress.binancePayId || "the payment ID in your email"}.` : `Send ${money(device.price)} to ${progress.usdtAddress || "the USDT address in your email"} on ${progress.usdtNetwork || "TRC20"}.`}</p><p className="mt-2">Include <strong>{reference}</strong> as the payment reference.</p></div>}
      <div className="mx-auto mt-7 rounded-2xl border border-border bg-card p-5 text-left"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Request reference</span><button type="button" onClick={() => void navigator.clipboard?.writeText(reference)} className="flex items-center gap-1 text-xs font-bold text-primary"><Copy size={13} /> Copy</button></div><p className="mono mt-2 text-lg">{reference}</p><div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs"><span><span className="block text-muted-foreground">Device</span><strong className="mt-1 block">{device.model}</strong></span><span><span className="block text-muted-foreground">Amount</span><strong className="mono mt-1 block">{money(device.price)}</strong></span></div></div>
      {!confirmed && <div className="mx-auto mt-5 flex max-w-lg items-start gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-left text-xs leading-5 text-muted-foreground"><Clock3 size={16} className="mt-0.5 shrink-0 text-primary" /><span><strong className="text-foreground">Payment still needs confirmation.</strong> We&apos;ll email your unlock details automatically after confirmation.</span></div>}
      <button type="button" onClick={onReset} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold hover:border-primary"><RefreshCw size={16} /> Start another unlock</button>
    </div>
  );
}

export function DirectUnlockRemotePage() {
  const { user, token, isAuthenticated } = useAuth();
  const [stage, setStage] = useState<Stage>("dashboard");
  const [device, setDevice] = useState<Device | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountEmail = user?.email ?? "";
  const accountName = user?.name || accountEmail.split("@")[0] || "Account";

  useEffect(() => {
    if (stage !== "pending" || !progress || progress.kind === "manual" || confirmed) return;
    const interval = window.setInterval(async () => {
      const endpoint = progress.kind === "mpesa" ? "/api/payments/mpesa/query" : "/api/payments/nowpayments/query";
      const body = progress.kind === "mpesa" ? { orderId: progress.orderId, checkoutRequestId: progress.checkoutRequestId } : { orderId: progress.orderId, paymentId: progress.paymentId };
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
        const result = await response.json() as { paymentStatus?: string };
        if (result.paymentStatus === "paid") { setConfirmed(true); window.clearInterval(interval); }
        if (result.paymentStatus === "failed") { setError("Payment was not completed. Start again or choose another payment method."); window.clearInterval(interval); }
      } catch { /* retry on the next interval */ }
    }, progress.kind === "mpesa" ? 5000 : 30000);
    return () => window.clearInterval(interval);
  }, [stage, progress, confirmed, token]);

  const reset = () => { setStage("dashboard"); setDevice(null); setIdentifier(""); setProgress(null); setConfirmed(false); setError(null); };
  const submitPayment = async (method: PaymentMethod, value?: string) => {
    if (!device || !user) return;
    setSubmitting(true);
    setError(null);
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    try {
      const response = await fetch("/api/orders", { method: "POST", headers, body: JSON.stringify({
        sessionId: `direct-unlock-${Date.now()}`, customerEmail: accountEmail, customerName: user.name, paymentMethod: method,
        paymentStatus: method === "binance_pay" || method === "usdt_manual" ? "pending_payment_confirmation" : "pending",
        total: device.price.toFixed(2), currency: "USD", deviceIdentifier: identifier.trim(), orderType: "unlock",
        notes: `Direct unlock request for ${device.brand} ${device.model}. Identifier: ${identifier.trim()}`,
        items: [{ productId: 0, productName: `${device.brand} Direct Unlock — ${device.model}`, price: device.price.toFixed(2), quantity: 1 }],
      }) });
      const order = await response.json() as OrderResponse;
      if (!response.ok || !order.id) throw new Error(order.error || "We could not create your unlock request.");
      if (method === "mpesa") {
        const triggerResponse = await fetch(`/api/orders/${order.id}/mpesa/trigger`, { method: "POST", headers, body: JSON.stringify({ phone: value }) });
        const trigger = await triggerResponse.json() as { checkoutRequestId?: string; error?: string };
        if (!triggerResponse.ok || !trigger.checkoutRequestId) throw new Error(trigger.error || "We could not start the M-Pesa payment.");
        setProgress({ kind: "mpesa", orderId: order.id, checkoutRequestId: trigger.checkoutRequestId });
      } else if (method === "nowpayments") {
        const cryptoResponse = await fetch(`/api/orders/${order.id}/nowpayments/generate`, { method: "POST", headers, body: JSON.stringify({ payCurrency: value }) });
        const crypto = await cryptoResponse.json() as { paymentId?: string; payAddress?: string; payAmount?: number; payCurrency?: string; error?: string };
        if (!cryptoResponse.ok || !crypto.paymentId || !crypto.payAddress || !crypto.payAmount || !crypto.payCurrency) throw new Error(crypto.error || "We could not create the crypto payment.");
        setProgress({ kind: "crypto", orderId: order.id, paymentId: crypto.paymentId, address: crypto.payAddress, amount: crypto.payAmount, currency: crypto.payCurrency });
      } else {
        const configResponse = await fetch("/api/payment-config", { headers });
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

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[100dvh] bg-gray-50">
        <main className="mx-auto flex min-h-[70dvh] max-w-xl items-center justify-center px-5 py-12">
          <div className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><LockKeyhole size={25} /></span>
            <p className="mono mt-5 text-[11px] font-bold uppercase tracking-[.18em] text-primary">Account required</p>
            <h1 className="display-font mt-3 text-3xl font-bold tracking-[-.04em]">Sign in to start an unlock.</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Your unlock request and delivery email are linked to your account, so you won&apos;t need to enter your email separately.</p>
            <Link href="/login" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground">Sign in <ArrowRight size={16} /></Link>
          </div>
        </main>
      </div>
    );
  }

  if (stage === "dashboard") {
     return <DashboardEntry accountName={accountName} token={token} onStartUnlock={() => setStage("device")} />;
  }

  return (
    <div className="min-h-[100dvh] bg-[#071522]">
      <header className="border-b border-white/10 bg-[#071522] text-white">
        <div className="mx-auto flex min-h-[62px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-7">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl border border-[#00c9ad]/50 bg-[#00c9ad]/10 text-[#2de1c9]"><LockKeyhole size={19} /></span><div><p className="text-sm font-black tracking-tight sm:text-base">GSM <span className="text-[#16d9bd]">WORLD</span></p><p className="hidden text-[8px] font-semibold tracking-wide text-slate-400 sm:block">Global Unlock Services</p></div></div>
          <nav className="hidden items-center gap-7 text-[10px] font-semibold text-slate-300 md:flex"><Link href="/" className="hover:text-white">Home</Link><Link href="/direct-unlock" className="border-b-2 border-[#16d9bd] pb-2 text-[#16d9bd]">Services</Link><Link href="/orders/lookup" className="hover:text-white">Track Order</Link><Link href="/account" className="hover:text-white">Support</Link></nav>
          <AccountPill email={accountEmail} />
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 pb-10 pt-4 sm:px-7 sm:pt-6">
        <div className="mb-3 flex flex-col justify-between gap-3 rounded-[10px] border border-[#1daca9]/50 bg-[linear-gradient(105deg,#0b3e4b_0%,#0a3944_55%,#06313d_100%)] px-4 py-3 text-white shadow-[0_8px_24px_rgba(0,201,173,0.08)] sm:flex-row sm:items-center sm:px-5">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#16e2c4] text-[#06313d]"><CirclePlus size={17} /></span><div className="min-w-0"><p className="text-[10px] font-black text-[#71f0df]">Account-linked unlock request</p><p className="truncate text-[10px] text-slate-200">Hello, {accountName}. Your unlock details will be delivered to {accountEmail}.</p></div></div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#4ae4d1]/30 bg-white/5 px-2.5 py-1.5 text-[9px] font-bold text-[#b5f7ef]"><Mail size={12} /> No email re-entry</span>
        </div>
        <StageHeader stage={stage} />
        <div className="rounded-[20px] border border-slate-200/80 bg-[#f5f8fa] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.14)] sm:p-5 lg:p-6">
          {stage === "device" && <DeviceStage selected={device} onSelect={(nextDevice) => { setDevice(nextDevice); setStage("details"); }} />}
          {stage === "details" && device && <DetailsStage device={device} identifier={identifier} accountEmail={accountEmail} setIdentifier={setIdentifier} onBack={() => setStage("device")} onContinue={() => setStage("processing")} />}
          {stage === "processing" && device && <ProcessingStage device={device} identifier={identifier} onDone={() => setStage("payment")} />}
          {stage === "payment" && device && <PaymentStage device={device} accountEmail={accountEmail} onBack={() => setStage("processing")} onSubmit={submitPayment} submitting={submitting} error={error} />}
          {stage === "pending" && device && progress && <PendingStage device={device} accountEmail={accountEmail} identifier={identifier} progress={progress} confirmed={confirmed} onReset={reset} />}
        </div>
      </main>
    </div>
  );
}