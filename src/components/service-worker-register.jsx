import { useEffect } from "react";

// Registers the PWA service worker (M16). Registration only runs in the browser
// in production builds — in dev there is no /sw.js to serve and we don't want a
// caching layer between the developer and Turbopack/HMR.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration is best-effort; a failure must never break the app.
    });
  }, []);

  return null;
}
