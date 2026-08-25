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

      <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
        <strong>Brouillon en attente de validation juridique.</strong> Ce texte décrit fidèlement
        le fonctionnement technique actuel de l&apos;application, mais n&apos;a pas été relu par
        un juriste. Ne le considérez pas comme définitif avant validation.
      </div>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-navy-900">
        <section>
          <h2 className="font-semibold text-navy-950">1. Données collectées</h2>
          <p className="mt-1.5 text-muted">
            Manguifi collecte les données strictement nécessaires au pointage
            du personnel : identité (nom, prénom, matricule, numéro de
            téléphone, email facultatif, photo de profil, et selon
            l&apos;activation par votre organisation, date de naissance et
            numéro de pièce d&apos;identité), appartenance à une équipe/un
            site, horodatage et géolocalisation de chaque pointage
            (nécessaires pour confirmer votre présence sur site), et, selon
            les réglages activés par l&apos;administrateur de votre
            organisation, une photo au moment du pointage. Les justificatifs
            d&apos;absence (photo ou scan de document) sont également
            stockés. Pour les employés, le numéro de téléphone sert aussi
            d&apos;identifiant de connexion via WhatsApp (code à usage
            unique envoyé par l&apos;intermédiaire de notre prestataire
            technique Twilio) — voir section 7.
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
            Les photos, documents justificatifs, numéros de téléphone,
            adresses email, dates de naissance et numéros de pièce
            d&apos;identité sont chiffrés avant stockage (AES-256). L&apos;accès
            aux données est cloisonné par rôle : un responsable ne voit que
            les équipes qui lui sont assignées, un employé ne voit que son
            propre espace. Les tentatives de connexion sont limitées en
            fréquence pour prévenir les abus, et les actions sensibles
            (validation, suppression, modification) sont tracées dans un
            journal d&apos;audit consultable par l&apos;administrateur.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">5. Conservation et suppression</h2>
          <p className="mt-1.5 text-muted">
            Les données sont conservées tant que votre compte ou celui de
            votre organisation est actif. Un administrateur peut supprimer
            définitivement l&apos;organisation et l&apos;ensemble de ses
            données depuis Paramètres, ou un employé individuellement depuis
            sa fiche. Un employé peut à tout moment télécharger une copie de
            ses propres données, ou demander leur suppression, depuis son
            espace personnel (Mon compte). Cette demande de suppression est
            transmise à l&apos;administrateur de votre organisation, qui y
            répond directement : les pointages et heures supplémentaires
            ayant une valeur légale de paie, leur suppression n&apos;est pas
            automatique et reste soumise à l&apos;appréciation de votre
            employeur au regard de ses propres obligations légales.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">6. Sauvegardes</h2>
          <p className="mt-1.5 text-muted">
            Des sauvegardes automatiques et chiffrées sont réalisées
            périodiquement pour permettre une restauration en cas
            d&apos;incident technique. Les sauvegardes anciennes sont purgées
            automatiquement au bout d&apos;une durée fixée par
            l&apos;administrateur technique de la plateforme.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">7. Sous-traitants techniques</h2>
          <p className="mt-1.5 text-muted">
            Manguifi fait appel à des prestataires pour certaines fonctions
            techniques : Twilio (envoi des codes de connexion par WhatsApp et
            SMS) et Resend (envoi d&apos;emails de réinitialisation de mot de
            passe). Ces prestataires ne reçoivent que les informations
            strictement nécessaires à l&apos;envoi (numéro de téléphone ou
            email, code à usage unique) et n&apos;ont pas accès au reste de
            vos données.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">8. Contact</h2>
          <p className="mt-1.5 text-muted">
            Pour toute question relative à vos données, contactez
            l&apos;administrateur de votre organisation sur Manguifi.
          </p>
        </section>
      </div>
    </div>
  );
}
