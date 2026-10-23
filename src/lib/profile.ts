/**
 * Règles du profil employé (téléphone). Sans dépendance serveur : utilisable
 * dans le navigateur comme sur le serveur.
 */

/** Mobile sénégalais : 9 chiffres commençant par 70, 75, 76, 77 ou 78, avec ou sans +221. */
const SN_MOBILE = /^(?:\+221|00221)?\s?(7[05678])\s?(\d{3})\s?(\d{2})\s?(\d{2})$/;

/** Renvoie le numéro au format +221XXXXXXXXX, ou null s'il est invalide. */
export function normalizeSenegalMobile(raw: string): string | null {
  const trimmed = raw.trim();
  const m = trimmed.match(SN_MOBILE);
  if (!m) return null;
  return `+221${m[1]}${m[2]}${m[3]}${m[4]}`;
}

/** Affichage lisible : +221 77 123 45 67. */
export function formatSenegalMobile(e164: string): string {
  const d = e164.replace(/^\+221/, "");
  return `+221 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/** Pour le journal : ne garde que les 3 derniers chiffres (le champ est personnel). */
export function maskPhone(e164: string): string {
  return `+221 ** *** ${e164.slice(-3)}`;
}
