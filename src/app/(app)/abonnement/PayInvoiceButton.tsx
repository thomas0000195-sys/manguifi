"use client";

import { useState } from "react";

/** Lance le paiement PayDunya d'une facture : le serveur crée la tentative et renvoie l'URL de paiement. */
export default function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/invoices/${encodeURIComponent(invoiceId)}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "Paiement impossible pour le moment.");
        setBusy(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Connexion impossible. Réessayez.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="w-full rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Redirection…" : "Payer en ligne"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
