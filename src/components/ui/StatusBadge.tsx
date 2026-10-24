import { CheckCircle2, Clock, XCircle, PauseCircle, Moon, Palmtree, FileCheck2, LogOut, PencilLine, type LucideIcon } from "lucide-react";

/**
 * Statut unique de l'application : icône + libellé + couleur, pour être lisible
 * en plein soleil et pour les daltoniens (le sens ne repose jamais sur la couleur seule).
 */
export const STATUSES = {
  PRESENT: { label: "Présent", icon: CheckCircle2, tone: "bg-green-50 text-green-700" },
  EN_RETARD: { label: "En retard", icon: Clock, tone: "bg-orange-50 text-orange-700" },
  ABSENT: { label: "Absent", icon: XCircle, tone: "bg-red-50 text-red-700" },
  EN_PAUSE: { label: "En pause", icon: PauseCircle, tone: "bg-navy-50 text-navy-800" },
  REPOS: { label: "Repos planifié", icon: Moon, tone: "bg-navy-50 text-navy-800" },
  CONGE: { label: "Congé", icon: Palmtree, tone: "bg-green-50 text-green-700" },
  ABSENCE_JUSTIFIEE: { label: "Absence justifiée", icon: FileCheck2, tone: "bg-green-50 text-green-700" },
  SORTIE_MANQUANTE: { label: "Sortie manquante", icon: LogOut, tone: "bg-red-50 text-red-700" },
  CORRECTION_EN_ATTENTE: { label: "Correction en attente", icon: PencilLine, tone: "bg-orange-50 text-orange-700" },
  DEPART_ANTICIPE: { label: "Départ anticipé", icon: LogOut, tone: "bg-orange-50 text-orange-700" },
  NON_POINTE: { label: "Pas encore pointé", icon: Clock, tone: "bg-navy-50 text-navy-800" },
} satisfies Record<string, { label: string; icon: LucideIcon; tone: string }>;

export type StatusKey = keyof typeof STATUSES;

export default function StatusBadge({ status }: { status: StatusKey }) {
  const { label, icon: Icon, tone } = STATUSES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
