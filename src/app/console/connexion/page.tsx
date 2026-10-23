import ConsoleLoginForm from "./ConsoleLoginForm";

// Accès réservé au propriétaire de la plateforme. Pas d'indexation, pas de lien public.
export default function ConsoleLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <h1 className="text-xl font-bold text-navy-950">Console Manguifi</h1>
        <p className="mt-1 text-sm text-muted">Accès réservé.</p>
        <div className="mt-6">
          <ConsoleLoginForm />
        </div>
      </div>
    </div>
  );
}
