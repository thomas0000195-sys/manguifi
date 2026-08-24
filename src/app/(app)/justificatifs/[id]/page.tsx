import { requireUser, assertJustificatifInScope } from "@/lib/guard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReviewActions from "./ReviewActions";
import { decryptDataUrl } from "@/lib/crypto";

const MOTIFS: Record<string, string> = {
  MALADIE: "Maladie",
  CONGE_PAYE: "Congé payé",
  CONGE_SANS_SOLDE: "Congé sans solde",
  AUTORISATION_EXCEPTIONNELLE: "Autorisation exceptionnelle",
  DEUIL: "Deuil",
  AUTRE: "Autre",
};

export default async function JustificatifDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser(["ADMIN", "RESPONSABLE"]);
  const { id } = await params;

  const scoped = await assertJustificatifInScope(user, id);
  const justificatif = {
    ...scoped,
    documentDataUrl: decryptDataUrl(scoped.documentDataUrl),
  };

  const isImage = justificatif.documentDataUrl.startsWith("data:image");
  const isPdf = justificatif.documentDataUrl.startsWith("data:application/pdf");

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:py-8">
      <Link href="/justificatifs" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour aux justificatifs
      </Link>

      <div className="mt-5 animate-fade-in-up rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-navy-950">
              {justificatif.employee.firstName} {justificatif.employee.lastName}
            </h1>
            <p className="text-sm text-muted">{justificatif.employee.team.name}</p>
          </div>
          <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-800">
            {MOTIFS[justificatif.motif]}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-navy-50 px-3 py-2.5">
            <p className="text-xs text-muted">Du</p>
            <p className="font-medium text-navy-900">
              {justificatif.dateStart.toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="rounded-xl bg-navy-50 px-3 py-2.5">
            <p className="text-xs text-muted">Au</p>
            <p className="font-medium text-navy-900">
              {justificatif.dateEnd.toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Document joint
          </p>
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={justificatif.documentDataUrl}
              alt="Justificatif"
              className="max-h-96 w-full rounded-xl border border-border object-contain"
            />
          )}
          {isPdf && (
            <a
              href={justificatif.documentDataUrl}
              download={`justificatif-${justificatif.id}.pdf`}
              className="block rounded-xl border border-border px-4 py-3 text-sm font-medium text-navy-800 hover:bg-navy-50"
            >
              Ouvrir le document PDF
            </a>
          )}
        </div>

        {justificatif.status === "EN_ATTENTE" ? (
          <ReviewActions justificatifId={justificatif.id} />
        ) : (
          <div className="mt-6 rounded-xl bg-navy-50 px-4 py-3 text-sm">
            <p className="font-medium text-navy-900">
              {justificatif.status === "JUSTIFIE" ? "Justifié" : "Refusé"} par{" "}
              {justificatif.reviewedBy?.email}
            </p>
            {justificatif.comment && (
              <p className="mt-1 text-muted italic">« {justificatif.comment} »</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
