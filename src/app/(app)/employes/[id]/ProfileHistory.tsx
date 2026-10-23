import { History } from "lucide-react";

export const PROFILE_HISTORY_ACTIONS = ["profile.phone_updated", "profile.photo_updated"] as const;

const LABELS: Record<string, string> = {
  "profile.phone_updated": "Téléphone modifié",
  "profile.photo_updated": "Photo modifiée",
};

type HistoryEntry = { action: string; createdAt: Date; details: string | null };

/** Valeurs déjà masquées au moment de l'écriture (maskPhone) : rien de sensible n'est affiché. */
function describeChange(entry: HistoryEntry): string | null {
  if (entry.action !== "profile.phone_updated" || !entry.details) return null;
  try {
    const parsed = JSON.parse(entry.details) as { old?: string | null; new?: string | null };
    return `${parsed.old ?? "—"} → ${parsed.new ?? "—"}`;
  } catch {
    return null;
  }
}

/** Lecture seule : historique des modifications de profil faites par l'employé. */
export default function ProfileHistory({ entries }: { entries: HistoryEntry[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-navy-800" />
        <p className="text-sm font-semibold text-navy-950">Historique du profil</p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Aucune modification enregistrée.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {entries.map((entry, index) => (
            <li key={index} className="py-2.5">
              <p className="text-sm font-medium text-navy-900">{LABELS[entry.action] ?? entry.action}</p>
              <p className="text-xs text-muted">
                {entry.createdAt.toLocaleString("fr-FR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Africa/Dakar",
                })}
              </p>
              {describeChange(entry) && (
                <p className="mt-0.5 text-xs text-navy-800">{describeChange(entry)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
