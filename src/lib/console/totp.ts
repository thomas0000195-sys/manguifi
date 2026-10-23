import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

/** Second facteur de la console : application d'authentification (TOTP, RFC 6238). */

const ISSUER = "Manguifi Console";

export function newTotpSecret(): string {
  return generateSecret();
}

export function totpUri(secret: string, accountLabel: string): string {
  return generateURI({ issuer: ISSUER, label: accountLabel, secret });
}

export async function totpQrDataUrl(secret: string, accountLabel: string): Promise<string> {
  return QRCode.toDataURL(totpUri(secret, accountLabel), { margin: 1, width: 240 });
}

/** Vérifie un code à 6 chiffres. Tolère une dérive d'une période (30 s). */
export async function checkTotp(secret: string, token: string): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false;
  const result = await verify({ secret, token, epochTolerance: 30 });
  return result.valid === true;
}
