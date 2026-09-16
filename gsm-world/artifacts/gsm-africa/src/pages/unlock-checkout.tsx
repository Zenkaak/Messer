import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  CreditCard,
  FileDigit,
  Globe2,
  Mail,
  Menu,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";

type Brand = "Apple" | "Samsung" | "Google" | "Xiaomi" | "Huawei";
type FlowStage = "device" | "details" | "processing" | "payment" | "pending";
type Device = {
  id: string;
  brand: Brand;
  model: string;
  price: number;
  series: string;
};

const catalog: Device[] = [
  { id: "iphone-15", brand: "Apple", model: "iPhone 15 / 15 Pro", series: "A16 / A17 Pro", price: 39.99 },
  { id: "iphone-13", brand: "Apple", model: "iPhone 13 / 13 Pro", series: "A15 Bionic", price: 34.99 },
  { id: "s24", brand: "Samsung", model: "Galaxy S24 / S24 Ultra", series: "Galaxy S series", price: 44.99 },
  { id: "a54", brand: "Samsung", model: "Galaxy A54 5G", series: "Galaxy A series", price: 29.99 },
  { id: "pixel-8", brand: "Google", model: "Pixel 8 / 8 Pro", series: "Tensor G3", price: 39.99 },
  { id: "redmi-note", brand: "Xiaomi", model: "Redmi Note 12", series: "Redmi Note series", price: 24.99 },
  { id: "p30", brand: "Huawei", model: "P30 / P30 Pro", series: "P series", price: 27.99 },
];

