import Link from "next/link";
import { QrCode, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-background px-5 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-white">
        <QrCode className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">Erreur 404</p>
        <h1 className="mt-1 text-2xl font-bold text-navy-950">Page introuvable</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Cette page n&apos;existe pas ou vous n&apos;avez pas accès à cette ressource.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
      >
        <ArrowLeft className="h-4 w-4" /> Retour à l&apos;accueil
      </Link>
    </div>
  );
}
