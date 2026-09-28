# DEPLOIEMENT_COMPTES.md — Préparation des services externes

**Date**: 2026-09-28  
**Branche**: `master`  
**Statut**: Audit complété | Plan d'action en cours

---

## 📋 Résumé exécutif

Manguifi utilise **5 services critiques** et **1 optionnel** pour la production :

| # | Service | Type | Plan recommandé démarrage | Coût/mois | Blocker |
|---|---|---|---|---|---|
| 1 | **Neon.tech** (PostgreSQL) | ✅ Obligatoire | Free → Pro (8 $) | 0 → 8 $ | Démarrer gratuit |
| 2 | **Resend** (Email) | ✅ Obligatoire | Free (100 emails/j) | 0 $ | Domaine vérifié requis |
| 3 | **Twilio Verify** (OTP WhatsApp) | ✅ Obligatoire | Pay-as-you-go | ~5–50 $ | Rechargement 💳 |
| 4 | **Vercel Blob** (Sauvegardes) | ✅ Obligatoire | Free (1 GB) → Pro | 0 → 20 $ | Domaine Vercel nécessaire |
| 5 | **Sentry** (Monitoring) | ⚠️ Optionnel | Free | 0 $ | Non-bloquant |
| 6 | **Domaine personnalisé** | ✅ Obligatoire | Registrar | ~10–15 $/an | DNS + SPF/DKIM/DMARC |

**Budget de démarrage minimal** : ~0 $ (gratuit)  
**Budget de démarrage réaliste** : ~50–80 $ (1 mois de dev, avant clients payants)

---

## 🔍 AUDIT DÉTAILLÉ DES SERVICES

### 1️⃣ **BASE DE DONNÉES : Neon.tech (PostgreSQL)**

**Status**: ✅ Détecté dans `.env.example`  
**Utilisation**: Stockage critique (employés, plannings, présences, logs, droits)

#### Plan gratuit Neon Free
- **Limite de stockage**: 3 GB
- **CPU/RAM partagés**: Pause après 7 jours d'inactivité (⚠️ **déploiement continu = pas de pause**)
- **Connexions**: Jusqu'à 5 par projet
- **Sauvegarde**: 7 jours
- **Verdict**: ✅ **Suffisant pour le démarrage** (app active = pas de pause)

#### Plan payant Neon Pro (à partir de 8 $/mois)
- Pas de limite de stockage
- Pas de pause
- Jusqu'à 100 connexions
- Sauvegarde 30 jours
- **À activer quand**: > 10 GB de données ou croissance rapide

#### 🚀 ACTION : Créer un projet Neon gratuit
```bash
# Sur https://neon.tech
1. Créer un compte (GitHub OAuth recommandé)
2. Créer un projet "manguifi-prod"
3. Région: Europe (Belgique/France si disponible) — proximité Dakar
4. Copier la connection string dans DATABASE_URL
```

---

### 2️⃣ **EMAIL TRANSACTIONNEL : Resend**

**Status**: ✅ Détecté (`RESEND_API_KEY` requis)  
**Utilisation**: OTP réinitialisation mot de passe, invitations employés, notifications admins

#### Plan gratuit Resend
- **Limite d'emails**: 100/jour
- **Domaines**: Doit vérifier un domaine personnalisé (SPF/DKIM/DMARC)
- **Sans domaine**: Peut envoyer seulement vers l'adresse du compte Resend
- **Verdict**: ⚠️ **Suffisant si volume < 100/jour**

#### Plan payant Resend Paid (à partir de 20 $/mois)
- Illimité
- Domaines vérifiés illimités
- Webhooks, analytics
- **À activer quand**: > 3000 emails/mois

#### 🚀 ACTION : Créer un compte Resend
```bash
# Sur https://resend.com
1. Créer un compte (GitHub/Google OAuth)
2. Créer une API key en "Production"
3. Ajouter dans RESEND_API_KEY
4. ⏸️ STOP : Attendre le domaine personnalisé
   → Pour pilote local, utiliser EMAIL_OTP_TEST_OVERRIDE_TO
   → Rediriger tous les codes vers l'admin temporairement
```

---

### 3️⃣ **OTP WHATSAPP/SMS : Twilio Verify**

