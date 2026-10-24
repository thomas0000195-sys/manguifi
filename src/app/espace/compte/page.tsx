import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { decryptDataUrlForDisplay } from "@/lib/crypto";
import { formatSenegalMobile } from "@/lib/profile";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MyDataPanel from "./MyDataPanel";
import MyPhotoUpload from "./MyPhotoUpload";
import MyProfileForm from "./MyProfileForm";
import AppearancePanel from "@/components/AppearancePanel";
import InstallGuideButton from "@/components/InstallGuideButton";
import LogoutButton from "@/components/LogoutButton";

const DAYS = [
  { v: 1, l: "Lun" },
  { v: 2, l: "Mar" },
  { v: 3, l: "Mer" },
  { v: 4, l: "Jeu" },
  { v: 5, l: "Ven" },
  { v: 6, l: "Sam" },
  { v: 0, l: "Dim" },
];

function daysLabel(daysOfWeek: string) {
  const set = new Set(daysOfWeek.split(",").map(Number));
  return DAYS.filter((d) => set.has(d.v))
    .map((d) => d.l)
    .join(", ");
}

export default async function MonComptePage() {
  const user = await requireUser(["EMPLOYEE"]);
  const emp = user.employee;

  const details = emp
    ? await prisma.employee.findUnique({
        where: { id: emp.id },
        include: { team: { include: { site: true } }, schedules: true },
      })
    : null;
  const schedule =
    details && (details.schedules[0] ?? (await prisma.schedule.findFirst({ where: { teamId: details.teamId } })));

  const phoneE164 = emp?.phone ? decryptDataUrlForDisplay(emp.phone) : null;
  const phoneDisplay = phoneE164 ? formatSenegalMobile(phoneE164) : "";
  const fullName = emp ? `${emp.firstName} ${emp.lastName}` : "";
  const initials = emp ? `${emp.firstName[0] ?? ""}${emp.lastName[0] ?? ""}`.toUpperCase() : "?";
  const photo = emp?.photoUrl ? decryptDataUrlForDisplay(emp.photoUrl) : null;

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <Link
        href="/espace"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <MyPhotoUpload currentPhotoUrl={photo} initials={initials} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-navy-950">{fullName || "Mon compte"}</p>
          {emp?.position && <p className="truncate text-sm text-muted">{emp.position}</p>}
          {emp && <p className="font-mono text-xs text-navy-800">{emp.matricule}</p>}
          <p className="truncate text-xs text-muted">
            {user.org.name}
            {details ? ` · ${details.team.site.name}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy-950">Mon profil</h2>
        <MyProfileForm key={phoneDisplay} initialPhone={phoneDisplay} />

        <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Nom complet</dt>
            <dd className="text-right font-medium text-navy-950">{fullName || "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Matricule</dt>
            <dd className="text-right font-mono text-navy-950">{emp?.matricule ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Poste</dt>
            <dd className="text-right font-medium text-navy-950">{emp?.position ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Équipe</dt>
            <dd className="text-right font-medium text-navy-950">{details?.team.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Site</dt>
            <dd className="text-right font-medium text-navy-950">{details?.team.site.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Horaire</dt>
            <dd className="text-right font-medium text-navy-950">
              {schedule
                ? `${schedule.startTime}–${schedule.endTime} · ${daysLabel(schedule.daysOfWeek)}`
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          Ces informations sont gérées par votre administrateur.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <AppearancePanel />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy-950">Installer l&apos;application</h2>
        <p className="mb-3 text-xs text-muted">Pour ouvrir Manguifi comme une application, depuis l&apos;écran d&apos;accueil.</p>
        <InstallGuideButton />
      </div>

      <div className="mt-6">
        <MyDataPanel />
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <LogoutButton employee />
      </div>
    </div>
  );
}
