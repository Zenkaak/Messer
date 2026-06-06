import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

if (import.meta.env.VITE_API_BASE_URL) {
  setBaseUrl(import.meta.env.VITE_API_BASE_URL as string);
}

// Wire up auth token so all generated API hooks send Authorization: Bearer <token>
setAuthTokenGetter(() => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("gsmafrica_token");
});

const root = document.getElementById("root");

if (!root) {
  document.body.innerHTML = '<div style="padding:16px;font-family:sans-serif">App failed to mount.</div>';
} else {
  createRoot(root).render(<App />);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed" && navigator.serviceWorker.controller) {
          newSW.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}
