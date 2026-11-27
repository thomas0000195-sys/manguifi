"use client";

import { useActionState } from "react";
import { libererTelephoneEmployeAction, type ConsoleActionState } from "@/app/actions/console-actions";

const initial: ConsoleActionState = {};

/** Fiche employé sans compte de connexion. Le numéro est retiré, la fiche est conservée. */
export default function LibererTelephoneEmployeButton({ employeeId }: { employeeId: string }) {
  const [state, action, pending] = useActionState(libererTelephoneEmployeAction, initial);
  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-3"
      onSubmit={(e) => {
        if (!window.confirm("Retirer le numéro de téléphone de ce compte bloqué ? Le compte et son historique sont conservés. Cette action est tracée dans le journal d'audit.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <button disabled={pending} className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60">
        Libérer le téléphone
      </button>
      {state.success && <span className="text-xs text-green-700">Numéro libéré.</span>}
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
