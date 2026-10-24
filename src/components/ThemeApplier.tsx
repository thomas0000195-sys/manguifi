"use client";

import { useEffect } from "react";

export const THEME_KEY = "manguifi_theme";
export const SIZE_KEY = "manguifi_taille";

/**
 * Applique le thème et la taille de texte choisis par l'utilisateur sur <html>.
 * Le choix est mémorisé sur l'appareil. En cas d'erreur de stockage, on garde les valeurs par défaut.
 */
export default function ThemeApplier() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");

    function apply() {
      let theme = "clair";
      let size = "normal";
      try {
        theme = localStorage.getItem(THEME_KEY) ?? "clair";
        size = localStorage.getItem(SIZE_KEY) ?? "normal";
      } catch {
        // Stockage indisponible : valeurs par défaut.
      }
      const resolved = theme === "auto" ? (media?.matches ? "sombre" : "clair") : theme;
      root.dataset.theme = resolved === "sombre" ? "sombre" : "clair";
      root.dataset.taille = ["normal", "grand", "tres-grand"].includes(size) ? size : "normal";
    }

    apply();
    media?.addEventListener?.("change", apply);
    window.addEventListener("manguifi:preferences", apply);
    return () => {
      media?.removeEventListener?.("change", apply);
      window.removeEventListener("manguifi:preferences", apply);
    };
  }, []);

  return null;
}
