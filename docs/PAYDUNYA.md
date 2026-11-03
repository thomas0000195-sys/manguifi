# Paiement des factures par PayDunya (mode test)

Ce document décrit l'intégration PayDunya : comment elle fonctionne, comment la configurer,
comment la tester, et ce qu'il reste à faire avant le passage en production.

Statut : **mode test uniquement**. Rien n'est encore activé en production.

---

## 1. Ce que fait l'intégration

Une admin d'entreprise peut payer une facture en ligne (Wave, Orange Money, Free Money, carte)
depuis la page **Mon abonnement** (`/abonnement`). Quand PayDunya confirme le paiement, la facture
passe automatiquement à **Payée**.

Ce qui n'est **pas** fait : prélèvement automatique, remboursement, suspension automatique d'un
compte, abonnement récurrent, stockage de numéro de carte ou de téléphone de paiement.
Aucune donnée de paiement ne transite par Manguifi : le client paie sur la page PayDunya.

## 2. Schéma du flux

```
Admin                 Manguifi (serveur)                      PayDunya
  |  « Payer en ligne »      |                                    |
  |------------------------->| POST /api/billing/invoices/:id/pay |
  |                          |  - contrôles (rôle, entreprise,    |
  |                          |    flag, liste blanche, facture)   |
  |                          |  - montant lu en base              |
  |                          |  - PaymentAttempt INITIATED        |
  |                          |  POST checkout-invoice/create ---->|
  |                          |<------ token + URL de paiement ----|
  |                          |  - PaymentAttempt PENDING          |
  |<---- URL de paiement ----|                                    |
  |------------------------- redirection navigateur -------------->|
  |                                                               | (paiement)
  |                          |<--- IPN POST (formulaire, hash) ---|
  |                          |  1. hash vérifié (SHA-512, temps constant)
  |                          |  2. statut RELU : GET checkout-invoice/confirm/:token
  |                          |  3. hash de la réponse revérifié, mode, montant
  |                          |  4. transaction : tentative SUCCESS + Payment
  |                          |     + facture PAYEE + AuditLog (une seule fois)
  |                          |  5. email « Paiement reçu » à l'admin
  |<--- retour navigateur ---|  /abonnement/paiement/retour?token=…
  |                          |  statut affiché = statut vérifié côté serveur
```

Filet de sécurité : `POST /api/cron/paydunya-reconcile` (Bearer `CRON_SECRET`) revérifie les
tentatives restées ouvertes depuis plus de 15 minutes, et passe en **EXPIRED** celles qui n'ont
pas été payées au bout de 24 heures.

## 3. Fichiers

| Rôle | Fichier |
|---|---|
| Configuration et validation des variables | `src/lib/paydunya/config.ts` |
| Client HTTP/JSON, hash IPN | `src/lib/paydunya/client.ts` |
| Logique de paiement, rapprochement, idempotence, rattrapage | `src/lib/billing/paydunya-payments.ts` |
| Emails (Resend) | `src/lib/billing/emails.ts` |
| Création du paiement | `src/app/api/billing/invoices/[id]/pay/route.ts` |
| Notification IPN | `src/app/api/billing/paydunya/ipn/route.ts` |
| Rattrapage (cron) | `src/app/api/cron/paydunya-reconcile/route.ts` |
| Page Mon abonnement | `src/app/(app)/abonnement/page.tsx` |
| Page retour | `src/app/(app)/abonnement/paiement/retour/page.tsx` |
| Console : liste et vérification manuelle | `src/app/console/(secure)/paiements/`, `src/app/api/console/paiements/[id]/verifier/route.ts`, `src/lib/console/paiements.ts` |
| Tests (sans réseau) | `tests/paydunya.test.ts` (lancés par `npm run test:auth`) |
| Migration et retour arrière | `prisma/migrations/20261103120000_add_paydunya_payments/`, `prisma/rollback/20261103120000_add_paydunya_payments.sql` |

## 4. Variables d'environnement

Aucune valeur ici : les clés se trouvent dans PayDunya Business (Intégrez notre API).

