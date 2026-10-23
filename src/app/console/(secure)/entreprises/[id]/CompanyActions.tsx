"use client";

import { useActionState } from "react";
import { suspendCompanyAction, reactivateCompanyAction, type ConsoleActionState } from "@/app/actions/console-actions";

const initial: ConsoleActionState = {};

export default function CompanyActions({ orgId, orgName, suspended }: { orgId: string; orgName: string; suspended: boolean }) {
  const [suspendState, suspendAction, suspendPending] = useActionState(suspendCompanyAction, initial);
  const [reactState, reactAction, reactPending] = useActionState(reactivateCompanyAction, initial);

  if (suspended) {
    return (
      <form action={reactAction} className="space-y-2">
        <input type="hidden" name="orgId" value={orgId} />
        {reactState.error && <p className="text-sm text-red-700">{reactState.error}</p>}
        <button disabled={reactPending} className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Réactiver l&apos;entreprise</button>
      </form>
    );
  }

  return (
    <form action={suspendAction} className="space-y-2 rounded-2xl border border-red-200 p-4">
      <input type="hidden" name="orgId" value={orgId} />
      <p className="text-sm">Pour suspendre, saisissez le nom exact de l&apos;entreprise : <strong>{orgName}</strong></p>
      <input name="confirmation" required className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
      {suspendState.error && <p className="text-sm text-red-700">{suspendState.error}</p>}
      <button disabled={suspendPending} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Suspendre l&apos;entreprise</button>
    </form>
  );
}
