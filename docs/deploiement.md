# PHASE 5 — Préparation du Déploiement Manguifi

**Date** : 29 septembre 2026  
**Environnement cible** : LWS cPanel (Linux, Node.js 22+, PostgreSQL Neon externe)  
**Maintenance prévue** : 30 minutes  
**Rollback** : 15 minutes max

---

## 1️⃣ PRÉ-DÉPLOIEMENT (À faire AVANT tout déploiement)

### 1.1 Vérifications Critiques

```bash
# ✓ Vérifier que tous les blockers PHASE 4 sont résolus
[ ] Next.js 16.3.7+ (pas 16.3.2)
[ ] IDOR fix appliquée ou acceptée + documentée
[ ] Build réussi en local: npm run build
[ ] Lint + TypeScript passent: npm run lint && npm run build
[ ] Tests unitaires passent: node --import tsx scripts/test-access-code.ts
```

### 1.2 Backup Pré-Migration

**Sur LWS (ou via Vercel Blob)** :
```bash
# Créer snapshot Vercel Blob (30-jour retention)
# OU via PostgreSQL si accès direct:
pg_dump -h [neon-host] -U [user] [database] > manguifi_backup_2026-09-29.sql

# Vérifier taille du backup
ls -lh manguifi_backup_2026-09-29.sql  # Devrait être ~10-100 MB
```

**Vérification de restore**:
```bash
# Tester que le backup est valide (optionnel mais recommandé)
pg_restore --list manguifi_backup_2026-09-29.sql | head -20
```

### 1.3 Communication

- [ ] Informer utilisateurs: maintenance 30 min prévu
- [ ] Fenêtre: jour de semaine, heures creuses (ex: mardi 22h)
- [ ] Lien contact: support@manguifi.sn en cas problème

---

## 2️⃣ VARIABLES D'ENVIRONNEMENT (À ajouter/modifier sur LWS)

### 2.1 Obligatoires — Ajouter si absent

```bash
# Base de données
DATABASE_URL="postgresql://user:pass@host.neon.tech/manguifi?sslmode=require"

# Secrets (générer avec: openssl rand -hex 32)
AUTH_SECRET="[32 hex chars]"
ENCRYPTION_KEY="[32 hex chars]"
CRON_SECRET="[32 hex chars]"

# Email (Resend)
RESEND_API_KEY="re_[...key...]"
EMAIL_FROM="Manguifi <onboarding@resend.dev>"  # or custom domain si vérifié
APP_URL="https://manguifi.sn"

# Optionnel : email OTP test override (JAMAIS en prod réelle)
EMAIL_OTP_TEST_OVERRIDE_TO=""

# Sauvegardes (Vercel Blob)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_[...key...]"
BACKUP_RETENTION_DAYS="30"

# Monitoring (optionnel)
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""

# Twilio (optionnel, pas utilisé pour employee login)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_VERIFY_SERVICE_SID=""
```

### 2.2 À Modifier (Éventuellement)

```bash
# Si domaine email vérifié sur Resend:
EMAIL_FROM="Manguifi <noreply@manguifi.sn>"  # Remplacer domaine

# Si instance Sentry créée:
SENTRY_DSN="https://key@sentry.io/project"
NEXT_PUBLIC_SENTRY_DSN="https://key@sentry.io/project"
```

### 2.3 À NE PAS MODIFIER

```bash
# Ceux-ci sont auto-détectés ou par défaut:
NODE_ENV="production"  # Auto
VERCEL="1"  # Auto sur Vercel, omit sur LWS self-hosted
```

---

## 3️⃣ ÉTAPES DE DÉPLOIEMENT (Dans l'ordre, pas de déviation)

### 3.0 Préparation (Jour J, -1h)

```bash
# Sur LWS:
cd /var/www/manguifi  # (chemin exemple, adapter à votre env)

# 1. Clone/fetch du repo
git fetch origin
git checkout claude/new-session-1rprgz  # ou master une fois mergée

# 2. Vérifier version Node.js
node --version  # Devrait être 22.x.x

# 3. Installer dépendances
npm ci  # (plus strict que npm install)
```

### 3.1 Build de Production (-30 min)

```bash
# Dans /var/www/manguifi:

# 1. Générer types Prisma
npx prisma generate

# 2. Build Next.js
npm run build

# Vérifier absence d'erreurs:
# - Build output: ".next/" folder created
# - Taille raisonnableatique (< 500 MB)

# 3. Tester build local (optionnel)
npm run start  # Vérifie que server démarre
# Ctrl+C pour arrêter
```

### 3.2 Migrations Base de Données (⚠️ Point critique, pas de retour auto)

