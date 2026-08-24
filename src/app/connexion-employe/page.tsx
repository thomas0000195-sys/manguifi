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
        <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm">
          <h1 className="text-xl font-bold text-navy-950">Espace employé</h1>
          <p className="mt-1 text-sm text-muted">
            Connectez-vous avec votre numéro WhatsApp — aucun mot de passe requis.
          </p>
          <div className="mt-6">
            <WhatsAppLoginForm />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Vous êtes administrateur ou responsable ?{" "}
          <Link href="/connexion" className="font-semibold text-navy-900 hover:underline">
            Se connecter par email
          </Link>
        </p>
      </div>
    </div>
  );
}
