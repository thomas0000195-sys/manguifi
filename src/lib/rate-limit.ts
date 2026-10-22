/**
 * Limitation de débit partagée entre toutes les instances, stockée dans
 * Postgres (table RateLimitBucket). Les compteurs en mémoire ne fonctionnent
 * pas sur Vercel : chaque instance aurait son propre compteur.
 *
 * Politique :
 * - La limite principale porte sur l'identifiant visé (email, téléphone,
 *   identifiant de session). Elle protège un compte quelle que soit l'IP
 *   d'où viennent les tentatives.
 * - Une limite secondaire par IP est ajoutée seulement si l'IP peut être
 *   considérée comme fiable (TRUST_PROXY=true, derrière un reverse proxy).
 *   Sans proxy de confiance, l'en-tête X-Forwarded-For est contrôlé par le
 *   client : il ne sert alors à rien, et une clé commune à tous les clients
 *   bloquerait les utilisateurs légitimes.
 * - En cas d'erreur de stockage, la requête est refusée (fail closed).
 *
 * Aucune donnée personnelle n'est stockée : clés et IP sont hachées.
 */
import crypto from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";

export type RateLimitPolicy = {
  /** Tentatives autorisées par identifiant dans la fenêtre. */
  limit: number;
  windowMs: number;
  /** Tentatives autorisées par IP fiable dans la fenêtre (optionnel). */
  ipLimit?: number;
};

/** Exécute une requête SQL paramétrée (ex. `prisma.$queryRawUnsafe`). */
export type SqlExecutor = (sql: string, params: unknown[]) => Promise<Array<{ count: number }>>;

// Insertion ou incrément atomique. Quand la fenêtre précédente est expirée,
// le compteur repart à 1 avec une nouvelle échéance. Les dates sont passées
// en ISO UTC : Prisma stocke les DateTime en UTC sans fuseau, ce qui reste
// cohérent avec la comparaison ci-dessous.
const CONSUME_SQL = `
INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
VALUES ($1, 1, $2::timestamp)
ON CONFLICT ("key") DO UPDATE SET
  "count" = CASE WHEN "RateLimitBucket"."resetAt" < $3::timestamp THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
  "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" < $3::timestamp THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
RETURNING "count"`;

const PURGE_SQL = `DELETE FROM "RateLimitBucket" WHERE "resetAt" < $1::timestamp`;

/** Une purge sur 100 appels : évite de supprimer à chaque requête. */
const PURGE_PROBABILITY = 0.01;

function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Renvoie l'IP du client si le proxy est déclaré fiable, sinon null.
 * Avec X-Forwarded-For, la dernière valeur est celle ajoutée par le proxy
 * le plus proche ; les valeurs précédentes sont fournies par le client.
 * CLIENT_IP_HEADER permet d'utiliser un autre en-tête (ex. x-real-ip).
 */
export function getTrustedClientIp(requestHeaders: Pick<Headers, "get">): string | null {
  if (process.env.TRUST_PROXY !== "true") return null;

  const name = (process.env.CLIENT_IP_HEADER ?? "x-forwarded-for").toLowerCase();
  const raw = requestHeaders.get(name);
  if (!raw) return null;

  if (name === "x-forwarded-for") {
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? null;
  }
  return raw.trim() || null;
}

async function consume(exec: SqlExecutor, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await exec(CONSUME_SQL, [key, resetAt.toISOString(), now.toISOString()]);
  if (Math.random() < PURGE_PROBABILITY) {
    await exec(PURGE_SQL, [now.toISOString()]);
  }
  return Number(rows[0]?.count) <= limit;
}

/**
 * Cœur de la limitation, sans dépendance à Next ni à Prisma : permet de
 * tester la logique avec un exécuteur SQL quelconque.
 */
export async function evaluateRateLimit(
  exec: SqlExecutor,
  requestHeaders: Pick<Headers, "get">,
  scope: string,
  identifier: string,
  policy: RateLimitPolicy
): Promise<boolean> {
  const checks: Array<{ key: string; limit: number }> = [
    { key: `${scope}:id:${digest(identifier)}`, limit: policy.limit },
  ];
  const ip = getTrustedClientIp(requestHeaders);
  if (ip && policy.ipLimit !== undefined) {
    checks.push({ key: `${scope}:ip:${digest(ip)}`, limit: policy.ipLimit });
  }

  try {
    for (const check of checks) {
      if (!(await consume(exec, check.key, check.limit, policy.windowMs))) return false;
    }
    return true;
  } catch (err) {
    // Journaliser le type d'erreur seulement : le message SQL peut contenir des valeurs.
    console.error(`Rate limit indisponible (${scope}) :`, err instanceof Error ? err.name : "erreur");
    return false;
  }
}

/** Point d'entrée des actions serveur. */
export async function checkRateLimit(scope: string, identifier: string, policy: RateLimitPolicy): Promise<boolean> {
  const exec: SqlExecutor = (sql, params) =>
    prisma.$queryRawUnsafe<Array<{ count: number }>>(sql, ...params);
  return evaluateRateLimit(exec, await headers(), scope, identifier, policy);
}
