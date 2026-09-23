"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in the browser only. Runs once on mount.
 * Never touches the server or native app environments.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("Service worker registration failed:", error);
        }
      });
    };

    // This effect runs after hydration, which is often AFTER the window
    // `load` event has already fired (cached assets, client-side navigation)
    // — listening unconditionally meant register() never ran and the site
    // silently had no service worker for many visits. Register immediately
    // when the document is already loaded; listen only when it is not.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