**Status**: ✅ Détecté (TWILIO_* variables obligatoires)  
**Utilisation**: Vérification employés par WhatsApp (connexion, OTP)

#### Plan Pay-as-you-go Twilio
- **Coût par OTP SMS**: ~0.01 $ (Sénégal)
- **Coût par OTP WhatsApp**: ~0.08–0.15 $ (Sénégal, dépend de la configuration Meta)
- **Minimum initial**: Rechargement $20 (peut durer longtemps en test)
- **Estimation monthly**:
  - 5 employés: ~5–10 $ (tests)
  - 50 employés: ~50–100 $ (1 OTP par jour en moyenne)
  - 500 employés: ~500–1000 $ (forte utilisation)

#### 🚀 ACTION : Créer un compte Twilio Trial
```bash
# Sur https://twilio.com
1. Créer un compte (email + téléphone)
2. ⏸️ STOP : Vérifier numéro de téléphone
3. Créer un Verify Service (Console > Verify > Services > Create)
   - Nom: "manguifi-otp"
   - Canaux: SMS, WhatsApp
4. ⏸️ STOP : Recharger le compte (minimum $20)
5. Copier TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
```

**⚠️ LIMITATION TRIAL**: Twilio trial account ne peut envoyer que vers numéros **pré-vérifiés dans la console**.  
**→ Pour production réelle**: Utiliser Meta Business Manager (voir section 7).

---

### 4️⃣ **SAUVEGARDES : Vercel Blob**

**Status**: ✅ Détecté (BLOB_READ_WRITE_TOKEN requis)  
**Utilisation**: Snapshots PostgreSQL quotidiens (tolérance 30 jours, rotation automatique)

#### Plan gratuit Vercel Blob
- **Stockage**: 1 GB
- **Accès**: Private
- **Verdict**: ✅ **Suffisant** (backup quotidien ~50–100 MB, rotation 30j)

#### Plan payant Vercel Pro (à partir de 20 $/mois)
- 100 GB stockage
- À activer quand: > 1 GB de snapshots

#### 🚀 ACTION : Activer Vercel Blob
```bash
# Sur dashboard.vercel.com
1. Créer un projet Vercel "manguifi" (ou utiliser existant)
2. Storage > Create > Blob
   - Nom: "manguifi-backups"
   - Mode: Private
3. La variable BLOB_READ_WRITE_TOKEN s'ajoute automatiquement
4. Vérifier que /api/cron/backup s'exécute quotidiennement
```

**⚠️ NOTE**: Vercel Blob fonctionne uniquement si le projet est déployé **sur Vercel** (ou via tunnel local en dev).  
**Alternative gratuite**: AWS S3 (1 an gratuit) ou Wasabi (1 TB/mois gratuit).

---

### 5️⃣ **MONITORING : Sentry (OPTIONNEL)**

**Status**: ✅ Détecté (SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN optionnels)  
**Utilisation**: Alertes erreurs backend/frontend (non-critique pour démarrage)

#### Plan gratuit Sentry
- **Limite d'erreurs**: 5000/mois
- **Rétention**: 7 jours
- **Verdict**: ✅ **Suffisant pour début**

#### Plan payant Sentry Pro (à partir de $29/mois)
- 100k événements/mois
- Rétention 30 jours
- À activer quand: déploiement en production réelle

#### 🚀 ACTION (OPTIONNEL) : Créer un compte Sentry
```bash
# Sur https://sentry.io (peut être fait plus tard)
1. Créer compte (GitHub OAuth)
2. Créer un projet "manguifi-backend" (Next.js)
3. Copier DSN dans SENTRY_DSN et NEXT_PUBLIC_SENTRY_DSN
4. Déployer → erreurs remontées automatiquement
```

---

### 6️⃣ **DOMAINE PERSONNALISÉ : Registrar**

**Status**: ⚠️ **À acheter AVANT production**  
**Utilisation**: 
- URL de l'API (manguifi.sn)
- Email d'expédition (noreply@manguifi.sn)
- SPF/DKIM/DMARC (Resend)
- Webhooks Twilio