```bash
# Vérifier variables d'environnement chargées
printenv | grep DATABASE_URL  # Doit afficher la URL Neon

# 1. Créer backup AVANT migration
export DB_URL="$DATABASE_URL"
pg_dump -h [neon-host] -U [user] --dbname="$DB_URL" > backup_before_migration.sql

# 2. Exécuter migrations (IRRÉVERSIBLE)
npx prisma migrate deploy

# Sortie attendue:
# ✔ 1 migration file applied (if new migrations)
# or
# ✔ No migrations to apply

# 3. Vérifier nouvelles tables créées
psql "$DATABASE_URL" -c "\dt public."

# Expected tables (parmi autres):
# - EmployeeAccessCode
# - EmployeeSession
# - EmployeeLoginAttempt
```

### 3.3 Démarrage du Service (Fenêtre de maintenance)

```bash
# Arrêter ancien service (si running)
sudo systemctl stop manguifi  # (adapter nom du service)

# Nettoyer cache
rm -rf .next/  # Récréé au démarrage
npm run build  # Rebuild si nécessaire

# Démarrer nouveau service
sudo systemctl start manguifi
sudo systemctl status manguifi  # Vérifier running

# Alternative (si pas de systemd):
node .next/standalone/server.js &
```

### 3.4 Vérification Immédiate Post-Démarrage (5 min)

```bash
# 1. Health check
curl https://manguifi.sn/api/health

# Réponse attendue: 200 OK

# 2. Vérifier logs
tail -f /var/log/manguifi.log  # ou journalctl

# Chercher erreurs (panic, FATAL, Error loading)
# Les warnings de dépendances sont OK

# 3. Test simple login
# Ouvrir https://manguifi.sn/connexion
# Essayer login admin (email/password)
# Doit rediriger à /dashboard
```

---

## 4️⃣ PROCÉDURE DE RETOUR ARRIÈRE (Rollback)

**À exécuter SI détection d'erreur après déploiement**

```bash
# Dans /var/www/manguifi:

# 1. Arrêter service
sudo systemctl stop manguifi

# 2. Revenir à version précédente (git)
git reset --hard origin/[branche-précédente]  # ex: master

# 3. Installer dépendances (peut être omis si identiques)
npm ci

# 4. Rebuild
npx prisma generate
npm run build

# 5. RESTAURER DATABASE DEPUIS BACKUP (critique!)
# ⚠️ Ceci SUPPRIME les données créées après migration
pg_restore -h [neon-host] -U [user] -d [database] < backup_before_migration.sql

# 6. Redémarrer service
sudo systemctl start manguifi

# 7. Vérifier
curl https://manguifi.sn/api/health

# 8. Documenter incident
echo "Rollback exécuté à $(date)" >> /var/log/manguifi.log
```

**Note** : Rollback perd les données créées après déploiement. Planifier fenêtre minimale.

---

## 5️⃣ POST-DÉPLOIEMENT CHECKLIST (30 min après démarrage)

### 5.1 Tests Critiques (5 min)

```bash
# ✓ Health API
curl https://manguifi.sn/api/health
# Attendu: {"status": "ok"} ou 200

# ✓ Connexion Admin (Email/Password)
# 1. https://manguifi.sn/connexion
# 2. Email: [admin email]
# 3. Password: [password]
# 4. OTP: recevoir via email Resend
# 5. Entrer OTP
# Attendu: Redirection /dashboard
```

### 5.2 Créer Employé de Test (5 min)

```bash
# Depuis /dashboard (connecté as admin):

# 1. Aller à /employes
# 2. Cliquer "Ajouter un employé"
# 3. Remplir:
#    - Prénom: Test
#    - Nom: Pilot
#    - Numéro: 77 123 45 67 (numéro IWADA test)
#    - Équipe: [any]
#    - Poste: [any]
# 4. Cliquer "Créer"
# 5. NOTER le code d'accès généré (8 chiffres)
```

### 5.3 Test Login Employé avec Code (5 min)

```bash
# Logout admin (ou autre browser/private window)

# 1. Aller à https://manguifi.sn/connexion-employe
# 2. Entrer numéro: "77 123 45 67"
# 3. Cliquer "Continuer"
# 4. Entrer code d'accès: [du step 5.2]
# 5. Cliquer "Vérifier"
# Attendu: Redirection /espace

# 6. Vérifier persistance session
# - Rafraîchir page (F5)
# - Doit rester connecté (pas redirect à /connexion-employe)
```

### 5.4 Test Pointage QR + GPS (5 min)

```bash
# Encore connecté comme employé de test:

# 1. Aller à /espace/scanner
# Attendu: Demande permission localisation
# 2. Accepter (Allow)
# 3. Scanner QR code test (ou générer depuis /dashboard > QR)
# Attendu: 
#   - Pointage enregistré (checkin)
#   - GPS capturé
#   - Timestamp correct
# 4. Scanner à nouveau (checkout)
# Attendu: Marqué comme checkout
```

### 5.5 Test Génération Rapport (5 min)

