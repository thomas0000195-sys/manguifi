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

const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=]+)$/;

/**
 * Contrôle serveur de la photo de profil : JPEG, PNG ou WebP, 2 Mo maximum
 * après compression. Ne jamais se fier au navigateur seul.
 */
export function checkProfilePhoto(dataUrl: string): { ok: true } | { ok: false; error: string } {
  const match = dataUrl.match(PHOTO_PATTERN);
  if (!match) return { ok: false, error: "Format d'image invalide : JPEG, PNG ou WebP uniquement." };
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > PHOTO_MAX_BYTES) return { ok: false, error: "La photo dépasse 2 Mo après compression." };
  return { ok: true };
}
