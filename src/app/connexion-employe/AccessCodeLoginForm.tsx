"use client";

import { useActionState, useState } from "react";
import {
  requestAccessCodeAction,
  verifyAccessCodeAction,
  type AccessCodeRequestState,
  type AccessCodeVerifyState,
} from "@/app/actions/access-code-auth";
import { AlertCircle, Loader2, Smartphone } from "lucide-react";

const initialRequestState: AccessCodeRequestState = {};
const initialVerifyState: AccessCodeVerifyState = {};

export default function AccessCodeLoginForm() {
  const [value, setValue] = useState("");

  const [requestState, requestAction, requestPending] = useActionState(
    requestAccessCodeAction,
    initialRequestState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyAccessCodeAction,
    initialVerifyState
  );

  const [identifier, setIdentifier] = useState<string | null>(requestState.phone ?? null);

  if (requestState.submitted && requestState.phone && identifier !== requestState.phone) {
    setIdentifier(requestState.phone);
  }

  if (!identifier) {
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
            Votre numéro de téléphone
          </label>
          <input
            name="phone"
            type="tel"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex. 77 123 45 67 ou +221 77 123 45 67"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
          />
        </div>
        <button
          type="submit"
          disabled={requestPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 active:scale-[0.99] disabled:opacity-70"
        >
          {requestPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Smartphone className="h-4 w-4" />
          )}
          Continuer
        </button>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-4">
      <input type="hidden" name="phone" value={identifier} />
      {verifyState.error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100 animate-fade-in-up">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{verifyState.error}</span>
        </div>
      )}
      <div className="rounded-xl bg-navy-50 px-3.5 py-2.5 text-sm text-navy-900">
        Code d&apos;accès pour <span className="font-semibold">{identifier}</span>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy-900">
          Votre code d&apos;accès (8 chiffres)
        </label>
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoFocus
          required
          placeholder="12345678"
          maxLength={8}
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
        onClick={() => {
          setIdentifier(null);
          setValue("");
        }}
        className="w-full text-center text-xs font-medium text-muted hover:text-navy-900"
      >
        Changer de numéro
      </button>
    </form>
  );
}
