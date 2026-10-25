import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Coquille iPhone. Le site www.manguifi.tech reste la source unique de l'application :
 * toute mise à jour du site est visible immédiatement, sans nouvelle version App Store.
 * Seule la page hors ligne est locale (dossier www).
 */
const config: CapacitorConfig = {
  appId: "tech.manguifi.app",
  appName: "Manguifi",
  webDir: "www",
  server: {
    url: "https://www.manguifi.tech/?source=ios",
    cleartext: false,
    allowNavigation: ["www.manguifi.tech"],
  },
  ios: {
    contentInset: "automatic",
    scheme: "Manguifi",
  },
};

export default config;
