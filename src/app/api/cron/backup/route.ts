import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put, list, del } from "@vercel/blob";

const DEFAULT_RETENTION_DAYS = 30;
const BACKUP_PREFIX = "backups/";

export const dynamic = "force-dynamic";

/**
 * Scheduled backup endpoint. Not wired to any UI — meant to be called by an
 * external scheduler (Vercel Cron, Windows Task Scheduler + curl, a cron
 * job on a VPS) on whatever cadence you want. Writes one private Vercel Blob
 * per org per run, named with a timestamp so runs never collide.
 *
 * Storage note: this used to write to a local ./backups directory. That
 * silently produced nothing on Vercel — its filesystem is ephemeral, so the
 * file was gone the instant the function finished, while the route still
 * reported { ok: true }. Vercel Blob (access: "private") persists across
 * invocations and works the same whether this runs on Vercel or a VPS, so
 * there's now a single code path instead of a host-dependent one. Requires
 * a Blob store created and connected to the project (Vercel dashboard →
 * Storage → Blob), which sets BLOB_READ_WRITE_TOKEN automatically.
 *
 * Protect it: set CRON_SECRET in the environment and call with either
 * `Authorization: Bearer <secret>` or `?secret=<secret>`. Without a secret
 * configured the route refuses to run (fails closed, not open).
 *
 * Example (Windows Task Scheduler, daily):
 *   curl -H "Authorization: Bearer %CRON_SECRET%" https://your-domain/api/cron/backup
 *
 * Example (Vercel Cron, in vercel.json):
 *   { "crons": [{ "path": "/api/cron/backup?secret=YOUR_SECRET", "schedule": "0 3 * * *" }] }
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET n'est pas configuré — sauvegarde désactivée par sécurité." },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const provided = authHeader?.replace(/^Bearer\s+/i, "") ?? querySecret;

  if (provided !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany();

  const results: { orgId: string; file: string }[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (const org of orgs) {
    const [sites, teams, employees, users, responsableTeams, attendances, justificatifs, overtimes, schedules] =
      await Promise.all([
        prisma.site.findMany({ where: { orgId: org.id } }),
        prisma.team.findMany({ where: { orgId: org.id } }),
        prisma.employee.findMany({ where: { orgId: org.id } }),
        // passwordHash is already a one-way bcrypt hash — safe to include so
        // a restore doesn't leave every account locked out.
        prisma.user.findMany({ where: { orgId: org.id } }),
        prisma.responsableTeam.findMany({ where: { user: { orgId: org.id } } }),
        prisma.attendance.findMany({ where: { orgId: org.id } }),
        prisma.justificatif.findMany({ where: { orgId: org.id } }),
        prisma.overtimeRecord.findMany({ where: { orgId: org.id } }),
        prisma.schedule.findMany({ where: { orgId: org.id } }),
      ]);

    // Photos and documents are written to the backup file exactly as they
    // are stored in the database — still AES-256-GCM encrypted (see
    // lib/crypto.ts). A previous version of this route decrypted them
    // "for readability", which meant every backup file on disk was a
    // plaintext copy of every employee photo and justificatif document.
    // restore-backup.ts writes them back verbatim, so no re-encryption is
    // needed there either.
    const payload = {
      backedUpAt: new Date().toISOString(),
      org,
      sites,
      teams,
      employees,
      users,
      responsableTeams,
      schedules,
      attendances,
      justificatifs,
      overtimes,
    };

    const safeName = org.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const file = `${BACKUP_PREFIX}${timestamp}_${safeName}_${org.id}.json`;
    await put(file, JSON.stringify(payload, null, 2), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    results.push({ orgId: org.id, file });
  }

  const deleted = await purgeOldBackups();

  return NextResponse.json({ ok: true, backedUpOrgs: results.length, files: results, deletedOldBackups: deleted });
}

/**
 * Retention policy: backups older than BACKUP_RETENTION_DAYS (default 30)
 * are deleted on every run. Without this, the store grows forever and
 * — since each file is a near-complete snapshot of an org's data — keeps
 * personal data around well past any reasonable retention justification.
 */
async function purgeOldBackups(): Promise<string[]> {
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const deleted: string[] = [];

  let cursor: string | undefined;
  do {
    const { blobs, cursor: next, hasMore } = await list({ prefix: BACKUP_PREFIX, cursor, limit: 1000 });
    for (const blob of blobs) {
      if (blob.uploadedAt.getTime() < cutoff) {
        await del(blob.url);
        deleted.push(blob.pathname);
      }
    }
    cursor = hasMore ? next : undefined;
  } while (cursor);

  return deleted;
}
