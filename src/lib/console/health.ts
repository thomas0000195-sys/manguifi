import { prisma } from "@/lib/prisma";
import { EXPECTED_MAX_AGE_HOURS } from "@/lib/console/heartbeat";

/** État des tâches, taille de la base et erreurs par heure. Aucun secret ni variable d'environnement. */
export async function getHealth() {
  const now = Date.now();
  const heartbeats = await prisma.systemHeartbeat.findMany({ orderBy: { jobName: "asc" } });
  const jobs = heartbeats.map((h) => {
    const maxAge = EXPECTED_MAX_AGE_HOURS[h.jobName];
    const ageHours = (now - h.lastRunAt.getTime()) / (60 * 60 * 1000);
    return {
      name: h.jobName,
      lastRunAt: h.lastRunAt,
      status: h.lastStatus,
      durationMs: h.lastDurationMs,
      error: h.lastError,
      overdue: maxAge !== undefined && ageHours > maxAge,
    };
  });

  const sizeRows = await prisma.$queryRawUnsafe<{ bytes: bigint }[]>(`SELECT pg_database_size(current_database())::bigint AS bytes`);
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const errorRows = await prisma.$queryRawUnsafe<{ hour: Date; n: bigint }[]>(
    `SELECT date_trunc('hour', "createdAt") AS hour, COUNT(*)::bigint AS n FROM "ErrorLog" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`,
    dayAgo
  );

  return {
    jobs,
    databaseBytes: Number(sizeRows[0]?.bytes ?? 0),
    errorsByHour: errorRows.map((r) => ({ hour: r.hour, count: Number(r.n) })),
  };
}
