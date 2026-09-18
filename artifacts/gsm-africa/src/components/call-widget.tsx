import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Headphones,
  Loader2,
  Phone,
  PhoneCall,
  PhoneOff,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

export type CallState = "idle" | "queued" | "active" | "completed" | "cancelled";

export interface CallWidgetProps {
  state: CallState;
  queuePosition?: number | null;
  queueTimestamp?: string | number | Date | null;
  error?: string | null;
  loading?: boolean;
  presentation?: "compact" | "panel";
  onRequest: () => void;
  onCancel: () => void;
  onHangUp: () => void;
  onClose: () => void;
  onCompactClick?: () => void;
  className?: string;
}

const stateCopy: Record<CallState, { title: string; description: string }> = {
  idle: {
    title: "Talk to a human",
    description: "A GSM World agent can help with your unlock, order, or device.",
  },
  queued: {
    title: "You’re in the call queue",
    description: "We’ll connect you as soon as an agent is ready.",
  },
  active: {
    title: "You’re connected",
    description: "Your GSM World support call is live.",
  },
  completed: {
    title: "Call complete",
    description: "Thanks for speaking with GSM World support.",
  },
  cancelled: {
    title: "Call cancelled",
    description: "Your request was removed from the queue.",
  },
};

function formatQueuedAt(value: CallWidgetProps["queueTimestamp"]) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function StatusIcon({ state, className }: { state: CallState; className?: string }) {
  if (state === "active") return <PhoneCall className={className} aria-hidden="true" />;
  if (state === "queued") return <Clock3 className={className} aria-hidden="true" />;
  if (state === "completed") return <CheckCircle2 className={className} aria-hidden="true" />;
  if (state === "cancelled") return <PhoneOff className={className} aria-hidden="true" />;
  return <Headphones className={className} aria-hidden="true" />;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function CallWidget({
  state,
  queuePosition,
  queueTimestamp,
  error,
  loading = false,
  presentation = "panel",
  onRequest,
  onCancel,
  onHangUp,
  onClose,
  onCompactClick,
  className,
}: CallWidgetProps) {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useMemo(
    () => (queueTimestamp ? (queueTimestamp instanceof Date ? queueTimestamp : new Date(queueTimestamp)).getTime() : Date.now()),
    [queueTimestamp],
  );

  useEffect(() => {
    if (state !== "active") {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, state]);

  if (presentation === "compact") {
    const compactLabel = state === "active" ? "Call in progress" : state === "queued" ? "Call requested" : "Talk to an agent";
    return (
      <button
        type="button"
        data-testid="button-call-widget"
        aria-label={compactLabel}
        onClick={onCompactClick ?? onRequest}
        disabled={loading}
        className={cx(
          "group inline-flex min-h-12 items-center gap-3 rounded-2xl bg-[#087f8c] px-4 text-left text-white shadow-[0_10px_28px_rgba(8,127,140,0.24)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#086f7b] focus:outline-none focus:ring-2 focus:ring-[#69d5d2] focus:ring-offset-2 disabled:cursor-default disabled:hover:translate-y-0",
          className,
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/15">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Phone className="h-4 w-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold tracking-[-0.01em]">{compactLabel}</span>
          <span className="block text-[11px] text-teal-50/80">
            {state === "active" ? "Connected to support" : state === "queued" ? "Agent matching in progress" : "Fast, real support"}
          </span>
        </span>
      </button>
    );
  }

  const copy = stateCopy[state];
  const queuedAt = formatQueuedAt(queueTimestamp);
  const isTerminal = state === "completed" || state === "cancelled";

  return (
    <section
      aria-label="GSM World call support"
      data-testid="call-widget"
      className={cx(
        "w-full overflow-hidden rounded-[24px] border border-[#d7e9ec] bg-[#fbfefe] text-[#163642] shadow-[0_18px_48px_rgba(18,70,82,0.14)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-[#e1eef0] bg-[linear-gradient(135deg,#eaf8f8_0%,#f7fbfc_72%)] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#087f8c] text-white shadow-[0_7px_16px_rgba(8,127,140,0.2)]">
            <StatusIcon state={state} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#087f8c]">GSM World support</p>
            <h2 data-testid="text-call-status" className="mt-0.5 truncate text-base font-bold tracking-[-0.02em] text-[#163642]">{copy.title}</h2>
          </div>
        </div>
        <button
          type="button"
          data-testid="button-close-call-widget"
          aria-label="Close call support"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#5d7c84] transition-colors hover:bg-white hover:text-[#163642] focus:outline-none focus:ring-2 focus:ring-[#69d5d2]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {state === "idle" && (
          <>
            <p className="text-sm leading-6 text-[#52717a]">{copy.description}</p>
            <div className="grid gap-2.5 rounded-2xl border border-[#dcecef] bg-[#f3fafb] p-3.5 sm:grid-cols-3">
              {[
                ["< 2 min", "Typical connection"],
                ["Real people", "No automated maze"],
                ["Secure", "Your details stay private"],
              ].map(([value, label]) => (
                <div key={label} className="flex items-center gap-2 sm:block">
                  <span className="text-sm font-extrabold text-[#163642]">{value}</span>
                  <span className="text-xs text-[#66838b] sm:mt-0.5 sm:block">{label}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              data-testid="button-request-call"
              onClick={onRequest}
              disabled={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087f8c] px-4 text-sm font-bold text-white transition-colors hover:bg-[#086f7b] focus:outline-none focus:ring-2 focus:ring-[#69d5d2] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Phone className="h-4 w-4" aria-hidden="true" />}
              {loading ? "Requesting an agent…" : "Request a call now"}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#66838b]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#087f8c]" aria-hidden="true" />
              No charge to request support
            </p>
          </>
        )}

        {state === "queued" && (
          <>
            <p className="text-sm leading-6 text-[#52717a]">{copy.description}</p>
            <div className="rounded-2xl bg-[#edf8f8] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#5b858d]">Your place</p>
                  <p data-testid="text-queue-position" className="mt-1 text-3xl font-extrabold tracking-[-0.05em] text-[#087f8c]">
                    {queuePosition && queuePosition > 0 ? `#${queuePosition}` : "Next up"}
                  </p>
                </div>
                <Users className="mb-1 h-7 w-7 text-[#69b8bb]" aria-hidden="true" />
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#cde7e8]">
                <div className="h-full w-2/3 rounded-full bg-[#1ba0a5]" />
              </div>
              {queuedAt && <p className="mt-2 text-[11px] text-[#66838b]">Requested at {queuedAt}</p>}
            </div>
            <button type="button" data-testid="button-cancel-call" onClick={onCancel} disabled={loading} className="w-full rounded-xl border border-[#cfe2e5] px-4 py-2.5 text-sm font-bold text-[#52717a] transition-colors hover:border-[#087f8c] hover:text-[#087f8c] focus:outline-none focus:ring-2 focus:ring-[#69d5d2] disabled:opacity-60">
              Cancel request
            </button>
          </>
        )}

        {state === "active" && (
          <>
            <div className="rounded-2xl border border-[#bce5df] bg-[#effbf8] p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#167b70]">
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2eb9a5] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#159987]" /></span>
                Agent connected
              </div>
              <p data-testid="text-call-duration" className="mt-3 font-mono text-3xl font-bold tracking-[-0.04em] text-[#163642]">
                {Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}
              </p>
              <p className="mt-1 text-xs text-[#66838b]">Keep this window open while you speak with support.</p>
            </div>
            <button type="button" data-testid="button-hang-up-call" onClick={onHangUp} disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b9474f] px-4 text-sm font-bold text-white transition-colors hover:bg-[#a43b43] focus:outline-none focus:ring-2 focus:ring-[#f1a4a8] focus:ring-offset-2 disabled:opacity-60">
              <PhoneOff className="h-4 w-4" aria-hidden="true" /> End call
            </button>
          </>
        )}

        {isTerminal && (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-[#f3f8f9] p-4">
              <StatusIcon state={state} className="text-[#087f8c]" />
              <p className="text-sm leading-6 text-[#52717a]">{copy.description}</p>
            </div>
            <button type="button" data-testid="button-request-another-call" onClick={onRequest} disabled={loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#087f8c] px-4 text-sm font-bold text-white transition-colors hover:bg-[#086f7b] focus:outline-none focus:ring-2 focus:ring-[#69d5d2] focus:ring-offset-2 disabled:opacity-60">
              <Phone className="h-4 w-4" aria-hidden="true" /> Request another call
            </button>
          </>
        )}

        {error && (
          <div role="alert" data-testid="status-call-error" className="flex items-start gap-2 rounded-xl border border-[#f1c8c8] bg-[#fff5f5] px-3.5 py-3 text-xs font-semibold leading-5 text-[#a33e45]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </section>
  );
}