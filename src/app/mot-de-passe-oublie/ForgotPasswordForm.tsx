"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type ResetRequestState } from "@/app/actions/auth";
import { AlertCircle, Loader2, CheckCircle2, ExternalLink } from "lucide-react";

const initialState: ResetRequestState = {};

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.submitted) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="flex items-start gap-2 rounded-xl bg-green-50 px-3.5 py-3 text-sm text-green-700 ring-1 ring-green-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {state.emailSent
              ? "Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception (et vos spams)."
              : "Si un compte existe avec cet email, un lien de réinitialisation a été généré."}
          </span>
        </div>

        {state.devResetUrl && (
          <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 px-3.5 py-3 text-sm text-orange-800">
            <p className="font-medium">Mode démo — aucun email n&apos;est envoyé pour l&apos;instant.</p>
            <p className="mt-1">Voici le lien qui serait normalement envoyé par email :</p>
            <Link
              href={state.devResetUrl}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-orange-700 shadow-sm hover:bg-orange-100"
            >
              Ouvrir le lien de réinitialisation <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100 animate-fade-in-up">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy-900">Email professionnel</label>
        <input
          name="email"
          type="email"
          required
          placeholder="vous@entreprise.com"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 active:scale-[0.99] disabled:opacity-70"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Envoyer le lien de réinitialisation
      </button>
    </form>
  );
}
