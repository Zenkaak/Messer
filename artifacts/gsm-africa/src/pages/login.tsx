import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, Hash } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function LoginPage() {
  const [, navigate] = useLocation();
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/account";
  const { login } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP flow state
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

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
    <div className="min-h-[80vh] flex flex-col justify-center p-6">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1a2332] flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Lock size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-foreground">Sign In</h1>
        <p className="text-sm text-muted-foreground mt-1">Access your GSM World account</p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab("password")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === "password" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
        >
          Password
        </button>
        <button
          onClick={() => setTab("otp")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === "otp" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
        >
          OTP (No Password)
        </button>
      </div>

      {/* Password login */}
      {tab === "password" && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full pl-9 pr-4 py-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-bold bg-[#1a2332] hover:bg-[#253246] text-white mt-2"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      )}

      {/* OTP login */}
      {tab === "otp" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            Enter your email and we'll send you a 6-digit code to sign in — no password needed.
          </div>
          {!otpSent ? (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                  />
                </div>
              </div>
              <Button
                onClick={sendOtp}
                className="w-full h-12 text-base font-bold bg-[#1a2332] hover:bg-[#253246] text-white"
                disabled={otpLoading || !otpEmail}
              >
                {otpLoading ? "Sending..." : "Send Login Code"}
              </Button>
            </>
          ) : (
            <>
              <div className="text-center py-2">
                <p className="text-sm text-gray-600">Code sent to <span className="font-bold">{otpEmail}</span></p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">6-Digit Code</label>
                <div className="relative">
                  <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full pl-9 pr-4 py-3 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono text-center tracking-widest text-lg"
                    onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                  />
                </div>
              </div>
              <Button
                onClick={verifyOtp}
                className="w-full h-12 text-base font-bold bg-[#1a2332] hover:bg-[#253246] text-white"
                disabled={otpLoading || otpCode.length !== 6}
              >
                {otpLoading ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <button
                onClick={() => { setOtpSent(false); setOtpCode(""); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium py-1"
              >
                Resend or change email
              </button>
            </>
          )}
        </div>
      )}

      {/* Google sign-in */}
      <div className="mt-6 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400 font-medium">or continue with</span>
        </div>
      </div>
      <button
        onClick={() => {
          const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
          window.location.href = `${base}/api/auth/google/redirect`;
        }}
        className="mt-3 w-full group relative flex items-center gap-0 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 bg-white"
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

      <div className="mt-5 text-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary font-bold hover:underline">
            Create one
          </Link>
        </p>
      </div>

      <div className="mt-4 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground text-center">
        Your account lets you track orders and manage your profile.
      </div>
    </div>
  );
}
