/** Bandeau affiché sur les écrans de paiement tant que PAYDUNYA_MODE=test. */
export default function BandeauTest() {
  return (
    <div role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
      MODE TEST : aucun argent réel n&apos;est débité.
    </div>
  );
}
