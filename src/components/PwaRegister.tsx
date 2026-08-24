"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Service workers require a secure context; skip silently on plain
    // http (e.g. LAN testing) instead of throwing in the console.
    if (!window.isSecureContext) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* non-fatal — the app works fine without the SW, it only enables install */
    });
  }, []);

  return null;
}
