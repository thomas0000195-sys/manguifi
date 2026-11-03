/**
 * Client HTTP/JSON de PayDunya (paiement avec redirection), limité à ce que
 * Manguifi utilise : créer une facture de paiement et la confirmer.
 *
 * Aucune clé n'apparaît dans les messages d'erreur ni dans les journaux.
 * Le transport est injectable (fetchImpl) pour les tests, qui n'appellent
 * jamais le réseau.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { PaydunyaConfig } from "./config";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class PaydunyaApiError extends Error {}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Hash de vérification : SHA-512 de la clé principale (MasterKey), en hexadécimal.
 * Source : section « Etat de paiement » de la documentation PayDunya.
 */
export function expectedPaydunyaHash(masterKey: string): string {
  return createHash("sha512").update(masterKey, "utf8").digest("hex");
}

/** Comparaison à temps constant. Un hash absent ou de mauvaise longueur est refusé. */
export function isValidPaydunyaHash(received: string | null | undefined, masterKey: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expectedPaydunyaHash(masterKey), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function authHeaders(cfg: PaydunyaConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "PAYDUNYA-MASTER-KEY": cfg.masterKey,
    "PAYDUNYA-PRIVATE-KEY": cfg.privateKey,
    "PAYDUNYA-TOKEN": cfg.token,
  };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new PaydunyaApiError(`Réponse PayDunya illisible (HTTP ${res.status}).`);
  }
  if (!data || typeof data !== "object") {
    throw new PaydunyaApiError(`Réponse PayDunya inattendue (HTTP ${res.status}).`);
  }
  return data as Record<string, unknown>;
}

export type CreateCheckoutInput = {
  amountXof: number;
  description: string;
  storeName: string;
  customData: Record<string, string | number>;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
};

export type CreatedCheckout = { token: string; checkoutUrl: string };

/** POST …/checkout-invoice/create. Retourne le jeton et l'URL de paiement (response_text). */
export async function createCheckoutInvoice(
  cfg: PaydunyaConfig,
  input: CreateCheckoutInput,
  fetchImpl: FetchLike = fetch
): Promise<CreatedCheckout> {
  const body = {
    invoice: { total_amount: input.amountXof, description: input.description },
    store: { name: input.storeName },
    custom_data: input.customData,
    actions: {
      cancel_url: input.cancelUrl,
      return_url: input.returnUrl,
      callback_url: input.callbackUrl,
    },
  };

  const res = await fetchImpl(`${cfg.apiBaseUrl}/checkout-invoice/create`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await readJson(res);

  if (data.response_code !== "00" || typeof data.token !== "string" || typeof data.response_text !== "string") {
    throw new PaydunyaApiError(`PayDunya a refusé la création de la facture (code ${String(data.response_code ?? "?")}).`);
  }
  return { token: data.token, checkoutUrl: data.response_text };
}

export type CheckoutStatus = "completed" | "pending" | "cancelled" | "failed" | "unknown";

export type ConfirmedCheckout = {
  token: string;
  status: CheckoutStatus;
  /** Mode annoncé par PayDunya : "test" ou "live". */
  mode: string;
  totalAmount: number | null;
  /** Vrai si le hash de la réponse correspond à la clé principale configurée. */
  hashValid: boolean;
  receiptUrl: string | null;
  failReason: string | null;
};

function normalizeStatus(raw: unknown): CheckoutStatus {
  switch (typeof raw === "string" ? raw.toLowerCase() : "") {
    case "completed":
      return "completed";
    case "pending":
      return "pending";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

/** GET …/checkout-invoice/confirm/{token} : statut réel côté PayDunya. */
export async function confirmCheckoutInvoice(
  cfg: PaydunyaConfig,
  token: string,
  fetchImpl: FetchLike = fetch
): Promise<ConfirmedCheckout> {
  const res = await fetchImpl(`${cfg.apiBaseUrl}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    method: "GET",
    headers: authHeaders(cfg),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await readJson(res);

  if (data.response_code !== "00") {
    throw new PaydunyaApiError(`PayDunya n'a pas retrouvé la facture (code ${String(data.response_code ?? "?")}).`);
  }

  const invoice = (data.invoice ?? {}) as Record<string, unknown>;
  const amount = Number(invoice.total_amount);
  const failReason = typeof data.fail_reason === "string" && data.fail_reason ? data.fail_reason.slice(0, 200) : null;

  return {
    token: typeof invoice.token === "string" ? invoice.token : token,
    status: normalizeStatus(data.status),
    mode: typeof data.mode === "string" ? data.mode : "",
    totalAmount: Number.isFinite(amount) ? amount : null,
    hashValid: isValidPaydunyaHash(typeof data.hash === "string" ? data.hash : null, cfg.masterKey),
    receiptUrl: typeof data.receipt_url === "string" ? data.receipt_url : null,
    failReason,
  };
}
