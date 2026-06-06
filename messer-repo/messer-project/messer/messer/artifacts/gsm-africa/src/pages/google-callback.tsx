import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function apiBase() {
  return (import.meta.env.BASE_URL as string).replace(/\/$/, "");
}

export function GoogleCallbackPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "returning" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email");
    const name = params.get("name");
    const error = params.get("error");

    if (error) {
      setErrorMsg(decodeURIComponent(error));
      setStatus("error");
      return;
    }

    if (!token || !email) {
      setErrorMsg("Sign-in incomplete. Please try again.");
      setStatus("error");
      return;
    }

    const decodedToken = decodeURIComponent(token);
    const decodedEmail = decodeURIComponent(email);
    const decodedName = name ? decodeURIComponent(name) : null;

    // Detect environment
    const isInApp = navigator.userAgent.includes("GSMWorldApp/1.0");
    const isAndroid = /android/i.test(navigator.userAgent);

    if (isAndroid && !isInApp) {
      // Running in Chrome on Android after OAuth — automatically fire the deep
      // link. MainActivity catches it and loads /auth/google-callback inside the
      // WebView, which completes the login flow without any user interaction.
      setStatus("returning");
      const deepLink =
        `gsmworld://auth/callback?token=${encodeURIComponent(decodedToken)}` +
        `&email=${encodeURIComponent(decodedEmail)}` +
        `&name=${encodeURIComponent(decodedName || "")}`;
      // Small delay so the "Returning…" screen renders before Chrome switches apps
      setTimeout(() => { window.location.href = deepLink; }, 350);
      return;
    }

    // Web / in-app WebView flow — complete login normally
    fetch(`${apiBase()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${decodedToken}` },
    })
      .then((r) => r.json() as Promise<{ user?: { id: number; email: string; name: string | null } }>)
      .then(async (data) => {
        const user = data.user ?? { id: 0, email: decodedEmail, name: decodedName };
        login(decodedToken, user);
        try {
          const sessionId = localStorage.getItem("gsm_session_id");
          if (sessionId) {
            await fetch(`${apiBase()}/api/auth/cart-migrate`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${decodedToken}` },
              body: JSON.stringify({ guestSessionId: sessionId }),
            });
          }
        } catch {}
        toast({ title: "Signed in with Google!", description: `Welcome, ${decodedEmail}` });
        navigate("/account");
      })
      .catch(async () => {
        login(decodedToken, { id: 0, email: decodedEmail, name: decodedName });
        try {
          const sessionId = localStorage.getItem("gsm_session_id");
          if (sessionId) {
            await fetch(`${apiBase()}/api/auth/cart-migrate`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${decodedToken}` },
              body: JSON.stringify({ guestSessionId: sessionId }),
            });
          }
        } catch {}
        toast({ title: "Signed in with Google!", description: `Welcome, ${decodedEmail}` });
        navigate("/account");
      });
  }, []);

  if (status === "returning") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-5 bg-[#0d1623] px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-2 shadow-2xl">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-400">
            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            <path d="M8 12l2.5 2.5L16 9"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-black text-white mb-2">Signed in successfully</h2>
          <p className="text-slate-400 text-sm max-w-[240px]">Returning you to the GSM World app automatically…</p>
        </div>
        <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mt-2" />
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Completing Google sign-in…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <h2 className="text-lg font-black text-gray-900">Sign-in Failed</h2>
      <p className="text-sm text-muted-foreground max-w-xs">{errorMsg}</p>
      <Link
        href="/login"
        className="mt-2 px-6 py-2.5 bg-[#1a2332] text-white text-sm font-bold rounded-xl hover:bg-[#253246] transition-colors"
      >
        Back to Login
      </Link>
    </div>
  );
}
