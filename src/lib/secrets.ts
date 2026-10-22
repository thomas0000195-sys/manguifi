/**
 * Accès aux secrets obligatoires (AUTH_SECRET, ENCRYPTION_KEY).
 *
 * Aucune valeur de repli n'existe : une clé prévisible permettrait de forger
 * des sessions ADMIN ou de recalculer les empreintes des emails et téléphones.
 * Si le secret manque ou est trop court, l'appel échoue immédiatement, en
 * production comme en développement. Les messages d'erreur ne contiennent
 * jamais la valeur du secret.
 *
 * Les secrets sont lus à chaque appel et non à l'import du module, pour que
 * `next build` (qui charge les modules sans forcément disposer de l'exécution
 * runtime) ne dépende pas de la présence des variables.
 */

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_PREFIX = "change-me";

export function readRequiredSecret(name: string, value: string | undefined): string {
  if (!value || value.length < MIN_SECRET_LENGTH || value.startsWith(PLACEHOLDER_PREFIX)) {
    throw new Error(
      `${name} est absent, trop court (${MIN_SECRET_LENGTH} caractères minimum) ou non remplacé. Configurez une valeur aléatoire dans l'environnement.`
    );
  }
  return value;
}

/** Clé de signature des sessions JWT. */
export function getAuthSecret(): string {
  return readRequiredSecret("AUTH_SECRET", process.env.AUTH_SECRET);
}

/**
 * Clé de chiffrement des données au repos et des empreintes (HMAC).
 * Utilise ENCRYPTION_KEY, ou AUTH_SECRET quand ENCRYPTION_KEY n'est pas
 * défini : cette chaîne existait déjà et doit rester identique, sinon les
 * données déjà chiffrées ou hachées deviendraient illisibles.
 */
export function getEncryptionSecret(): string {
  const name = process.env.ENCRYPTION_KEY ? "ENCRYPTION_KEY" : "AUTH_SECRET";
  return readRequiredSecret(name, process.env[name]);
}
