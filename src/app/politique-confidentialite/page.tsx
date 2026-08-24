import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Politique de confidentialité — Manguifi" };

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-navy-950">Politique de confidentialité</h1>
      <p className="mt-1 text-sm text-muted">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-navy-900">
        <section>
          <h2 className="font-semibold text-navy-950">1. Données collectées</h2>
          <p className="mt-1.5 text-muted">
            Manguifi collecte les données strictement nécessaires au pointage
            du personnel : identité (nom, prénom, matricule, téléphone, email
            facultatif, photo de profil), appartenance à une équipe/un site,
            horodatage et géolocalisation de chaque pointage (nécessaires pour
            confirmer votre présence sur site), et, selon les réglages activés
            par l&apos;administrateur de votre organisation, une photo au
            moment du pointage. Les justificatifs d&apos;absence (photo ou
            scan de document) sont également stockés.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">2. Finalité</h2>
          <p className="mt-1.5 text-muted">
            Ces données servent exclusivement au suivi de présence, au calcul
            des heures travaillées et supplémentaires, et à la préparation
            d&apos;exports pour la paie de votre employeur. Elles ne sont
            jamais vendues ni partagées avec des tiers à des fins
            commerciales.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">3. Géolocalisation et photo</h2>
          <p className="mt-1.5 text-muted">
            La géolocalisation est indispensable à chaque pointage : elle sert
            uniquement à vérifier que vous êtes bien sur le site au moment du
            scan, en comparant votre position à celle du site (jamais suivie
            en dehors de ce moment précis). La photo au moment du pointage est
            une option que l&apos;administrateur de votre organisation peut
            activer ou désactiver depuis les paramètres.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">4. Sécurité</h2>
          <p className="mt-1.5 text-muted">
            Les photos et documents justificatifs sont chiffrés avant
            stockage. L&apos;accès aux données est cloisonné par rôle :
            un responsable ne voit que les équipes qui lui sont assignées,
            un employé ne voit que son propre espace.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">5. Conservation et suppression</h2>
          <p className="mt-1.5 text-muted">
            Les données sont conservées tant que votre compte ou celui de
            votre organisation est actif. Un administrateur peut supprimer
            définitivement l&apos;organisation et l&apos;ensemble de ses
            données depuis Paramètres. Un employé souhaitant faire supprimer
            ses données personnelles peut en faire la demande auprès de
            l&apos;administrateur de son organisation.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">6. Contact</h2>
          <p className="mt-1.5 text-muted">
            Pour toute question relative à vos données, contactez
            l&apos;administrateur de votre organisation sur Manguifi.
          </p>
        </section>
      </div>
    </div>
  );
}