#### Registrars populaires (Sénégal/Afrique)
| Registrar | Domaine .sn | .com | Remarques |
|---|---|---|---|
| **OVH** | ~4 $/an | ~6 $/an | Hébergement possible aussi |
| **Namecheap** | ~5 $/an | ~8 $/an | Interface simple, support |
| **GoDaddy** | ~7 $/an | ~9 $/an | Populaire, promo fréquente |

#### 🚀 ACTION : Réserver un domaine
```bash
# Recommandation : .sn (Sénégal) pour crédibilité locale
1. ⏸️ STOP : Réserver domaine (ex: manguifi.sn)
2. Pointer les DNS vers l'hébergement (voir section Hébergement)
3. Configurer SPF/DKIM/DMARC pour Resend
```

---

### 7️⃣ **WHATSAPP EN PRODUCTION : Meta Business Manager (À PRÉPARER)**

**Status**: ⚠️ **Non configuré, nécessaire avant vraie production**  
**Utilisation**: Expéditeur WhatsApp officiel (actuellement trial Twilio limité)

#### Process Meta Business Manager
1. Créer un compte Meta Business Manager
2. Créer une application WhatsApp
3. Vérifier l'identité de l'entreprise (2–3 jours)
4. Connecter à Twilio (via API intégration)

#### 🚀 ACTION : À faire **3–4 semaines avant production**
```bash
# Sur https://business.facebook.com/
1. ⏸️ STOP : Créer compte Meta Business Manager
2. ⏸️ STOP : Vérifier l'identité IWADA/ITAKA (documents + numéro NINEA Sénégal)
3. Créer application WhatsApp
4. Connecter à Twilio (partenariat tiers)
```

---

## 📊 TABLEAU RÉCAPITULATIF DÉPLOIEMENT

| Service | Plan démarrage | Coût démarrage | Coût/mois | Action 1️⃣ | Action 2️⃣ | Blocker |
|---|---|---|---|---|---|---|
| **Neon.tech** | Free | $0 | $0 | Créer projet | Copier URL | Non |
| **Resend** | Free | $0 | $0 | Créer compte | Ajouter API key | Domaine |
| **Twilio** | Trial Pay-as-you-go | $20 recharge | $5–50 | Créer compte | Recharger 💳 | Crédit |
| **Vercel Blob** | Free | $0 | $0 | Créer Vercel proj | Activer Blob | Non |
| **Sentry** | Free | $0 | $0 | Optionnel | Optionnel | Non |
| **Domaine** | .sn Registrar | $4–5 | $4–5/an | ⏸️ ARRÊT | Réserver | OUI |
| **Meta Business** | Trial | $0 | $0 | ⏸️ Préparation | ⏸️ Vérif 3–4 sem | Production |

---

## 🚀 PLAN D'EXÉCUTION ÉTAPE PAR ÉTAPE

### ✅ PHASE 1 : SERVICES GRATUITS (TOUT DE SUITE)

1. **Neon.tech** 
   - Créer projet Free
   - Copier DATABASE_URL
   
2. **Resend**
   - Créer compte
   - Générer API key
   - ⏸️ ATTENDRE domaine pour vérification
   - Pour pilote: utiliser `EMAIL_OTP_TEST_OVERRIDE_TO` (redirection temp)

3. **Vercel + Blob**
   - Créer projet Vercel
   - Activer Blob storage
   - Copier BLOB_READ_WRITE_TOKEN

4. **Sentry** (Optionnel)
   - Créer projet
   - Ajouter DSN

### ⏸️ PHASE 2 : ACTIONS THOMAS (BLOCKERS)

À ce stade, tu dois :
- [ ] **Domaine**: Réserver `manguifi.sn` (ou similaire) chez OVH/Namecheap
- [ ] **Twilio**: Créer compte + recharger $20
- [ ] **Email Pilote**: Valider que `EMAIL_OTP_TEST_OVERRIDE_TO` fonctionne (tous les codes → toi)

### 🔧 PHASE 3 : INTÉGRATIONS (AVEC DOMAINE)

Une fois domaine acheté:
- Configurer DNS (enregistrements A, CNAME)
- Verifier domaine Resend (SPF/DKIM/DMARC)
- Ajouter APP_URL réelle

### 📱 PHASE 4 : PRODUCTION (3–4 SEMAINES AVANT)

