import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, Copy, Globe2, Mail, Phone, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { DEVICE_CATALOG } from "@/pages/direct-unlock";

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
  const [stage, setStage] = useState<Stage>("device");
  const [device, setDevice] = useState<Device | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
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