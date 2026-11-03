"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Demande une vérification immédiate auprès de PayDunya pour une tentative. */
export default function VerifierButton({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function verifier() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/console/paiements/${encodeURIComponent(attemptId)}/verifier`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      setMessage(res.ok ? `Statut : ${data.status}` : (data.error ?? "Vérification impossible."));
      if (res.ok) router.refresh();
    } catch {
      setMessage("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={verifier}
        disabled={busy}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
      >
        {busy ? "Vérification…" : "Vérifier ce paiement"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
