# tRPC DevTools

Extension navigateur (Chrome et Firefox, Manifest V3) qui ajoute un panneau **tRPC** aux DevTools.
Elle capture les requêtes tRPC de la page et affiche proprement chaque appel :

- découpe des requêtes batchées (`httpBatchLink`) en un appel par procédure ;
- query (GET) et mutation (POST), tRPC v9, v10 et v11 ;
- décodage **superjson** (`Date`, `Map`, `Set`, `BigInt`, `undefined`, `RegExp`, `URL`, `NaN`…) ;
- erreurs tRPC mises en avant (code, statut HTTP, message) ;
- arbre JSON repliable, filtre par procédure, filtre « erreurs uniquement », copie en JSON ;
- thème clair / sombre selon les DevTools.

Aucune dépendance, aucun build : le dossier se charge tel quel.

## Installer en local

**Chrome / Edge / Brave**

1. Ouvrir `chrome://extensions` et activer le *mode développeur*.
2. *Charger l'extension non empaquetée* → choisir ce dossier.
3. Ouvrir les DevTools sur une app tRPC → onglet **tRPC**, puis recharger la page.

**Firefox (115+)**

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. *Charger un module complémentaire temporaire* → choisir `manifest.json`.
3. Ouvrir les DevTools → onglet **tRPC**.

## Développer

```sh
npm test          # tests du parseur tRPC et du décodeur superjson (node:test)
npm run package   # crée dist/trpc-devtools-<version>.zip
npm run icons     # régénère les icônes (Pillow)
```

Pour travailler sur l'interface sans DevTools, servir le dossier (`python3 -m http.server`) et ouvrir
`http://localhost:8000/panel.html` : le panneau s'affiche en mode démo avec les exemples de `src/fixtures.js`.

## Structure

| Fichier | Rôle |
| --- | --- |
| `manifest.json` | Manifest V3, déclare la page DevTools |
| `devtools.js` | Crée le panneau « tRPC » |
| `panel.html` / `panel.css` / `panel.js` | Interface : capture réseau (`chrome.devtools.network`), liste, détail |
| `src/trpc.js` | Transforme une requête HTTP en appels tRPC (batch, input, résultat, erreur) |
| `src/superjson.js` | Décodeur superjson minimal, sans dépendance |
| `src/tree.js` | Rendu de l'arbre JSON |

## Limites actuelles / pistes

- Seules les requêtes faites pendant que les DevTools sont ouverts sont capturées.
- `httpBatchStreamLink` (réponses JSONL en streaming) et les subscriptions (SSE / WebSocket) ne sont pas encore décodés.
- Les procédures sont détectées par la forme de la réponse (`{ result: { data } }` / `{ error }`) ou `?batch=1`.
