"use client";

import { useState, useTransition } from "react";
import { markGuideSeenAction } from "@/app/actions/guide";

type Step = { title: string; text: string };

/**
 * Guide de premier lancement : des bulles successives, toujours passables.
 * Jamais bloquant : l'utilisateur peut fermer à tout moment.
 */
export default function GuideBubbles({ steps, seen }: { steps: Step[]; seen: boolean }) {
  const [visible, setVisible] = useState(!seen);
  const [index, setIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  if (!visible || steps.length === 0) return null;

  const step = steps[index];
  const last = index === steps.length - 1;

  function close() {
    setVisible(false);
    startTransition(async () => {
      await markGuideSeenAction();
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4" role="dialog" aria-live="polite">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <p className="text-xs font-semibold text-muted">
          Conseil {index + 1} sur {steps.length}
        </p>
        <h2 className="mt-1 text-base font-bold text-navy-950">{step.title}</h2>
        <p className="mt-1 text-sm text-muted">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="min-h-11 px-3 text-sm font-medium text-muted hover:text-navy-950"
          >
            Passer
          </button>
          <button
            type="button"
            onClick={() => (last ? close() : setIndex(index + 1))}
            className="min-h-11 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"
          >
            {last ? "Terminer" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
