import { prisma } from "@/lib/prisma";
import { scrubErrorText } from "@/lib/console/errors";

/** Enregistre le passage d'une tâche planifiée. N'échoue jamais. */
export async function recordHeartbeat(jobName: string, status: "ok" | "error", durationMs: number, error?: string) {
  try {
    await prisma.systemHeartbeat.upsert({
      where: { jobName },
      create: { jobName, lastRunAt: new Date(), lastStatus: status, lastDurationMs: durationMs, lastError: error ? scrubErrorText(error) : null },
      update: { lastRunAt: new Date(), lastStatus: status, lastDurationMs: durationMs, lastError: error ? scrubErrorText(error) : null },
    });
  } catch {
    console.error("État des tâches indisponible.");
  }
}

/** Délai maximal avant qu'une tâche soit considérée en retard. */
export const EXPECTED_MAX_AGE_HOURS: Record<string, number> = {
  backup: 26,
  retention: 8 * 24,
};
