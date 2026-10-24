import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/console/errors";

/**
 * Canaux de notification. Seul le canal « dans l'application » est actif.
 * L'e-mail et WhatsApp sont prévus mais désactivés : les appelants n'ont rien à changer
 * quand on les branchera.
 */
export const NOTIFICATION_CHANNELS = { inApp: true, email: false, whatsapp: false } as const;

const MAX_TITLE = 120;
const MAX_BODY = 300;
export const NOTIFICATION_RETENTION_DAYS = 90;

export type NotificationInput = {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
};

/**
 * Crée une notification. Ne fait jamais échouer l'action appelante : en cas d'erreur,
 * seule une trace sans contenu est journalisée.
 * Ne jamais y mettre de donnée personnelle détaillée : un titre court et un lien.
 */
export async function sendNotification(input: NotificationInput): Promise<void> {
  if (!NOTIFICATION_CHANNELS.inApp) return;
  try {
    await prisma.notification.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        type: input.type.slice(0, 60),
        title: input.title.slice(0, MAX_TITLE),
        body: input.body?.slice(0, MAX_BODY) ?? null,
        link: input.link?.slice(0, 200) ?? null,
      },
    });
  } catch {
    await logError({ severity: "warning", source: "notification", message: "Création de notification échouée" });
  }
}

/** Supprime les notifications plus anciennes que la durée de rétention. */
export async function purgeOldNotifications(days = NOTIFICATION_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
