"use client";

import { useActionState, useState } from "react";
import {
  requestEmployeeEmailOtpAction,
  verifyEmployeeEmailOtpAction,
  type EmailOtpRequestState,
  type EmailOtpVerifyState,
} from "@/app/actions/email-auth";
import { AlertCircle, Loader2, Mail } from "lucide-react";

const initialRequestState: EmailOtpRequestState = {};
const initialVerifyState: EmailOtpVerifyState = {};

/**
 * Connexion employé : l'employé saisit son email professionnel, reçoit un
 * code à 6 chiffres, puis le saisit pour ouvrir sa session.
 */
export default function EmployeeEmailLoginForm() {
  const [requestState, requestAction, requestPending] = useActionState(
    requestEmployeeEmailOtpAction,
    initialRequestState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyEmployeeEmailOtpAction,
    initialVerifyState
  );
  const [email, setEmail] = useState<string | null>(requestState.email ?? null);

  if (requestState.submitted && requestState.email && email !== requestState.email) {
    setEmail(requestState.email);
  }

  if (!email) {
    return (
      <form action={requestAction} className="space-y-4">
        {requestState.error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100 animate-fade-in-up">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{requestState.error}</span>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-900">
            Email professionnel
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="prenom.nom@entreprise.com"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
          />
        </div>
        <button
          type="submit"
          disabled={requestPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 active:scale-[0.99] disabled:opacity-70"
        >
          {requestPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Recevoir mon code
        </button>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-4">
      <input type="hidden" name="email" value={email} />
      {verifyState.error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100 animate-fade-in-up">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{verifyState.error}</span>
        </div>
      )}
      <div className="rounded-xl bg-navy-50 px-3.5 py-2.5 text-sm text-navy-900">
        Si cette adresse est enregistrée, un code à 6 chiffres vient d&apos;être envoyé à{" "}
        <span className="font-semibold">{email}</span>. Il expire dans 10 minutes.
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy-900">Code reçu</label>
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={6}
          placeholder="123456"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tracking-[0.4em] outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
        />
      </div>
      <button
        type="submit"
        disabled={verifyPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 active:scale-[0.99] disabled:opacity-70"
      >
        {verifyPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Vérifier
      </button>
      <button
        type="button"
        onClick={() => setEmail(null)}
        className="w-full text-center text-xs font-medium text-muted hover:text-navy-900"
      >
        Changer d&apos;adresse
      </button>
    </form>
  );
}
