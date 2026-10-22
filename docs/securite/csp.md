# Content-Security-Policy

## État actuel

La CSP est posée par `src/proxy.ts`, avec un nonce unique par requête :

- `script-src 'self' 'nonce-…' 'strict-dynamic'` : seuls les scripts portant le nonce s'exécutent. `'unsafe-inline'` a été retiré des scripts.
- `'unsafe-eval'` n'est présent qu'en développement (requis par React pour ses diagnostics).
- `style-src 'self' 'unsafe-inline'` : conservé. L'application rend des attributs `style="…"` dans le HTML serveur, et les nonces ne couvrent pas ces attributs. Le retirer demande de convertir ces styles en classes ou en nonces de style.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src 'self'`.
- `upgrade-insecure-requests` n'est pas posé : une instance servie en HTTP seul casserait sinon tous ses chunks.

Les pages sont rendues dynamiquement (`export const dynamic = "force-dynamic"` dans `src/app/layout.tsx`), car un nonce ne peut pas être injecté dans une page statique générée au build.

## Vérifié

- Build de production : OK, toutes les pages en rendu dynamique (ƒ).
- Serveur de production local : en-tête CSP présent avec un nonce différent à chaque requête ; hydratation React fonctionnelle (changement d'onglet sur `/connexion` déclenché en JavaScript, sans violation CSP remontée).
- Un clic souris sur l'onglet a affiché dans la console « An unknown error occurred when fetching the script ». Il n'a pas été reproduit en déclenchant le clic en JavaScript, et aucune violation CSP n'a été enregistrée. Cause non identifiée.

## Limites

- Les tests de bout en bout des parcours connectés (admin, employé) n'ont pas été rejoués sous la nouvelle CSP.
- Les scripts tiers éventuels (Sentry, si activé) doivent être vérifiés : `connect-src 'self'` bloque leurs envois.

## Plan pour retirer `'unsafe-inline'` des styles

1. Recenser les `style="…"` dans le HTML serveur (`grep -rn 'style="' src`).
2. Les remplacer par des classes Tailwind ou par des propriétés React `style={{…}}` (qui passent par CSSOM et ne sont pas bloqués).
3. Passer `style-src` à `'self' 'nonce-…'` dans `src/proxy.ts`.
4. Vérifier les pages principales dans le navigateur, console propre.

## Retour arrière

Restaurer l'en-tête CSP statique de `next.config.ts` (supprimé dans les modifications en cours et remplacé par `src/proxy.ts`) et retirer `src/proxy.ts` et `export const dynamic` de `src/app/layout.tsx`.
