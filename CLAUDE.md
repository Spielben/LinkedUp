# CLAUDE.md — LinkedUp project
# Web app: automated LinkedIn content creation
# Repo: https://github.com/Spielben/LinkedUp (public)
# Owner: Benoit Ricard — Spielben and Co., Ltd.

---

## QUI JE SUIS SUR CE PROJET

Je suis le créateur de cette app. Je ne suis pas développeur de métier.
Je travaille en vibe coding — je veux aller vite, comprendre ce qu'on fait, et ne pas me perdre dans des détails inutiles.

**Règle numéro un : tu ne m'exposes jamais une clé API, un token, un secret.**
Si tu dois faire référence à une variable sensible, tu écris son NOM uniquement — jamais sa valeur.
Exemple correct : `OPENROUTER_API_KEY` — jamais `sk-or-v1-xxxxx`.
Si ça arrive : c'est une erreur grave. Stop immédiat, on corrige.

---

## LE PROJET

**Nom :** LinkedUp (package: `linkdup`)
**But :** Générer et publier du contenu LinkedIn de façon automatisée, self-hosted
**Langue du code :** TypeScript (backend + frontend)
**Architecture :**

```
Backend   → Express (Node.js), TypeScript, tsx en dev
Frontend  → React + Vite (dossier client/)
Base de données → SQLite (better-sqlite3)
Auth LinkedIn → OAuth 2.0
IA → OpenRouter API (multi-modèles)
```

**Scripts npm :**
```
npm run dev       → lance backend + frontend en parallèle (dev local)
npm run build     → compile TypeScript + Vite
npm start         → lance le serveur de prod (dist/)
```

---

## STACK COMPLÈTE

| Élément           | Détail                                      |
|-------------------|---------------------------------------------|
| Runtime           | Node.js ≥ 18                                |
| Langage           | TypeScript 6                                |
| Backend           | Express 5, tsx (dev), src/cli.ts (entry)    |
| Frontend          | React, Vite, Zustand (state)                |
| BDD               | SQLite via better-sqlite3                   |
| Auth LinkedIn     | OAuth 2.0, tokens dans .env.production      |
| IA                | OpenRouter API (clé dans .env.production)   |
| Ingestion         | PDF, DOCX, YouTube transcript, web scrape   |
| Hébergement       | VPS Hostinger (Ubuntu 22.04), Docker — **APP EN PRODUCTION** |
| Reverse proxy     | Traefik ou Nginx (selon config VPS)         |
| Secrets           | .env.production (jamais commité)            |
| Credentials Mac   | keytar (Keychain macOS)                     |

---

## STRUCTURE DES DOSSIERS

```
LinkedUp/
├── src/                    → backend Node/Express
│   ├── cli.ts              → point d'entrée principal
│   ├── server.ts           → config Express
│   ├── credentials.ts      → gestion clés (keytar)
│   ├── routes/             → API routes
│   │   ├── posts.ts
│   │   ├── contenus.ts
│   │   ├── linkedin-auth.ts
│   │   ├── linkedin-posts.ts
│   │   ├── scheduler.ts
│   │   ├── settings.ts
│   │   ├── styles.ts
│   │   ├── templates.ts
│   │   ├── import.ts
│   │   └── seed.ts
│   ├── services/           → logique métier
│   │   ├── openrouter.ts   → appels IA
│   │   ├── linkedin.ts     → API LinkedIn
│   │   ├── content-ingestion.ts
│   │   └── post-media.ts
│   └── db/                 → schéma et accès SQLite
├── client/                 → frontend React/Vite
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── stores/         → Zustand
│   │   └── lib/
│   └── vite.config.ts
├── deploy/                 → scripts de déploiement VPS
├── docs/                   → documentation
├── bin/linkdup.js          → CLI entry point
├── Dockerfile
├── .env.production.example → template (jamais de vraies valeurs ici)
├── .env.production         → JAMAIS COMMITÉ — contient les vrais secrets
└── CLAUDE.md               → ce fichier
```

---

## VARIABLES D'ENVIRONNEMENT

Le fichier `.env.production` contient tous les secrets.
**Il ne doit jamais apparaître dans un diff, un commit, ou une réponse.**

