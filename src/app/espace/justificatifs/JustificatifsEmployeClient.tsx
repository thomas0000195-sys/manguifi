"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { submitJustificatifAction } from "@/app/actions/justificatif";
import { Plus, X, Loader2, FileCheck2, Paperclip } from "lucide-react";

const MOTIFS = [
  { v: "MALADIE", l: "Maladie" },
  { v: "CONGE_PAYE", l: "Congé payé" },
  { v: "CONGE_SANS_SOLDE", l: "Congé sans solde" },
  { v: "AUTORISATION_EXCEPTIONNELLE", l: "Autorisation exceptionnelle" },
  { v: "DEUIL", l: "Deuil" },
  { v: "AUTRE", l: "Autre" },
];

const STATUS_STYLE: Record<string, { l: string; c: string }> = {
  EN_ATTENTE: { l: "En attente", c: "bg-orange-100 text-orange-600" },
  JUSTIFIE: { l: "Justifié", c: "bg-green-100 text-green-600" },
  REFUSE: { l: "Refusé", c: "bg-red-100 text-red-500" },
  NON_JUSTIFIEE_DEFINITIVE: { l: "Non justifiée", c: "bg-navy-50 text-muted" },
};

type Justificatif = {
  id: string;
  dateStart: Date;
  dateEnd: Date;
  motif: string;
  status: string;
  comment: string | null;
};

export default function JustificatifsEmployeClient({
  justificatifs,
}: {
  justificatifs: Justificatif[];
}) {
  const [show, setShow] = useState(false);
  const [fileData, setFileData] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Le fichier dépasse 5 Mo. Choisissez une photo ou un scan plus léger.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFileData(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit(formData: FormData) {
    if (!fileData) {
      toast.error("Ajoutez une photo ou un scan du document.");
      return;
    }
    formData.set("documentDataUrl", fileData);
    startTransition(async () => {
      const res = await submitJustificatifAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Justificatif envoyé");
      setShow(false);
      setFileData(null);
    });
  }

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy-950">Justificatifs</h1>
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-1.5 rounded-xl bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-navy-800"
        >
          <Plus className="h-3.5 w-3.5" /> Nouveau
        </button>
      </div>

      {justificatifs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <FileCheck2 className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm text-muted">Aucun justificatif envoyé.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {justificatifs.map((j) => {
            const style = STATUS_STYLE[j.status];
            return (
              <div key={j.id} className="animate-fade-in-up rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-navy-950">
                    {MOTIFS.find((m) => m.v === j.motif)?.l ?? j.motif}
                  </p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.c}`}>{style.l}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {new Date(j.dateStart).toLocaleDateString("fr-FR")} — {new Date(j.dateEnd).toLocaleDateString("fr-FR")}
                </p>
                {j.comment && <p className="mt-2 text-xs italic text-muted">« {j.comment} »</p>}
              </div>
            );
          })}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center">
          <div className="w-full max-w-md animate-fade-in-up rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy-950">Nouveau justificatif</h2>
              <button onClick={() => setShow(false)} className="rounded-lg p-1.5 hover:bg-navy-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form action={handleSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-900">Du</label>
                  <input type="date" name="dateStart" required className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-navy-900">Au</label>
                  <input type="date" name="dateEnd" required className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-900">Motif</label>
                <select name="motif" required className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100">
                  {MOTIFS.map((m) => (
                    <option key={m.v} value={m.v}>{m.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-900">Document</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted hover:bg-navy-50">
                  <Paperclip className="h-4 w-4" />
                  {fileData ? "Document ajouté ✓" : "Ajouter une photo ou un scan"}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
                </label>
              </div>
              <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Envoyer le justificatif
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
