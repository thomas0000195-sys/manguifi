"use client";

import { Download } from "lucide-react";
import { INSTALL_DISMISS_KEY } from "@/components/InstallPrompt";

/** Permet de revoir les consignes d'installation après les avoir fermées. */
export default function InstallGuideButton() {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.removeItem(INSTALL_DISMISS_KEY);
        } catch {
          // Stockage indisponible : la consigne reste affichée au prochain chargement.
        }
        window.location.reload();
      }}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-navy-950 hover:bg-navy-50"
    >
      <Download className="h-4 w-4" aria-hidden="true" /> Afficher les consignes d&apos;installation
    </button>
  );
}
