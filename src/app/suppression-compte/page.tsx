import PublicFooter from "@/components/PublicFooter";

export const metadata = { title: "Supprimer mon compte — Manguifi" };

export default function SuppressionComptePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-navy-950">
      <h1 className="text-2xl font-bold">Supprimer mon compte Manguifi</h1>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Depuis l&apos;application (méthode la plus rapide)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Connectez-vous à Manguifi.</li>
          <li>Ouvrez « Mon compte ».</li>
          <li>Dans la section « Mes données », choisissez « Demander la suppression ».</li>
        </ol>
        <p className="text-muted">Votre demande est transmise à votre administrateur, qui la traite.</p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Si vous n&apos;avez plus accès à votre compte</h2>
        <p className="text-muted">
          Écrivez à{" "}
          <a className="font-medium underline" href="mailto:m.gomis@iwadaa.com">m.gomis@iwadaa.com</a>{" "}
          depuis l&apos;adresse e-mail liée à votre compte, en précisant votre nom, votre entreprise et votre
          numéro de téléphone. Nous vous demanderons une vérification d&apos;identité avant toute suppression.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Ce qui est supprimé</h2>
        <p className="text-muted">
          Vos données personnelles (identité, contact, photo, justificatifs) sont supprimées, sauf celles que la loi
          oblige à conserver, comme les registres de présence et de paie. Les délais de conservation sont décrits
          dans notre politique de confidentialité.
        </p>
      </section>

      <PublicFooter />
    </main>
  );
}
