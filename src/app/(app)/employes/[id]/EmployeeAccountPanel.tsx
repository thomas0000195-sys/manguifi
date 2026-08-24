"use client";

import { useState, useActionState } from "react";
import toast from "react-hot-toast";
import { updateEmployeePhoneAction, type ActionState } from "@/app/actions/company";
import { MessageCircle, Loader2, CheckCircle2, Clock, Pencil } from "lucide-react";
import { formatPhoneForDisplay } from "@/lib/phone";

const initialState: ActionState = {};

export default function EmployeeAccountPanel({
  employeeId,
  phone,
  invitationStatus,
}: {
  employeeId: string;
  phone: string;
  invitationStatus: "EN_ATTENTE" | "ACTIVE";
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateEmployeePhoneAction, initialState);

  if (state.success) {
    toast.success("Numéro mis à jour", { id: "phone-updated" });
  }

  const active = invitationStatus === "ACTIVE";

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              active ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
            }`}
          >
            {active ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-950">Connexion WhatsApp</p>
            <p className="text-xs text-muted">
              {active
                ? "Activée — l'employé s'est connecté avec ce numéro."
                : "En attente — l'employé ne s'est pas encore connecté."}
            </p>
          </div>
        </div>
        {!active && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-medium text-navy-800 hover:underline"
          >
            <Pencil className="h-3 w-3" /> Modifier
          </button>
        )}
      </div>

      {!editing ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-navy-50 px-3.5 py-2.5 text-sm">
          <MessageCircle className="h-4 w-4 text-navy-800" />
          <span className="font-medium text-navy-900">{formatPhoneForDisplay(phone)}</span>
        </div>
      ) : (
        <form action={formAction} className="mt-3 space-y-2.5">
          <input type="hidden" name="employeeId" value={employeeId} />
          {state.error && <p className="text-xs text-red-600">{state.error}</p>}
          <input
            name="phone"
            type="tel"
            required
            defaultValue={phone}
            placeholder="Ex. 77 123 45 67"
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
          />
          <div className="flex items-center gap-2">
            <button
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-medium text-muted hover:text-navy-900"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {!active && (
        <p className="mt-3 text-xs text-muted">
          Communiquez ce numéro à l&apos;employé : il pourra se connecter directement depuis{" "}
          <span className="font-mono">/connexion-employe</span> avec un code envoyé par WhatsApp (SMS en secours).
        </p>
      )}
    </div>
  );
}