Variables présentes (noms uniquement) :
- `OPENROUTER_API_KEY`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`
- `LINKEDIN_ACCESS_TOKEN` (auto-rempli après OAuth)
- `LINKEDIN_REFRESH_TOKEN` (auto-rempli après OAuth)
- `LINKEDIN_PERSON_URN` (auto-rempli après OAuth)
- `APIFY_API_KEY`
- `PORT` (défaut: 3000)
- `USE_ENV_CREDENTIALS`
- `AUTH_OWNER_USER` / `AUTH_OWNER_PASS`
- `AUTH_COLLAB_USER` / `AUTH_COLLAB_PASS`

---

## TERMINAUX — LEQUEL UTILISER

C'est critique. Toujours préciser le contexte du terminal dans chaque commande.

### Terminal Mac — dossier projet local
```
# Terminal : Mac — dossier LinkedUp
# ~/[chemin local vers LinkedUp]
```
→ Pour : modifier des fichiers, lancer `npm run dev`, git, tests

### Terminal Mac — connexion VPS
```
# Terminal : Mac → SSH VPS Hostinger
ssh benoitricard@[VPS_IP]
```
→ Pour : accéder au serveur de production

**L'application tourne déjà en production sur le VPS.**
Avant toute modification sur le VPS : signaler l'impact sur l'app live.
Ne jamais proposer `docker compose down` sans avertir explicitement que ça coupe le service.

### Terminal VPS — dossier projet
```
# Terminal : VPS — dossier LinkedUp
# vérifier le chemin exact avec : pwd
```
→ Pour : rebuild, restart Docker, logs, déploiement

### Terminal VPS — Docker
```
# Terminal : VPS — Docker
docker compose ps
docker compose logs linkdup --tail=50 -f
docker compose restart linkdup
# JAMAIS docker compose down sans avertissement explicite — coupe la prod
```

**Règle :** chaque bloc de commande dans une réponse commence par un commentaire
qui indique exactement quel terminal utiliser. Sans exception.

---

## SÉCURITÉ — RÈGLES ABSOLUES

1. **Jamais de valeur de secret dans une réponse** — uniquement les noms de variables
2. **Jamais de `cat .env.production`** dans une procédure — utiliser `grep -v` ou pointer vers une variable précise
3. **Avant chaque commit** :
   ```
   # Terminal : Mac — dossier LinkedUp
   git diff --cached | grep -iE "sk-|token|secret|password|api_key|Bearer"
   ```
   Si un résultat apparaît → stop, ne pas commiter
4. **Repo public** — LinkedIn est open source. Toute valeur sensible dans le code = fuite immédiate
5. `.env.production` est dans `.gitignore` — ne jamais le stager, ne jamais l'ajouter

---

## STYLE DE CODE

- TypeScript strict — pas de `any` sauf justification explicite
- `async/await` — jamais de `.then()` chaîné
- `const` / `let` — jamais `var`
- Commentaires inline sur toute logique non évidente
- Pas d'abstraction prématurée — fonctions simples d'abord
- Pas de features non demandées

---

## COMPORTEMENT ATTENDU DE CLAUDE

### Toujours
- Préciser quel terminal pour chaque commande (Mac local / Mac→SSH / VPS)
- Lire le fichier concerné avant de le modifier
- Montrer un diff ou résumé des changements avant d'écrire
- Compléter le code — jamais tronquer avec `// ...` ou `// reste inchangé`

### Jamais
- Exposer une valeur de secret, token, ou clé API
- Ajouter des features non demandées
- Suggérer de changer de stack ou d'outil sans que ce soit demandé
- Paraphraser la question avant de répondre
- Utiliser des formules de politesse inutiles ("Bien sûr !", "Excellente question !")

### En cas de doute
- Poser UNE seule question ciblée — pas une liste
- Ne pas deviner — mieux vaut demander que casser

---

## GIT & GITHUB

```
# Terminal : Mac — dossier LinkedUp

# Vérification sécurité (obligatoire avant staging)
git diff | grep -iE "sk-|token|secret|password|api_key"

# Commit conventionnel
git add -A
git commit -m "type(scope): description courte"
git push origin main
```

Types : `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `style` | `wip`

---
# FIN DE CLAUDE.md
