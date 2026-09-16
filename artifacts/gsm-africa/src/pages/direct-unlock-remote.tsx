import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  Globe2,
  ListChecks,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { DEVICE_CATALOG } from "@/pages/direct-unlock";
import { useAuth } from "@/hooks/use-auth";

type Stage = "device" | "details" | "processing" | "payment" | "pending";
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

const PREPARATION_MS = 5 * 60 * 1000;
const PREPARATION_STEPS = [
  { code: "IMEI", title: "Validate identifier", detail: "Checking the IMEI checksum or serial format you entered.", log: "Identifier format and checksum accepted" },
  { code: "MODEL", title: "Match device service", detail: "Confirming the device family and the quoted unlock price.", log: "Device profile matched to selected service" },
  { code: "AUTH", title: "Prepare unlock request", detail: "Creating a request linked to your signed-in account.", log: "Account-linked request prepared for remote queue" },
  { code: "PAY", title: "Open payment options", detail: "M-Pesa and crypto payment choices will be available next.", log: "Payment session ready — awaiting customer selection" },
];
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

function StageHeader({ stage }: { stage: Stage }) {
  const labels = ["Device", "IMEI / serial", "Checks", "Payment"];
  const index = stage === "pending" ? 4 : ["device", "details", "processing", "payment"].indexOf(stage);
  return (
    <div className="mb-5 flex items-start rounded-2xl border border-gray-200 bg-white px-3 py-4 shadow-sm sm:px-5">
      {labels.map((label, itemIndex) => (
        <div key={label} className="flex flex-1 items-start last:flex-none">
          <div className="flex w-24 shrink-0 flex-col items-center gap-2 text-center">
            <span className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-bold transition-colors ${itemIndex < index ? "border-[#1a2332] bg-[#1a2332] text-white" : itemIndex === index ? "border-[#0097a7] bg-[#e6f7f8] text-[#007c89]" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
              {itemIndex < index ? <Check size={15} /> : itemIndex + 1}
            </span>
            <span className={`text-[10px] font-semibold ${itemIndex <= index ? "text-gray-800" : "text-gray-400"}`}>{label}</span>
          </div>
          {itemIndex < labels.length - 1 && <span className={`mt-4 h-px flex-1 ${itemIndex < index ? "bg-[#1a2332]" : "bg-gray-200"}`} />}
        </div>
      ))}
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

function DeviceStage({ selected, onSelect, onContinue }: { selected: Device | null; onSelect: (device: Device) => void; onContinue: () => void }) {
  const brands = useMemo(() => DEVICE_CATALOG.map((brand) => brand.brand), []);
  const [brand, setBrand] = useState(brands[0]);
  const [search, setSearch] = useState("");
  const currentBrand = DEVICE_CATALOG.find((item) => item.brand === brand) ?? DEVICE_CATALOG[0];
  const devices = currentBrand.models.filter((model) => model.name.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <p className="mono mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-primary">Step 01 / choose device</p>
          <h1 className="display-font text-[clamp(2rem,5vw,3.7rem)] font-bold leading-[.98] tracking-[-.06em]">Select the exact device.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Choose the service that matches your device. The full catalog and price are shown before you enter the IMEI or serial number.</p>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <Search size={17} className="shrink-0 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${currentBrand.brand} models`} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            <span className="mono shrink-0 text-[10px] text-muted-foreground">{devices.length} models</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {brands.map((item) => (
              <button type="button" key={item} onClick={() => { setBrand(item); setSearch(""); }} className={`rounded-xl border px-3 py-3 text-left text-xs font-bold transition-colors ${brand === item ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {devices.map((model) => {
              const device = { brand: currentBrand.brand, model: model.name, price: model.price };
              const isSelected = selected?.brand === device.brand && selected.model === device.model;
              return (
                <button type="button" key={model.name} onClick={() => onSelect(device)} className={`group flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-sm"}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}><Smartphone size={18} /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-5">{model.name}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{currentBrand.brand} service</span>
                    </span>
                  </span>
                  <span className="mono shrink-0 text-sm font-bold">{money(model.price)}</span>
                </button>
              );
            })}
          </div>
          {!devices.length && <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No models match “{search}”. Try another search.</div>}
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><ListChecks size={15} className="text-primary" /> Request summary</div>
          <div className="mt-5 rounded-xl bg-secondary/70 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected service</span>
            <p className="mt-2 text-sm font-bold leading-5">{selected?.model ?? "Choose a device"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selected?.brand ?? "Your selection will appear here"}</p>
            <p className="mono mt-4 text-2xl font-bold text-primary">{selected ? money(selected.price) : "—"}</p>
          </div>
          <div className="mt-5 space-y-3 text-xs text-muted-foreground">
            <p className="flex gap-2"><CheckCircle2 size={15} className="shrink-0 text-primary" /> Full device catalog and price shown</p>
            <p className="flex gap-2"><CheckCircle2 size={15} className="shrink-0 text-primary" /> IMEI or serial number required</p>
            <p className="flex gap-2"><CheckCircle2 size={15} className="shrink-0 text-primary" /> Unlock details sent to your account</p>
          </div>
          <button type="button" disabled={!selected} onClick={onContinue} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40">Continue <ArrowRight size={16} /></button>
        </aside>
      </div>
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
  const [stage, setStage] = useState<Stage>("device");
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

  const reset = () => { setStage("device"); setDevice(null); setIdentifier(""); setProgress(null); setConfirmed(false); setError(null); };
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

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <header className="bg-[#1a2332] text-white shadow-md">
        <div className="mx-auto flex min-h-[76px] max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
          <div><p className="text-lg font-black tracking-tight">GSM World</p><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-white/45">Direct unlock server</p></div>
          <AccountPill email={accountEmail} />
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div><p className="flex items-center gap-2 text-xs font-bold text-[#008b99]"><ShieldCheck size={15} /> Account-linked unlock request</p><p className="mt-1 text-xs text-gray-500">Hello, {accountName}. Your unlock details will be delivered to {accountEmail}.</p></div>
          <span className="hidden items-center gap-2 text-xs text-gray-500 sm:flex"><LockKeyhole size={14} /> No email re-entry</span>
        </div>
        <StageHeader stage={stage} />
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
          {stage === "device" && <DeviceStage selected={device} onSelect={setDevice} onContinue={() => setStage("details")} />}
          {stage === "details" && device && <DetailsStage device={device} identifier={identifier} accountEmail={accountEmail} setIdentifier={setIdentifier} onBack={() => setStage("device")} onContinue={() => setStage("processing")} />}
          {stage === "processing" && device && <ProcessingStage device={device} identifier={identifier} onDone={() => setStage("payment")} />}
          {stage === "payment" && device && <PaymentStage device={device} accountEmail={accountEmail} onBack={() => setStage("processing")} onSubmit={submitPayment} submitting={submitting} error={error} />}
          {stage === "pending" && device && progress && <PendingStage device={device} accountEmail={accountEmail} identifier={identifier} progress={progress} confirmed={confirmed} onReset={reset} />}
        </div>
      </main>
    </div>
  );
}