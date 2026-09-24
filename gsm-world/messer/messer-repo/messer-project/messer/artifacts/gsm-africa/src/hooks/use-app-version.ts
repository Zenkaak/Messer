import { useEffect, useRef } from "react";
import { toast } from "sonner";

function apiBase() {
  return (import.meta.env.BASE_URL as string).replace(/\/$/, "");
}

export function useAppVersion() {
  const currentVersion = useRef<string | null>(null);
  const toastShown = useRef(false);

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch(`${apiBase()}/api/version`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version: string };
        const incoming = data.version;
        if (!currentVersion.current) {
          currentVersion.current = incoming;
          return;
        }
        if (incoming !== currentVersion.current && !toastShown.current) {
          toastShown.current = true;
          const isAndroidApp = navigator.userAgent.includes("GSMWorldApp");
          // Cache-busting reload: navigate to the same page with a fresh query param
          // so the WebView fetches the latest version from the server.
          function hardReload() {
            const url = new URL(window.location.href);
            url.searchParams.set("_v", incoming);
            window.location.replace(url.toString());
          }
          toast(isAndroidApp ? "App Update Available" : "Update Available", {
            description: "A new version of GSM World is ready.",
            duration: isAndroidApp ? 60_000 : Infinity,
            action: {
              label: isAndroidApp ? "Update App" : "Update Now",
              onClick: hardReload,
            },
          });
          // Android app: auto-update after 60 s if user ignores the toast
          if (isAndroidApp) {
            setTimeout(hardReload, 60_000);
          }
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
