import { parsePhoneNumberFromString } from "libphonenumber-js";
import crypto from "node:crypto";

/**
 * Deterministic HMAC-SHA256 of a normalized E.164 phone number — lets the
 * database index and look up phones by exact match while the actual
 * `phone` column stores an AES-256-GCM ciphertext (see lib/crypto.ts) that
 * can't be queried directly. Same key material as the encryption key, on
 * the theory that anyone who has compromised ENCRYPTION_KEY has already
 * compromised everything this would protect anyway.
 */
export function hashPhone(e164: string): string {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? "manguifi-dev-fallback-key";
  return crypto.createHmac("sha256", secret).update(e164).digest("hex");
}

/**
 * Normalizes a phone number to E.164 (e.g. "+221771234567"). Defaults to
 * Senegal when the input has no country code, since that's this app's
 * primary market — pass a different `defaultCountry` for other deployments.
 * Returns null if the number isn't a plausible phone number at all.
 */
export function toE164(raw: string, defaultCountry: "SN" = "SN"): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;

  return parsed.number; // already E.164 format
}

export function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