const stages: { id: FlowStage; label: string }[] = [
  { id: "device", label: "Choose device" },
  { id: "details", label: "Device details" },
  { id: "processing", label: "Check request" },
  { id: "payment", label: "Payment" },
];

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`;
}

function isValidIdentifier(value: string) {
  const clean = value.replace(/[\s-]/g, "");
  if (/^\d{15}$/.test(clean)) {
    let sum = 0;
    for (let i = 0; i < clean.length; i += 1) {
      let digit = Number(clean[i]);
      if ((clean.length - i) % 2 === 0) digit *= 2;
      if (digit > 9) digit -= 9;
      sum += digit;
    }
    return sum % 10 === 0;
  }
  return /^[a-z0-9]{6,24}$/i.test(clean);
}

function BrandGlyph({ brand }: { brand: Brand }) {
  return (
    <span className="mono text-[11px] font-medium tracking-[-.04em]">
      {brand === "Apple" ? "A" : brand === "Samsung" ? "S" : brand === "Google" ? "G" : brand === "Xiaomi" ? "Mi" : "H"}
    </span>
  );
}

function Header({ onReset }: { onReset: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="topbar sticky top-0 z-20">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <button type="button" className="flex items-center gap-3 text-left" onClick={onReset}>
          <span className="brand-mark"><Zap size={18} strokeWidth={2.5} /></span>
          <span><span className="display-font block text-[17px] font-bold tracking-[-.04em]">GSM World</span><span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Device service desk</span></span>
        </button>
        <div className="hidden items-center gap-8 md:flex">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck size={15} className="text-primary" /> Secure remote service</span>
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><MessageCircle size={15} className="text-primary" /> Support available</span>
          <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={onReset}>Start over</button>
        </div>
        <button type="button" aria-label="Open menu" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden" onClick={() => setMenuOpen((value) => !value)}><Menu size={20} /></button>
      </div>
      {menuOpen && <div className="border-t border-border bg-card px-5 py-4 md:hidden"><button type="button" className="flex w-full items-center gap-2 text-sm font-semibold text-primary" onClick={() => { onReset(); setMenuOpen(false); }}><RefreshCw size={15} /> Start over</button></div>}
    </header>
  );
}

function Progress({ stage }: { stage: FlowStage }) {
  const currentIndex = stage === "pending" ? 4 : stages.findIndex((item) => item.id === stage);
  return (
    <div className="mb-8 flex items-start justify-between">
      {stages.map((item, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return <div className="relative flex flex-1 flex-col items-center gap-2 text-center" key={item.id}>
          {index < stages.length - 1 && <span className={`absolute left-1/2 top-[15px] h-px w-full ${done ? "bg-primary" : "bg-border"}`} />}
          <span className={`relative z-[1] grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${done ? "step-done border-primary" : current ? "step-current border-primary bg-card text-primary" : "border-border bg-card text-muted-foreground"}`}>{done ? <Check size={15} /> : index + 1}</span>
          <span className={`hidden text-[11px] font-semibold sm:block ${current || done ? "step-active" : "text-muted-foreground"}`}>{item.label}</span>
        </div>;
      })}
    </div>
  );
}

function DeviceSelection({ selected, onSelect, onContinue }: { selected: Device | null; onSelect: (device: Device) => void; onContinue: () => void }) {
  const [brand, setBrand] = useState<Brand>("Apple");
  const brands = useMemo(() => Array.from(new Set(catalog.map((item) => item.brand))), []);
  const devices = catalog.filter((item) => item.brand === brand);
  return <div className="fade-swap">
    <div className="mb-7">
      <p className="mono mb-3 text-[11px] font-medium uppercase tracking-[.16em] text-primary">Step 01 / device</p>
      <h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">Tell us what you&apos;re unlocking.</h1>
      <p className="mt-4 max-w-[590px] text-[15px] leading-7 text-muted-foreground">Choose the phone that needs a remote unlock. We&apos;ll show the exact service price before you enter anything else.</p>
    </div>
    <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
      {brands.map((item) => <button type="button" key={item} onClick={() => setBrand(item)} className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${brand === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"}`}><BrandGlyph brand={item} /> {item}</button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {devices.map((device) => <button type="button" key={device.id} className={`device-card panel flex items-center justify-between rounded-2xl p-4 text-left ${selected?.id === device.id ? "selected" : ""}`} onClick={() => onSelect(device)}>
        <span className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><Smartphone size={21} /></span><span><span className="block text-sm font-bold">{device.model}</span><span className="mt-1 block text-xs text-muted-foreground">{device.series}</span></span></span>
        <span className="text-right"><span className="mono block text-sm font-medium">{formatPrice(device.price)}</span><span className="mt-1 block text-[10px] text-muted-foreground">from</span></span>
      </button>)}
    </div>
    <div className="mt-7 flex items-center justify-between border-t border-border pt-6">
      <span className="hidden text-xs text-muted-foreground sm:block">Prices are shown in USD</span>
      <button type="button" disabled={!selected} onClick={onContinue} className="primary-btn ml-auto flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">Continue to details <ArrowRight size={16} /></button>
    </div>
  </div>;
}

