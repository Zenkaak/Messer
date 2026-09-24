import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

function getQuery(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

export function UnsubscribePage() {
  const [state, setState] = useState<"idle" | "loading" | "confirmed" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const confirmed = getQuery("confirmed");
    const error = getQuery("error");
    const email = getQuery("email");
    const token = getQuery("token");

    if (confirmed === "1") {
      setState("confirmed");
      setMsg("You have been successfully unsubscribed from GSM World marketing emails.");
      return;
    }
    if (error) {
      setState("error");
      setMsg("This unsubscribe link is invalid or has expired.");
      return;
    }

    if (email && token) {
      setState("loading");
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      fetch(`${base}/api/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      })
        .then(async (r) => {
          if (r.ok) {
            setState("confirmed");
            setMsg("You have been successfully unsubscribed.");
          } else {
            const d = await r.json().catch(() => ({})) as { error?: string };
            setState("error");
            setMsg(d.error ?? "Something went wrong. Please try again.");
          }
        })
        .catch(() => {
          setState("error");
          setMsg("Network error. Please try again.");
        });
    } else {
      setState("error");
      setMsg("Invalid unsubscribe link. Please use the link from your email.");
    }
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-[#1a2332] px-8 pt-8 pb-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
              <Mail size={26} className="text-white" />
            </div>
            <p className="text-[11px] font-bold text-blue-300/70 uppercase tracking-widest mb-1">Email Preferences</p>
            <h1 className="text-xl font-black text-white">Unsubscribe</h1>
          </div>

          <div className="px-8 py-8 text-center">
            {state === "loading" && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="text-blue-500 animate-spin" />
                <p className="text-gray-600 text-sm font-medium">Processing your request…</p>
              </div>
            )}

            {state === "confirmed" && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 mb-2">You're Unsubscribed</h2>
                  <p className="text-gray-500 text-sm leading-relaxed">{msg}</p>
                </div>
                <div className="w-full pt-2 space-y-2">
                  <p className="text-xs text-gray-400">
                    You will still receive essential transactional emails such as order confirmations and security alerts.
                  </p>
                  <Link href="/">
                    <button className="w-full mt-4 py-3 bg-[#1a2332] text-white font-bold rounded-2xl text-sm hover:bg-[#1e3a5f] transition-colors">
                      Back to Store
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle size={32} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 mb-2">Invalid Link</h2>
                  <p className="text-gray-500 text-sm leading-relaxed">{msg}</p>
                </div>
                <div className="w-full pt-2 space-y-3">
                  <p className="text-xs text-gray-400">
                    Please use the unsubscribe link directly from your email, or manage your preferences from your account.
                  </p>
                  <Link href="/account">
                    <button className="w-full py-3 bg-[#1a2332] text-white font-bold rounded-2xl text-sm hover:bg-[#1e3a5f] transition-colors">
                      Manage Account Preferences
                    </button>
                  </Link>
                  <Link href="/">
                    <button className="w-full py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-2xl text-sm hover:bg-gray-50 transition-colors">
                      Back to Store
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {state === "idle" && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="text-blue-500 animate-spin" />
                <p className="text-gray-600 text-sm font-medium">Loading…</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          GSM World · Trusted Since 2016 ·{" "}
          <Link href="/account" className="text-blue-500 hover:underline">Account Settings</Link>
        </p>
      </div>
    </div>
  );
}
