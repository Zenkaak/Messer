import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("gsm-theme");
      return saved === "light" || saved === "dark" ? saved : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const vars: Record<string, string> = theme === "dark"
      ? {
          "--bg-page":          "#060b15",
          "--color-page":       "#e2e8f0",
          "--bg-marquee-fade":  "#060b15",
          "--text-heading":     "#f1f5f9",
          "--text-link":        "#60a5fa",
          "--text-cat-label":   "#94a3b8",
          "--bg-card-subtle":   "rgba(255,255,255,0.025)",
          "--border-card":      "rgba(255,255,255,0.06)",
          "--border-card-md":   "rgba(255,255,255,0.07)",
          "--bg-step-num":      "#0c1a32",
          "--color-step-num":   "#818cf8",
          "--border-step-num":  "rgba(99,102,241,0.35)",
          "--bg-step-row":      "rgba(255,255,255,0.025)",
          "--border-step-row":  "rgba(255,255,255,0.05)",
          "--text-step-title":  "#f1f5f9",
          "--text-step-desc":   "#475569",
        }
      : {
          "--bg-page":          "#f0f6ff",
          "--color-page":       "#0f172a",
          "--bg-marquee-fade":  "#f0f6ff",
          "--text-heading":     "#0f172a",
          "--text-link":        "#2563eb",
          "--text-cat-label":   "#475569",
          "--bg-card-subtle":   "rgba(255,255,255,0.85)",
          "--border-card":      "rgba(0,0,0,0.09)",
          "--border-card-md":   "rgba(0,0,0,0.1)",
          "--bg-step-num":      "#e8f0fe",
          "--color-step-num":   "#4f46e5",
          "--border-step-num":  "rgba(99,102,241,0.3)",
          "--bg-step-row":      "rgba(255,255,255,0.7)",
          "--border-step-row":  "rgba(0,0,0,0.07)",
          "--text-step-title":  "#0f172a",
          "--text-step-desc":   "#64748b",
        };

    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
    }

    try {
      localStorage.setItem("gsm-theme", theme);
    } catch {}
  }, [theme]);

  function toggle() {
    setTheme(t => (t === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
