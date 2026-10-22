# Rapport final — audit de sécurité MANGUIFI (21 octobre 2026)

Branche : `fix/security-audit-2026-10`. Périmètre : code de l'application, base de développement, dépendances. Les systèmes de production n'ont pas été touchés.

## A. Résumé exécutif

Avant les corrections : une connexion employé par simple matricule (sans secret), deux secrets de repli publics, des sessions qui survivaient à la désactivation d'un compte, une limitation de débit inopérante sur Vercel, 3 vulnérabilités critiques et 10 élevées en dépendances de production, une CSP autorisant tous les scripts inline.

Après les corrections : aucune vulnérabilité connue en dépendances de production, connexion employé par code e-mail haché et limité, secrets obligatoires sans valeur de repli, sessions révoquées à chaque accès, limitation partagée en base, CSP à nonce pour les scripts, e-mails échappés, cron authentifié par en-tête.

Limites : les styles inline imposent `'unsafe-inline'` sur `style-src`, les données binaires restent en base, et les parcours employé (pointage, exports) n'ont pas été testés de bout en bout.

## B. Vulnérabilités

| Constat de l'audit | Gravité | État | Correction | Vérification |
|---|---|---|---|---|
| Connexion employé par matricule seul | Critique | Corrigé | Code à 6 chiffres par e-mail, haché, à usage unique, 5 essais max (`src/app/actions/email-auth.ts`, `src/lib/email-otp.ts`). Matricule retiré. | `tests/employee-email-otp.test.ts` |
| Secrets de repli codés en dur (JWT, chiffrement) | Critique | Corrigé | Absence ou longueur inférieure à 32 : échec explicite (`src/lib/secrets.ts`) | `tests/secrets.test.ts` |
| Sessions valables après désactivation ou réinitialisation | Élevée | Corrigé | Empreinte du mot de passe dans la session, statut employé vérifié à chaque accès (`src/lib/auth.ts`) | `tests/sessions.test.ts` |
| Limitation de débit en mémoire, IP falsifiable | Élevée | Corrigé | Table `RateLimitBucket` partagée, IP seulement si `TRUST_PROXY=true`, échec fermé (`src/lib/rate-limit.ts`) | `tests/rate-limit.test.ts` (PGlite) et test de fumée sur la base de développement |
| Dépendances critiques (Next, Capacitor) et élevées (Prisma, transitives) | Critique / élevée | Corrigé en production | Next 16.4.2, Capacitor 8.5.3, Prisma 7.10.1, `npm audit fix` | `npm audit --omit=dev` : 0 |
| OTP WhatsApp : code en clair, essais non limités | Moyenne | Corrigé | Chemin remplacé par l'OTP e-mail ; `src/lib/otp.ts` supprimé | Couvert par les tests OTP e-mail |
| Chemin WhatsApp employé accessible en POST direct | Moyenne | Corrigé | Actions et formulaire orphelins supprimés ; `/connexion-employe` redirige côté serveur | tsc, ESLint, build |
| Injection HTML dans les e-mails | Moyenne | Corrigé | Échappement et validation des destinataires (`src/lib/email.ts`) | `tests/email-html.test.ts` |
| Secret cron dans l'URL, comparaison non constante | Moyenne | Corrigé | En-tête uniquement, comparaison à temps constant (`src/lib/cron-auth.ts`) | `tests/cron-auth.test.ts` |
| CSP `unsafe-inline` pour les scripts | Moyenne | Corrigé pour les scripts | Nonce par requête (`src/proxy.ts`), rendu dynamique | Build et serveur de production, hydratation vérifiée |
| CSP `unsafe-inline` pour les styles | Faible | Non corrigé | Décision documentée : `style=""` rendus par le serveur | `docs/securite/csp.md` |
| Énumération de comptes | Faible | Réduite | Messages génériques à l'inscription, aux OTP admin, à la liaison de téléphone, aux doublons d'employés et à l'import CSV | Revue du code |
| Déchiffrement qui renvoie le texte chiffré | Faible | Corrigé | Échec explicite ; variante d'affichage pour les pages en lecture seule | `tests/secrets.test.ts` |
| Données binaires (photos, justificatifs) en base | Faible | Non corrigé | Plan écrit, aucune migration | `docs/securite/donnees-binaires.md` |
| Table `OTPCode` orpheline | Faible | Non corrigé | Conservée, suppression à valider | — |

## C. Tests

Commandes exécutées :

- `npm run test:auth` : 83 tests, 83 réussis, 0 échec (suites : employé par e-mail, secrets, sessions, limitation de débit, cron, e-mails, isolation entre entreprises, règles métier).
- `npx tsc --noEmit` : aucune erreur.
- `npx eslint src prisma scripts` : 0 erreur, 0 avertissement.
- `npx next build` : réussi, avec variables d'environnement et sans variables (secrets et `DATABASE_URL` retirés temporairement, `.env` restauré).
- Serveur de production local : en-tête CSP avec nonce, hydratation de `/connexion` vérifiée.

