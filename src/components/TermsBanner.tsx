"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { acceptTermsAction } from "@/app/actions/auth";

export default function TermsBanner() {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-navy-800 bg-navy-950 px-4 py-3 text-xs text-white shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-relaxed text-navy-100">
          En utilisant Manguifi, vous acceptez nos{" "}
          <Link href="/conditions-utilisation" target="_blank" className="font-medium text-white underline underline-offset-2">
            Conditions générales d&apos;utilisation
          </Link>{" "}
          et notre{" "}
          <Link href="/politique-confidentialite" target="_blank" className="font-medium text-white underline underline-offset-2">
            Politique de confidentialité
          </Link>
          .
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await acceptTermsAction();
              setHidden(true);
            })
          }
          className="shrink-0 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-navy-950 transition hover:bg-navy-50 disabled:opacity-60"
        >
          J&apos;accepte
        </button>
      </div>
    </div>
  );
}
