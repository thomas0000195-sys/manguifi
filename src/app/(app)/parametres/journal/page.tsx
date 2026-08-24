import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  CREATE_SITE: "Création d'un site",
  CREATE_TEAM: "Création d'une équipe",
  CREATE_EMPLOYEE: "Ajout d'un employé",
  DELETE_EMPLOYEE: "Suppression d'un employé",
  TOGGLE_EMPLOYEE_STATUS: "Changement de statut employé",
  IMPORT_EMPLOYEES_CSV: "Import CSV d'employés",
  CREATE_RESPONSABLE: "Création d'un compte responsable",
  ASSIGN_RESPONSABLE_TEAM: "Assignation d'un responsable à une équipe",
  CREATE_EMPLOYEE_ACCOUNT: "Création d'un compte employé",
  CREATE_SCHEDULE: "Création d'un horaire",
  UPDATE_SCHEDULE: "Modification d'un horaire",
  DELETE_SCHEDULE: "Suppression d'un horaire",
  APPROVE_JUSTIFICATIF: "Validation d'un justificatif",
  REJECT_JUSTIFICATIF: "Refus d'un justificatif",
  VALIDATE_OVERTIME: "Validation d'heures supplémentaires",
  REJECT_OVERTIME: "Rejet d'heures supplémentaires",
  UPDATE_SETTINGS: "Modification des paramètres",
  EXPORT_ORG_DATA: "Export des données de l'organisation",
  CORRECT_ATTENDANCE: "Correction d'un pointage",
  REQUEST_PASSWORD_RESET: "Demande de réinitialisation de mot de passe",
  RESET_PASSWORD: "Mot de passe réinitialisé",
  VALIDATE_ATTENDANCE: "Validation d'un pointage signalé",
  UPDATE_SITE_LOCATION: "Modification de la position d'un site",
  REGENERATE_SITE_QR: "Régénération du QR d'un site",
  TOGGLE_SITE_ACTIVE: "Activation/désactivation d'un site",
  UPDATE_EMPLOYEE_PHOTO: "Mise à jour de la photo d'un employé",
};

export default async function JournalPage() {
  const user = await requireUser(["ADMIN"]);

  const logs = await prisma.auditLog.findMany({
    where: { orgId: user.orgId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:py-8">
      <Link href="/parametres" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour aux paramètres
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-navy-800" />
        <h1 className="text-xl font-bold text-navy-950">Journal d&apos;audit</h1>
      </div>
      <p className="text-sm text-muted">
        Historique des actions sensibles effectuées dans votre organisation — visible uniquement par l&apos;administrateur.
      </p>

      {logs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <ScrollText className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm text-muted">Aucune action enregistrée pour le moment.</p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-surface">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-3 px-5 py-3.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-navy-950">
                  {ACTION_LABELS[log.action] ?? log.action}
                </p>
                <p className="truncate text-xs text-muted">
                  {log.user?.email ?? "Système"}
                  {log.details ? ` — ${log.details}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted">
                {log.createdAt.toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
