import { redirect } from "next/navigation";
import Link from "next/link";
import { getConsoleUser } from "@/lib/console/session";
import { modulesFor } from "@/lib/console/modules";
import { logoutConsoleAction } from "@/app/actions/console-logout";

/** Garde serveur de toute la console : sans session super admin valide, retour à la connexion. */
export default async function SecureConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getConsoleUser();
  if (!user) redirect("/console/connexion");

  const modules = modulesFor("SUPER_ADMIN");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface px-4 py-3 md:w-56 md:border-b-0 md:border-r md:px-5 md:py-6">
        <p className="text-sm font-bold text-navy-950">Console Manguifi</p>
        <nav className="mt-3 flex flex-wrap gap-1 md:flex-col">
          {modules.map((m) => (
            <Link key={m.key} href={m.href} className="rounded-lg px-3 py-2 text-sm text-navy-800 hover:bg-navy-50">
              {m.label}
            </Link>
          ))}
        </nav>
        <form action={logoutConsoleAction} className="mt-4">
          <button className="text-xs font-medium text-muted hover:text-red-600">Déconnexion</button>
        </form>
      </aside>
      <main className="flex-1 px-5 py-6">{children}</main>
    </div>
  );
}
