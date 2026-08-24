"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Download, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { exportMyDataAction, requestDataDeletionAction } from "@/app/actions/settings";

export default function MyDataPanel() {
  const [exporting, startExport] = useTransition();
  const [requesting, startRequest] = useTransition();
  const [requested, setRequested] = useState(false);

  function handleExport() {
    startExport(async () => {
      const json = await exportMyDataAction();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mes-donnees-manguifi.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export généré");
    });
  }

  function handleRequestDeletion() {
    if (!confirm("Confirmer la demande de suppression de vos données auprès de votre administrateur ?")) return;
    startRequest(async () => {
      await requestDataDeletionAction();
      setRequested(true);
      toast.success("Demande envoyée à votre administrateur");
    });
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-navy-950">Mes données</h2>
        <p className="mt-1 text-sm text-muted">
          Téléchargez une copie de votre profil, vos pointages, vos justificatifs et vos heures
          supplémentaires.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-50 disabled:opacity-70"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exporter mes données (JSON)
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-orange-600" />
          <h2 className="text-sm font-semibold text-navy-950">Suppression de mes données</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Vos pointages et heures supplémentaires ont une valeur légale de paie — la suppression
          n&apos;est pas automatique. Votre demande sera transmise à votre administrateur, qui vous
          répondra directement.
        </p>
        <button
          onClick={handleRequestDeletion}
          disabled={requesting || requested}
          className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-70"
        >
          {requesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {requested ? "Demande envoyée" : "Demander la suppression"}
        </button>
      </div>
    </div>
  );
}
