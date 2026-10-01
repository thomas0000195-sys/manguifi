"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { generateEmployeeAccessCodeAction } from "@/app/actions/employee-access-code";
import { Loader2, RefreshCw, Copy, Check } from "lucide-react";

export default function AccessCodePanel({ employeeId }: { employeeId: string }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("employeeId", employeeId);
      const res = await generateEmployeeAccessCodeAction({}, formData);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setGeneratedCode(res.code || null);
      toast.success("Code d'accès généré");
    });
  }

  function handleCopy() {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copié");
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-navy-950">Code d'accès</h2>
      <p className="mt-1 text-xs text-muted">
        Générez un code de 8 chiffres que l'employé utilisera pour se connecter à /connexion-employe.
        {generatedCode && (
          <>
            <br />
            <strong>Le code expire dans 30 jours.</strong>
          </>
        )}
      </p>

      {generatedCode && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-3.5 py-2.5">
          <code className="flex-1 font-mono text-sm font-bold text-green-900">{generatedCode}</code>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition hover:bg-green-100"
            title="Copier"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-600">Copié</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-600">Copier</span>
              </>
            )}
          </button>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={pending}
        className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-navy-900 transition hover:bg-navy-50 disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Génération en cours...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            {generatedCode ? "Régénérer un nouveau code" : "Générer un code d'accès"}
          </>
        )}
      </button>

      {generatedCode && (
        <p className="mt-2 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
          ⚠️ Communiquez ce code à l'employé — il ne s'affichera qu'une seule fois.
          <br />
          La génération d'un nouveau code révoquera la session active.
        </p>
      )}
    </div>
  );
}
