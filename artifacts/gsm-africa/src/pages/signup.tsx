import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck, Zap, Globe, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/context/notification-context";

type Step = "register" | "verify";

export function SignupPage() {
  const [, navigate] = useLocation();
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/account";
  const { login } = useAuth();
  const { toast } = useToast();
  const { notify } = useNotifications();

  const [step, setStep] = useState<Step>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP step
  const [otp, setOtp] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<{ id: number; name: string | null; email: string } | null>(null);
  const [resending, setResending] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json() as { error?: string; token?: string; user?: { id: number; name: string | null; email: string } };
      if (!res.ok) {
        toast({ title: data.error || "Registration failed", variant: "destructive" });
        return;
      }
      setPendingToken(data.token!);
      setPendingUser(data.user!);
      setStep("verify");
      toast({ title: "Verification code sent!", description: `Check your email at ${email}.` });
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      toast({ title: "Enter the 6-digit code from your email.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp.trim() }),
      });
      const data = await res.json() as { error?: string; success?: boolean };
      if (!res.ok || !data.success) {
        toast({ title: data.error || "Invalid or expired code.", variant: "destructive" });
        return;
      }
      login(pendingToken!, pendingUser!);
      notify("Welcome to GSM World!", `Hi ${pendingUser?.name || pendingUser?.email}, your account is now verified.`, "success");
      navigate(returnTo);
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await fetch("/api/auth/otp-login/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast({ title: "Code resent!", description: "Check your inbox again." });
    } catch {
      toast({ title: "Could not resend. Try again shortly.", variant: "destructive" });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-white">

      {/* Dark hero */}
      <div
        className="flex flex-col items-center justify-center pt-12 pb-10 px-6 text-center"
        style={{ background: "linear-gradient(160deg,#1a2332 0%,#1e3a5f 100%)" }}
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center mb-4 shadow-lg">
          <User size={28} className="text-white" />
        </div>
        {step === "register" ? (
          <>
            <h1 className="text-2xl font-black text-white mb-1">Create Account</h1>
            <p className="text-blue-300/70 text-sm max-w-[220px]">Join thousands of GSM professionals worldwide</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white mb-1">Verify Your Email</h1>
            <p className="text-blue-300/70 text-sm max-w-[260px]">We sent a 6-digit code to <span className="text-blue-300 font-semibold">{email}</span></p>
          </>
        )}
      </div>

      {/* Form */}
      <div className="px-5 pt-6 pb-8 space-y-4">

        {step === "register" ? (
          <form onSubmit={handleRegister} className="space-y-3">
            {/* Full name */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">
                Full Name <span className="normal-case text-gray-300">(optional)</span>
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Minimum 6 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1a2332] hover:bg-[#253246] text-white font-black text-base rounded-2xl transition-colors shadow-lg shadow-gray-900/20 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating account…</>
              ) : "Create Account"}
            </button>
          </form>
        ) : (
          /* ── OTP Verification Step ── */
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-blue-700 font-medium">
                A 6-digit verification code was sent to
              </p>
              <p className="text-sm font-black text-blue-900 mt-0.5">{email}</p>
              <p className="text-xs text-blue-500 mt-1">The code expires in 10 minutes.</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="w-full py-4 text-center text-3xl font-black tracking-[0.5em] border-2 border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3.5 bg-[#1a2332] hover:bg-[#253246] text-white font-black text-base rounded-2xl transition-colors shadow-lg shadow-gray-900/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying…</>
              ) : "Verify & Activate Account"}
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => { setStep("register"); setOtp(""); }}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-blue-600 font-semibold hover:underline disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {step === "register" && (
          <>
            {/* Google sign-in divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400 font-medium">or sign up with</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
                window.location.href = `${base}/api/auth/google/redirect`;
              }}
              className="w-full group relative flex items-center gap-0 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 bg-white"
              style={{ minHeight: "48px" }}
            >
              <span className="flex items-center justify-center bg-white w-12 h-12 shrink-0 border-r border-gray-100">
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              </span>
              <span className="flex-1 text-center text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors pr-3">
                Continue with Google
              </span>
            </button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 font-bold hover:underline">Sign in</Link>
            </p>

            {/* Trust features */}
            <div className="pt-2 grid grid-cols-3 gap-2">
              {[
                { icon: <ShieldCheck size={15} className="text-green-600" />, label: "Secure" },
                { icon: <Zap size={15} className="text-yellow-500" />, label: "Instant" },
                { icon: <Globe size={15} className="text-blue-600" />, label: "Worldwide" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 bg-gray-50 border border-gray-100 rounded-xl py-3">
                  {icon}
                  <span className="text-[10px] font-semibold text-gray-500">{label}</span>
                </div>
              ))}
            </div>

            <p className="text-center text-[11px] text-gray-400">
              By creating an account you agree to our terms of service.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
