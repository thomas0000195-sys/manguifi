# Rapport de session autonome — Manguifi (pré-lancement)

Session lancée le 2026-08-24 sur la base de `prompt-claude-code-session-autonome-manguifi.md`. Ce fichier fait foi sur ce qui a réellement été fait, testé, et sur ce qui reste bloqué en attente d'une décision ou d'une action externe.

**Contexte important** : le dépôt n'avait aucun historique git avant cette session — initialisé (`git init`) avec un commit baseline capturant l'état existant. Tous les commits ci-dessous sont donc les premiers de l'historique du projet.

---

## 1. Terminé cette session

### Sécurité (Phase 4, points 20-21)

Le chiffrement des données binaires sensibles (photos employé, photos de pointage, documents justificatifs) existait déjà en AES-256-GCM (`src/lib/crypto.ts`) avant cette session — point 20 était donc déjà largement couvert. Cette session a traité les gaps trouvés à l'audit :

- **CSP + HSTS ajoutés** (`next.config.ts`) — les deux headers de sécurité manquants. Testés en build de production réel (`next start` + inspection console), ajustés après un premier essai trop strict : le bootstrap inline de Next.js et les styles critiques inline ont besoin de `'unsafe-inline'` sur `script-src`/`style-src` sans configuration par nonce (non implémentée cette session, voir section 5).
- **Rate limiting manquant sur la vérification OTP admin/responsable** (`whatsapp-auth.ts`) — `verifyLoginOtpAction` et `verifyLinkPhoneOtpAction` n'avaient aucune limite de tentatives sur la vérification du code (brute-force du code à 6 chiffres possible), contrairement à leur équivalent employé. Corrigé.
- **Bug service worker trouvé en testant le CSP** (`public/sw.js`) — le SW retombait sur le shell HTML en cache pour *toute* requête réseau échouée, y compris les chunks JS/CSS, ce qui pouvait corrompre silencieusement l'app sur une connexion instable. Corrigé : le fallback offline ne s'applique plus qu'aux navigations.
- **Sauvegardes en clair sur disque** (`api/cron/backup/route.ts`) — les photos/documents étaient déchiffrés avant d'être écrits dans les fichiers de backup ("pour la lisibilité"). Corrigé : les blobs restent chiffrés dans les fichiers de sauvegarde. Ajout d'une purge automatique (`BACKUP_RETENTION_DAYS`, défaut 30 jours).
- **`.env.example`** mis à jour (variables Twilio manquantes depuis une session précédente, + nouvelles variables Sentry/rétention).

