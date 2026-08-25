# App native (iOS/Android) — état et prochaines étapes

## Approche choisie : Capacitor, pas de réécriture

Manguifi reste l'application Next.js existante. Capacitor l'enveloppe dans une coquille
native (Android/iOS) qui affiche l'app dans une WebView pointée sur l'URL de production —
c'est le mode « remote » de Capacitor, nécessaire ici car Next.js est server-rendered
(pas un export statique). Ça veut dire :

- Aucune duplication de code : un seul frontend, celui déjà construit.
- L'app native a besoin d'une connexion internet pour fonctionner (comme la PWA).
- Les mises à jour du site se répercutent automatiquement dans l'app, sans repasser par
  les stores (sauf si vous changez du code natif lui-même — rare).
- Accès aux vraies permissions natives (caméra, géolocalisation) via les dialogues système
  iOS/Android plutôt que ceux du navigateur.

Alternative écartée : une réécriture React Native complète. Beaucoup plus de travail pour
un bénéfice qui n'est pas démontré ici (le produit n'a pas besoin de fonctionnalités 100%
natives comme des notifications push complexes ou du offline-first avancé).

## Fait cette session

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios` installés.
- `capacitor.config.ts` créé (`appId: com.manguifi.app`) — **`server.url` pointe actuellement
  sur un tunnel Cloudflare temporaire utilisé pour les tests, à remplacer par le vrai domaine
  de production avant toute publication réelle.**
- Projets natifs générés : `android/` (Android Studio/Gradle) et `ios/` (Xcode).
- Permissions déclarées :
  - Android (`android/app/src/main/AndroidManifest.xml`) : `CAMERA`, `ACCESS_FINE_LOCATION`,
    `ACCESS_COARSE_LOCATION`.
  - iOS (`ios/App/App/Info.plist`) : `NSCameraUsageDescription`,
    `NSLocationWhenInUseUsageDescription` (obligatoires, sans elles Apple rejette l'app).
- Scripts npm ajoutés : `npm run cap:sync`, `npm run cap:android` (ouvre Android Studio),
  `npm run cap:ios` (ouvre Xcode).
- Build Next.js confirmé non cassé par ces ajouts.

## Non fait — nécessite des outils/comptes que je n'ai pas ici

| Étape | Pourquoi je ne peux pas la faire | Qui/quoi il faut |
|---|---|---|
| Mettre à jour `server.url` avec le vrai domaine | Le domaine de production n'existe pas encore | Vous, une fois le domaine acheté et déployé |
| Compiler l'APK/AAB Android | Java + Android SDK non installés sur cette machine | Installer **Android Studio** (inclut le SDK), puis `npm run cap:android` |
| Compiler l'app iOS | Xcode ne tourne que sur macOS | Un Mac avec **Xcode** installé, puis `npm run cap:ios` |
| Icônes et écrans de démarrage natifs | Génération d'assets graphiques (tailles multiples par plateforme) | Peut être fait avec `@capacitor/assets` une fois un logo haute résolution fourni |
| Compte développeur Google Play | 25 $ US, paiement unique, création de compte | Vous — https://play.google.com/console |
| Compte développeur Apple | 99 $ US/an, création de compte + vérification d'identité | Vous — https://developer.apple.com |
| Signature de l'APK/AAB (keystore Android) | Génère une clé qui doit être conservée indéfiniment (perdue = plus jamais possible de mettre à jour l'app) | Vous, au moment du premier build de production, avec sauvegarde de la clé aussi critique que `ENCRYPTION_KEY` |
| Fiche store (captures d'écran, description, politique de confidentialité liée) | Contenu marketing/éditorial | Vous, avec la politique de confidentialité comme base (déjà rédigée, en brouillon) |
| Revue Apple/Google | Process externe, délai variable (quelques heures à quelques jours) | Automatique une fois soumis |

## Prochaine fois que vous avez accès à Android Studio ou un Mac

```bash
npm run cap:sync
npm run cap:android   # ouvre Android Studio — build/run depuis là
npm run cap:ios       # ouvre Xcode (Mac uniquement) — build/run depuis là
```

À chaque changement de `capacitor.config.ts` (notamment l'URL de production), relancez
`npm run cap:sync` avant de rebuilder dans Android Studio/Xcode.