function DetailsForm({ device, identifier, setIdentifier, email, setEmail, onBack, onSubmit }: { device: Device; identifier: string; setIdentifier: (value: string) => void; email: string; setEmail: (value: string) => void; onBack: () => void; onSubmit: () => void }) {
  const [touched, setTouched] = useState(false);
  const identifierValid = isValidIdentifier(identifier);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const formValid = identifierValid && emailValid;
  return <div className="fade-swap">
    <div className="mb-7"><p className="mono mb-3 text-[11px] font-medium uppercase tracking-[.16em] text-primary">Step 02 / details</p><h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">A couple of details.</h1><p className="mt-4 max-w-[570px] text-[15px] leading-7 text-muted-foreground">We use your identifier to check eligibility and email you when the remote unlock is ready.</p></div>
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-primary/20 bg-secondary/60 p-4"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-card text-primary"><Smartphone size={19} /></span><span><span className="block text-xs text-muted-foreground">Selected service</span><span className="block text-sm font-bold">{device.brand} {device.model}</span></span></span><span className="mono text-sm font-medium">{formatPrice(device.price)}</span></div>
    <div className="space-y-5">
      <label className="block"><span className="mb-2 flex items-center justify-between text-sm font-bold"><span>IMEI or serial number</span><button type="button" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"><CircleHelp size={14} /> Where to find it</button></span><div className="relative"><FileDigit className="absolute left-3 top-3.5 text-muted-foreground" size={18} /><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} onBlur={() => setTouched(true)} placeholder="15-digit IMEI or device serial" className={`field h-12 w-full rounded-xl border bg-card pl-10 pr-4 text-sm ${touched && !identifierValid ? "border-destructive" : "border-input"}`} /></div>{touched && !identifierValid ? <span className="mt-2 block text-xs text-destructive">Enter a valid 15-digit IMEI or a serial number with at least 6 characters.</span> : <span className="mt-2 block text-xs leading-5 text-muted-foreground">Find your IMEI by dialing *#06# or in Settings → About. A serial number is accepted for supported services.</span>}</label>
      <label className="block"><span className="mb-2 block text-sm font-bold">Email for your result</span><div className="relative"><Mail className="absolute left-3 top-3.5 text-muted-foreground" size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => setTouched(true)} placeholder="you@example.com" className={`field h-12 w-full rounded-xl border bg-card pl-10 pr-4 text-sm ${touched && !emailValid ? "border-destructive" : "border-input"}`} /></div><span className="mt-2 block text-xs leading-5 text-muted-foreground">We&apos;ll send the unlock result and payment confirmation to this address.</span></label>
    </div>
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onBack} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft size={16} /> Back</button><button type="button" disabled={!formValid} onClick={onSubmit} className="primary-btn flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">Check availability <ArrowRight size={16} /></button></div>
  </div>;
}

function Processing({ device, onContinue, onBack }: { device: Device; onContinue: () => void; onBack: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setReady(true), 3400); return () => window.clearTimeout(timer); }, []);
  return <div className="fade-swap">
    <div className="mb-7"><p className="mono mb-3 text-[11px] font-medium uppercase tracking-[.16em] text-primary">Step 03 / availability</p><h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">{ready ? "Your service is available." : "Processing your request."}</h1><p className="mt-4 max-w-[570px] text-[15px] leading-7 text-muted-foreground">{ready ? "We found a supported remote unlock route for your device. Review the final price before payment." : "We’re checking the identifier with our remote service partners. This secure check usually takes 5–8 minutes."}</p></div>
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[#e5f0ec] p-6 dark:bg-secondary"><div className="scan-line absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-primary/10 to-transparent" /><div className="relative flex items-center gap-4"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${ready ? "bg-primary text-primary-foreground" : "bg-card text-primary"}`}>{ready ? <Check size={23} /> : <RefreshCw size={21} className="animate-spin" />}</span><span><span className="block text-sm font-bold">{ready ? "Eligibility confirmed" : "Verifying your device"}</span><span className="mt-1 block text-xs text-muted-foreground">{device.brand} {device.model} · {device.series}</span></span></div><div className="relative mt-6 h-2 overflow-hidden rounded-full bg-card/80"><div className={`h-full rounded-full bg-primary transition-all duration-[3200ms] ease-out ${ready ? "w-full" : "w-[82%]"}`} /></div><div className="relative mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground"><span>{ready ? "Complete" : "Secure check in progress"}</span><span>{ready ? "Ready for payment" : "Please wait"}</span></div></div>
    <div className="mt-5 rounded-2xl border border-[#e9cda5] bg-[#fff5e5] p-4 text-sm leading-6 text-[#704a22] dark:bg-[#3d3020] dark:text-[#f0c995]"><div className="flex gap-3"><Clock3 className="mt-0.5 shrink-0" size={18} /><span><strong>Keep this page open.</strong> This secure device check runs for about 5–8 minutes. Once it is complete, you’ll review the exact price and choose your payment method.</span></div></div>
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onBack} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft size={16} /> Back</button><button type="button" disabled={!ready} onClick={onContinue} className="primary-btn flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{ready ? "Review payment" : "Checking availability…"} <ArrowRight size={16} /></button></div>
  </div>;
}

