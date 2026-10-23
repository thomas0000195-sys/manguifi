"use client";

import { useActionState } from "react";
import { resolveErrorAction, type ConsoleActionState } from "@/app/actions/console-actions";

const initial: ConsoleActionState = {};

export default function ResolveButton({ errorId }: { errorId: string }) {
  const [state, action, pending] = useActionState(resolveErrorAction, initial);
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="errorId" value={errorId} />
      <button disabled={pending} className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-60">Marquer comme résolu</button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