| Variable | Rôle |
|---|---|
| `PAYDUNYA_MODE` | `test` (sandbox, clés de test) ou `live`. **Vide = intégration désactivée**, comportement inchangé. |
| `PAYDUNYA_MASTER_KEY` | Clé principale. Sert aussi à vérifier le hash des réponses et des notifications. |
| `PAYDUNYA_PRIVATE_KEY` | Clé privée du mode courant. |
| `PAYDUNYA_TOKEN` | Jeton de l'application, du mode courant. |
| `PAYDUNYA_PUBLIC_KEY` | Présente dans `.env.example` mais **non utilisée** : l'API HTTP/JSON ne s'en sert pas. Non obligatoire. |
| `PAYDUNYA_ENABLED_COMPANY_IDS` | Liste blanche d'identifiants d'entreprises (séparés par des virgules). Vide = personne. |
| `BILLING_ALERT_EMAIL` | Destinataire des alertes internes (écart de montant, paiement à examiner). Optionnel. |
| `APP_URL` | URL publique. Utilisée pour le retour et la notification. En `live`, doit commencer par `https://`. |

**Validation au démarrage** (`src/instrumentation.ts`) : si `PAYDUNYA_MODE` est renseigné, toutes les
clés obligatoires doivent l'être, sinon l'application refuse de démarrer. Le message indique le nom
de la variable manquante, jamais sa valeur.

**Deux verrous d'accès** pour chaque entreprise :
1. le flag Console `billing.paydunya` (table `FeatureFlag`, ligne `key = 'billing.paydunya'`, désactivé par défaut) ;
2. la liste blanche `PAYDUNYA_ENABLED_COMPANY_IDS`.

Activer le flag (à faire à la main, dans l'éditeur SQL de Neon, avec précaution) :

```sql
INSERT INTO "FeatureFlag" ("key", "enabled", "updatedAt")
VALUES ('billing.paydunya', true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "enabled" = EXCLUDED."enabled", "updatedAt" = CURRENT_TIMESTAMP;
```

Désactiver : même requête avec `false`. Sans ligne, le flag est considéré comme désactivé.

## 5. Données

Migration **additive** (`20261103120000_add_paydunya_payments`) :

- `PaymentAttempt` : une tentative de paiement en ligne (statuts : `INITIATED`, `PENDING`, `SUCCESS`,
  `FAILED`, `CANCELED`, `EXPIRED`, `TO_REVIEW`). Contient le montant, le mode (`isTest`), le jeton
  PayDunya, la référence et une raison courte expurgée. **Aucune clé, aucun hash complet, aucun corps de requête.**
- `Payment` : un encaissement, avec `source` (`MANUAL` ou `PAYDUNYA`), `isTest` et le lien vers la tentative.
- `Invoice` : points d'accroche minimaux (voir §9).
- `FeatureFlag` : interrupteurs de la Console.

Les paiements de test (`isTest = true`) sont exclus des encaissements réels : la Console les affiche à part,
et tout indicateur doit utiliser `NON_TEST_PAYMENT_FILTER` (`src/lib/billing/paydunya-payments.ts`).

**Retour arrière** : voir `prisma/rollback/20261103120000_add_paydunya_payments.sql`. À n'exécuter qu'à la main,
et seulement si aucun paiement en ligne n'a été encaissé (sinon, exporter d'abord).

**Appliquer la migration** : ne jamais lancer `prisma migrate deploy` sur la production depuis un poste de
développement. Ouvrir `migration.sql` et l'exécuter dans l'éditeur SQL de Neon, en une transaction.

## 6. Procédure de test (mode test)

Prérequis : une base de test (ou la base de développement), une entreprise de test, un compte admin de test,
les clés **de test** PayDunya, et une facture de test.

