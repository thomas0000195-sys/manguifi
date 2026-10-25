import PublicFooter from "@/components/PublicFooter";

export const metadata = { title: "Support — Manguifi" };

const FAQ = [
  {
    q: "Je n'arrive pas à me connecter.",
    a: "Vérifiez que vous utilisez le téléphone ou l'adresse e-mail donnés à votre administrateur. Le code de connexion est valable quelques minutes : demandez-en un nouveau si le précédent a expiré.",
  },
  {
    q: "Je n'ai pas reçu mon code.",
    a: "Regardez dans les spams ou dans les messages WhatsApp. Si rien n'arrive après quelques minutes, demandez un nouveau code, ou contactez votre administrateur.",
  },
  {
    q: "Le pointage ne fonctionne pas.",
    a: "Autorisez la localisation et la caméra pour le navigateur ou l'application. Le pointage n'est possible que sur le lieu de travail, avec le GPS activé.",
  },
  {
    q: "Qui peut voir mes données ?",
    a: "Votre administrateur et les responsables de votre équipe, selon leur rôle. Vous pouvez consulter notre politique de confidentialité à tout moment.",
  },
  {
    q: "Comment supprimer mon compte ?",
    a: "Depuis « Mon compte », section « Mes données », ou en suivant la page Supprimer mon compte.",
  },
];

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-navy-950">
      <h1 className="text-2xl font-bold">Support Manguifi</h1>
      <p className="mt-3 text-muted">Une question, un problème ? Écrivez-nous, nous répondons en français.</p>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">Nous contacter</h2>
        <p>
          E-mail :{" "}
          <a className="font-medium underline" href="mailto:m.gomis@iwadaa.com">m.gomis@iwadaa.com</a>
        </p>
        <p>WhatsApp : TODO_THOMAS (numéro de support)</p>
        <p className="text-muted">Délai de réponse : TODO_THOMAS (par exemple « sous 2 jours ouvrés »).</p>
      </section>

      <section className="mt-8 space-y-5">
        <h2 className="text-lg font-semibold">Questions fréquentes</h2>
        {FAQ.map((item) => (
          <div key={item.q}>
            <h3 className="font-semibold">{item.q}</h3>
            <p className="mt-1 text-muted">{item.a}</p>
          </div>
        ))}
      </section>

      <PublicFooter />
    </main>
  );
}
