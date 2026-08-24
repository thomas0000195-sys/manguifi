"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { reviewJustificatifAction } from "@/app/actions/justificatif";
import { Check, X, Loader2 } from "lucide-react";

export default function ReviewActions({ justificatifId }: { justificatifId: string }) {
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function review(status: "JUSTIFIE" | "REFUSE") {
    startTransition(async () => {
      const res = await reviewJustificatifAction({ id: justificatifId, status, comment });
      if (res.error) { toast.error(res.error); return; }
      toast.success(status === "JUSTIFIE" ? "Justificatif validé" : "Justificatif refusé");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-3">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commentaire (facultatif)"
        rows={2}
        className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
      />
      <div className="flex gap-3">
        <button
          onClick={() => review("JUSTIFIE")}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-70"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Valider
        </button>
        <button
          onClick={() => review("REFUSE")}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-70"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          Refuser
        </button>
      </div>
    </div>
  );
}
