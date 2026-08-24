import { requireUser } from "@/lib/guard";
import Link from "next/link";
import { QrCode, Home, History, FileCheck2, LogOut, UserCircle } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import InstallPrompt from "@/components/InstallPrompt";

export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["EMPLOYEE"]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-white">
            <QrCode className="h-4 w-4" />
          </div>
          <span className="font-semibold text-navy-900">Manguifi</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/espace/compte" className="text-muted hover:text-navy-900" title="Mon compte">
            <UserCircle className="h-5 w-5" />
          </Link>
          <form action={logoutAction}>
            <button className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-red-600">
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </button>
          </form>
        </div>
      </header>

      <InstallPrompt />

      {user.org.isDemo && (
        <div className="border-b border-orange-100 bg-orange-50 px-4 py-2 text-center text-[11px] font-medium text-orange-700">
          Mode démonstration — données fictives
        </div>
      )}

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-3 border-t border-border bg-surface/95 backdrop-blur">
        <Link href="/espace" className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-navy-900">
          <Home className="h-5 w-5" /> Accueil
        </Link>
        <Link href="/espace/historique" className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted">
          <History className="h-5 w-5" /> Historique
        </Link>
        <Link href="/espace/justificatifs" className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted">
          <FileCheck2 className="h-5 w-5" /> Justificatifs
        </Link>
      </nav>
      <p className="sr-only">{user.email}</p>
    </div>
  );
}