- Vérifier Meta Business Manager + WhatsApp
- Configurer intégration Twilio ↔ Meta
- Tests de chaîne complète email + OTP + WhatsApp

---

## 💰 BUDGET ESTIMÉ

### Démarrage minimal (Gratuit)
```
Neon.tech (Free):        $0
Resend (Free):           $0
Twilio (Trial):          $0 (mais il faut recharger pour test)
Vercel Blob (Free):      $0
Sentry (Free):           $0
─────────────────────────
TOTAL:                   $0 (+ recharge Twilio $20)
```

### Démarrage réaliste (1 mois)
```
Neon.tech (Free):        $0
Resend (Free):           $0
Twilio OTP (Pay-as-you): $10–30 (dépend utilisation)
Vercel Blob (Free):      $0
Domaine .sn (1 mois):    ~$0.50 (prorata)
─────────────────────────
TOTAL MOIS 1:            ~$40–60
```

### Production stable (croissance)
```
Neon.tech Pro:           $8/mois (si > 10 GB)
Resend Paid:             $20/mois (si > 3k emails)
Twilio (scaling):        $50–200/mois (dépend clients)
Vercel Blob:             $0–20/mois
Domaine (annuel):        $4–5/mois (amortissement)
─────────────────────────
TOTAL MOIS 6+:           ~$80–250/mois
```

---

## ✅ CHECKLIST ACTIONS THOMAS

À faire **IMMÉDIATEMENT** (avant déploiement):

- [ ] **Domaine**: Réserver `manguifi.sn` (OVH ou équivalent)
- [ ] **Twilio**: 
  - [ ] Créer compte
  - [ ] Recharger $20
  - [ ] Créer Verify Service
  - [ ] Copier 3 clés (Account SID, Auth Token, Verify Service SID)
- [ ] **Resend**:
  - [ ] Créer compte
  - [ ] Générer API key
  - [ ] Pour pilote: choisir une adresse email pour `EMAIL_OTP_TEST_OVERRIDE_TO`
- [ ] **Neon.tech**:
  - [ ] Créer projet
  - [ ] Copier DATABASE_URL
- [ ] **Vercel**:
  - [ ] Créer projet
  - [ ] Activer Blob
  - [ ] Copier token

À faire **PLUS TARD** (3–4 semaines avant production réelle):

- [ ] **Meta Business Manager**: Créer compte + vérifier identité entreprise
- [ ] **DNS**: Configurer enregistrements (une fois domaine activé)
- [ ] **Sentry**: Optionnel, peut être ajouté après

---

## 🔗 RESSOURCES & LIENS

| Service | Lien | Temps création |
|---|---|---|
| Neon.tech | https://neon.tech | 2 min |
| Resend | https://resend.com | 2 min |
| Twilio | https://twilio.com | 5 min + recharge 💳 |
| Vercel | https://vercel.com | 2 min |
| Sentry | https://sentry.io | 2 min (optionnel) |
| OVH Domaine | https://www.ovh.com/sn/ | 15 min + paiement |
| Meta Business | https://business.facebook.com | 10 min + docs 3–4 sem |

---

## 📝 NOTES IMPORTANTES

1. **Pas de Supabase**: Le code utilise **Neon.tech** (plus léger, gratuit suffisant pour démarrage)
2. **Pas de LWS cPanel**: Le code est dockerisé → deployable **partout** (Vercel, VPS, OVH, etc.)
3. **Vercel Blob** nécessite le projet sur Vercel (au moins dev gratuit)
4. **Twilio Trial**: Limité à numéros vérifiés → Meta Business obligatoire pour vraie production
5. **Email pilot**: Utiliser `EMAIL_OTP_TEST_OVERRIDE_TO` pour rediriger tous les codes vers toi le temps du pilote — **NE PAS OUBLIER de retirer avant production**

---

## 🎯 PROCHAINE ÉTAPE

Une fois ces informations validées:
1. Tu crées les comptes (gratuit + recharge Twilio)
2. Je génère un `.env.production.example` complet
3. Je crée des scripts de configuration automatisée
4. On teste la chaîne email + OTP en local
5. On déploie sur Vercel (ou VPS de ton choix)

