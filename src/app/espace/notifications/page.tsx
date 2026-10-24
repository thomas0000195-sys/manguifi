import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NotificationList from "@/components/NotificationList";

export default async function NotificationsPage() {
  const user = await requireUser(["EMPLOYEE"]);
  const allowed = await checkRateLimit("notif-read", user.id, { limit: 120, windowMs: 60_000 });

  const items = allowed
    ? await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      })
    : [];

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <Link href="/espace" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour
      </Link>
      <h1 className="mt-5 text-xl font-bold text-navy-950">Notifications</h1>
      <div className="mt-4">
        {allowed ? (
          <NotificationList
            items={items.map((n) => ({
              ...n,
              readAt: n.readAt ? n.readAt.toISOString() : null,
              createdAt: n.createdAt.toISOString(),
            }))}
          />
        ) : (
          <p className="text-sm text-muted">Trop de consultations. Réessayez dans une minute.</p>
        )}
      </div>
    </div>
  );
}
