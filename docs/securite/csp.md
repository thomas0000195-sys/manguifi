# Content-Security-Policy

## État actuel

La CSP est posée par `src/proxy.ts`, avec un nonce unique par requête :

- `script-src 'self' 'nonce-…' 'strict-dynamic'` : seuls les scripts portant le nonce s'exécutent. `'unsafe-inline'` a été retiré des scripts.
- `'unsafe-eval'` n'est présent qu'en développement (requis par React pour ses diagnostics).
- `style-src 'self' 'unsafe-inline'` : conservé, voir « Essai sans unsafe-inline » ci-dessous.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src 'self'`.
- `upgrade-insecure-requests` n'est pas posé : une instance servie en HTTP seul casserait sinon tous ses chunks.

Les pages sont rendues dynamiquement (`export const dynamic = "force-dynamic"` dans `src/app/layout.tsx`), car un nonce ne peut pas être injecté dans une page statique générée au build.

## Vérifié

- Build de production : OK, toutes les pages en rendu dynamique (ƒ).
- Serveur de production local : en-tête CSP présent avec un nonce différent à chaque requête ; hydratation React fonctionnelle (changement d'onglet sur `/connexion` déclenché en JavaScript, sans violation CSP remontée).
- Le message « An unknown error occurred when fetching the script » apparaît sur les pages en production. Les seules requêtes en échec sont des préchargements de liens (`?_rsc=`) annulés par le navigateur (`ERR_ABORTED`), toutes les ressources du site répondent 200. Très probablement lié à l'état de l'onglet de test (fenêtre non affichée), non reproduit sur le serveur de développement. Aucune violation CSP n'est liée à ce message.

## Limites

- Les tests de bout en bout des parcours connectés (admin, employé) n'ont pas été rejoués sous la nouvelle CSP.
- Les scripts tiers éventuels (Sentry, si activé) doivent être vérifiés : `connect-src 'self'` bloque leurs envois.

## Essai sans unsafe-inline pour les styles

Mesuré en production locale, en retirant `'unsafe-inline'` de `style-src` (nonce seul) : le navigateur bloque une dizaine de chaînes `style="…"` différentes sur /dashboard, /employes, /rapports, /parametres et /equipes. Ce sont des styles rendus par le serveur, que ni un nonce ni un hash ne couvrent. Le retrait casserait la mise en page. Décision : `'unsafe-inline'` reste sur `style-src`.

Pour le retirer, il faut :

1. Trouver le composant qui produit chaque `style="…"` (les hashes sont visibles dans la console du navigateur).
2. Le convertir en classes Tailwind, ou en valeurs calculées côté client.
3. Recommencer l'essai et vérifier la console sur chaque page principale.

Coût estimé : plusieurs composants touchés, à traiter comme un chantier séparé.

## Retour arrière

Restaurer l'en-tête CSP statique de `next.config.ts` (supprimé dans les modifications en cours et remplacé par `src/proxy.ts`) et retirer `src/proxy.ts` et `export const dynamic` de `src/app/layout.tsx`.
