# LINK'DUP — Debug & Validation Session

> Working directory : ~/Projects/linkdup/
> Model recommande : Sonnet

---

## CONTEXTE

LINK'DUP est une app Node.js (Express backend + React/Vite frontend) pour générer du contenu LinkedIn.
Phase 1 (scaffold), Phase 2 (CRUD), Phase 3 (AI generation via OpenRouter) sont codées.
La génération AI fonctionne (testé via curl), mais le frontend ne s'affiche pas dans le browser.

## PROBLÈME CONNU

Le frontend est une page blanche. Cause identifiée : `zustand` était installé dans le root `package.json` mais pas dans `client/package.json`. J'ai fait `cd client && npm install zustand` mais je n'ai pas pu vérifier si ça suffit.

Il peut y avoir d'autres problèmes similaires (dépendances manquantes côté client, erreurs JS, etc.)

## STRUCTURE DU PROJET

```
package.json          — dépendances serveur (express, better-sqlite3, keytar, etc.)
client/package.json   — dépendances client (react, react-router, tailwindcss, zustand)

# Backend
src/cli.ts            — entry point, lance Express sur :3000
src/server.ts         — Express app, routes API + static files
src/routes/           — CRUD + AI generation routes
src/services/         — openrouter.ts, content-ingestion.ts

# Frontend  
client/vite.config.ts — Vite config, proxy /api → localhost:3000
client/src/App.tsx    — BrowserRouter, sidebar, routes
client/src/stores/    — Zustand stores (posts, styles, templates, contenus)
client/src/pages/     — Dashboard, PostsList, PostDetail, StylesList, etc.
```

## TA MISSION

### Étape 1 : Faire fonctionner le frontend

1. Lance le backend : `DEV=1 npx tsx src/cli.ts`
2. Lance le frontend : `npx vite --config client/vite.config.ts`
3. Vérifie que http://localhost:5173 renvoie du HTML valide
4. Si page blanche → check la console browser (curl les JS, cherche les erreurs d'import)
5. Corrige tout ce qui empêche le frontend de s'afficher (dépendances manquantes, imports cassés, etc.)
6. Vérifie que la sidebar s'affiche et que la navigation fonctionne

### Étape 2 : Tester le parcours complet dans le UI

1. Dashboard : les compteurs s'affichent (même à 0)
2. Seeds : appeler `curl -X POST http://localhost:3000/api/seed` pour importer les données de test (52 templates, 2 styles, 2 contenus depuis ~/Documents/linkdup-audit/)
3. Posts → "+ New Post" → créer un post avec subject "Test AI generation"
4. PostDetail : vérifier que les dropdowns Style/Template/Contenu se remplissent
5. Cliquer "Generate" → vérifier que V1/V2/V3 apparaissent (appelle OpenRouter — la clé est dans le macOS Keychain sous service "linkdup", account "openrouter")
6. Cliquer sur une version → vérifier qu'elle se copie dans Final Version
7. Écrire des optimization_instructions → cliquer Optimize → vérifier que final_version est mise à jour
8. Tester Copy to clipboard
9. StylesList : vérifier que les styles importés s'affichent, tester le bouton Generate (si un style a des examples)
10. ContenusList : vérifier que les contenus s'affichent, tester le bouton Ingest (si un contenu a une URL)
11. Settings : vérifier que le formulaire save/load fonctionne

### Étape 3 : Corriger tous les bugs trouvés

- Corriger chaque bug au fur et à mesure
- Committer après chaque fix important
- Ne pas refactorer ou "améliorer" — uniquement corriger ce qui ne fonctionne pas

### Étape 4 : Validation finale

1. Tuer les serveurs
2. Relancer proprement : `DEV=1 npx tsx src/cli.ts` + `npx vite --config client/vite.config.ts`
3. Refaire le parcours complet une dernière fois
4. Confirmer que tout fonctionne

## CONTRAINTES

- NE PAS modifier l'architecture (pas de nouveau framework, pas de restructuration)
- NE PAS ajouter de fonctionnalités (pas de dark mode, pas de tests, pas de docs)
- NE PAS pousser vers un remote (pas de git push)
- Committer après chaque fix avec un message descriptif
- La clé OpenRouter est dans le Keychain macOS — NE PAS la logger ou l'écrire dans un fichier
- Si un test OpenRouter échoue pour une raison de clé/réseau, noter le problème et passer à la suite
