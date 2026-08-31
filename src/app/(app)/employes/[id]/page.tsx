import { requireUser, assertEmployeeInScope } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { decryptDataUrl } from "@/lib/crypto";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2, Clock, Calendar } from "lucide-react";
import ProfileCard from "./ProfileCard";
import EmployeeAccountPanel from "./EmployeeAccountPanel";
import EmployeePhotoUpload from "./EmployeePhotoUpload";
import ExportEmployeeDataButton from "./ExportEmployeeDataButton";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const { id } = await params;

  await assertEmployeeInScope(user, id);

  const employeeRaw = await prisma.employee.findUniqueOrThrow({
    where: { id },
    include: { team: { include: { site: true } }, user: true },
  });

  const photoDataUrl = employeeRaw.photoUrl ? decryptDataUrl(employeeRaw.photoUrl) : null;
  const employee = {
    ...employeeRaw,
    phone: employeeRaw.phone ? decryptDataUrl(employeeRaw.phone) : null,
    email: employeeRaw.email ? decryptDataUrl(employeeRaw.email) : null,
    dateOfBirth: employeeRaw.dateOfBirth ? decryptDataUrl(employeeRaw.dateOfBirth) : null,
    idNumber: employeeRaw.idNumber ? decryptDataUrl(employeeRaw.idNumber) : null,
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:py-8">
      <Link
        href="/employes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux employés
      </Link>

      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        {user.role === "ADMIN" ? (
          <EmployeePhotoUpload
            employeeId={employee.id}
            currentPhotoUrl={photoDataUrl}
            initials={`${employee.firstName[0]}${employee.lastName[0]}`}
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-navy-50 text-lg font-semibold text-navy-800">
            {photoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              `${employee.firstName[0]}${employee.lastName[0]}`
            )}
          </div>
        )}
        <div>
          <h1 className="text-lg font-bold text-navy-950">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-sm text-muted">
            {employee.position || "—"} · {employee.team.name}
          </p>
        </div>
        <div className="ml-auto">
          <ExportEmployeeDataButton
            employeeId={employee.id}
            fileName={`manguifi-${employee.matricule}`}
          />
        </div>
      </div>

      <Link
        href={`/employes/${employee.id}/planning`}
        className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-4 hover:bg-navy-50/40"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-navy-950">
          <Calendar className="h-4 w-4 text-navy-800" /> Planning
        </span>
        <span className="text-xs text-muted">Jours travaillés / repos</span>
      </Link>

      <ProfileCard employee={employee} photoDataUrl={photoDataUrl} />

      {user.role === "ADMIN" && employee.phone && (
        <EmployeeAccountPanel
          employeeId={employee.id}
          phone={employee.phone}
          invitationStatus={employee.invitationStatus}
        />
      )}

      {user.role === "ADMIN" && !employee.phone && employee.email && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                employee.invitationStatus === "ACTIVE" ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
              }`}
            >
              {employee.invitationStatus === "ACTIVE" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-950">Connexion par email</p>
              <p className="text-xs text-muted">
                {employee.invitationStatus === "ACTIVE"
                  ? "Activée — l'employé s'est connecté avec cet email."
                  : "En attente — l'employé ne s'est pas encore connecté."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-navy-50 px-3.5 py-2.5 text-sm font-medium text-navy-900">
            <Mail className="h-4 w-4 text-navy-800" /> {employee.email}
          </div>
        </div>
      )}
    </div>
  );
}
