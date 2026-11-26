"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-fetches the current server component tree on an interval so
 * dashboards feel "live" (new punches, resolved anomalies) without the user
 * having to hit reload. Pauses while the tab is hidden to avoid burning
 * requests in background tabs.
 *
 * Correction : l'ancienne version ajoutait un écouteur « visibilitychange »
 * à chaque exécution de l'effet, sans jamais le retirer, et relançait un
 * rechargement à chaque retour sur l'onglet. Cette version n'a qu'un seul
 * minuteur et un seul écouteur, tous deux retirés au démontage.
 */
export default function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function tick() {
      if (document.visibilityState === "visible") router.refresh();
    }
    function start() {
      if (timer === null) timer = setInterval(tick, intervalMs);
    }
    function stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalMs]);

  return null;
}
