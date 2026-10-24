"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

/** Marque le guide de premier lancement comme vu pour l'utilisateur connecté. */
export async function markGuideSeenAction(): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const allowed = await checkRateLimit("guide-seen", session.userId, { limit: 20, windowMs: 60_000 });
  if (!allowed) return { ok: false };

  await prisma.user.update({
    where: { id: session.userId },
    data: { guideSeenAt: new Date() },
  });
  return { ok: true };
}
