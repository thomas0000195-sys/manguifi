"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bell } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationList({ items }: { items: NotificationItem[] }) {
  const [pending, startTransition] = useTransition();
  const unread = items.filter((i) => !i.readAt).length;

  if (items.length === 0) {
    return <EmptyState icon={Bell} title="Aucune notification pour le moment." />;
  }

  return (
    <div>
      {unread > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await markAllNotificationsReadAction(); })}
          className="mb-3 min-h-11 text-sm font-semibold text-navy-800 hover:underline disabled:opacity-60"
        >
          Tout marquer comme lu
        </button>
      )}
      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {items.map((n) => (
          <li key={n.id} className="flex items-start gap-3 p-4">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-navy-800"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${n.readAt ? "text-muted" : "font-semibold text-navy-950"}`}>
                {n.readAt ? null : <span className="sr-only">Non lue : </span>}
                {n.title}
              </p>
              {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
              <p className="mt-1 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString("fr-FR", { timeZone: "Africa/Dakar", dateStyle: "short", timeStyle: "short" })}</p>
              <div className="mt-2 flex gap-4">
                {n.link && (
                  <Link href={n.link} className="min-h-11 py-2 text-sm font-semibold text-navy-800 hover:underline">
                    Ouvrir
                  </Link>
                )}
                {!n.readAt && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(async () => { await markNotificationReadAction(n.id); })}
                    className="min-h-11 py-2 text-sm font-medium text-muted hover:text-navy-950 disabled:opacity-60"
                  >
                    Marquer comme lu
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
