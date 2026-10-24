"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * Déconnexion avec confirmation. Le bouton « Rester connecté » est l'action
 * principale, pour éviter une déconnexion par erreur.
 */
export default function LogoutButton({ employee = false }: { employee?: boolean }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" /> Déconnexion
      </button>
      <form ref={formRef} action={logoutAction} className="hidden" />
      <ConfirmDialog
        open={open}
        title="Se déconnecter ?"
        message={
          employee
            ? "Vous devrez demander un nouveau code à votre responsable pour vous reconnecter. Continuer ?"
            : "Voulez-vous vraiment vous déconnecter ?"
        }
        confirmLabel="Se déconnecter"
        cancelLabel="Rester connecté"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
