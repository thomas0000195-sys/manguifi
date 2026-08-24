"use client";

import { useTransition } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import { minutesToLabel } from "@/lib/attendance-logic";
import { OVERTIME_SEVERITY_LABEL, type OvertimeSeverity } from "@/lib/overtime-severity";
import { validateOvertimeAction } from "@/app/actions/overtime";
import { Download, FileDown, Check, X, Loader2 } from "lucide-react";

type Row = {
  employee: { id: string; firstName: string; lastName: string; matricule: string; team: { name: string; site: { name: string } } };
  joursPresence: number;
  retards: number;
  absencesJustifieesPayees: number;
  absencesJustifieesNonPayees: number;
  absencesNonJustifieesEnAttente: number;
  absencesNonJustifieesDefinitives: number;
  minutesNormales: number;
  minutesSupValidees: number;
  minutesSupEnAttente: number;
};

type Overtime = {
  id: string;
  date: Date;
  overtimeMinutes: number;
  severity: OvertimeSeverity;
  employee: { firstName: string; lastName: string };
};

const SEVERITY_STYLE: Record<OvertimeSeverity, string> = {
  modere: "bg-navy-50 text-navy-800",
  important: "bg-orange-100 text-orange-600",
  repete: "bg-red-50 text-red-500",
};

export default function RapportsClient({
  rows,
  pendingOvertimes,
  monthLabel,
}: {
  rows: Row[];
  pendingOvertimes: Overtime[];
  monthLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  function exportCsv() {
    const csv = Papa.unparse(
      rows.map((r) => ({
        Matricule: r.employee.matricule,
        Employé: `${r.employee.firstName} ${r.employee.lastName}`,
        Équipe: r.employee.team.name,
        "Jours présents": r.joursPresence,
        Retards: r.retards,
        "Absences justifiées (payées)": r.absencesJustifieesPayees,
        "Absences justifiées (non payées)": r.absencesJustifieesNonPayees,
        "Absences non justifiées (en attente)": r.absencesNonJustifieesEnAttente,
        "Absences non justifiées (définitives)": r.absencesNonJustifieesDefinitives,
        "Heures normales": minutesToLabel(r.minutesNormales),
        "Heures sup. validées": minutesToLabel(r.minutesSupValidees),
        "Heures sup. en attente": minutesToLabel(r.minutesSupEnAttente),
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-manguifi-${monthLabel.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.setTextColor(11, 26, 54);
    doc.text(`Rapport Manguifi — ${monthLabel}`, 14, 15);

    const headers = ["Matricule", "Employé", "Équipe", "Présents", "Retards", "Abs. just. payées", "Abs. just. non payées", "Abs. non j. attente", "Abs. non j. déf.", "H. normales", "H. sup validées", "H. sup attente"];
    const colX = [14, 44, 74, 100, 116, 132, 158, 184, 208, 230, 254, 274];
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    headers.forEach((h, i) => doc.text(h, colX[i], 26));
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 29, 283, 29);

    let y = 36;
    doc.setFontSize(9);
    doc.setTextColor(11, 19, 36);
    for (const r of rows) {
      const vals = [
        r.employee.matricule,
        `${r.employee.firstName} ${r.employee.lastName}`,
        r.employee.team.name,
        String(r.joursPresence),
        String(r.retards),
        String(r.absencesJustifieesPayees),
        String(r.absencesJustifieesNonPayees),
        String(r.absencesNonJustifieesEnAttente),
        String(r.absencesNonJustifieesDefinitives),
        minutesToLabel(r.minutesNormales),
        minutesToLabel(r.minutesSupValidees),
        minutesToLabel(r.minutesSupEnAttente),
      ];
      vals.forEach((v, i) => doc.text(v, colX[i], y));
      y += 7;
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
    }
    doc.save(`rapport-manguifi-${monthLabel.replace(/\s+/g, "-")}.pdf`);
  }

  function validate(id: string, status: "VALIDEE" | "REJETEE") {
    startTransition(async () => {
      const res = await validateOvertimeAction(id, status);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(status === "VALIDEE" ? "Heures sup. validées" : "Heures sup. rejetées");
    });
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
        <button onClick={exportPdf} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-50">
          <FileDown className="h-4 w-4" /> Export PDF
        </button>
      </div>

      {pendingOvertimes.length > 0 && (
        <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50 p-5">
          <h2 className="font-semibold text-orange-600">
            Heures supplémentaires à valider ({pendingOvertimes.length})
          </h2>
          <div className="mt-3 space-y-2">
            {pendingOvertimes.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 text-sm shadow-sm">
                <span className="text-navy-900">
                  {o.employee.firstName} {o.employee.lastName} —{" "}
                  {new Date(o.date).toLocaleDateString("fr-FR")} · +{minutesToLabel(o.overtimeMinutes)}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${SEVERITY_STYLE[o.severity]}`}>
                    {OVERTIME_SEVERITY_LABEL[o.severity]}
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => validate(o.id, "VALIDEE")}
                    disabled={pending}
                    className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-60"
                  >
                    {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Valider
                  </button>
                  <button
                    onClick={() => validate(o.id, "REJETEE")}
                    disabled={pending}
                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-3 w-3" /> Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-border bg-navy-50/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Matricule</th>
              <th className="px-4 py-3">Employé</th>
              <th className="px-4 py-3">Présents</th>
              <th className="px-4 py-3">Retards</th>
              <th className="px-4 py-3">Abs. just. payées</th>
              <th className="px-4 py-3">Abs. just. non payées</th>
              <th className="px-4 py-3">Abs. non j. (attente)</th>
              <th className="px-4 py-3">Abs. non j. (définitives)</th>
              <th className="px-4 py-3">H. normales</th>
              <th className="px-4 py-3">H. sup validées</th>
              <th className="px-4 py-3">H. sup attente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted">
                  Aucune donnée pour cette période / ce filtre.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.employee.id} className="transition hover:bg-navy-50/40">
                <td className="px-4 py-3 font-mono text-xs text-muted">{r.employee.matricule}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-navy-950">
                    {r.employee.firstName} {r.employee.lastName}
                  </p>
                  <p className="text-xs text-muted">{r.employee.team.name}</p>
                </td>
                <td className="px-4 py-3">{r.joursPresence}</td>
                <td className="px-4 py-3">
                  {r.retards > 0 ? <span className="text-orange-600">{r.retards}</span> : r.retards}
                </td>
                <td className="px-4 py-3">{r.absencesJustifieesPayees}</td>
                <td className="px-4 py-3">{r.absencesJustifieesNonPayees}</td>
                <td className="px-4 py-3">
                  {r.absencesNonJustifieesEnAttente > 0 ? (
                    <span className="font-medium text-orange-600">{r.absencesNonJustifieesEnAttente}</span>
                  ) : (
                    r.absencesNonJustifieesEnAttente
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.absencesNonJustifieesDefinitives > 0 ? (
                    <span className="font-medium text-red-500">{r.absencesNonJustifieesDefinitives}</span>
                  ) : (
                    r.absencesNonJustifieesDefinitives
                  )}
                </td>
                <td className="px-4 py-3">{minutesToLabel(r.minutesNormales)}</td>
                <td className="px-4 py-3 text-green-600">{minutesToLabel(r.minutesSupValidees)}</td>
                <td className="px-4 py-3 text-orange-600">{minutesToLabel(r.minutesSupEnAttente)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
