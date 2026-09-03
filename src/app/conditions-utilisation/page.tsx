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
          <h2 className="font-semibold text-navy-950">2. Formation du contrat</h2>
          <p className="mt-1.5 text-muted">
            Conformément à la loi sénégalaise n° 2008-08 du 25 janvier 2008 sur les transactions
            électroniques, l&apos;acceptation des présentes conditions par voie électronique
            (création d&apos;un compte Organisation, ou première connexion d&apos;un responsable
            ou d&apos;un employé invité) vaut acceptation pleine et entière, sans qu&apos;une
            signature manuscrite ne soit requise.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">3. Comptes et accès</h2>
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
          <h2 className="font-semibold text-navy-950">4. Usages autorisés et interdits</h2>
          <p className="mt-1.5 text-muted">
            Le service est réservé à un usage de suivi de présence et de gestion des ressources
            humaines de l&apos;Organisation. Sont notamment interdits : l&apos;accès frauduleux ou
            le maintien frauduleux dans le service, la tentative de contournement des mesures de
            sécurité, l&apos;usurpation d&apos;identité d&apos;un autre utilisateur, la falsification
            de pointages ou de justificatifs, et l&apos;extraction de données à des fins autres que
            la gestion RH de l&apos;Organisation elle-même. Ces agissements sont susceptibles de
            constituer une infraction au sens de la loi sénégalaise n° 2008-11 du 25 janvier 2008
            sur la cybercriminalité, indépendamment de la résiliation du compte concerné.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">5. Responsabilités de l&apos;Organisation</h2>
          <p className="mt-1.5 text-muted">
            L&apos;Organisation est responsable de l&apos;exactitude des informations qu&apos;elle
            saisit (identité des employés, sites, horaires), de l&apos;usage qui est fait des
            données de pointage pour la paie, et du respect de ses propres obligations légales
            envers ses employés (droit du travail, protection des données personnelles
            applicable dans sa juridiction).
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">6. Disponibilité et support</h2>
          <p className="mt-1.5 text-muted">
            Le service est fourni « en l&apos;état », sans garantie de disponibilité continue.
            Des interruptions pour maintenance peuvent survenir. Aucun engagement de niveau de
            service (SLA) n&apos;est garanti à ce stade.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">7. Limitation de responsabilité</h2>
          <p className="mt-1.5 text-muted">
            Manguifi ne saurait être tenu responsable des conséquences d&apos;une décision de
            paie, disciplinaire ou contractuelle prise par l&apos;Organisation sur la base des
            données du service, ni des pertes de données résultant d&apos;un usage non conforme
            (identifiants partagés, appareils non sécurisés). Cette limitation ne s&apos;applique
            pas en cas de dol ou de faute lourde imputable à l&apos;éditeur, conformément aux
            principes du droit sénégalais des obligations.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">8. Propriété intellectuelle</h2>
          <p className="mt-1.5 text-muted">
            Le logiciel, sa marque et son interface restent la propriété de l&apos;éditeur de
            Manguifi. Les données saisies par l&apos;Organisation (employés, pointages,
            justificatifs) lui appartiennent et lui sont restituables sur demande (export des
            données depuis Paramètres).
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">9. Résiliation</h2>
          <p className="mt-1.5 text-muted">
            L&apos;Organisation peut à tout moment supprimer définitivement son compte et
            l&apos;ensemble de ses données depuis Paramètres. Cette action est irréversible.
            L&apos;éditeur peut de son côté suspendre ou résilier l&apos;accès d&apos;une
            Organisation en cas de manquement grave aux présentes conditions, notamment en cas
            d&apos;usage interdit au sens de l&apos;article 4, après notification préalable sauf
            urgence avérée (atteinte à la sécurité du service ou aux données d&apos;autres
            utilisateurs).
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">10. Modification des présentes conditions</h2>
          <p className="mt-1.5 text-muted">
            L&apos;éditeur peut faire évoluer les présentes conditions pour refléter les évolutions
            du service ou de la réglementation applicable. Toute modification substantielle sera
            portée à la connaissance des administrateurs des Organisations concernées avant son
            entrée en vigueur. La poursuite de l&apos;utilisation du service après notification
            vaut acceptation des conditions modifiées.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">11. Force majeure</h2>
          <p className="mt-1.5 text-muted">
            Aucune des parties ne pourra être tenue responsable d&apos;un manquement à ses
            obligations résultant d&apos;un événement de force majeure au sens du droit sénégalais
            (notamment coupure prolongée d&apos;électricité ou de réseau internet imputable à un
            tiers, catastrophe naturelle, décision d&apos;une autorité publique), pendant toute la
            durée de cet événement.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-navy-950">12. Droit applicable et juridiction</h2>
          <p className="mt-1.5 text-muted">
            Les présentes conditions générales d&apos;utilisation sont régies par le droit
            sénégalais, notamment le Code des Obligations Civiles et Commerciales, la loi n°
            2008-08 du 25 janvier 2008 sur les transactions électroniques, la loi n° 2008-11 du 25
            janvier 2008 sur la cybercriminalité, et la loi n° 2008-12 du 25 janvier 2008 portant
            protection des données à caractère personnel. Tout différend relatif à leur validité,
            leur interprétation ou leur exécution qui n&apos;aurait pu être résolu à
            l&apos;amiable sera soumis à la compétence exclusive des juridictions sénégalaises du
            lieu du siège social de l&apos;éditeur de Manguifi. Cette clause ne prive pas
            l&apos;Organisation cliente des protections d&apos;ordre public éventuellement
            applicables dans son propre pays d&apos;implantation, le cas échéant.
          </p>
        </section>
      </div>
    </div>
  );
}