function Payment({ device, email, onBack, onPay }: { device: Device; email: string; onBack: () => void; onPay: () => void }) {
  const [method, setMethod] = useState<"card" | "mobile">("card");
  return <div className="fade-swap">
    <div className="mb-7"><p className="mono mb-3 text-[11px] font-medium uppercase tracking-[.16em] text-primary">Step 04 / payment</p><h1 className="display-font text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[.98] tracking-[-.06em]">One clear price. No surprises.</h1><p className="mt-4 max-w-[570px] text-[15px] leading-7 text-muted-foreground">Choose how you&apos;d like to pay. Your request stays pending until your payment provider confirms the transaction.</p></div>
    <div className="mb-5 rounded-2xl border border-border bg-secondary/40 p-5"><div className="flex items-start justify-between gap-4"><span><span className="block text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Remote unlock service</span><span className="mt-2 block text-base font-bold">{device.brand} {device.model}</span></span><span className="mono text-xl font-medium">{formatPrice(device.price)}</span></div><div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><Mail size={14} /> Confirmation will be sent to {email}</div></div>
    <div className="mb-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setMethod("card")} className={`flex items-center gap-3 rounded-xl border p-4 text-left ${method === "card" ? "border-primary bg-secondary/60" : "border-border bg-card"}`}><CreditCard size={19} className="text-primary" /><span><span className="block text-sm font-bold">Card payment</span><span className="mt-1 block text-xs text-muted-foreground">Visa, Mastercard, debit</span></span>{method === "card" && <Check className="ml-auto text-primary" size={17} />}</button><button type="button" onClick={() => setMethod("mobile")} className={`flex items-center gap-3 rounded-xl border p-4 text-left ${method === "mobile" ? "border-primary bg-secondary/60" : "border-border bg-card"}`}><Globe2 size={19} className="text-primary" /><span><span className="block text-sm font-bold">Mobile money</span><span className="mt-1 block text-xs text-muted-foreground">Available by region</span></span>{method === "mobile" && <Check className="ml-auto text-primary" size={17} />}</button></div>
    <div className="rounded-xl border border-border bg-card p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mb-2 text-primary" size={18} /><strong className="text-foreground">Payment is handled securely.</strong> We do not store card details. This button starts a payment request; it does not mark your order as paid.</div>
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onBack} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft size={16} /> Back</button><button type="button" onClick={onPay} className="primary-btn flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground">Request payment · {formatPrice(device.price)} <ArrowRight size={16} /></button></div>
  </div>;
}

