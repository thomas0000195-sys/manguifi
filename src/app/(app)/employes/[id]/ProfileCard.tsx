"use client";

import { Download, IdCard, Cake } from "lucide-react";
import jsPDF from "jspdf";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  matricule: string;
  dateOfBirth: Date | null;
  idNumber: string | null;
  team: { name: string; site: { name: string } };
};

export default function ProfileCard({
  employee,
  photoDataUrl,
}: {
  employee: Employee;
  photoDataUrl?: string | null;
}) {
  function downloadCard() {
    const doc = new jsPDF({ unit: "mm", format: [90, 130] });
    doc.setFillColor(11, 26, 54);
    doc.rect(0, 0, 90, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("Manguifi", 45, 12, { align: "center" });
    doc.setFontSize(9);
    doc.text("Badge employé", 45, 19, { align: "center" });

    if (photoDataUrl) {
      const format = photoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(photoDataUrl, format, 27, 36, 36, 36);
    }

    doc.setTextColor(11, 19, 36);
    doc.setFontSize(13);
    doc.text(`${employee.firstName} ${employee.lastName}`, 45, 82, { align: "center" });
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(employee.position || employee.team.name, 45, 88, { align: "center" });
    doc.text(`${employee.team.name} — ${employee.team.site.name}`, 45, 94, { align: "center" });

    doc.setFontSize(11);
    doc.setTextColor(11, 19, 36);
    doc.text(employee.matricule, 45, 108, { align: "center" });
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Matricule interne — référence paie et rapports", 45, 113, { align: "center" });

    doc.save(`badge-${employee.firstName}-${employee.lastName}.pdf`);
  }

  return (
    <div className="mt-4 animate-fade-in-up rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Informations du profil
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl bg-navy-50 px-4 py-3">
          <IdCard className="h-4 w-4 text-navy-800" />
          <div>
            <p className="text-xs text-muted">Matricule</p>
            <p className="font-mono text-sm font-semibold text-navy-950">{employee.matricule}</p>
          </div>
        </div>
        {employee.dateOfBirth && (
          <div className="flex items-center gap-3 rounded-xl bg-navy-50 px-4 py-3">
            <Cake className="h-4 w-4 text-navy-800" />
            <div>
              <p className="text-xs text-muted">Date de naissance</p>
              <p className="text-sm font-semibold text-navy-950">
                {new Date(employee.dateOfBirth).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>
        )}
        {employee.idNumber && (
          <div className="flex items-center gap-3 rounded-xl bg-navy-50 px-4 py-3">
            <IdCard className="h-4 w-4 text-navy-800" />
            <div>
              <p className="text-xs text-muted">N° pièce d&apos;identité</p>
              <p className="text-sm font-semibold text-navy-950">{employee.idNumber}</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Le pointage se fait désormais en scannant le QR affiché sur le site — il n&apos;y a plus de QR individuel à imprimer pour cet employé.
      </p>

      <button
        onClick={downloadCard}
        className="mt-4 flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-navy-900 transition hover:bg-navy-50"
      >
        <Download className="h-4 w-4" /> Télécharger le badge (PDF)
      </button>
    </div>
  );
}
