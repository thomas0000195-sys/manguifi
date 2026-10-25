import Link from "next/link";
import { APP_VERSION } from "@/lib/app-version";

/** Pied de page des pages publiques : liens exigés par les stores et version de l'application. */
export default function PublicFooter() {
  return (
    <footer className="mt-12 border-t border-border pt-6 text-xs text-muted">
      <nav aria-label="Liens utiles" className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/confidentialite" className="hover:text-navy-950 hover:underline">Confidentialité</Link>
        <Link href="/conditions-utilisation" className="hover:text-navy-950 hover:underline">Conditions d&apos;utilisation</Link>
        <Link href="/support" className="hover:text-navy-950 hover:underline">Support</Link>
        <Link href="/suppression-compte" className="hover:text-navy-950 hover:underline">Supprimer mon compte</Link>
      </nav>
      <p className="mt-3">Manguifi · version {APP_VERSION}</p>
    </footer>
  );
}
