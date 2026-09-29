# Audit — Panne de Connexion Employé (Déploiement Récent)

**Date d'audit** : 29 septembre 2026  
**Version** : Commit 8cdf3f3 (Email OTP workaround)

## Contexte

Après un déploiement récent, les employés ne pouvaient plus se connecter via la page `/connexion-employe`. Le système d'authentification par SMS Twilio ne fonctionnait pas au Sénégal (Sender ID Orange/Expresso non enregistré), ce qui a entraîné un passage à Email OTP comme workaround.

## Cause Identifiée

### Problème Principal : Twilio SMS Non Fonctionnel en Production

**Symptôme**  
Les appels à `sendOtp()` (SMS via Twilio Verify) échouaient silencieusement en production au Sénégal :
- Les variables d'environnement Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`) n'étaient pas définies en production
- Ou : le Sender ID n'était pas enregistré auprès de l'opérateur Orange/Expresso

**Impact**  
- Impossible pour un employé de recevoir un code OTP par SMS
- Redirection silencieuse vers Email OTP (workaround)
- Pas de journalisation explicite de la cause

**Fichier touchés**
- `src/lib/twilio.ts` : `sendOtp()` retourne `{ sent: false, error: "..." }` sans révéler la vraie raison
- `src/app/actions/whatsapp-auth.ts` : `requestEmployeeOtpAction()` (ligne 67) utilise `generateAndSendOtpEmail()` au lieu de `sendOtp()` — workaround

### Problème Secondaire : Bug Email-Auth (Découvert en Audit)

**Symptôme**  
À la ligne 100 d'`email-auth.ts`, l'email encrypté était passé au JWT session au lieu de l'email en clair :
```typescript
// AVANT (bug)
email: user.email,  // ← email encrypté (AES-256-GCM)
```

**Impact**  
- Le JWT contenait une valeur encrypté au lieu de l'email
- Potentiellement cassé certains flux qui s'attendent à l'email en clair dans la session
- Incohérent avec `whatsapp-auth.ts` qui décrypte correctement (ligne 146)

**Correction**  
```typescript
// APRÈS (fixé)
email: user.email ? decryptDataUrl(user.email) : email,
```

## Architecture Actuelle (Post-Workaround)

### Flux de Connexion Employé

1. **Page `/connexion-employe`** (`src/app/connexion-employe/page.tsx`)
   - Accepte numéro + code ou email + code
   - Détecte le canal par la présence de "@" en client-side

2. **Deux chemins parallèles** :
   - **Téléphone** : `requestEmployeeOtpAction()` + `verifyEmployeeOtpAction()` → envoie Email OTP (workaround)
   - **Email** : `requestEmployeeEmailOtpAction()` + `verifyEmployeeEmailOtpAction()` → envoie Email OTP (normal)

3. **Couche Email OTP** (`src/lib/email-otp.ts`)
   - Génère un code 6 chiffres
   - Stocke le hash du code (pas le code lui-même)
   - Expire après 10 minutes
   - Max 5 tentatives par code

### Modules Inutilisés

- `src/lib/twilio.ts` : toujours présent mais `sendOtp()` et `checkOtp()` ne sont utilisés que pour admin/responsable (lien phone OTP et login OTP)
- `src/lib/otp.ts` : ancien système (obsolète — remplacé par `email-otp.ts`)

## Recommandations pour PHASE 2

### Immédiat

1. **Remplacer l'Email OTP par Code d'Accès Haché**
   - Un code d'accès à 8 caractères unique par employé
   - Généré au moment de l'ajout/régénération, pas à chaque connexion
   - Haché en base de données (bcryptjs)
   - Valide 30 jours, usage unique

2. **Normaliser le Flux de Connexion**
   - Unifier sous un système unique (accès + numéro normalisé E.164)
   - Supprimer le dual-path téléphone/email qui ajoute de la complexité

### Moyen Terme

1. **Isolation du Module SMS**
   - Garder `twilio.ts` pour l'infra (future API WhatsApp, SMS administratif)
   - Derrière flag `EMPLOYEE_AUTH_METHOD=access_code|sms`
   - Le SMS reste non fonctionnel au Sénégal jusqu'à enregistrement Sender ID

2. **Audit de Sécurité Complète**
   - Rate limiting : limite 5 essais faux par 15 min ✓ (existant)
   - Limitation par IP : ✓ (existant)
   - Codes jamais journalisés : ✓ (existant)
   - Comparaison à temps constant : ✓ (existant avec hash)
   - Journal d'audit pour génération/consommation de code (à ajouter)

## Variables d'Environnement Manquantes en Production

Au moment de la panne, vérifier :
- ✗ `TWILIO_ACCOUNT_SID` (non défini ou vide)
- ✗ `TWILIO_AUTH_TOKEN` (non défini ou vide)
- ✗ `TWILIO_VERIFY_SERVICE_SID` (non défini ou vide)

**Leçon apprise** : Les variables Twilio ne sont pas obligatoires pour l'app (elle bascule sur Email OTP), mais la vraie raison de la panne devait être :
1. Sender ID non enregistré chez Orange/Expresso au Sénégal
2. Ou : Twilio trial account limité à numéros vérifiés

## Conclusion

La panne n'était pas une rupture critique mais une dégradation progressive vers Email OTP. Le workaround a bien fonctionné, mais a masqué le problème sous-jacent. **PHASE 2** va remplacer ce dual-système par un code d'accès unique, plus simple et plus sûr.