1. Renseigner `PAYDUNYA_MODE=test`, les clés de test, `APP_URL`, et `PAYDUNYA_ENABLED_COMPANY_IDS` (l'identifiant
   de l'entreprise de test uniquement). Activer le flag (SQL du §4).
2. Se connecter en admin, ouvrir `/abonnement`. Le bandeau **MODE TEST** doit apparaître.
3. Cliquer sur **Payer en ligne**. Le navigateur doit aller sur la page de paiement PayDunya (sandbox).
4. Payer avec un moyen de test fourni par la documentation PayDunya.
5. Vérifier : la page de retour affiche « Paiement confirmé », la facture est **Payée**, un seul `Payment`
   existe, et l'email « Paiement reçu » arrive (si `RESEND_API_KEY` est configurée).
6. Annulation : cliquer sur « Annuler » sur la page PayDunya. La facture ne doit pas changer.
7. Notification : vérifier que PayDunya a bien appelé `/api/billing/paydunya/ipn` (journal Vercel).
8. Console : `/console/paiements` affiche la tentative en mode TEST, séparée des encaissements réels.

Les tests automatisés (`npm run test:auth`) couvrent la logique sans réseau. Ils ne remplacent pas le test
de bout en bout ci-dessus, qui n'a pas pu être exécuté dans l'environnement de développement (voir §10).

## 7. Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| L'application ne démarre pas, message « Variables PayDunya manquantes » | `PAYDUNYA_MODE` renseigné sans toutes les clés | Compléter les variables, ou vider `PAYDUNYA_MODE`. |
| « Le paiement en ligne n'est pas disponible » | Flag désactivé, ou entreprise hors liste blanche | Vérifier la ligne `FeatureFlag` et `PAYDUNYA_ENABLED_COMPANY_IDS`. |
| Facture payée sur PayDunya mais restée « À payer » | IPN non reçue (URL, pare-feu, Vercel) | Console › Paiements › « Vérifier ce paiement ». Vérifier l'URL de notification côté PayDunya. |
| Statut « À examiner » (TO_REVIEW) | Montant, devise ou mode différents, ou facture déjà réglée | Ne rien marquer à la main. Comparer le montant PayDunya et la facture, puis décider. Alerte envoyée à `BILLING_ALERT_EMAIL`. |
| « Notification rejetée » dans la Console | Signature invalide : mauvaise clé, ou appel non légitime | Vérifier `PAYDUNYA_MASTER_KEY` (mode courant). Un nombre élevé peut signaler une attaque. |
| « Le service de paiement est indisponible » | Erreur réseau ou refus de PayDunya à la création | Réessayer. Voir les erreurs dans la Console (source `api`). |
| Tentative bloquée en « En attente » | Confirmation pas encore reçue | Le rattrapage la revérifie après 15 min. Bouton « Vérifier ce paiement » en Console. |

## 8. Passage en production : liste de contrôle

- [ ] Documents d'entreprise validés par PayDunya (compte Business activé pour le mode live).
- [ ] Clés **de production** saisies dans Vercel (environnement Production) : `PAYDUNYA_MASTER_KEY`,
      `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`. Ne jamais les mettre dans le dépôt ni dans un fichier committé.
- [ ] `PAYDUNYA_MODE=live`, `APP_URL=https://www.manguifi.tech` (avec `www`, sans redirection).
- [ ] URL de notification (IPN) activée côté PayDunya : `https://www.manguifi.tech/api/billing/paydunya/ipn`.
      Les protections de Vercel sur les aperçus empêchent la notification : le test se fait sur le domaine de production.
- [ ] Informations de l'émetteur renseignées dans Manguifi (lot 10.4), pour ne plus émettre de proforma.
- [ ] Test avec un petit montant réel, sur la société de test seulement (liste blanche).
- [ ] Retirer la liste blanche de test, ou l'ouvrir aux entreprises validées.
- [ ] Tâche de rattrapage programmée (voir §10, point 9).

## 9. Écarts avec le cahier des charges et avec la documentation PayDunya

Ces points ont été relevés en comparant le cahier des charges et la documentation officielle
(`https://developers.paydunya.com/doc/FR/http_json`).

| # | Sujet | Écart et justification |
|---|---|---|
| 1 | **Lot 10 absent** | Le dépôt ne contenait ni plans, ni abonnements, ni factures, ni paiements manuels. Seuls les points d'accroche `Invoice` et `Payment` ont été ajoutés (et `PaymentAttempt`). **Pas de plan ni d'échéance**, pas de création de facture par l'application : les factures doivent être créées par un outil ou un script en attendant le lot 10. Le paiement manuel de la Console n'existe pas encore. |
| 2 | `PAYDUNYA_PUBLIC_KEY` | Le cahier des charges la liste comme obligatoire. L'API HTTP/JSON ne l'utilise pas : elle n'est donc pas requise. |
| 3 | Devise | La réponse de confirmation ne contient pas de devise. La devise est contrôlée côté Manguifi (XOF). |
| 4 | Méthode de paiement | La réponse de confirmation documentée ne contient pas le moyen de paiement : le champ `method` reste vide. |
| 5 | Alerte « signature rejetée » | Le cahier des charges demande une entrée dans l'**AuditLog** (`billing.ipn_rejected`). Or `AuditLog` exige un utilisateur et une entreprise, qui sont inconnus pour une requête non signée. L'événement est donc écrit dans **ErrorLog** (Console › Erreurs) avec le préfixe `billing.ipn_rejected`. |
| 6 | Statut « à examiner » | Le cahier des charges le mentionne sans nom de statut. Ajout du statut `TO_REVIEW`. |
| 7 | Nommage | `orgId` au lieu de `companyId`, pour rester cohérent avec le reste du schéma. |
| 8 | Flag `billing.paydunya` | Pas d'écran Console pour le basculer : la table `FeatureFlag` se modifie en SQL (§4). |
| 9 | Limitation de débit de l'IPN | Une limite globale (300 requêtes par minute) est appliquée, pas une limite par IP : l'IP fiable dépend de `TRUST_PROXY`, qui n'est pas documentée comme activée en production. |
| 10 | Pré-remplissage du client | Non fait : aucune donnée personnelle n'est envoyée à PayDunya (la documentation le permet via `customer`). |
| 11 | Callback par facture | Fait : `actions.callback_url` est renseigné à chaque création (la documentation le permet). |
| 12 | Forme de l'IPN | La documentation indique un envoi `application/x-www-form-urlencoded` avec les données sous la clé `data`. Le code lit `data[hash]` et `data[invoice][token]`. **Ces noms de champs sont déduits de la structure documentée : à confirmer sur le bac à sable** (voir §10). |
| 13 | Expiration à 24 h | La documentation indique que PayDunya annule elle-même une facture non payée au bout de 24 h. Manguifi passe aussi la tentative en EXPIRED pour que la Console reste juste. |
| 14 | Rattrapage | La tâche existe (`/api/cron/paydunya-reconcile`), mais **n'est programmée nulle part** : pas d'entrée dans `vercel.json` (voir §10). |
| 15 | Lien de menu | La page « Mon abonnement » n'est pas dans le menu : le menu est commun à tous les rôles. Accès par l'URL `/abonnement` pour l'instant. |
| 16 | Seuil d'alerte Console | Les signatures rejetées et les paiements à examiner sont affichés, sans seuil d'alerte automatique. |

## 10. À faire manuellement (dans l'ordre)

1. Dans PayDunya (bac à sable), créer ou vérifier l'application en mode test, et noter les clés de test.
2. Renseigner les variables de test (voir §4) **en local** ou dans un environnement de test, jamais dans le dépôt.
3. Appliquer `prisma/migrations/20261103120000_add_paydunya_payments/migration.sql` dans l'éditeur SQL Neon
   (la base de test d'abord), en une transaction.
4. Vérifier sur le bac à sable les noms de champs de l'IPN (point 12 du §9), et la réponse de confirmation.
5. Exécuter le parcours de test du §6.
6. Ajouter les variables dans Vercel (Production) **avec les clés de test d'abord**, puis les clés live au passage en production.
7. Activer la notification (IPN) côté PayDunya avec l'URL exacte du §8.
8. Activer le flag et la liste blanche pour la société de test seulement, puis tester sur le domaine de production.
9. Programmer le rattrapage : un appel `GET https://www.manguifi.tech/api/cron/paydunya-reconcile` toutes les 15 à
   30 minutes, avec l'en-tête `Authorization: Bearer <CRON_SECRET>`. Par exemple avec un cron Vercel dans `vercel.json`,
   ou un planificateur externe. Non fait dans ce dépôt.
10. Ajouter un lien « Mon abonnement » dans le menu, pour les admins uniquement, si souhaité.
