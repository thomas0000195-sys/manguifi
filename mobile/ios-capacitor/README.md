# Application iPhone (Capacitor)

Coquille iPhone qui affiche `https://www.manguifi.tech/?source=ios`. Le site reste la source unique : une mise à jour du site est visible sans nouvelle version App Store.

**Statut : NON TESTÉ.** La génération du projet Xcode demande un Mac (Xcode et CocoaPods). Voir le lot 8 pour une compilation sans Mac.

## Contenu
- `capacitor.config.ts` : identifiant `tech.manguifi.app`, adresse du site, navigation limitée à `www.manguifi.tech`.
- `www/` : page hors ligne locale, en français, avec un bouton « Réessayer ».
- `templates/` : fichiers à copier dans le projet Xcode généré.

## Procédure sur un Mac
1. `npm install` dans `mobile/ios-capacitor`.
2. `npx cap add ios`, puis `npx cap sync ios`.
3. Dans Xcode, projet App, cible App :
   - **Identité** : Bundle Identifier `tech.manguifi.app`, Team (votre identifiant Apple, 10 caractères).
   - **Appareils** : iPhone uniquement (`TARGETED_DEVICE_FAMILY = 1`).
   - **Orientation** : portrait seulement.
4. Copier `templates/Info.plist.additions.xml` dans `Info.plist`.
5. Copier `templates/PrivacyInfo.xcprivacy` dans le projet (cocher la cible App).
6. Ajouter `templates/App.entitlements` à la capacité **Associated Domains**, avec `applinks:www.manguifi.tech`.
7. Tester sur un iPhone réel : pointage QR, GPS, retour haptique, et page hors ligne (couper le réseau).

## Décisions et écarts par rapport au prompt
- **Lecteur de QR** : le scan utilise la caméra du navigateur (WKWebView la prend en charge avec `NSCameraUsageDescription`), et non ML Kit. Raison : moins de plugins natifs à maintenir. Le contenu est validé par `parseSiteQrPayload`, qui n'accepte que le préfixe `MANGUIFI_SITE:`. **À confirmer sur iPhone réel.**
- **Ouverture par lien** (`appUrlOpen`) : non implémentée. Le QR code d'un site n'est pas une URL ; seuls les liens `www.manguifi.tech` ouvrent l'application (liens universels).
- **Retour haptique** : plugin `@capacitor/haptics`, appelé sur succès et erreur du pointage.
- **Géolocalisation** : demandée au moment du pointage via la permission standard, décrite dans `NSLocationWhenInUseUsageDescription`. Pas de localisation en arrière-plan.

## Ce qui reste à faire avant l'App Store
- Relecture des textes de permission et du manifeste de confidentialité avec le juriste.
- Captures d'écran et fiche (lot 9 et 10).
- Clé API App Store Connect et workflow TestFlight (lot 8).
