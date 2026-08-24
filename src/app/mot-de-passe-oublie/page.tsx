import Link from "next/link";
import { QrCode } from "lucide-react";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm animate-fade-in-up">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-white">
            <QrCode className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-navy-900">Manguifi</span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm">
          <h1 className="text-xl font-bold text-navy-950">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-muted">
            Indiquez votre email, nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/connexion" className="font-semibold text-navy-900 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
