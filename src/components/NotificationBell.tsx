import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";

/** Cloche avec le nombre de notifications non lues de l'utilisateur. */
export default async function NotificationBell({ userId, href }: { userId: string; href: string }) {
  const unread = await prisma.notification.count({ where: { userId, readAt: null } });
  return (
    <Link
      href={href}
      className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-navy-50 hover:text-navy-900"
      aria-label={unread > 0 ? `Notifications, ${unread} non lue(s)` : "Notifications"}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