Parcours de bout en bout, faits à la main dans le navigateur sur la base de développement (aucun script enregistré) :

1. Inscription d'une entreprise de test, création d'un site (position simulée), d'une équipe : réussi. L'ajout d'un employé a échoué car la photo de profil obligatoire n'a pas pu être fournie par le navigateur de test.
2. Tableau de bord, employés, équipes et sites, horaires, rapports, paramètres, journal d'audit : pages affichées sans erreur.
3. Déconnexion, redirection d'une page protégée vers `/connexion`, reconnexion : réussies.
4. Onglet « Employé » de `/connexion` : affiché et réactif aux clics.

Non testés de bout en bout : pointage par QR code, connexion employé avec code reçu, exports CSV et PDF, envoi d'e-mails réels, notifications, tâches cron.

Remarque : les données de test restent dans la base de développement (une organisation « E2E Test Org » et son administrateur de test). Elles peuvent être supprimées.

## D. Dépendances

| Paquet | Avant | Après |
|---|---|---|
| next, eslint-config-next | 16.3.1 | 16.4.2 |
| @capacitor/android, ios, core | 8.5.0 | 8.5.3 |
| @capacitor/cli | 8.5.0 (dépendance) | 8.5.3 (développement) |
| prisma, @prisma/client | 6.19.3 | 7.10.1 (avec @prisma/adapter-pg et pg) |

Audit :

- Production : 18 vulnérabilités (3 critiques, 10 élevées, 4 modérées, 1 faible) avant ; 0 après.
- Total, y compris développement : 27 avant ; 12 après (1 critique, 8 élevées, 3 modérées). Elles sont toutes dans les outils de développement : `@capacitor/assets` (dépend de `@capacitor/cli` 5 et de `sharp` 0.32), la chaîne `eslint-config-next` 14 proposée par npm (retour arrière majeur, refusé), `uuid` et `xcode` (sans correctif).

Versions récentes : Next 16.4.2 et Prisma 7.10.1 ont été publiés le 15 octobre 2026. À surveiller.

## E. Modifications

Commits sur la branche :

- `1e78bd8` : phases 1 à 3 (authentification employé, secrets, sessions, limitation de débit).
- `8dda14e` : phase 4 (dépendances).
- `3e68ec4` : phases 5 à 9 (OTP WhatsApp, e-mails, cron, énumération, Prisma 7).
- `6855901` : CSP à nonce, décryptage d'affichage, tests d'isolation et métier, documentation.

Modifications non commitées à la date de ce rapport : suppression de la page WhatsApp employé et de ses actions, redirection serveur de `/connexion-employe`, texte d'aide du compte employé (e-mail au lieu de WhatsApp), tests de la branche WhatsApp employé supprimés.

## F. Actions manuelles restantes

1. Appliquer la migration `20261021120000_add_rate_limit_bucket` sur la base de production (`npx prisma migrate deploy`), après sauvegarde.
2. Définir `TRUST_PROXY=true` uniquement si l'application est derrière un proxy de confiance, et `CLIENT_IP_HEADER` si l'hébergeur en utilise un autre.
3. Définir `CRON_SECRET` dans l'environnement Vercel (ou de l'hébergeur) pour que les crons reçoivent l'en-tête d'authentification.
4. Vérifier que chaque employé a un e-mail enregistré, sinon il ne peut plus se connecter.
5. Prévenir les utilisateurs : les sessions existantes sont invalidées au déploiement.
6. Passer `DATABASE_URL` en `sslmode=verify-full`.
7. Décider du stockage des photos et justificatifs (voir `donnees-binaires.md`).
8. Décider de la suppression de la table `OTPCode`.
9. Supprimer les données de test de la base de développement si elles gênent.

## G. Retour arrière

Ordre inverse des commits : `git revert 6855901`, puis `git revert 3e68ec4`, puis `git revert 8dda14e`, puis `git revert 1e78bd8`. Les modifications non commitées se restaurent avec `git checkout -- <fichiers>`.

Points à traiter à la main : la migration `RateLimitBucket` ne se défait pas avec Git. Si elle a été appliquée, il faut supprimer la table avec `DROP TABLE "RateLimitBucket";` après sauvegarde. Les sessions émises avec le code précédent restent invalides après retour arrière, ce qui est sans conséquence. Les données chiffrées restent lisibles tant que `ENCRYPTION_KEY` n'a pas changé.

## H. Conclusion

Classement : **corrections appliquées, validation incomplète**.

Justification : aucune vulnérabilité critique connue ne subsiste dans le code de production ni dans ses dépendances, et les corrections critiques et élevées sont testées. La validation reste incomplète pour les raisons suivantes :

- les styles inline imposent `'unsafe-inline'` sur `style-src` ;
- les parcours employé (pointage, exports, e-mails réels) ne sont pas testés de bout en bout ;
- les données binaires restent en base ;
- la migration de production n'est pas encore appliquée.

Ce rapport ne déclare pas l'application totalement sécurisée. Il couvre le périmètre décrit en tête et les limites indiquées ci-dessus.
