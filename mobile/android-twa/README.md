# Application Android (TWA)

Coquille Android qui affiche `https://www.manguifi.tech`. Une modification du site ne demande aucune nouvelle version Play : seul un changement de cette coquille en demande une.

## 1. Créer la clé d'envoi (une seule fois)

Il faut Java (`keytool`). Sans Java sur votre ordinateur, utilisez **Google Cloud Shell** (https://shell.cloud.google.com), qui en contient déjà.

```bash
keytool -genkeypair -v -keystore upload.jks -alias manguifi-upload -keyalg RSA -keysize 2048 -validity 10000
```

- Choisissez un mot de passe long et notez-le dans Bitwarden (deux mots de passe : celui du fichier et celui de la clé).
- Téléchargez `upload.jks` puis gardez-en une copie chiffrée (Bitwarden, pièce jointe), **jamais dans le dépôt**.

## 2. Secrets GitHub (Settings > Secrets and variables > Actions)

| Nom | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Le fichier `upload.jks` encodé en base64 (`base64 -w0 upload.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | Mot de passe du fichier |
| `ANDROID_KEY_PASSWORD` | Mot de passe de la clé `manguifi-upload` |

## 3. Google Play App Signing

À la création de l'application sur la Play Console, activez **Play App Signing**. Google garde la clé de signature finale. Récupérez son empreinte SHA-256 (page **Intégrité de l'application**) et ajoutez-la, avec celle de la clé d'envoi, à la variable Vercel `ANDROID_SHA256_FINGERPRINTS` (séparées par des virgules). Ensuite, redéployez le site : `/.well-known/assetlinks.json` s'met à jour.

## 4. Produire le .aab

1. Incrémenter la version : `node mobile/android-twa/scripts/bump-version.mjs`, puis commiter `twa-manifest.json`.
2. Lancer le workflow **Android AAB** (onglet Actions, bouton *Run workflow*).
3. Télécharger l'artefact `manguifi-aab` et l'envoyer dans la Play Console.

## Points à vérifier avant chaque publication

- `targetSdkVersion` : Google impose un niveau minimum qui évolue chaque année. Vérifiez la valeur exigée à la date de soumission.
- Le workflow est **NON TESTÉ** : la première exécution peut demander des ajustements (génération du projet Android par Bubblewrap).
