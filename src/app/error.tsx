"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-background px-5 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Une erreur est survenue</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Quelque chose s&apos;est mal passé de notre côté. Réessayez, et si le problème persiste, contactez votre administrateur.
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
      >
        <RotateCcw className="h-4 w-4" /> Réessayer
      </button>
    </div>
  );
}
