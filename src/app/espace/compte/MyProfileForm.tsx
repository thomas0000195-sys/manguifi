"use client";

import { useActionState, useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateMyPhoneAction, type ProfileState } from "@/app/actions/employee-profile";
import { normalizeSenegalMobile } from "@/lib/profile";
import { Loader2 } from "lucide-react";

const initialState: ProfileState = {};

/** Seul champ modifiable du profil : le téléphone. Enregistrer reste désactivé sans changement. */
export default function MyProfileForm({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [state, action, pending] = useActionState(updateMyPhoneAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast.success("Profil mis à jour");
      router.refresh();
    }
  }, [state.success, router]);

  const changed = phone.trim() !== initialPhone.trim();
  const valid = normalizeSenegalMobile(phone) !== null;
  const showError = changed && !valid && phone.trim() !== "";

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-navy-900">
          Numéro de téléphone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="77 123 45 67"
          disabled={pending}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
        />
        {showError && (
          <p className="mt-1.5 text-xs text-red-600">
            Numéro invalide : 9 chiffres commençant par 70, 75, 76, 77 ou 78.
          </p>
        )}
        {state.error && <p className="mt-1.5 text-xs text-red-600">{state.error}</p>}
      </div>

      <button
        type="submit"
        disabled={!changed || !valid || pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enregistrer
      </button>
    </form>
  );
}
