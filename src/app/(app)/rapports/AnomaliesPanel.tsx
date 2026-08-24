"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { validateAttendanceAction, correctAttendanceAction } from "@/app/actions/attendance-review";
import { AlertTriangle, Check, Pencil, Loader2, X } from "lucide-react";

const ANOMALY_LABEL: Record<string, string> = {
  CONFIANCE_FAIBLE: "Confiance faible",
  HORS_PLAGE_HORAIRE: "Hors plage horaire",
  HORS_ZONE_GEOGRAPHIQUE: "Hors zone géographique",
  SITE_NON_GEOLOCALISE: "Site non géolocalisé",
};

type Anomaly = {
  id: string;
  type: "ARRIVEE" | "DEPART";
  timestamp: Date;
  anomalyType: string | null;
  confidence: "ELEVE" | "A_VERIFIER";
  employee: { firstName: string; lastName: string; team: { name: string } };
};

export default function AnomaliesPanel({ anomalies }: { anomalies: Anomaly[] }) {
  const [editing, setEditing] = useState<Anomaly | null>(null);
  const [validating, setValidating] = useState<Anomaly | null>(null);

  if (anomalies.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5">
      <div className="flex items-center gap-2 text-red-600">
        <AlertTriangle className="h-4 w-4" />
        <h2 className="font-semibold">Anomalies de pointage à vérifier ({anomalies.length})</h2>
      </div>
      <div className="mt-3 space-y-2">
        {anomalies.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 text-sm shadow-sm"
          >
            <div>
              <span className="font-medium text-navy-900">
                {a.employee.firstName} {a.employee.lastName}
              </span>{" "}
              <span className="text-muted">
                — {a.employee.team.name} · {a.type === "ARRIVEE" ? "Arrivée" : "Départ"}{" "}
                {new Date(a.timestamp).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-600">
                {ANOMALY_LABEL[a.anomalyType ?? ""] ?? "À vérifier"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setValidating(a)}
                className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
              >
                <Check className="h-3 w-3" /> Valider
              </button>
              <button
                onClick={() => setEditing(a)}
                className="flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-navy-50"
              >
                <Pencil className="h-3 w-3" /> Corriger
              </button>
            </div>
          </div>
        ))}
      </div>

      {validating && <ValidateModal anomaly={validating} onClose={() => setValidating(null)} />}
      {editing && <CorrectModal anomaly={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ValidateModal({ anomaly, onClose }: { anomaly: Anomaly; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    const reason = String(formData.get("reason"));
    if (!reason.trim()) { toast.error("Un motif est requis."); return; }

    startTransition(async () => {
      const res = await validateAttendanceAction(anomaly.id, reason);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Pointage validé");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center">
      <div className="w-full max-w-md animate-fade-in-up rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-950">Valider le pointage</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-navy-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          {anomaly.employee.firstName} {anomaly.employee.lastName} — {anomaly.employee.team.name} ·{" "}
          {anomaly.type === "ARRIVEE" ? "Arrivée" : "Départ"}{" "}
          {new Date(anomaly.timestamp).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <form action={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-navy-900">
              Motif de validation (obligatoire)
            </label>
            <textarea
              name="reason"
              required
              autoFocus
              rows={2}
              placeholder="Ex. employé identifié en personne, appareil personnel confirmé..."
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            />
          </div>
          <button
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-70"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer la validation
          </button>
        </form>
      </div>
    </div>
  );
}

function CorrectModal({ anomaly, onClose }: { anomaly: Anomaly; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const initialTime = new Date(anomaly.timestamp).toTimeString().slice(0, 5);

  function handleSubmit(formData: FormData) {
    const newTime = String(formData.get("newTime"));
    const newType = String(formData.get("newType")) as "ARRIVEE" | "DEPART";
    const reason = String(formData.get("reason"));

    if (!reason.trim()) { toast.error("Un motif est requis."); return; }

    startTransition(async () => {
      const res = await correctAttendanceAction({ attendanceId: anomaly.id, newTime, newType, reason });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Pointage corrigé");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center">
      <div className="w-full max-w-md animate-fade-in-up rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-950">Corriger le pointage</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-navy-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          {anomaly.employee.firstName} {anomaly.employee.lastName} — {anomaly.employee.team.name}
        </p>
        <form action={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-navy-900">Type</label>
              <select
                name="newType"
                defaultValue={anomaly.type}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              >
                <option value="ARRIVEE">Arrivée</option>
                <option value="DEPART">Départ</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-navy-900">Heure</label>
              <input
                type="time"
                name="newTime"
                defaultValue={initialTime}
                required
                className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-navy-900">
              Motif de la correction (obligatoire)
            </label>
            <textarea
              name="reason"
              required
              rows={2}
              placeholder="Ex. oubli de badge, téléphone déchargé, erreur de manipulation..."
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            />
          </div>
          <button
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer la correction
          </button>
        </form>
      </div>
    </div>
  );
}
