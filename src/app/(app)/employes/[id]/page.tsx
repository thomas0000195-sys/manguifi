import { requireUser, assertEmployeeInScope } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { decryptDataUrl } from "@/lib/crypto";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id },
    include: { team: { include: { site: true } }, user: true },
  });

  const photoDataUrl = employee.photoUrl ? decryptDataUrl(employee.photoUrl) : null;

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

      <ProfileCard employee={employee} photoDataUrl={photoDataUrl} />

      {user.role === "ADMIN" && (
        <EmployeeAccountPanel
          employeeId={employee.id}
          phone={employee.phone}
          invitationStatus={employee.invitationStatus}
        />
      )}
    </div>
  );
}
