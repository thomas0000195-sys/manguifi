import Link from "next/link";
import { QrCode, AlertTriangle } from "lucide-react";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

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
          <h1 className="text-xl font-bold text-navy-950">Nouveau mot de passe</h1>
          {token ? (
            <>
              <p className="mt-1 text-sm text-muted">Choisissez un nouveau mot de passe pour votre compte.</p>
              <div className="mt-6">
                <ResetPasswordForm token={token} />
              </div>
            </>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Lien invalide.{" "}
                <Link href="/mot-de-passe-oublie" className="font-semibold hover:underline">
                  Demandez-en un nouveau
                </Link>
                .
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
