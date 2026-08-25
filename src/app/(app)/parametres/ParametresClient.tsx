"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { updateSettingsAction, exportOrgDataAction, type ActionState } from "@/app/actions/settings";
import { Camera, MapPin, Vibrate, Clock, Download, Loader2, ScrollText, ShieldAlert, IdCard } from "lucide-react";
import DangerZone from "./DangerZone";
import WhatsAppLinkCard from "./WhatsAppLinkCard";

const initialState: ActionState = {};

export default function ParametresClient({
  role,
  phone,
  org,
}: {
  role: "ADMIN" | "RESPONSABLE";
  phone: string | null;
  org: {
    name: string;
    photoOnPunchEnabled: boolean;
    hapticFeedbackEnabled: boolean;
    allowedTimeWindowEnabled: boolean;
    allowedTimeWindowStart: string | null;
    allowedTimeWindowEnd: string | null;
    justificationDelayDays: number;
    matriculePrefix: string;
    idNumberEnabled: boolean;
    attendanceRetentionMonths: number | null;
  };
}) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, initialState);
  const [timeWindow, setTimeWindow] = useState(org.allowedTimeWindowEnabled);
  const [retentionEnabled, setRetentionEnabled] = useState(org.attendanceRetentionMonths != null);
  const [exporting, startExport] = useTransition();
  const isAdmin = role === "ADMIN";

  if (state.success) toast.success("Paramètres enregistrés", { id: "settings-saved" });

  function handleExport() {
    startExport(async () => {
      const json = await exportOrgDataAction();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `manguifi-export-${org.name.replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export généré");
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:py-8">
      <h1 className="text-xl font-bold text-navy-950">Paramètres</h1>
      <p className="text-sm text-muted">{org.name}</p>

      <div className="mt-6">
        <WhatsAppLinkCard phone={phone} />
      </div>

      {isAdmin && (
      <form action={formAction} className="mt-4 space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-navy-950">Pointage</h2>

          <ToggleRow
            icon={Camera}
            name="photoOnPunchEnabled"
            defaultChecked={org.photoOnPunchEnabled}
            title="Photo au moment du pointage"
            desc="Une photo est prise à chaque scan pour renforcer la fiabilité. Désactivable si non souhaité."
          />
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-navy-50 px-3.5 py-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-navy-800" />
            <div>
              <p className="text-sm font-medium text-navy-900">Géolocalisation</p>
              <p className="text-xs text-muted">
                Toujours activée — un pointage hors de la zone autorisée d&apos;un site est automatiquement signalé pour vérification.
              </p>
            </div>
          </div>
          <ToggleRow
            icon={Vibrate}
            name="hapticFeedbackEnabled"
            defaultChecked={org.hapticFeedbackEnabled}
            title="Retour haptique et sonore"
            desc="Vibration et son de confirmation lors du scan."
          />

          <div className="mt-4 border-t border-border pt-4">
            <ToggleRow
              icon={Clock}
              name="allowedTimeWindowEnabled"
              defaultChecked={org.allowedTimeWindowEnabled}
              title="Plage horaire autorisée"
              desc="Restreint les pointages à une plage horaire globale."
              onChange={setTimeWindow}
            />
            {timeWindow && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  type="time"
                  name="allowedTimeWindowStart"
                  defaultValue={org.allowedTimeWindowStart ?? "06:00"}
                  className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
                <input
                  type="time"
                  name="allowedTimeWindowEnd"
                  defaultValue={org.allowedTimeWindowEnd ?? "22:00"}
                  className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-navy-950">Profil employé</h2>
          <label className="mt-3 block text-sm text-navy-900">
            Préfixe du matricule
            <input
              type="text"
              name="matriculePrefix"
              maxLength={8}
              defaultValue={org.matriculePrefix}
              placeholder="MGF"
              className="mt-1.5 w-full rounded-xl border border-border px-4 py-3 text-sm uppercase outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            />
          </label>
          <p className="mt-1.5 text-xs text-muted">
            Exemple : {org.matriculePrefix || "MGF"}-2026-000123.
          </p>
          <div className="mt-4 border-t border-border pt-4">
            <ToggleRow
              icon={IdCard}
              name="idNumberEnabled"
              defaultChecked={org.idNumberEnabled}
              title="Numéro de pièce d'identité"
              desc="Ajoute un champ CNI/passeport (facultatif) à la fiche employé, selon le contexte légal de votre pays."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-navy-950">Justificatifs</h2>
          <label className="mt-3 block text-sm text-navy-900">
            Délai de justification (jours)
            <input
              type="number"
              name="justificationDelayDays"
              min={1}
              max={30}
              defaultValue={org.justificationDelayDays}
              className="mt-1.5 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            />
          </label>
          <p className="mt-1.5 text-xs text-muted">
            Passé ce délai, une absence non couverte passe automatiquement en
            &laquo;&nbsp;non justifiée définitive&nbsp;&raquo;.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-navy-950">Conservation des données</h2>
          <label className="mt-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-navy-900">Purge automatique</p>
              <p className="text-xs text-muted">
                Supprime définitivement les pointages, justificatifs et heures sup au-delà
                d&apos;une ancienneté donnée. Désactivé par défaut — vérifiez vos obligations
                légales de conservation des données de paie avant d&apos;activer.
              </p>
            </div>
            <input
              type="checkbox"
              name="attendanceRetentionEnabled"
              checked={retentionEnabled}
              onChange={(e) => setRetentionEnabled(e.target.checked)}
              className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-navy-100 transition checked:bg-green-500 relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition checked:before:translate-x-4"
            />
          </label>
          {retentionEnabled && (
            <label className="mt-3 block text-sm text-navy-900">
              Ancienneté maximale (mois)
              <input
                type="number"
                name="attendanceRetentionMonths"
                min={1}
                max={120}
                defaultValue={org.attendanceRetentionMonths ?? 24}
                className="mt-1.5 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
              />
            </label>
          )}
        </div>

        <button
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer les paramètres
        </button>
      </form>
      )}

      {isAdmin && (
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-navy-950">Données de l&apos;organisation</h2>
        <p className="mt-1 text-sm text-muted">
          Exportez l&apos;ensemble des données de votre organisation (sites,
          équipes, employés, pointages, justificatifs).
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-50 disabled:opacity-70"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exporter toutes les données (JSON)
        </button>
      </div>
      )}

      {isAdmin && (
      <Link
        href="/parametres/journal"
        className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-5 transition hover:bg-navy-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-800">
            <ScrollText className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-950">Journal d&apos;audit</p>
            <p className="text-xs text-muted">Historique des actions sensibles de votre organisation</p>
          </div>
        </div>
      </Link>
      )}

      <Link
        href="/politique-confidentialite"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 text-sm font-medium text-navy-900 transition hover:bg-navy-50"
      >
        <ShieldAlert className="h-4 w-4 text-navy-800" />
        Politique de confidentialité
      </Link>

      <Link
        href="/conditions-utilisation"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-surface p-5 text-sm font-medium text-navy-900 transition hover:bg-navy-50"
      >
        <ShieldAlert className="h-4 w-4 text-navy-800" />
        Conditions générales d&apos;utilisation
      </Link>

      {isAdmin && <DangerZone orgName={org.name} />}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  name,
  defaultChecked,
  title,
  desc,
  onChange,
}: {
  icon: React.ElementType;
  name: string;
  defaultChecked: boolean;
  title: string;
  desc: string;
  onChange?: (v: boolean) => void;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="mt-3 flex items-start justify-between gap-3 first:mt-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-800">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-navy-900">{title}</p>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked);
          onChange?.(e.target.checked);
        }}
        className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-navy-100 transition checked:bg-green-500 relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition checked:before:translate-x-4"
      />
    </label>
  );
}
