import Link from "next/link";
import { QrCode } from "lucide-react";
import WhatsAppLoginForm from "./WhatsAppLoginForm";

export default function ConnexionEmployePage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm animate-fade-in-up">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-white">
            <QrCode className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-navy-900">
            Manguifi
          </span>
        </Link>
        <div className="relative rounded-2xl border border-border bg-surface p-7 shadow-sm">
          <Link
            href="/connexion"
            className="absolute top-4 right-4 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition hover:border-navy-300 hover:text-navy-900"
          >
            Espace Pro
          </Link>
          <h1 className="text-xl font-bold text-navy-950">Espace employé</h1>
          <p className="mt-1 text-sm text-muted">
            Connectez-vous avec votre numéro WhatsApp — aucun mot de passe requis.
          </p>
          <div className="mt-6">
            <WhatsAppLoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