**Non traité, documenté en section 3** : les champs texte identifiants (téléphone, email, numéro de pièce d'identité, date de naissance) restent en clair dans la base SQLite — voir la discussion détaillée en section 3, c'est une décision qui vous revient.

### RGPD (Phase 4, point 22)

- **Export individuel des données d'un employé** (`exportEmployeeDataAction`, `settings.ts`) — jusqu'ici seul un export de TOUTE l'organisation existait ; aucun moyen de répondre à une demande de portabilité pour un employé sans tout extraire. Ajouté, gardé par `assertEmployeeInScope` (IDOR), bouton dédié sur la fiche employé.
- **Fix export organisation** — les photos de profil employé n'étaient jamais déchiffrées dans `exportOrgDataAction`, contrairement aux photos de pointage et documents justificatifs (incohérence, sans doute un oubli). Corrigé.
- **Suppression individuelle** : `deleteEmployeeAction` existait déjà et cascade correctement (Attendance, Justificatif, OvertimeRecord, Schedule). Aucun changement nécessaire.
- **Non traité, documenté en section 3** : pas de self-service employé (export/suppression depuis `/espace`) ; pas de politique de rétention automatique des données de pointage/justificatifs ; texte juridique de `politique-confidentialite/page.tsx` non retouché (relève de la validation légale, hors scope de cette session par les règles d'arrêt).

### Infra & déploiement (Phase 5, points 23-27)

- **Point 23 (hébergement)** — comparatif documenté ci-dessous (section 4), config de déploiement déjà présente (Dockerfile, docker-compose.yml, testés côté build cette session mais toujours jamais exécutés via un vrai `docker build` faute de Docker installé localement — limite déjà connue des sessions précédentes).
- **Point 24 (nom de domaine)** — suggestions documentées section 4. Achat hors scope (règle d'arrêt explicite).
- **Point 25 (variables d'environnement)** — `.env.example` complété (Twilio, Sentry, rétention des sauvegardes).
- **Point 26 (monitoring)** — Sentry intégré au niveau code (serveur, edge, navigateur, capture d'erreur dans `error.tsx`), inactif tant qu'aucun DSN n'est renseigné. `next.config.ts` n'est PAS enveloppé par `withSentryConfig` (ça demande un token d'auth Sentry pour l'upload de source maps — je n'en ai pas). Compte à créer par vous.
- **Point 27 (sauvegardes)** — script déjà présent (`api/cron/backup`), corrigé cette session (voir sécurité ci-dessus) + purge automatique ajoutée. Restauration testée par lecture de code (le format spread reste compatible avec le schema WhatsApp actuel), pas par un restore réel de bout en bout (risque jugé disproportionné pour une vérification sur les données de démo).
- **Point 28 (checklist de mise en production)** — voir section 6.

### Nouvelle fonctionnalité — Import en masse (Phase 3 du prompt)

L'import CSV existait déjà (multi-tenant, dédoublonnage global par téléphone) mais sans validation formelle, sans détail d'erreur par ligne, et sans étape de confirmation — un fichier mal formé créait ce qu'il pouvait, en silence.

- Validation zod par ligne (`importEmployeesCsvAction`, `company.ts`).
- Mode `dryRun` : l'upload déclenche un aperçu avant toute écriture.
- Résultat détaillé par ligne (numéro, nom, statut, raison du rejet).
- Plafond de 1000 lignes par import (protection contre un timeout sur un import très volumineux en traitement synchrone — la vraie solution, une queue asynchrone, est documentée comme proposition en section 5).
- Écran de prévisualisation côté UI (`EmployeesClient.tsx`) : tableau ligne par ligne, confirmation explicite avant import réel.
- Modèle CSV téléchargeable.
- Testé en direct dans le navigateur : fichier de 3 lignes (2 valides, 1 invalide) → aperçu correct → confirmation → 2 employés créés avec matricules corrects.
- Confirmé : aucune génération de QR individuel obsolète dans le flux d'import (le modèle actuel est QR-par-site, pas QR-par-employé).

### CI

- Ajout de `.github/workflows/ci.yml` : `npm ci` → `prisma generate` → `prisma migrate deploy` → `npm run lint` → `npm run build`, sur push/PR vers `main`. Rien n'existait avant.

---

## 2. Audit — état des lieux (isolation des rôles, flux métier)

Audit mené via relecture ciblée du code (fichiers/lignes cités dans les commits et ci-dessus). Résultats :

- **Isolation des rôles** : les 3 rôles (ADMIN/RESPONSABLE/EMPLOYEE) sont correctement cloisonnés par `requireUser([...])` sur chaque page, et le filtrage par équipe pour un RESPONSABLE (`getScopedTeamIds`) est appliqué partout où c'est pertinent (rapports, révision de pointage, justificatifs, heures sup). Un point de vigilance non bloquant : les actions employé ADMIN-only (`deleteEmployeeAction`, `toggleEmployeeStatusAction`, `updateEmployeePhoneAction`, `updateEmployeePhotoAction`) n'ont pas de guard IDOR par équipe — sans conséquence tant qu'elles restent ADMIN-only, mais à ajouter si un jour un RESPONSABLE obtient un droit de gestion partielle des employés.
- **`reviewJustificatifAction`** réimplémente une vérification de scope équivalente à `assertJustificatifInScope` au lieu de l'appeler — fonctionnellement correct (le guard dédié utilise `notFound()`, pensé pour des pages, pas des server actions qui doivent retourner `{error}`), donc laissé tel quel plutôt que "corrigé" à tort.
- **Flux de pointage** (QR par site + géolocalisation + tolérance configurable + heures sup) : déjà audité et corrigé lors d'une session précédente (bug de pointage à cheval sur minuit pour les équipes de nuit). Non retesté en profondeur cette session, faute de temps — sujet à un audit dédié si vous voulez une revue complète avant lancement.
- **Aucune fonctionnalité V2 hors scope détectée** : recherche ciblée (bluetooth/BLE/beacon, OCR/tesseract) dans `src/` — aucun résultat. Le MVP reste bien dans son scope.
- **Score de fiabilité par pointage, dashboard temps réel, exports/reporting, gestion multi-sites** : présents et fonctionnels d'après les sessions précédentes (vus dans le code : `confidence: "ELEVE"|"A_VERIFIER"`, `src/lib/dashboard.ts`, `src/lib/reports.ts`, gestion multi-sites via `Site`/`Team`) — pas re-testés unitairement cette session par manque de temps.

---

## 3. Points bloqués — nécessitent une action de votre part

1. **Chiffrement des champs identifiants en clair** (téléphone, email, numéro de pièce d'identité, date de naissance) — décision d'architecture, pas juste une action technique. Le téléphone est la clé de connexion WhatsApp (`Employee.phone`/`User.phone`, contrainte `@unique`) : le chiffrer nécessiterait soit (a) une colonne HMAC séparée pour permettre la recherche exacte tout en gardant la valeur affichée chiffrée, soit (b) un chiffrement déterministe (moins sûr qu'AES-GCM classique). C'est un changement qui touche l'authentification WhatsApp testée et fonctionnelle — je ne l'ai pas fait sans votre feu vert, pour ne rien casser. Si vous le voulez, dites-le et je le fais à votre retour.
2. **Compte Sentry** — le code est prêt et inactif. Créez un compte sur sentry.io, récupérez le DSN, mettez `SENTRY_DSN` et `NEXT_PUBLIC_SENTRY_DSN` dans `.env` en production. Aucune action de ma part possible ici (compte à créer = règle d'arrêt).
3. **Hébergement + nom de domaine** — comparatif préparé (section 4), mais création de compte hébergeur + achat du domaine restent à votre charge (règle d'arrêt explicite du prompt).
4. **Docker jamais réellement testé** — build/run jamais exécutés faute de Docker installé sur cette machine. Le Dockerfile a été relu et adapté au fil des sessions mais son premier vrai test sera sur le futur VPS. Risque à connaître avant le déploiement final.
5. **Texte juridique** (politique de confidentialité, CGU, DPA) — reste en l'état, volontairement non retouché (validation légale = règle d'arrêt).
6. **RGPD self-service employé** — pas d'export/suppression déclenchable par l'employé lui-même depuis `/espace`. Actuellement, ça passe forcément par une demande à l'admin. Je peux l'ajouter si vous le souhaitez (proposition en section 5).

---

## 4. Infra — comparatif hébergement & suggestions de domaine

### Hébergement (point 23)

| Option | Pour | Contre | Coût indicatif |
|---|---|---|---|
| **VPS générique** (Hetzner, DigitalOcean, Contabo) + Docker Compose (déjà préparé) | Contrôle total, SQLite + volume persistant simple, pas de verrou fournisseur, le Dockerfile/compose existants marchent tels quels | Vous gérez les mises à jour OS, la sécurité du serveur, le SSL (Caddy/Nginx + Let's Encrypt à ajouter), les sauvegardes hors-site | ~5-10 €/mois (Hetzner CX22 ou équivalent) |
| **Railway / Render** (PaaS) | Déploiement quasi immédiat depuis le Dockerfile existant, HTTPS automatique, moins de gestion serveur | Coût qui grimpe avec l'usage, SQLite sur disque éphémère par défaut sur certains plans (vérifier le stockage persistant avant de choisir) | ~7-20 €/mois selon plan |
| **Vercel** | Le plus simple pour du Next.js pur | **Écarté** : SQLite + volume de fichiers (photos chiffrées, sauvegardes) ne fonctionne pas sur une plateforme serverless sans état — demanderait de migrer vers Postgres + stockage objet (S3/R2), un changement d'architecture, pas juste un déploiement | — |

**Recommandation** : VPS (le Dockerfile est déjà écrit pour ça) si vous voulez rester proche de l'architecture actuelle (SQLite fichier) ; Railway/Render si vous préférez ne pas administrer de serveur et acceptez le coût variable. Vercel demanderait une migration de base de données, pas recommandé sans plus de contexte sur vos besoins de montée en charge.

### Nom de domaine (point 24)

Aucune vérification de disponibilité effectuée (nécessiterait d'interroger un registrar en ligne — hors scope pour cette session autonome). Suggestions de forme, à vérifier vous-même : `manguifi.com`, `manguifi.app`, `manguifi.africa`, `getmanguifi.com`, `manguifi.io`. `.africa` ou `.sn` (Sénégal) peuvent avoir du sens pour le positionnement marché, mais sont souvent plus chers/contraints (certains ccTLD exigent une présence locale).

---

## 5. Propositions d'amélioration non implémentées

- **CSP par nonce** (au lieu de `'unsafe-inline'`) via `middleware.ts` — plus strict contre l'injection de script, demande de propager un nonce par requête dans tous les `<Script>`/inline styles de l'app. Non fait cette session (changement plus large, risque de casser le rendu sans test approfondi).
- **Chiffrement des champs identifiants en clair** (téléphone/email/idNumber/dateOfBirth) — voir point bloquant #1, section 3.
- **Import CSV en file d'attente asynchrone** pour les très gros volumes (300-1000+ lignes) — évite tout risque de timeout, permet un rapport de progression en temps réel. Nécessite une infra de queue (Redis/BullMQ ou équivalent), non installée.
- **RGPD self-service employé** (export/suppression depuis `/espace`) — voir point bloquant #6, section 3.
- **Politique de rétention automatique** des pointages/justificatifs anciens (purge ou anonymisation après X mois) — actuellement rien n'expire automatiquement côté données métier (seules les sauvegardes ont désormais une rétention, section 1).
- **Synchronisation Google Sheet / API d'import SIRH** — évoquées dans le prompt comme alternatives à l'import CSV, non implémentées (l'import CSV couvre le besoin minimum viable).
- **`withSentryConfig`** (upload de source maps, releases automatiques) — demande un token d'auth Sentry que je n'ai pas ; à activer une fois le compte créé si vous voulez des stack traces lisibles en prod.

---

## 6. Checklist finale avant mise en production (point 28)

- [ ] Compte hébergeur créé (VPS ou PaaS, voir section 4) — **vous**
- [ ] Nom de domaine acheté + DNS pointé — **vous**
- [ ] `.env` de production rempli avec de vrais secrets (`AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` générés via `openssl rand -hex 32`, jamais les valeurs de `.env.example`) — **vous**
- [ ] Compte Resend + domaine vérifié pour l'envoi d'email (déjà nécessaire, session antérieure) — **vous**
- [ ] Compte Twilio passé en production (le trial actuel ne peut envoyer qu'aux numéros vérifiés dans la console) + expéditeur WhatsApp enregistré (Meta) — **vous**
- [ ] Compte Sentry créé, DSN renseigné — **vous**
- [ ] `docker build` + `docker compose up` testés au moins une fois en conditions réelles (jamais fait localement, faute de Docker) — **vous, ou moi si Docker est installé à votre retour**
- [ ] Scheduler externe configuré pour appeler `/api/cron/backup` régulièrement (cron VPS, ou cron du PaaS) — **vous**
- [ ] Texte juridique final (politique de confidentialité, CGU) validé — **vous**
- [ ] CI GitHub Actions vérifiée sur un vrai push (ajoutée cette session, jamais exécutée sur GitHub faute de remote configuré) — **vous, en poussant sur un dépôt distant**

---

## 7. Résumé des commits de cette session

1. `Baseline: état du projet avant session autonome pré-lancement` — initialisation git, capture de l'état existant (aucun historique git n'existait avant).
2. `Sécurité : CSP/HSTS, rate limiting OTP admin, fix service worker`
3. `Import CSV : validation zod, aperçu ligne par ligne, modèle téléchargeable`
4. `RGPD : export individuel des données employé, fix export org (photos non déchiffrées)`
5. `Monitoring : intègre Sentry (code prêt, inactif sans compte/DSN)`
6. `Sauvegardes : ne plus écrire les photos/documents en clair, purge auto`
7. *(CI + docker-compose.yml, à committer en fin de session)*
