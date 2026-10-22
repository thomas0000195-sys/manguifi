# Photos et justificatifs stockés en base

## Constat

Trois colonnes Postgres contiennent des fichiers encodés en data URL base64, chiffrés au niveau applicatif (AES-256-GCM, `src/lib/crypto.ts`) :

| Table | Colonne | Contenu |
|---|---|---|
| `Employee` | `photoUrl` | photo de profil |
| `Attendance` | `photoDataUrl` | photo prise au pointage |
| `Justificatif` | `documentDataUrl` | justificatif (image ou PDF) |

Mesure faite en lecture seule sur la base de développement : une seule photo de profil (≈ 465 Ko). Aucune photo de pointage ni justificatif. Ce volume ne dit rien de la production, qui n'a pas été mesurée.

## Risques

- **Volume** : une data URL gonfle la ligne de 33 % (encodage base64). Une photo de pointage par jour et par employé représente vite plusieurs Go par an.
- **Sauvegardes** : chaque sauvegarde (`/api/cron/backup`) copie ces données en clair dans le blob `backups/`, donc chiffrées seulement par le fait qu'elles sont déjà chiffrées dans la base.
- **Performances** : les requêtes qui sélectionnent ces colonnes par erreur transportent des centaines de Ko par ligne.

## Options

1. **Blob privé** (Vercel Blob, déjà utilisé pour les sauvegardes) : stocker le fichier chiffré dans un blob, ne garder que son identifiant en base. Les fichiers sont servis par une route authentifiée qui vérifie le périmètre (`assertEmployeeInScope`, `assertJustificatifInScope`) avant de renvoyer le contenu.
2. **Stockage objet compatible S3** : même principe, avec un fournisseur hors Vercel si la souveraineté des données l'impose.
3. **Garder la base** : acceptable tant que le volume reste faible. À réévaluer au-delà de quelques Go.

Recommandation : option 1, car elle réutilise un service déjà configuré, et garder un chiffrement applicatif identique à celui d'aujourd'hui.

## Plan de migration (si l'option 1 est retenue)

1. Ajouter une colonne `storageKey` (migration additive, sans suppression).
2. Écrire les nouveaux fichiers en blob et en base à la fois (écriture double).
3. Script de rétro-remplissage, par lots, avec reprise : chiffrer, téléverser, écrire `storageKey`, vérifier la taille et le déchiffrement.
4. Basculer la lecture sur `storageKey`, avec repli sur la colonne data URL pendant une période de transition.
5. Après validation, vider les colonnes data URL (migration distincte, après sauvegarde complète et accord explicite).

## Sauvegarde et retour arrière

- Sauvegarde complète de la base avant chaque étape destructive.
- Tant que la colonne data URL existe, le retour arrière consiste à rebasculer la lecture.
- Les données chiffrées restent illisibles sans `ENCRYPTION_KEY` : la clé doit être sauvegardée séparément (voir `SESSION_REPORT.md`).

## Décisions à prendre

- Choix du stockage (option 1 ou 2, ou garder la base).
- Durée de conservation des photos de pointage (rétention légale à confirmer).
- Autorisation pour la migration des données de production.
