/**
 * Configuration PayDunya, lue depuis les variables d'environnement.
 *
 * - PAYDUNYA_MODE absent : l'intégration est désactivée et rien ne change
 *   dans l'application (c'est le comportement par défaut).
 * - PAYDUNYA_MODE présent (test ou live) : toutes les clés du mode doivent
 *   être présentes, sinon l'application refuse de démarrer
 *   (validatePaydunyaEnvAtStartup, appelé depuis src/instrumentation.ts).
 *
 * Les messages d'erreur ne contiennent jamais la valeur d'une clé : seulement
 * le nom de la variable manquante.
 */

export type PaydunyaMode = "test" | "live";

export type PaydunyaConfig = {
  mode: PaydunyaMode;
  isTest: boolean;
  /** Racine de l'API HTTP/JSON du mode courant (sandbox-api en test). */
  apiBaseUrl: string;
  masterKey: string;
  privateKey: string;
  token: string;
  /** Identifiants (Organization.id) autorisés à payer en ligne. Vide = personne. */
  enabledCompanyIds: string[];
  /** URL publique de l'application, sans slash final (retour et notification). */
  appUrl: string;
};

export class PaydunyaConfigError extends Error {}

// Source : https://developers.paydunya.com/doc/FR/http_json (section « Paiement avec redirection »).
const API_BASE_URL: Record<PaydunyaMode, string> = {
  test: "https://app.paydunya.com/sandbox-api/v1",
  live: "https://app.paydunya.com/api/v1",
};

/**
 * Lit et valide la configuration. Retourne null si l'intégration n'est pas
 * configurée. Lève PaydunyaConfigError si elle est configurée mais incomplète.
 */
export function readPaydunyaConfig(env: NodeJS.ProcessEnv = process.env): PaydunyaConfig | null {
  const rawMode = env.PAYDUNYA_MODE?.trim();
  if (!rawMode) return null;

  if (rawMode !== "test" && rawMode !== "live") {
    throw new PaydunyaConfigError("PAYDUNYA_MODE doit valoir « test » ou « live ».");
  }
  const mode: PaydunyaMode = rawMode;

  // PAYDUNYA_PUBLIC_KEY n'est pas requise : l'API HTTP/JSON ne l'utilise pas (voir docs/PAYDUNYA.md).
  const required = ["PAYDUNYA_MASTER_KEY", "PAYDUNYA_PRIVATE_KEY", "PAYDUNYA_TOKEN", "APP_URL"] as const;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new PaydunyaConfigError(`Variables PayDunya manquantes : ${missing.join(", ")}.`);
  }

  const appUrl = env.APP_URL!.trim().replace(/\/+$/, "");
  if (mode === "live" && !appUrl.startsWith("https://")) {
    throw new PaydunyaConfigError("APP_URL doit commencer par https:// en mode live.");
  }

  const enabledCompanyIds = (env.PAYDUNYA_ENABLED_COMPANY_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    mode,
    isTest: mode === "test",
    apiBaseUrl: API_BASE_URL[mode],
    masterKey: env.PAYDUNYA_MASTER_KEY!.trim(),
    privateKey: env.PAYDUNYA_PRIVATE_KEY!.trim(),
    token: env.PAYDUNYA_TOKEN!.trim(),
    enabledCompanyIds,
    appUrl,
  };
}

/** Appelé au démarrage : échoue proprement si l'intégration est configurée à moitié. */
export function validatePaydunyaEnvAtStartup(env: NodeJS.ProcessEnv = process.env): void {
  readPaydunyaConfig(env);
}
