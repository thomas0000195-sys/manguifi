"use client";

import { useActionState, useState } from "react";
import { deleteOrganizationAction, type ActionState } from "@/app/actions/settings";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

const initialState: ActionState = {};

export default function DangerZone({ orgName }: { orgName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteOrganizationAction, initialState);

  return (
    <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5">
      <div className="flex items-center gap-2 text-red-600">
        <AlertTriangle className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Zone de danger</h2>
      </div>
      <p className="mt-1.5 text-sm text-red-700/80">
        Supprime définitivement l&apos;organisation et toutes ses données
        (sites, équipes, employés, pointages, justificatifs, comptes). Cette
        action est irréversible.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
        >
          <Trash2 className="h-4 w-4" /> Supprimer l&apos;organisation et mes données
        </button>
      ) : (
        <form action={formAction} className="mt-3 space-y-2.5">
          {state.error && <p className="text-xs text-red-700">{state.error}</p>}
          <label className="block text-xs font-medium text-red-700">
            Tapez exactement « {orgName} » pour confirmer
          </label>
          <input
            name="confirmation"
            required
            placeholder={orgName}
            className="w-full rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer la suppression définitive
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
