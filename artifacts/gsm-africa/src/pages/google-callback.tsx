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
  const [status, setStatus] = useState<"loading" | "error">("loading");
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

    // Fetch full user profile to get the real user id
    fetch(`${apiBase()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${decodedToken}` },
    })
      .then((r) => r.json() as Promise<{ user?: { id: number; email: string; name: string | null } }>)
      .then((data) => {
        if (data.user) {
          login(decodedToken, data.user);
        } else {
          login(decodedToken, { id: 0, email: decodedEmail, name: decodedName });
        }
        toast({ title: "Signed in with Google!", description: `Welcome, ${decodedEmail}` });
        navigate("/account");
      })
      .catch(() => {
        login(decodedToken, { id: 0, email: decodedEmail, name: decodedName });
        toast({ title: "Signed in with Google!", description: `Welcome, ${decodedEmail}` });
        navigate("/account");
      });
  }, []);

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
