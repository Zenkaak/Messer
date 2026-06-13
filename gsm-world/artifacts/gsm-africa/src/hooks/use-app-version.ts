import { useEffect, useRef } from "react";

function apiBase() {
  return (import.meta.env.BASE_URL as string).replace(/\/$/, "");
}

export function useAppVersion() {
  const currentVersion = useRef<string | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    async function checkVersion() {
      if (reloading.current) return;
      try {
        const res = await fetch(`${apiBase()}/api/version`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version: string };
        const incoming = data.version;
        if (!currentVersion.current) {
          currentVersion.current = incoming;
          return;
        }
        if (incoming !== currentVersion.current) {
          reloading.current = true;
          // Silent background reload — no toast, no prompt
          function hardReload() {
            const url = new URL(window.location.href);
            url.searchParams.set("_v", incoming);
            window.location.replace(url.toString());
          }
          // Give the page 3 seconds to finish any in-flight work
          setTimeout(hardReload, 3000);
        }
      } catch {
        // Network error — silently ignore
      }
    }

    checkVersion();
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}
