import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Action = { label: string; href: string } | { label: string; onClick: () => void };

/** État vide : une icône, une explication, et une action concrète (lien ou bouton). */
export default function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: Action;
}) {
  const className =
    "mt-4 inline-flex min-h-11 items-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800";
  return (
    <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-800">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mt-3 text-base text-navy-950">{title}</p>
      {action && ("href" in action ? (
        <Link href={action.href} className={className}>{action.label}</Link>
      ) : (
        <button type="button" onClick={action.onClick} className={className}>{action.label}</button>
      ))}
    </div>
  );
}
