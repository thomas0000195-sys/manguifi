import { parsePhoneNumberFromString } from "libphonenumber-js";

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
