"use client";

import { useEffect, useState } from "react";
import { THEME_KEY, SIZE_KEY } from "@/components/ThemeApplier";

const THEMES = [
  { v: "clair", l: "Clair" },
  { v: "sombre", l: "Sombre" },
  { v: "auto", l: "Automatique (selon l'appareil)" },
];
const SIZES = [
  { v: "normal", l: "Normal" },
  { v: "grand", l: "Grand" },
  { v: "tres-grand", l: "Très grand" },
];

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : le réglage vaut pour cette page seulement.
  }
  window.dispatchEvent(new Event("manguifi:preferences"));
}

export default function AppearancePanel() {
  const [theme, setTheme] = useState("clair");
  const [size, setSize] = useState("normal");

  useEffect(() => {
    // Lecture du stockage local (hors React) une fois au montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(read(THEME_KEY, "clair"));
    setSize(read(SIZE_KEY, "normal"));
  }, []);

  function choose(setter: (v: string) => void, key: string, value: string) {
    setter(value);
    save(key, value);
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-navy-950">Affichage</legend>
      <div>
        <p className="mb-2 text-sm text-muted">Thème</p>
        <div className="grid gap-2">
          {THEMES.map((t) => (
            <label key={t.v} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 text-sm text-navy-950">
              <input type="radio" name="theme" value={t.v} checked={theme === t.v} onChange={() => choose(setTheme, THEME_KEY, t.v)} className="h-4 w-4" />
              {t.l}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm text-muted">Taille du texte</p>
        <div className="grid gap-2">
          {SIZES.map((s) => (
            <label key={s.v} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 text-sm text-navy-950">
              <input type="radio" name="taille" value={s.v} checked={size === s.v} onChange={() => choose(setSize, SIZE_KEY, s.v)} className="h-4 w-4" />
              {s.l}
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
