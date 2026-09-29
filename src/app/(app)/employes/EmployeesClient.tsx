"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import toast from "react-hot-toast";
import {
  createEmployeeAction,
  toggleEmployeeStatusAction,
  importEmployeesCsvAction,
  type ImportRowResult,
} from "@/app/actions/company";
import {
  Plus,
  Search,
  Upload,
  X,
  Loader2,
  UserRound,
  Power,
  Camera,
  Download,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// Matches the server's per-call cap (MAX_IMPORT_ROWS in company.ts) — large
// files are sent in sequential chunks of this size instead of one giant
// request, so a 1000+ row import never risks a single Server Action call
// timing out on a constrained host.
const IMPORT_CHUNK_SIZE = 200;
const MAX_IMPORT_TOTAL_ROWS = 5000;

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  photoUrl: string | null;
  matricule: string;
  status: "ACTIF" | "INACTIF";
  team: { id: string; name: string; site: { name: string } };
};

type Team = { id: string; name: string; site: { name: string } };

export default function EmployeesClient({
  employees,
  teams,
  canManage,
  idNumberEnabled,
  authChannel,
}: {
  employees: Employee[];
  teams: Team[];
  canManage: boolean;
  idNumberEnabled: boolean;
  authChannel: "WHATSAPP" | "EMAIL";
}) {
  const emailChannel = authChannel === "EMAIL";
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importTeamId, setImportTeamId] = useState(teams[0]?.id ?? "");
  const [importPreview, setImportPreview] = useState<{
    rows: { firstName: string; lastName: string; phone: string; email?: string; position?: string }[];
    results: ImportRowResult[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName} ${e.phone ?? ""} ${e.email ?? ""} ${e.team.name} ${e.matricule}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleAdd(formData: FormData) {
    if (photoPreview) {
      formData.set("photoDataUrl", photoPreview);
    }
    startTransition(async () => {
      const res = await createEmployeeAction({}, formData);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Employé ajouté");
      setShowAdd(false);
      setPhotoPreview(null);
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleEmployeeStatusAction(id);
      toast.success("Statut mis à jour");
    });
  }

  function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !importTeamId) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as Record<string, string>[]).map((r) => ({
          firstName: r.firstName || r.prenom || r["Prénom"] || "",
          lastName: r.lastName || r.nom || r["Nom"] || "",
          phone: r.phone || r.telephone || r["Téléphone"] || "",
          email: r.email || r["Email"] || "",
          position: r.position || r.poste || r["Poste"] || "",
        }));
        if (rows.length > MAX_IMPORT_TOTAL_ROWS) {
          toast.error(`Maximum ${MAX_IMPORT_TOTAL_ROWS} lignes par fichier — divisez-le.`);
          return;
        }
        startTransition(async () => {
          const chunks = chunkRows(rows, IMPORT_CHUNK_SIZE);
          setImportProgress({ done: 0, total: chunks.length });
          let allResults: ImportRowResult[] = [];
          let seenHashes: string[] = [];
          for (let i = 0; i < chunks.length; i++) {
            const res = await importEmployeesCsvAction(chunks[i], importTeamId, true, i * IMPORT_CHUNK_SIZE, seenHashes);
            if ("error" in res) {
              toast.error(res.error);
              setImportProgress(null);
              return;
            }
            allResults = allResults.concat(res.results);
            seenHashes = seenHashes.concat(res.newPhoneHashes);
            setImportProgress({ done: i + 1, total: chunks.length });
          }
          setImportPreview({ rows, results: allResults });
          setImportProgress(null);
        });
      },
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function confirmImport() {
    if (!importPreview || !importTeamId) return;
    setImporting(true);
    startTransition(async () => {
      const chunks = chunkRows(importPreview.rows, IMPORT_CHUNK_SIZE);
      setImportProgress({ done: 0, total: chunks.length });
      let totalCount = 0;
      let totalSkipped = 0;
      let seenHashes: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const res = await importEmployeesCsvAction(chunks[i], importTeamId, false, i * IMPORT_CHUNK_SIZE, seenHashes);
        if ("error" in res) {
          toast.error(res.error);
          setImporting(false);
          setImportProgress(null);
          return;
        }
        totalCount += res.count;
        totalSkipped += res.skipped;
        seenHashes = seenHashes.concat(res.newPhoneHashes);
        setImportProgress({ done: i + 1, total: chunks.length });
      }
      setImporting(false);
      setImportProgress(null);
      toast.success(
        `${totalCount} employé(s) importé(s)` + (totalSkipped > 0 ? ` — ${totalSkipped} ligne(s) ignorée(s)` : "")
      );
      setImportPreview(null);
    });
  }

  function downloadCsvTemplate() {
    const header = "Prénom,Nom,Téléphone,Email,Poste\n";
    const example = "Fatou,Ndiaye,771234567,,Cuisinière\n";
    const blob = new Blob(["﻿" + header + example], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-import-employes-manguifi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
      {importProgress && importProgress.total > 1 && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-navy-800" />
          <div>
            <p className="font-medium text-navy-950">
              {importing ? "Import en cours" : "Analyse du fichier"} — lot {importProgress.done}/{importProgress.total}
            </p>
            <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-navy-100">
              <div
                className="h-full rounded-full bg-navy-900 transition-all"
                style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy-950">Employés</h1>
          <p className="text-sm text-muted">{employees.length} employé(s) au total</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsvTemplate}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-50"
              title="Télécharger le modèle CSV"
            >
              <Download className="h-4 w-4" />
            </button>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-50">
              <Upload className="h-4 w-4" /> Import CSV
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsv}
              />
            </label>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
        )}
      </div>

      {teams.length > 1 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span>Import CSV vers l&apos;équipe :</span>
          <select
            value={importTeamId}
            onChange={(e) => setImportTeamId(e.target.value)}
            className="rounded-lg border border-border px-2 py-1 text-xs"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-5 relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un employé..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <UserRound className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 font-medium text-navy-900">Aucun employé trouvé</p>
          <p className="text-sm text-muted">
            {employees.length === 0
              ? "Ajoutez votre premier employé pour créer son profil et son matricule."
              : "Essayez une autre recherche."}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="animate-fade-in-up rounded-2xl border border-border bg-surface p-4 transition hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-navy-50 text-sm font-semibold text-navy-800">
                    {emp.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={emp.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <>
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-navy-950">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs text-muted">
                      {emp.position || "—"} · {emp.team.name}
                    </p>
                    <p className="text-[11px] font-mono text-muted/80">{emp.matricule}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    emp.status === "ACTIF"
                      ? "bg-green-100 text-green-600"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {emp.status === "ACTIF" ? "Actif" : "Inactif"}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted">{emp.phone ?? emp.email}</p>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/employes/${emp.id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-navy-900 transition hover:bg-navy-50"
                >
                  <UserRound className="h-3.5 w-3.5" /> Profil
                </Link>
                {canManage && (
                  <button
                    onClick={() => handleToggle(emp.id)}
                    disabled={pending}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-muted transition hover:bg-navy-50"
                    title={emp.status === "ACTIF" ? "Désactiver" : "Activer"}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center">
          <div className="w-full max-w-md animate-fade-in-up rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy-950">Ajouter un employé</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-lg p-1.5 hover:bg-navy-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form action={handleAdd} className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-navy-50 text-muted hover:bg-navy-100">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Aperçu" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoChange} />
                </label>
                <div className="text-xs text-muted">
                  Photo de profil (facultatif)
                  <br />
                  L&apos;employé peut l&apos;ajouter après connexion.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="firstName"
                  required
                  placeholder="Prénom"
                  className="rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
                <input
                  name="lastName"
                  required
                  placeholder="Nom"
                  className="rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
              </div>
              {emailChannel ? (
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email (utilisé pour la connexion)"
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
              ) : (
                <>
                  <input
                    name="phone"
                    required
                    placeholder="Téléphone WhatsApp"
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email (facultatif)"
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                  />
                </>
              )}
              <input
                name="position"
                placeholder="Poste (facultatif)"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted">Date de naissance (facultatif)</label>
                  <input
                    name="dateOfBirth"
                    type="date"
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                  />
                </div>
                {idNumberEnabled && (
                  <div>
                    <label className="mb-1 block text-xs text-muted">N° pièce d&apos;identité</label>
                    <input
                      name="idNumber"
                      placeholder="CNI, passeport..."
                      className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                    />
                  </div>
                )}
              </div>
              <select
                name="teamId"
                required
                className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.site.name}
                  </option>
                ))}
              </select>
              <button
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Ajouter l&apos;employé
              </button>
            </form>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col animate-fade-in-up rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy-950">Aperçu de l&apos;import</h2>
              <button
                onClick={() => setImportPreview(null)}
                className="rounded-lg p-1.5 hover:bg-navy-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              {importPreview.results.filter((r) => r.status === "ok").length} ligne(s) valide(s) sur{" "}
              {importPreview.results.length}. Vérifiez avant de confirmer.
            </p>
            <div className="mt-4 flex-1 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-navy-50 text-navy-800">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.results.map((r) => (
                    <tr key={r.row} className="border-t border-border">
                      <td className="px-3 py-2 text-muted">{r.row}</td>
                      <td className="px-3 py-2 text-navy-900">
                        {r.firstName} {r.lastName}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "ok" ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Prêt
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" /> {r.reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={confirmImport}
                disabled={importing || importPreview.results.every((r) => r.status !== "ok")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer l&apos;import ({importPreview.results.filter((r) => r.status === "ok").length})
              </button>
              <button
                onClick={() => setImportPreview(null)}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted hover:bg-navy-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