```bash
# Encore connecté comme employé de test:

# 1. Aller à /espace/justificatifs ou historique
# 2. Sélectionner date range (ex: aujourd'hui)
# 3. Cliquer "Télécharger rapport PDF"
# Attendu:
#   - PDF généré avec pointages du jour
#   - Nom employé correct
#   - Pas d'erreur 500
```

### 5.6 Admin Génère Nouveau Code (3 min)

```bash
# Reconnectez-vous as admin (/connexion)
# 1. Aller à /employes/[test-pilot-id]
# 2. Cliquer "Régénérer le code d'accès"
# Attendu:
#   - Nouveau code affiché (8 chiffres)
#   - Différent du précédent
#   - Session employé révoquée (test pilot logged out)
```

### 5.7 Employee Session Invalidée (2 min)

```bash
# Si test pilot device a session:
# 1. Sur device, tenter accès /espace
# Attendu: Redirect à /connexion-employe (session lost)
# 2. Essayer login avec ANCIEN code
# Attendu: Erreur "Code invalide" (revoqué)
# 3. Login avec NOUVEAU code
# Attendu: Succès
```

### 5.8 Vérifier Logs d'Audit

```bash
# Admin: /parametres/journal
# Chercher entrées pour Test Pilot:
# - EMPLOYEE_ACCESS_CODE_LOGIN (nouveau code)
# - GENERATE_EMPLOYEE_ACCESS_CODE (nouveau code généré)
# Attendu: Timestamps corrects, détails présents
```

---

## 6️⃣ PLAN DE TEST PILOTE (5 Employés IWADA)

**Durée** : 7 jours après déploiement production  
**Objectif** : Valider système avant rollout complet

### Phase 1 : Onboarding (Jour 1-2)

```bash
# Sélectionner 5 employés IWADA (volontaires de préférence)
# Pour chaque:
# 1. Créer dans /employes
# 2. Générer code d'accès
# 3. Envoyer par WhatsApp ou SMS (avec instructions)
# 4. Demander: "Avez-vous reçu le code?"

Employés test suggérés:
- 1 responsable d'équipe
- 2-3 pointeurs réguliers
- 1 nouveau (sans expérience app)
```

### Phase 2 : Utilisation Quotidienne (Jour 3-6)

```bash
# Employés utilisent normalement:
# - Pointages QR matin/soir
# - Consultation historique
# - Tests rapports

# Admin suivi:
# - Vérifier pointages apparaissent
# - Vérifier GPS capturé
# - Checker logs d'audit (aucun erreur 500)
# - Recueillir feedback: UX, bugs, suggestions
```

### Phase 3 : Incidents Simulés (Jour 7)

```bash
# 1. Regenerate code pour 1 employé
#    → Vérifier ancienne session perdue
#    → Vérifier reconnexion avec nouveau code OK

# 2. Désactiver 1 employé
#    → Vérifier session révoquée
#    → Vérifier impossible reconnecter même avec code

# 3. Test rate limiting (5 mauvais codes)
#    → Vérifier blocage 15 min
#    → Vérifier déblocage après 15 min
```

### Phase 4 : Validation & Rollout

```bash
# Si aucun incident majeur:
# ✓ Déployer sur tous employés IWADA
# ✓ Puis progressivement autres clients
# ✓ Documenter issues mineures

# Si incident:
# ✗ Rollback complet
# ✗ Corriger issue
# ✗ Redéployer + nouveau pilote (7 jours)
```

---

## 7️⃣ VARIABLES DE DEBUG (SI problèmes)

```bash
# Si logs insuffisants, ajouter:
DEBUG=prisma*  # Pour logs Prisma détaillés
SENTRY_DSN=[test-dsn]  # Pour capturer errors

# Rebuild + restart:
npm run build
npm start
```

---

## 8️⃣ CONTACTS & ESCALADE

```
Issues technique pendant déploiement:
  → Slack: #manguifi-ops
  → Téléphone: [contact admin LWS]
  → Email: support@manguifi.sn

Problème database:
  → Neon support: https://neon.tech/docs/introduction
  → Email: support@neon.tech

Problème email Resend:
  → Dashboard: https://resend.com
  → Support: support@resend.dev
```

---

## SUMMARY: Déploiement Checklist Finale

- [ ] Blockers PHASE 4 résolus
- [ ] Backup créé (pré-migration)
- [ ] Variables d'environnement définies
- [ ] Build production réussi (npm run build)
- [ ] Migrations Prisma exécutées (npx prisma migrate deploy)
- [ ] Service redémarré
- [ ] Health check OK (curl /api/health)
- [ ] Admin login fonctionne
- [ ] Employé test créé
- [ ] Login avec code fonctionne
- [ ] Pointage QR OK
- [ ] Rapports générés OK
- [ ] Audit logs présents
- [ ] Plan de test pilote réalisable
- [ ] Rollback plan documenté & testé

**Attendez le FEU VERT de Thomas avant déploiement production**
