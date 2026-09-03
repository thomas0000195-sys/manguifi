/**
 * Restores one organization from a backup JSON produced by
 * /api/cron/backup (see src/app/api/cron/backup/route.ts).
 *
 * This is a DISASTER-RECOVERY tool, not something to run casually:
 * - Photos/documents in the backup file are still AES-256-GCM encrypted
 *   (same as in the live database) — this script writes them back as-is,
 *   no re-encryption needed. Restoring onto a different ENCRYPTION_KEY
 *   than the one the backup was taken under will silently produce
 *   undecryptable blobs — always restore with the same key.
 * - It refuses to run if an organization with the same id already exists,
 *   to avoid silently clobbering live data — delete it first if you really
 *   mean to replace it.
 *
 * The backup can come from either a local JSON file, or straight from
 * Vercel Blob (where /api/cron/backup writes them since it can no longer
 * rely on local disk on Vercel) — pass either a local path or the blob
 * pathname (e.g. "backups/2026-01-01T00-00-00-000Z_acme_abc123.json", as
 * printed by /api/cron/backup or `npx tsx scripts/list-backups.ts").
 * Fetching from Blob requires BLOB_READ_WRITE_TOKEN in the environment.
 *
 * Usage:
 *   npx tsx scripts/restore-backup.ts backups/2026-01-01T00-00-00-000Z_acme_abc123.json
 */
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { get } from "@vercel/blob";

const prisma = new PrismaClient();

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors the untyped JSON.parse this replaces
async function loadBackup(source: string): Promise<any> {
  if (existsSync(source)) {
    const raw = await readFile(source, "utf8");
    return JSON.parse(raw);
  }

  const result = await get(source, { access: "private" });
  if (!result || result.statusCode !== 200) {
    console.error(`Aucun fichier local ni blob trouvé pour "${source}".`);
    process.exit(1);
  }
  const raw = await new Response(result.stream).text();
  return JSON.parse(raw);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/restore-backup.ts <chemin-local-ou-pathname-blob>");
    process.exit(1);
  }

  const data = await loadBackup(file);

  const existing = await prisma.organization.findUnique({ where: { id: data.org.id } });
  if (existing) {
    console.error(
      `L'organisation "${data.org.name}" (${data.org.id}) existe déjà. Supprimez-la d'abord si vous voulez vraiment la remplacer.`
    );
    process.exit(1);
  }

  console.log(`Restauration de "${data.org.name}" depuis ${file}...`);

  await prisma.$transaction(async (tx) => {
    await tx.organization.create({
      data: {
        id: data.org.id,
        name: data.org.name,
        createdAt: new Date(data.org.createdAt),
        photoOnPunchEnabled: data.org.photoOnPunchEnabled,
        allowedTimeWindowEnabled: data.org.allowedTimeWindowEnabled,
        allowedTimeWindowStart: data.org.allowedTimeWindowStart,
        allowedTimeWindowEnd: data.org.allowedTimeWindowEnd,
        hapticFeedbackEnabled: data.org.hapticFeedbackEnabled,
        toleranceMinutes: data.org.toleranceMinutes,
        justificationDelayDays: data.org.justificationDelayDays,
        onboardingCompleted: data.org.onboardingCompleted,
        isDemo: data.org.isDemo,
        matriculePrefix: data.org.matriculePrefix,
        employeeSequence: data.org.employeeSequence,
        idNumberEnabled: data.org.idNumberEnabled,
      },
    });

    for (const site of data.sites) {
      await tx.site.create({ data: { ...site, createdAt: new Date(site.createdAt) } });
    }
    for (const team of data.teams) {
      await tx.team.create({ data: { ...team, createdAt: new Date(team.createdAt) } });
    }
    for (const schedule of data.schedules ?? []) {
      await tx.schedule.create({ data: { ...schedule, createdAt: new Date(schedule.createdAt) } });
    }
    for (const employee of data.employees) {
      await tx.employee.create({ data: { ...employee, createdAt: new Date(employee.createdAt) } });
    }
    for (const user of data.users ?? []) {
      await tx.user.create({ data: { ...user, createdAt: new Date(user.createdAt) } });
    }
    for (const rt of data.responsableTeams ?? []) {
      await tx.responsableTeam.create({ data: { userId: rt.userId, teamId: rt.teamId } });
    }
    for (const a of data.attendances) {
      await tx.attendance.create({
        data: {
          ...a,
          timestamp: new Date(a.timestamp),
          createdAt: new Date(a.createdAt),
        },
      });
    }
    for (const j of data.justificatifs) {
      await tx.justificatif.create({
        data: {
          ...j,
          dateStart: new Date(j.dateStart),
          dateEnd: new Date(j.dateEnd),
          createdAt: new Date(j.createdAt),
          reviewedAt: j.reviewedAt ? new Date(j.reviewedAt) : null,
        },
      });
    }
    for (const o of data.overtimes) {
      await tx.overtimeRecord.create({
        data: {
          ...o,
          date: new Date(o.date),
          createdAt: new Date(o.createdAt),
          validatedAt: o.validatedAt ? new Date(o.validatedAt) : null,
        },
      });
    }
  });

  console.log("Restauration terminée, comptes utilisateurs inclus.");
  console.log("Conseillez à chacun de réinitialiser son mot de passe via 'Mot de passe oublié'.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
