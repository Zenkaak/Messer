import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Phone, PhoneCall, PhoneOff, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { microphoneErrorMessage, requestMicrophoneAccess, VoiceCallPanel } from "@/components/voice-call";
import { enableOneSignalPush, syncOneSignalPush } from "@/lib/onesignal";

interface CallRecord {
  id: number;
  visitorId: string;
  targetUserId?: number | null;
  callerName?: string | null;
  callerLabel?: string | null;
  direction?: "user_to_admin" | "admin_to_user" | string | null;
  status: "queued" | "ringing" | "active" | "completed" | "cancelled";
  position?: number | null;
  queuedAt?: string | null;
  signalToken?: string | null;
  endedAt?: string | null;
}

function apiBase() {
  return (import.meta.env.BASE_URL as string).replace(/\/$/, "");
}

function visitorId() {
  const key = "gsm_call_visitor_id";
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const value = `visitor-${crypto.randomUUID()}`;
  sessionStorage.setItem(key, value);
  return value;
}

let ringContext: AudioContext | null = null;

function ringOnce() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ringContext ??= new AudioContextClass();
    const context = ringContext;
    void context.resume();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(520, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.09, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.42);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.45);
  } catch {
    // Browsers can block synthesized audio until the user interacts.
  }
}

export function CallDashboard() {
  const { user, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [call, setCall] = useState<CallRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparedStream, setPreparedStream] = useState<MediaStream | null>(null);
  const [pushState, setPushState] = useState<"idle" | "enabling" | "enabled" | "failed">("idle");
  const lastIncomingId = useRef<number | null>(null);
  const notifiedIncomingId = useRef<number | null>(null);
  const base = apiBase();

  const refreshIncoming = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${base}/api/calls/incoming`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const data = await response.json() as CallRecord | null;
      if (data) {
        setCall((current) => current?.id === data.id ? { ...current, ...data } : data);
        if (data.status === "ringing" && lastIncomingId.current !== data.id) {
          lastIncomingId.current = data.id;
          setOpen(true);
          ringOnce();
          if (notifiedIncomingId.current !== data.id && "Notification" in window && Notification.permission === "granted") {
            notifiedIncomingId.current = data.id;
            void navigator.serviceWorker?.ready.then((registration) =>
              registration.showNotification("Incoming GSM UNLOCK call", {
                body: "Your support agent is calling. Tap to answer.",
                tag: `gsm-call-${data.id}`,
                requireInteraction: true,
                data: { url: window.location.href },
              }),
            ).catch(() => {
              new Notification("Incoming GSM UNLOCK call", { body: "Your support agent is calling. Tap to answer.", tag: `gsm-call-${data.id}` });
            });
          }
        }
      } else if (call?.direction === "admin_to_user") {
        setCall(null);
        setOpen(false);
      }
    } catch {
      // Incoming ringing is best-effort while the user is online.
    }
  }, [base, token]);

  const refreshCall = useCallback(async (record: CallRecord) => {
    try {
      const response = await fetch(`${base}/api/calls/${record.id}?visitorId=${encodeURIComponent(record.visitorId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) setCall(await response.json() as CallRecord);
    } catch {
      // Polling should not interrupt an active dashboard.
    }
  }, [base, token]);

  useEffect(() => {
    const openDashboard = () => setOpen(true);
    window.addEventListener("gsm-open-call-dashboard", openDashboard);
    return () => window.removeEventListener("gsm-open-call-dashboard", openDashboard);
  }, []);

  useEffect(() => {
    refreshIncoming();
    const timer = window.setInterval(refreshIncoming, 2500);
    return () => window.clearInterval(timer);
  }, [refreshIncoming]);

  // Re-attach a browser that already granted notification permission after a
  // reload. The explicit button remains the first-time permission flow.
  useEffect(() => {
    if (!user?.id) {
      setPushState("idle");
      return;
    }
    if (!("Notification" in window) || Notification.permission !== "granted") {
      setPushState("idle");
      return;
    }
    let cancelled = false;
    void syncOneSignalPush(String(user.id)).then((enabled) => {
      if (!cancelled && enabled) setPushState("enabled");
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!call || call.status === "completed" || call.status === "cancelled") return;
    const timer = window.setInterval(() => refreshCall(call), 2500);
    return () => window.clearInterval(timer);
  }, [call, refreshCall]);

  useEffect(() => {
    if (!call || call.status !== "ringing" || call.direction !== "admin_to_user") return;
    const timer = window.setInterval(ringOnce, 1800);
    return () => window.clearInterval(timer);
  }, [call]);

  async function requestCall() {
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      // A call button is a user gesture, so this is the reliable point to
      // grant push permission and associate this device with the account.
      if (user?.id) void enableOneSignalPush(String(user.id));
      const response = await fetch(`${base}/api/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ visitorId: visitorId(), name: user?.name, email: user?.email }),
      });
      const data = await response.json() as CallRecord & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not request a call");
      setCall(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a call");
    } finally {
      setLoading(false);
    }
  }

  async function enableCallNotifications() {
    if (!user?.id) return;
    setPushState("enabling");
    const enabled = await enableOneSignalPush(String(user.id));
    setPushState(enabled ? "enabled" : "failed");
  }

  async function acceptIncoming() {
    if (!call || !token) return;
    setLoading(true);
    let stream: MediaStream | null = null;
    try {
      stream = await requestMicrophoneAccess();
      const response = await fetch(`${base}/api/calls/${call.id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json() as CallRecord & { error?: string };
      if (!response.ok) throw new Error(data.error || "The call is no longer available");
      setPreparedStream(stream);
      setCall(data);
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      setError(microphoneErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function hangUp() {
    if (!call) return;
    setLoading(true);
    try {
      if (call.status === "active") {
        await fetch(`${base}/api/calls/${call.id}/hangup`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ visitorId: call.visitorId }),
        });
      } else {
        await fetch(`${base}/api/calls/${call.id}?visitorId=${encodeURIComponent(call.visitorId)}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
      }
    } finally {
      setCall(null);
      setPreparedStream(null);
      setOpen(false);
      setLoading(false);
    }
  }

  const isIncoming = call?.status === "ringing" && call.direction === "admin_to_user";
  const isOutgoingRinging = call?.status === "ringing" && call.direction !== "admin_to_user";
  const isActive = call?.status === "active";
  const isQueued = call?.status === "queued";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[10.5rem] right-4 z-[390] flex min-h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#087f8c,#0b596d)] px-4 text-left text-white shadow-[0_12px_30px_rgba(8,127,140,0.32)] transition-transform hover:-translate-y-0.5 md:bottom-6 md:right-[6.75rem]"
        aria-label="Open GSM UNLOCK call dashboard"
      >
        <Phone className="h-4 w-4" />
        <span>
          <span className="block text-sm font-extrabold">{isActive ? "Call in progress" : "Call GSM UNLOCK"}</span>
          <span className="block text-[10px] text-teal-50/80">
            {isQueued ? "Calling…" : call?.status === "ringing" ? "Ringing now" : "Voice support"}
          </span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[500] flex items-stretch justify-center bg-slate-950/65 backdrop-blur-sm sm:items-center sm:p-4">
          <section className="flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#f4fbfc] shadow-2xl sm:min-h-0 sm:rounded-[28px]">
            <header className="flex items-center gap-3 bg-[linear-gradient(135deg,#163642,#087f8c)] px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white sm:pt-4">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15"><PhoneCall className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-100">Private voice support</p>
                <h2 className="truncate text-base font-extrabold">GSM UNLOCK call dashboard</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"><X className="h-4 w-4" /></button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {!call && (
                <div className="rounded-3xl bg-white p-5 text-center shadow-sm">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eaf8f8] text-[#087f8c]"><PhoneCall className="h-6 w-6" /></div>
                  <h3 className="mt-4 text-lg font-extrabold text-[#163642]">Talk to a real agent</h3>
                  <p className="mt-2 text-sm leading-6 text-[#66838b]">A private voice session opens here. It does not use the GSMBot chat box.</p>
                   {user?.id && pushState !== "enabled" && (
                     <div className="mt-4 rounded-2xl border border-[#ccebed] bg-[#f1fbfb] p-3 text-left">
                       <p className="text-xs font-bold text-[#163642]">Get call alerts when this page is closed</p>
                       <p className="mt-1 text-[11px] leading-5 text-[#66838b]">Allow browser notifications so GSM UNLOCK can reach you while you are using another app.</p>
                       <button type="button" onClick={() => void enableCallNotifications()} disabled={pushState === "enabling"} className="mt-2 w-full rounded-xl border border-[#087f8c] px-3 py-2 text-xs font-bold text-[#087f8c] disabled:opacity-60">
                         {pushState === "enabling" ? "Enabling notifications…" : "Enable call notifications"}
                       </button>
                       {pushState === "failed" && <p className="mt-2 text-[11px] font-semibold text-rose-600">Permission was not granted. Check this site’s notification settings and try again.</p>}
                     </div>
                   )}
                   {user?.id && pushState === "enabled" && (
                     <p className="mt-4 rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">Call notifications are enabled on this browser.</p>
                   )}
                  <button type="button" onClick={() => void requestCall()} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087f8c] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60">
                    <Phone className="h-4 w-4" /> {loading ? "Calling…" : "Request a call"}
                  </button>
                </div>
              )}

              {isIncoming && (
                <div className="rounded-3xl bg-white p-5 text-center shadow-sm">
                  <div className="mx-auto grid h-16 w-16 animate-pulse place-items-center rounded-full bg-[#087f8c] text-white"><PhoneCall className="h-7 w-7" /></div>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#087f8c]">Incoming call</p>
                  <h3 className="mt-1 text-xl font-extrabold text-[#163642]">GSM UNLOCK</h3>
                  <p className="mt-2 text-sm text-[#66838b]">Your support agent is calling you now.</p>
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => void hangUp()} className="flex-1 rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600"><PhoneOff className="mr-1 inline h-4 w-4" /> Decline</button>
                    <button type="button" onClick={() => void acceptIncoming()} disabled={loading} className="flex-1 rounded-xl bg-[#087f8c] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><PhoneCall className="mr-1 inline h-4 w-4" /> Answer</button>
                  </div>
                </div>
              )}

              {isOutgoingRinging && (
                <div className="rounded-3xl bg-white p-5 text-center shadow-sm">
                  <div className="mx-auto grid h-16 w-16 animate-pulse place-items-center rounded-full bg-[#087f8c] text-white"><PhoneCall className="h-7 w-7" /></div>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#087f8c]">Ringing</p>
                  <h3 className="mt-1 text-xl font-extrabold text-[#163642]">GSM UNLOCK</h3>
                  <p className="mt-2 text-sm text-[#66838b]">An agent is online and being connected to your call.</p>
                  <button type="button" onClick={() => void hangUp()} disabled={loading} className="mt-5 w-full rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600">
                    <PhoneOff className="mr-1 inline h-4 w-4" /> Cancel call
                  </button>
                </div>
              )}

              {isQueued && (
                <div className="rounded-3xl bg-white p-5 text-center shadow-sm">
                  <Clock3 className="mx-auto h-8 w-8 text-[#087f8c]" />
                  <h3 className="mt-3 text-lg font-extrabold text-[#163642]">Calling GSM UNLOCK…</h3>
                  <p className="mt-2 text-sm text-[#66838b]">
                    {call.position ? `Position #${call.position}.` : "The request is being delivered."} We’ll show Ringing when an agent is online.
                  </p>
                  <button type="button" onClick={() => void hangUp()} disabled={loading} className="mt-5 w-full rounded-xl border border-[#d7e9ec] px-4 py-3 text-sm font-bold text-[#52717a]">Cancel request</button>
                </div>
              )}

              {isActive && call.signalToken && (
                <VoiceCallPanel
                  callId={call.id}
                  signalToken={call.signalToken}
                  role="user"
                  authToken={token}
                  visitorId={call.visitorId}
                  initialStream={preparedStream}
                  onHangUp={() => void hangUp()}
                />
              )}

              {error && <p className="rounded-2xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">{error}</p>}
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#66838b]"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Your call stays between you and the agent</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}