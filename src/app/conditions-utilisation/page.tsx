import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Conditions générales d'utilisation — Manguifi" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-navy-950">Conditions générales d&apos;utilisation</h1>
      <p className="mt-1 text-sm text-muted">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
        <strong>Brouillon en attente de validation juridique.</strong> Aucune CGU n&apos;existait
        pour ce produit avant ce document. Ce texte pose une structure standard mais n&apos;a pas
        été relu par un juriste — ne le publiez pas tel quel comme référence contractuelle.
      </div>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-navy-900">
        <section>
          <h2 className="font-semibold text-navy-950">1. Objet</h2>
          <p className="mt-1.5 text-muted">
            Manguifi est un service de pointage du personnel par QR code et géolocalisation,
            destiné aux entreprises (l&apos;« Organisation ») souhaitant suivre la présence de
            leurs employés. Les présentes conditions régissent l&apos;accès et l&apos;utilisation
            du service par l&apos;Organisation et les personnes qu&apos;elle y invite
            (administrateurs, responsables, employés).
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">2. Comptes et accès</h2>
          <p className="mt-1.5 text-muted">
            La création d&apos;un compte Organisation se fait par un administrateur, qui invite
            ensuite les responsables et employés. Les employés n&apos;ont pas de création de
            compte libre : leur accès est activé par la vérification d&apos;un numéro de
            téléphone déjà enregistré par l&apos;administrateur. Chaque utilisateur est
            responsable de la confidentialité de ses identifiants et de l&apos;accès à son
            appareil.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">3. Responsabilités de l&apos;Organisation</h2>
          <p className="mt-1.5 text-muted">
            L&apos;Organisation est responsable de l&apos;exactitude des informations qu&apos;elle
            saisit (identité des employés, sites, horaires), de l&apos;usage qui est fait des
            données de pointage pour la paie, et du respect de ses propres obligations légales
            envers ses employés (droit du travail, protection des données personnelles
            applicable dans sa juridiction).
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">4. Disponibilité et support</h2>
          <p className="mt-1.5 text-muted">
            Le service est fourni « en l&apos;état », sans garantie de disponibilité continue.
            Des interruptions pour maintenance peuvent survenir. Aucun engagement de niveau de
            service (SLA) n&apos;est garanti à ce stade.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">5. Limitation de responsabilité</h2>
          <p className="mt-1.5 text-muted">
            Manguifi ne saurait être tenu responsable des conséquences d&apos;une décision de
            paie, disciplinaire ou contractuelle prise par l&apos;Organisation sur la base des
            données du service, ni des pertes de données résultant d&apos;un usage non conforme
            (identifiants partagés, appareils non sécurisés).
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">6. Propriété intellectuelle</h2>
          <p className="mt-1.5 text-muted">
            Le logiciel, sa marque et son interface restent la propriété de l&apos;éditeur de
            Manguifi. Les données saisies par l&apos;Organisation (employés, pointages,
            justificatifs) lui appartiennent et lui sont restituables sur demande (export des
            données depuis Paramètres).
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">7. Résiliation</h2>
          <p className="mt-1.5 text-muted">
            L&apos;Organisation peut à tout moment supprimer définitivement son compte et
            l&apos;ensemble de ses données depuis Paramètres. Cette action est irréversible.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">8. Droit applicable</h2>
          <p className="mt-1.5 text-muted">
            <em>À compléter selon le pays d&apos;immatriculation de l&apos;éditeur et les
            juridictions des Organisations clientes — point à trancher avec un juriste avant
            publication.</em>
          </p>
        </section>
      </div>
    </div>
  );
}
