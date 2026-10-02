"use client";

import { useActionState } from "react";
import { matriculeLoginAction, type MatriculeLoginState } from "@/app/actions/matricule-auth";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function MatriculeLoginForm() {
  const [state, formAction, isPending] = useActionState(matriculeLoginAction, {} as MatriculeLoginState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="matricule" className="block text-sm font-medium text-navy-950">
          Matricule
        </label>
        <input
          id="matricule"
          name="matricule"
          type="text"
          placeholder="Ex: MGF001"
          autoComplete="off"
          disabled={isPending}
          className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder-gray-400 transition focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200 disabled:bg-gray-100"
        />
      </div>

      {state.error && (
        <div className="flex gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>{state.error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-950 disabled:opacity-50"
      >
        {isPending ? "Connexion..." : <>Connexion <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  );
}
