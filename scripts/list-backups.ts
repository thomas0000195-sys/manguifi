/**
 * Lists backups stored in Vercel Blob by /api/cron/backup, most recent
 * first — so you know which pathname to pass to restore-backup.ts.
 * Requires BLOB_READ_WRITE_TOKEN in the environment.
 *
 * Usage:
 *   npx tsx scripts/list-backups.ts
 */
import { list } from "@vercel/blob";

async function main() {
  const { blobs } = await list({ prefix: "backups/", limit: 1000 });
  if (blobs.length === 0) {
    console.log("Aucune sauvegarde trouvée.");
    return;
  }

  blobs
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    .forEach((b) => {
      console.log(`${b.uploadedAt.toISOString()}  ${(b.size / 1024).toFixed(1)} KB  ${b.pathname}`);
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
