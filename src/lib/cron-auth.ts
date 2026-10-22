import crypto from "node:crypto";

export type CronAuthResult = "ok" | "unconfigured" | "unauthorized";

/**
 * Vérifie l'en-tête `Authorization: Bearer <CRON_SECRET>` des routes cron.
 *
 * - Le secret n'est accepté que dans l'en-tête, jamais dans l'URL : une URL
 *   est journalisée par les serveurs, les proxys et les outils de monitoring.
 * - La comparaison se fait sur des empreintes SHA-256 de longueur fixe avec
 *   timingSafeEqual, pour ne pas révéler la longueur ni le préfixe du secret.
 * - Sans CRON_SECRET configuré, la route refuse de fonctionner.
 */
export function checkCronAuth(authorization: string | null): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "unconfigured";

  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const provided = crypto.createHash("sha256").update(token).digest();
  const expected = crypto.createHash("sha256").update(secret).digest();

  return crypto.timingSafeEqual(provided, expected) && token !== "" ? "ok" : "unauthorized";
}
