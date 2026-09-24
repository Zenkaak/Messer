import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

const TOKEN_KEY = "gsmafrica_token";
const USER_KEY = "gsmafrica_user";
const GUEST_SESSION_KEY = "gsm_session_id";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  }, [user]);

  function login(newToken: string, newUser: AuthUser) {
    const guestSessionId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(GUEST_SESSION_KEY)
        : null;

    setToken(newToken);
    setUser(newUser);

    if (guestSessionId) {
      fetch("/api/cart/migrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
        },
        body: JSON.stringify({ guestSessionId }),
      })
        .then(() => {
          window.localStorage.removeItem(GUEST_SESSION_KEY);
        })
        .catch(() => {
          // Cart migration is best-effort — guest items may not transfer but login still succeeds
        });
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  function updateUser(updatedUser: AuthUser) {
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
