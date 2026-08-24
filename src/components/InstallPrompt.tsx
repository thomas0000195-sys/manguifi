"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "manguifi_install_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setDismissed(false);

    if (isIos()) {
      setShowIosTip(true);
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferred(null);
  }

  if (dismissed || (!deferred && !showIosTip)) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-navy-50 px-4 py-2.5 text-xs">
      {deferred ? (
        <>
          <span className="flex items-center gap-2 text-navy-900">
            <Download className="h-3.5 w-3.5 shrink-0" />
            Installez Manguifi sur cet appareil pour un accès plus rapide.
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={install}
              className="rounded-lg bg-navy-900 px-3 py-1.5 font-semibold text-white hover:bg-navy-800"
            >
              Installer
            </button>
            <button onClick={dismiss} className="p-1 text-muted hover:text-navy-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="flex items-center gap-2 text-navy-900">
            <Share className="h-3.5 w-3.5 shrink-0" />
            Sur iPhone : appuyez sur Partager, puis « Sur l&apos;écran d&apos;accueil ».
          </span>
          <button onClick={dismiss} className="shrink-0 p-1 text-muted hover:text-navy-900">
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
