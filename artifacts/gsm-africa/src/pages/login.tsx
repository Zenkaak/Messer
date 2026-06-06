import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowRight, Mail, Lock, Hash, Smartphone, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// Use localStorage so the key survives WebView navigation / process kill
// when Chrome takes over for the OAuth flow.
const OAUTH_SESSION_KEY = "gsm_oauth_session";

export function LoginPage() {
  const [, navigate] = useLocation();
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/account";
  const { login, token } = useAuth();

  const { toast } = useToast();

  const [tab, setTab] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);

  // If already logged in, redirect immediately
  useEffect(() => {
    if (token) {
      navigate(returnTo);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Google OAuth polling state (for Android WebView where Chrome handles OAuth)
  const [googlePolling, setGooglePolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setGooglePolling(false);
    localStorage.removeItem(OAUTH_SESSION_KEY);
  }

  function startPolling(sessionId: string) {
    // Clear any existing interval first
    if (pollRef.current) clearInterval(pollRef.current);
    setGooglePolling(true);
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${base}/api/auth/google/poll?session=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { status: string; token?: string; email?: string; name?: string; error?: string };
        if (data.status === "done" && data.token && data.email) {
          stopPolling();
          // Fetch full user profile to get the real DB id
          try {
            const meRes = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${data.token}` } });
            const me = await meRes.json() as { user?: { id: number; email: string; name: string | null } };
            login(data.token, me.user ?? { id: 0, email: data.email, name: data.name ?? null });
          } catch {
            login(data.token, { id: 0, email: data.email, name: data.name ?? null });
          }
          toast({ title: "Signed in with Google!", description: `Welcome, ${data.email}` });
          navigate(returnTo);
        } else if (data.status === "error") {
          stopPolling();
          toast({ title: data.error || "Google sign-in failed", variant: "destructive" });
        } else if (data.status === "expired") {
          stopPolling();
          toast({ title: "Sign-in timed out. Please try again.", variant: "destructive" });
        }
      } catch { /* network hiccup — keep polling */ }
    }, 2000);
  }

  // On mount: resume any in-progress Google OAuth poll.
  // Works for the Android WebView case where the page may have been re-created
  // after Chrome returned to foreground — localStorage survives that.
  useEffect(() => {
    const isAndroidApp = navigator.userAgent.includes("GSMWorldApp");
    const pending = localStorage.getItem(OAUTH_SESSION_KEY);
    if (pending) {
      if (isAndroidApp) {
        // Resume polling — WebView came back from Chrome
        startPolling(pending);
      } else {
        // Stale key in a real browser — clear it
        localStorage.removeItem(OAUTH_SESSION_KEY);
      }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGoogleSignIn() {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const isAndroidApp = navigator.userAgent.includes("GSMWorldApp");
    if (isAndroidApp) {
      // 1. Generate a sessionId the server will key the token against
      const sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
      // 2. Persist in localStorage so polling can resume if WebView is recreated
      localStorage.setItem(OAUTH_SESSION_KEY, sessionId);
      // 3. Show the "Waiting…" UI immediately
      setGooglePolling(true);
      // 4. Open the OAuth URL via an <a> click trick — this triggers
      //    shouldOverrideUrlLoading in the WebViewClient which then calls
      //    startActivity(Intent.ACTION_VIEW) to open Chrome.
      //    Using window.location.href would navigate the WebView away and
      //    destroy the JS context (killing any running poll interval).
      const oauthUrl = `${base}/api/auth/google/redirect?sessionId=${encodeURIComponent(sessionId)}`;
      const a = document.createElement("a");
      a.href = oauthUrl;
      a.target = "_blank";         // signals external navigation to the WebViewClient
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // 5. Start polling AFTER the click so the interval is alive while Chrome is open
      startPolling(sessionId);
    } else {
      // Browser: standard server-side redirect flow
      window.location.href = `${base}/api/auth/google/redirect`;
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; user?: { id: number; email: string; name: string | null }; error?: string };
      if (!res.ok) {
        toast({ title: data.error || "Login failed", variant: "destructive" });
        return;
      }
      login(data.token!, data.user!);
      toast({ title: "Welcome back!", description: `Signed in as ${data.user!.email}` });
      navigate(returnTo);
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp() {
    if (!otpEmail) { toast({ title: "Email is required", variant: "destructive" }); return; }
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/otp-login/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        toast({ title: data.error || "Failed to send OTP", variant: "destructive" });
        return;
      }
      setOtpSent(true);
      toast({ title: "Code sent!", description: `Check your email: ${otpEmail}` });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otpCode || otpCode.length !== 6) { toast({ title: "Enter the 6-digit code", variant: "destructive" }); return; }
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/otp-login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otpCode }),
      });
      const data = await res.json() as { token?: string; user?: { id: number; email: string; name: string | null }; error?: string };
      if (!res.ok) {
        toast({ title: data.error || "Invalid code", variant: "destructive" });
        return;
      }
      login(data.token!, data.user!);
      toast({ title: "Welcome!", description: `Signed in as ${data.user!.email}` });
      navigate(returnTo);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setOtpLoading(false);
    }
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "linear-gradient(160deg,#0d1828 0%,#080d18 60%)" }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-20"
          style={{ background: "radial-gradient(ellipse,#3b82f6 0%,transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 opacity-10"
          style={{ background: "radial-gradient(circle,#8b5cf6 0%,transparent 70%)", transform: "translate(30%,30%)" }} />
      </div>

      <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-5 py-10">
        <div className="mb-7 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-2xl"
            style={{ background: "linear-gradient(135deg,#1e3a5f,#1a2e4a)", border: "1px solid rgba(59,130,246,0.3)" }}>
            <Smartphone size={28} style={{ color: "#60a5fa" }} />
          </div>
          <h1 className="font-black text-2xl leading-tight tracking-tight" style={{ color: "#f8fafc" }}>
            Sign in to GSM World
          </h1>
          <p className="text-sm mt-1 font-medium" style={{ color: "#64748b" }}>
            Unlock phones · Buy credits · Track orders
          </p>
        </div>

        <div
          className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex rounded-2xl p-1 mb-6" style={{ background: "rgba(0,0,0,0.25)" }}>
            {(["password", "otp"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all"
                style={
                  tab === t
                    ? { background: "linear-gradient(135deg,#1e3a5f,#1e2d4a)", color: "#93c5fd", boxShadow: "0 2px 12px rgba(59,130,246,0.25)" }
                    : { color: "#475569" }
                }
              >
                {t === "password" ? "Password" : "Magic Code"}
              </button>
            ))}
          </div>

          {tab === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest block mb-2" style={{ color: "#475569" }}>Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", caretColor: "#60a5fa" }}
                    onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(96,165,250,0.5)"; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
                    onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest block mb-2" style={{ color: "#475569" }}>Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
                  <input
                    type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password" required autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-2xl text-sm outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", caretColor: "#60a5fa" }}
                    onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(96,165,250,0.5)"; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
                    onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors" style={{ color: "#475569" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 font-black text-sm py-3.5 rounded-2xl text-white transition-all active:scale-[0.98] mt-2 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 6px 24px rgba(99,102,241,0.35)" }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (<>Sign In <ArrowRight size={15} /></>)}
              </button>
            </form>
          )}

          {tab === "otp" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-3 text-xs font-medium"
                style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#93c5fd" }}>
                Enter your email and we'll send a 6-digit code — no password needed.
              </div>
              {!otpSent ? (
                <>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest block mb-2" style={{ color: "#475569" }}>Email</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
                      <input type="email" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none transition-all"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", caretColor: "#60a5fa" }}
                        onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(96,165,250,0.5)"; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
                        onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                        onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                      />
                    </div>
                  </div>
                  <button onClick={sendOtp} disabled={otpLoading || !otpEmail}
                    className="w-full flex items-center justify-center gap-2 font-black text-sm py-3.5 rounded-2xl text-white transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 6px 24px rgba(99,102,241,0.35)" }}
                  >
                    {otpLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </span>
                    ) : (<>Send Login Code <ArrowRight size={15} /></>)}
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center py-1">
                    <p className="text-sm" style={{ color: "#94a3b8" }}>
                      Code sent to <span className="font-bold" style={{ color: "#f1f5f9" }}>{otpEmail}</span>
                    </p>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest block mb-2" style={{ color: "#475569" }}>6-Digit Code</label>
                    <div className="relative">
                      <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
                      <input type={showOtp ? "text" : "password"} inputMode="numeric" value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="••••••" maxLength={6}
                        className="w-full pl-10 pr-11 py-3 rounded-2xl text-sm outline-none text-center font-mono tracking-[0.4em] text-lg transition-all"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", caretColor: "#60a5fa" }}
                        onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(96,165,250,0.5)"; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
                        onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                        onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                      />
                      <button type="button" onClick={() => setShowOtp(!showOtp)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors" style={{ color: "#475569" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
                      >
                        {showOtp ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <button onClick={verifyOtp} disabled={otpLoading || otpCode.length !== 6}
                    className="w-full flex items-center justify-center gap-2 font-black text-sm py-3.5 rounded-2xl text-white transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)", boxShadow: "0 6px 24px rgba(99,102,241,0.35)" }}
                  >
                    {otpLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying...
                      </span>
                    ) : (<>Verify &amp; Sign In <ArrowRight size={15} /></>)}
                  </button>
                  <button onClick={() => { setOtpSent(false); setOtpCode(""); }}
                    className="w-full text-sm font-medium py-1 transition-colors" style={{ color: "#475569" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
                  >
                    Resend or change email
                  </button>
                </>
              )}
            </div>
          )}

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs font-medium"
                style={{ background: "rgba(255,255,255,0.04)", color: "#475569", borderRadius: 6 }}>
                or continue with
              </span>
            </div>
          </div>

          {googlePolling ? (
            <div className="w-full rounded-2xl p-4 flex flex-col items-center gap-3"
              style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)" }}>
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin" style={{ color: "#60a5fa" }} />
                <span className="text-sm font-semibold" style={{ color: "#93c5fd" }}>
                  Waiting for Google sign-in...
                </span>
              </div>
              <p className="text-xs text-center" style={{ color: "#64748b" }}>
                Complete sign-in in the browser, then press Back to return here.
              </p>
              <button onClick={stopPolling}
                className="text-xs font-medium underline transition-colors" style={{ color: "#475569" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center gap-3 rounded-2xl transition-all active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px 16px" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              <span className="flex-1 text-center text-sm font-semibold" style={{ color: "#e2e8f0" }}>
                Continue with Google
              </span>
            </button>
          )}
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm" style={{ color: "#475569" }}>
            Don't have an account?{" "}
            <Link href="/signup" className="font-bold transition-colors" style={{ color: "#60a5fa" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#93c5fd")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#60a5fa")}
            >
              Create one free
            </Link>
          </p>
          <p className="text-xs" style={{ color: "#334155" }}>
            Your account lets you track orders and manage your profile.
          </p>
        </div>
      </div>
    </div>
  );
}
