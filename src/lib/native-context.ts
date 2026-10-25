/**
 * Détection du contexte d'exécution : navigateur, application Android (TWA) ou iPhone (Capacitor).
 * La logique est une fonction pure (testée) ; seule la lecture du navigateur est séparée.
 */
export type NativeContext = { isTwa: boolean; isCapacitor: boolean; isStoreApp: boolean };

export const SOURCE_KEY = "manguifi_source";

export function resolveNativeContext(input: {
  source: string | null;
  referrer: string;
  capacitor: boolean;
}): NativeContext {
  const isTwa = input.source === "twa" || input.referrer.startsWith("android-app://");
  const isCapacitor = input.capacitor || input.source === "ios";
  return { isTwa, isCapacitor, isStoreApp: isTwa || isCapacitor };
}

/** Lit le contexte dans le navigateur. Le paramètre ?source= est retenu pour la session. */
export function detectNativeContext(): NativeContext {
  if (typeof window === "undefined") return { isTwa: false, isCapacitor: false, isStoreApp: false };

  let source: string | null = null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("source");
    if (fromUrl) sessionStorage.setItem(SOURCE_KEY, fromUrl);
    source = fromUrl ?? sessionStorage.getItem(SOURCE_KEY);
  } catch {
    // Stockage indisponible : on se fie à l'URL seulement.
    source = new URLSearchParams(window.location.search).get("source");
  }

  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
  return resolveNativeContext({ source, referrer: document.referrer, capacitor });
}
