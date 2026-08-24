import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getScopedTeamIds } from "@/lib/dashboard";
import Link from "next/link";
import { FileCheck2, ChevronRight } from "lucide-react";

const MOTIFS: Record<string, string> = {
  MALADIE: "Maladie",
  CONGE_PAYE: "Congé payé",
  CONGE_SANS_SOLDE: "Congé sans solde",
  AUTORISATION_EXCEPTIONNELLE: "Autorisation exceptionnelle",
  DEUIL: "Deuil",
  AUTRE: "Autre",
};

const STATUS_STYLE: Record<string, { l: string; c: string }> = {
  EN_ATTENTE: { l: "En attente", c: "bg-orange-100 text-orange-600" },
  JUSTIFIE: { l: "Justifié", c: "bg-green-100 text-green-600" },
  REFUSE: { l: "Refusé", c: "bg-red-100 text-red-500" },
  NON_JUSTIFIEE_DEFINITIVE: { l: "Non justifiée", c: "bg-navy-50 text-muted" },
};

export default async function JustificatifsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const { status } = await searchParams;
  const scopedTeamIds = await getScopedTeamIds(user.orgId, user.role, user.id);

  const employees = await prisma.employee.findMany({
    where: {
      orgId: user.orgId,
      ...(scopedTeamIds ? { teamId: { in: scopedTeamIds } } : {}),
    },
    select: { id: true },
  });
  const employeeIds = employees.map((e) => e.id);

  const justificatifs = await prisma.justificatif.findMany({
    where: {
      orgId: user.orgId,
      employeeId: { in: employeeIds },
      ...(status ? { status: status as never } : {}),
    },
    include: { employee: { include: { team: true } } },
    orderBy: { createdAt: "desc" },
  });

  const filters = [
    { v: undefined, l: "Tous" },
    { v: "EN_ATTENTE", l: "En attente" },
    { v: "JUSTIFIE", l: "Justifiés" },
    { v: "REFUSE", l: "Refusés" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
      <h1 className="text-xl font-bold text-navy-950">Justificatifs d&apos;absence</h1>
      <p className="text-sm text-muted">{justificatifs.length} demande(s)</p>

      <div className="mt-4 flex gap-2">
        {filters.map((f) => (
          <Link
            key={f.l}
            href={f.v ? `/justificatifs?status=${f.v}` : "/justificatifs"}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              status === f.v || (!status && !f.v)
                ? "bg-navy-900 text-white"
                : "bg-navy-50 text-navy-800 hover:bg-navy-100"
            }`}
          >
            {f.l}
          </Link>
        ))}
      </div>

      {justificatifs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
          <FileCheck2 className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm text-muted">Aucun justificatif dans cette catégorie.</p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-surface">
          {justificatifs.map((j) => {
            const style = STATUS_STYLE[j.status];
            return (
              <Link
                key={j.id}
                href={`/justificatifs/${j.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-navy-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy-950">
                    {j.employee.firstName} {j.employee.lastName}{" "}
                    <span className="font-normal text-muted">— {j.employee.team.name}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {MOTIFS[j.motif]} · {new Date(j.dateStart).toLocaleDateString("fr-FR")} — {new Date(j.dateEnd).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.c}`}>{style.l}</span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