function Pending({ device, email, identifier, onReset }: { device: Device; email: string; identifier: string; onReset: () => void }) {
  const reference = `GSM-${identifier.replace(/\W/g, "").slice(-6).toUpperCase() || "WORLD"}`;
  return <div className="fade-swap text-center"><span className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={31} /></span><p className="mono mb-3 text-[11px] font-medium uppercase tracking-[.16em] text-primary">Request received</p><h1 className="display-font text-[clamp(2rem,5vw,3.3rem)] font-bold leading-[.98] tracking-[-.06em]">Payment pending,<br />your email is next.</h1><p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-7 text-muted-foreground">We&apos;ve created your unlock request. We&apos;ll email <strong className="text-foreground">{email}</strong> as soon as payment is confirmed, followed by the service result.</p><div className="mx-auto mt-8 max-w-[470px] rounded-2xl border border-border bg-secondary/50 p-5 text-left"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Request reference</span><button type="button" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline" onClick={() => void navigator.clipboard?.writeText(reference)}><Copy size={13} /> Copy</button></div><p className="mono mt-2 text-lg font-medium">{reference}</p><div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs"><span><span className="block text-muted-foreground">Device</span><strong className="mt-1 block">{device.brand} {device.model}</strong></span><span><span className="block text-muted-foreground">Amount due</span><strong className="mono mt-1 block">{formatPrice(device.price)}</strong></span></div></div><div className="mx-auto mt-6 flex max-w-[470px] items-start gap-3 rounded-xl border border-[#e9cda5] bg-[#fff5e5] p-4 text-left text-xs leading-5 text-[#704a22] dark:bg-[#3d3020] dark:text-[#f0c995]"><Clock3 className="mt-0.5 shrink-0" size={16} /><span><strong>Payment still needs confirmation.</strong> Once the payment provider confirms it, we&apos;ll send the unlock details and every update to your inbox.</span></div><button type="button" onClick={onReset} className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold hover:bg-secondary"><RefreshCw size={16} /> Start another unlock</button></div>;
}

export function UnlockCheckoutPage() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<FlowStage>("device");
  const [device, setDevice] = useState<Device | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const reset = () => { setStage("device"); setDevice(null); setIdentifier(""); setEmail(""); setLocation("/"); };
  return <div className="app-shell min-h-[100dvh]"><Header onReset={reset} /><main className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-12"><div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-primary"><ShieldCheck size={14} /></span> Trusted by customers across Africa & beyond</div><span className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-[#42a66b]" /> Service desk online</span></div><div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-14"><section className="min-w-0"><Progress stage={stage} /><div className="panel rounded-[1.35rem] p-5 sm:p-8 lg:p-10">{stage === "device" && <DeviceSelection selected={device} onSelect={setDevice} onContinue={() => setStage("details")} />}{stage === "details" && device && <DetailsForm device={device} identifier={identifier} setIdentifier={setIdentifier} email={email} setEmail={setEmail} onBack={() => setStage("device")} onSubmit={() => setStage("processing")} />}{stage === "processing" && device && <Processing device={device} onContinue={() => setStage("payment")} onBack={() => setStage("details")} />}{stage === "payment" && device && <Payment device={device} email={email} onBack={() => setStage("processing")} onPay={() => setStage("pending")} />}{stage === "pending" && device && <Pending device={device} email={email} identifier={identifier} onReset={reset} />}</div></section><aside className="space-y-4 lg:sticky lg:top-24">{stage !== "pending" && <div className="panel rounded-2xl p-5"><div className="mb-5 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Your request</span><span className="mono text-[10px] text-muted-foreground">LIVE</span></div>{device ? <><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><Smartphone size={20} /></span><span><span className="block text-sm font-bold">{device.brand} {device.model}</span><span className="mt-1 block text-xs text-muted-foreground">Remote unlock service</span></span></div><div className="mt-5 flex items-end justify-between border-t border-border pt-4"><span className="text-xs text-muted-foreground">Service price</span><span className="mono text-xl font-medium">{formatPrice(device.price)}</span></div></> : <div className="rounded-xl border border-dashed border-border p-4 text-center"><Smartphone className="mx-auto mb-2 text-muted-foreground" size={20} /><p className="text-xs leading-5 text-muted-foreground">Your selected phone and exact price will appear here.</p></div>}</div>}<div className="panel rounded-2xl p-5"><div className="mb-4 flex items-center gap-2"><Sparkles className="text-accent" size={17} /><span className="text-sm font-bold">Why GSM World?</span></div><ul className="space-y-3 text-xs leading-5 text-muted-foreground"><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-primary" /> Clear pricing before payment</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-primary" /> Remote service, no shop visit</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-primary" /> Updates sent straight to your email</li></ul></div><p className="px-1 text-[11px] leading-5 text-muted-foreground">Need help? Contact support and include your request reference so our team can find you quickly.</p></aside></div></main><footer className="mx-auto flex max-w-[1240px] flex-col gap-2 border-t border-border px-5 py-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} GSM World. Service desk.</span><span className="flex items-center gap-2"><ShieldCheck size={13} /> Secure request handling</span></footer></div>;
}