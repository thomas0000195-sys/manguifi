"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

/** Marque une notification comme lue. Seules les notifications de l'utilisateur connecté sont touchées. */
export async function markNotificationReadAction(id: string): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const allowed = await checkRateLimit("notif-mark", session.userId, { limit: 60, windowMs: 60_000 });
  if (!allowed) return { ok: false };

  await prisma.notification.updateMany({
    where: { id, userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/espace/notifications");
  return { ok: true };
}

/** Marque toutes les notifications de l'utilisateur comme lues. */
export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const allowed = await checkRateLimit("notif-mark", session.userId, { limit: 60, windowMs: 60_000 });
  if (!allowed) return { ok: false };

  await prisma.notification.updateMany({
    where: { userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/espace/notifications");
  return { ok: true };
}
