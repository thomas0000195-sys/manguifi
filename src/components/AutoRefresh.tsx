"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-fetches the current server component tree on an interval so
 * dashboards feel "live" (new punches, resolved anomalies) without the user
 * having to hit reload. Pauses while the tab is hidden to avoid burning
 * requests in background tabs.
 */
export default function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function start() {
      if (timer.current) return;
      timer.current = setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, intervalMs);
    }
    function stop() {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }
    start();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      }
    });
    return stop;
  }, [router, intervalMs]);

  return null;
}
