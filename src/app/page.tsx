import Link from "next/link";
import {
  QrCode,
  Clock,
  ShieldCheck,
  FileCheck2,
  BarChart3,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  Briefcase,
  MessageCircle,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex-1 bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-white">
              <QrCode className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-navy-900">
              Manguifi
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
            <a href="#fonctionnalites" className="hover:text-navy-900">
              Fonctionnalités
            </a>
            <a href="#comment" className="hover:text-navy-900">
              Comment ça marche
            </a>
            <a href="#confiance" className="hover:text-navy-900">
              Confiance
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/connexion"
              className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-navy-300 hover:text-navy-900 sm:inline-flex"
            >
              <Briefcase className="h-3.5 w-3.5" /> Espace Pro
            </Link>
            <Link
              href="/connexion-employe"
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" /> Connexion employé
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_-10%,rgba(26,53,96,0.10),transparent_45%),radial-gradient(circle_at_90%_10%,rgba(22,163,74,0.10),transparent_40%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600 ring-1 ring-green-100">
              <CheckCircle2 className="h-3.5 w-3.5" /> Sans badgeuse physique
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-navy-950 sm:text-5xl">
              Le pointage simple
              <br /> par QR code.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted">
              Sachez en quelques secondes qui est présent, absent ou en
              retard. Un système fiable pour vos équipes et votre paie —
              conçu pour les petites entreprises, écoles, chantiers et
              sociétés de sécurité en Afrique.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/connexion-employe"
                className="group inline-flex items-center gap-2 rounded-full bg-navy-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                Se connecter (employé)
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/inscription"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-navy-900 transition hover:bg-navy-50"
              >
                Créer mon compte entreprise
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">
              Employé : connexion instantanée par WhatsApp ou email, sans mot
              de passe.{" "}
              <Link href="/connexion" className="font-medium text-navy-800 hover:underline">
                Espace Pro (admin/responsable)
              </Link>
            </p>
          </div>

          <div className="relative animate-fade-in-up">
            <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-border bg-surface p-5 shadow-2xl shadow-navy-900/10">
              <div className="flex items-center justify-between rounded-2xl bg-navy-950 px-4 py-3 text-white">
                <span className="text-sm font-medium">Aujourd&apos;hui</span>
                <span className="text-xs text-white/60">14:32</span>
              </div>
              <div className="mt-4 rounded-2xl bg-green-50 p-4 ring-1 ring-green-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-white animate-pulse-ring">
                    <CheckCircle2 className="h-6 w-6 animate-check-pop" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-700">
                      Arrivée enregistrée
                    </p>
                    <p className="text-xs text-green-600">
                      Aïcha Traoré · Équipe Salle — 08:02
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
                  <span className="text-navy-900">22 présents sur 26</span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-600">
                    À jour
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm">
                  <span className="text-navy-900">1 anomalie à vérifier</span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                    À traiter
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-2xl font-bold text-navy-950 sm:text-3xl">
          Tout ce qu&apos;il faut pour gérer la présence, simplement
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: QrCode,
              title: "QR code par site",
              desc: "Un seul QR affiché sur place. Connecté à son compte, l'employé le scanne et sa géolocalisation confirme sa présence.",
            },
            {
              icon: Smartphone,
              title: "Feedback immédiat",
              desc: "Vibration progressive, son discret et confirmation visuelle claire à chaque pointage.",
            },
            {
              icon: Clock,
              title: "Heures supplémentaires",
              desc: "Détection automatique, tolérance configurable et validation en un tap pour la paie.",
            },
            {
              icon: FileCheck2,
              title: "Justificatifs d'absence",
              desc: "Upload de documents, validation par le responsable, statut clair pour chaque absence.",
            },
            {
              icon: BarChart3,
              title: "Rapports prêts pour la paie",
              desc: "Export CSV et PDF structurés : heures normales, heures sup, absences justifiées.",
            },
            {
              icon: ShieldCheck,
              title: "Sécurisé et confidentiel",
              desc: "Permissions par rôle, options facultatives clairement expliquées, données protégées.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-navy-950">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="comment" className="bg-navy-950 py-16 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Le parcours en 4 étapes
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1", "Créez votre compte", "Ajoutez site, équipe et employés en quelques minutes."],
              ["2", "Affichez le QR du site", "Un poster à imprimer par site, généré automatiquement."],
              ["3", "Vos équipes scannent", "Connectés à leur compte, arrivée et départ en moins de 10 secondes."],
              ["4", "Suivez et exportez", "Anomalies, heures sup et rapport mensuel pour la paie."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm font-bold">
                  {n}
                </span>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm text-white/60">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="confiance" className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="text-2xl font-bold text-navy-950 sm:text-3xl">
          Prêt à digitaliser votre pointage ?
        </h2>
        <p className="mt-3 text-muted">
          Écoles, restaurants, chantiers, sociétés de sécurité : Manguifi
          s&apos;adapte à votre organisation.
        </p>
        <Link
          href="/inscription"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-navy-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800"
        >
          Démarrer maintenant <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-sm text-muted">
          Déjà employé d&apos;une entreprise sur Manguifi ?{" "}
          <Link href="/connexion-employe" className="font-medium text-navy-800 hover:underline">
            Connectez-vous ici
          </Link>
        </p>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} Manguifi. Le pointage simple par QR code.
        {" · "}
        <Link href="/politique-confidentialite" className="hover:text-navy-900 hover:underline">
          Politique de confidentialité
        </Link>
        {" · "}
        <Link href="/conditions-utilisation" className="hover:text-navy-900 hover:underline">
          CGU
        </Link>
      </footer>
    </div>
  );
}
