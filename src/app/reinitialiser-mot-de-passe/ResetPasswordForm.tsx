"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ActionState } from "@/app/actions/auth";
import { AlertCircle, Loader2 } from "lucide-react";

const initialState: ActionState = {};

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100 animate-fade-in-up">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy-900">Nouveau mot de passe</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="8 caractères minimum"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 active:scale-[0.99] disabled:opacity-70"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Réinitialiser le mot de passe
      </button>
    </form>
  );
}
