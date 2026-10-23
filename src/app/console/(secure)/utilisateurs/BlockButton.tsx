"use client";

import { useActionState } from "react";
import { setUserBlockedAction, type ConsoleActionState } from "@/app/actions/console-actions";

const initial: ConsoleActionState = {};

export default function BlockButton({ userId, blocked }: { userId: string; blocked: boolean }) {
  const [state, action, pending] = useActionState(setUserBlockedAction, initial);
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="block" value={blocked ? "false" : "true"} />
      <button disabled={pending} className={`rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${blocked ? "bg-navy-900" : "bg-red-600"}`}>
        {blocked ? "Débloquer le compte" : "Bloquer le compte"}
      </button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
