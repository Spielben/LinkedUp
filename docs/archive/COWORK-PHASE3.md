# LINK'DUP — Phase 3 : AI Generation Engine

> Prompt pour Claude Code Co-work. Session autonome — le user dort.
> Working directory : ~/Projects/linkdup/

---

## RÈGLES DE SESSION (OBLIGATOIRES)

### Gestion du quota Claude Code Pro

Tu tournes sur un forfait Claude Code Pro avec des limites mensuelles de tokens. Le user dort — il ne peut pas intervenir si tu bloques.

1. **COMMITTER après CHAQUE tâche terminée** — pas à la fin de tout.
   - Tâche 1 terminée → `git commit` immédiatement
   - Tâche 2 terminée → `git commit` immédiatement
   - Etc. Chaque commit doit être fonctionnel et testable indépendamment.

2. **ORDRE DE PRIORITÉ strict** (si le quota s'épuise, les tâches les plus importantes sont faites) :
   - Tâche 1 : Client OpenRouter (src/services/openrouter.ts)
   - Tâche 2 : Route génération de posts (POST /api/posts/:id/generate)
   - Tâche 3 : Connecter le bouton Generate dans PostDetail.tsx
   - Tâche 4 : Route optimisation (POST /api/posts/:id/optimize) + bouton frontend
   - Tâche 5 : Route ingestion contenu (POST /api/contenus/:id/ingest) + bouton frontend
   - Tâche 6 : Route génération style (POST /api/styles/:id/generate) + bouton frontend

3. **Économie de contexte** :
   - NE PAS réécrire des fichiers entiers si un Edit ciblé suffit
   - NE PAS relire des fichiers déjà lus sauf nécessité absolue
   - Réponses courtes — pas de récapitulatifs après chaque action
   - NE PAS lire le plan file (~/.claude/plans/) — tout le contexte est dans CE prompt

4. **Si une tâche bloque** : commit ce qui est fait, laisser un TODO en commentaire dans le code, passer à la suivante. Ne pas boucler sur un problème.

5. **En fin de session** : résumer dans le dernier message ce qui a été fait et ce qui reste.

### Sécurité

- La clé OpenRouter est dans le macOS Keychain. La lire via `keytar` (déjà installé) : `import { getCredential } from "../credentials.js"; const key = await getCredential("openrouter");`
- JAMAIS écrire de clé API dans un fichier
- JAMAIS committer de fichier .env
- Prepared statements SQL pour toutes les requêtes (pattern déjà en place)

### Style de code

- Suivre exactement le pattern des fichiers existants (Router Express, Zustand stores, Tailwind classes)
- Pas d'axios — fetch natif côté serveur
- Pas de frameworks additionnels
- Les prompts AI sont en français (reproduit le système original KONTENU©)
- TypeScript strict

---

## CONTEXTE DU PROJET

LINK'DUP = rebuild open-source de KONTENU© (app LinkedIn content generation).
Phase 1 (scaffold) et Phase 2 (CRUD) sont terminées. Phase 3 = brancher l'IA.

### Architecture existante

```
src/
  cli.ts              — Entry point, lance Express + ouvre browser
  server.ts           — Express app, monte les routes sur /api/*
  credentials.ts      — Wrapper keytar (getCredential, setCredential, etc.)
  onboarding.ts       — Wizard CLI (stocke clé OpenRouter dans Keychain)
  db/
    index.ts          — SQLite connection (better-sqlite3, WAL, FK ON)
    schema.ts         — 7 tables DDL
  routes/
    posts.ts          — CRUD GET/POST/PUT/DELETE /api/posts
    styles.ts         — CRUD /api/styles
    templates.ts      — CRUD /api/templates
    contenus.ts       — CRUD /api/contenus
    settings.ts       — GET/PUT /api/settings (single row, id=1)
    seed.ts           — POST /api/seed (import JSON audit data)
  services/           — VIDE — c'est ici que tu vas créer openrouter.ts

client/
  vite.config.ts      — React + Tailwind 4, proxy /api → localhost:3000
  src/
    App.tsx           — BrowserRouter, sidebar nav, routes
    stores/
      posts.ts        — Zustand: fetch, create, update, remove
      styles.ts       — Zustand: fetch, create, update, remove
      contenus.ts     — Zustand: fetch, create, update, remove
      templates.ts    — Zustand: fetch, create, update, remove
    pages/
      Dashboard.tsx   — Stats cards
      PostsList.tsx   — Table + "New Post" button
      PostDetail.tsx  — Config panel + V1/V2/V3 cards + Final Version + Copy buttons
      StylesList.tsx  — Grid display
      ContenusList.tsx — Grid display
      TemplatesList.tsx — Grid display
      Settings.tsx    — Form
    lib/
      linkedin-chars.ts — countLinkedInChars() (emojis=2, bold=2)
```

### Tables SQLite pertinentes

```sql
posts: id, subject, description, model (default 'anthropic/claude-sonnet-4'), status, v1, v2, v3,
       selected_version, final_version, optimization_instructions, publication_date,
       first_comment, style_id→styles, template_id→templates, contenu_id→contenus, ...

styles: id, name, linkedin_url, status, instructions, examples

contenus: id, name, description, url, type, content_raw, summary, status

templates: id, name, template_text, example_text, category, author, ...

settings: id=1, name, email, linkedin_url, signature, budget_limit

token_usage: id, post_id, model, prompt_tokens, completion_tokens, cost_usd
```

### Pattern route existant (src/routes/posts.ts — à suivre)

```typescript
import { Router } from "express";
import { getDb } from "../db/index.js";

export const postsRouter = Router();

postsRouter.get("/", (_req, res) => {
  const db = getDb();
  const posts = db.prepare(`SELECT ... FROM posts ...`).all();
  res.json(posts);
});

postsRouter.put("/:id", (req, res) => {
  const db = getDb();
  // ... dynamic SET clauses from req.body
  const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  res.json(updated);
});
```

### Pattern store Zustand existant (client/src/stores/posts.ts — à suivre)

```typescript
export const usePostsStore = create<PostsStore>((set, get) => ({
  posts: [],
  loading: false,
  fetch: async () => {
    set({ loading: true });
    const res = await fetch("/api/posts");
    const posts = await res.json();
    set({ posts, loading: false });
  },
  update: async (id, data) => {
    const res = await fetch(`/api/posts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set({ posts: get().posts.map((p) => (p.id === id ? updated : p)) });
    return updated;
  },
}));
```

### Credential access (src/credentials.ts)

```typescript
import keytar from "keytar";
const SERVICE = "linkdup";
export type CredentialKey = "openrouter" | "apify";
export async function getCredential(key: CredentialKey): Promise<string | null> {
  return keytar.getPassword(SERVICE, key);
}
```

---

## TÂCHE 1 — Client OpenRouter (PRIORITÉ MAXIMALE)

Créer `src/services/openrouter.ts` :

```typescript
// Ce que le fichier doit exposer :
export async function callOpenRouter(options: {
  messages: Array<{ role: string; content: string }>;
  model?: string;          // default: "anthropic/claude-sonnet-4"
  stream?: boolean;        // default: false
  onChunk?: (text: string) => void;  // callback pour streaming
}): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number } }>

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number
```

Détails d'implémentation :
- Lire la clé via `getCredential("openrouter")` depuis src/credentials.ts
- Endpoint : `POST https://openrouter.ai/api/v1/chat/completions`
- Headers : `Authorization: Bearer <key>`, `HTTP-Referer: http://localhost:3000`, `X-Title: LINK'DUP`
- Body : `{ model, messages, stream }`
- Mode non-stream : retourner `response.choices[0].message.content` + `response.usage`
- Mode stream : lire le SSE ligne par ligne, appeler `onChunk` pour chaque delta, accumuler le texte complet
- Gérer les erreurs : si pas de clé → throw "OpenRouter API key not configured. Run the onboarding wizard."
- Gérer les erreurs API : si 401 → "Invalid API key", si 429 → "Rate limited", sinon → message d'erreur de l'API
- Utiliser `fetch` natif (pas axios)

**Après cette tâche → git commit "feat: OpenRouter client with streaming support"**

---

## TÂCHE 2 — Route génération de posts

Ajouter dans `src/routes/posts.ts` :

```
POST /api/posts/:id/generate
```

Logique :
1. Lire le post avec ses jointures (style, template, contenu) + settings (signature)
2. Assembler le prompt (voir ci-dessous)
3. Appeler `callOpenRouter()` avec le prompt
4. Parser la réponse pour extraire V1, V2, V3 (split sur "V1:", "V2:", "V3:")
5. Mettre à jour le post : v1, v2, v3, status → "Brouillon"
6. Logger dans token_usage : post_id, model, prompt_tokens, completion_tokens, cost_usd
7. Retourner le post mis à jour

Prompt à utiliser (EXACTEMENT celui-ci — c'est le reverse-engineering de KONTENU©) :

```
Tu es un expert en création de posts LinkedIn engageants et viraux.

Ton objectif est de rédiger 3 versions différentes d'un post LinkedIn en respectant le style d'écriture, la structure du template (si fourni), et en intégrant le contenu de référence (si fourni).

---

## Informations du post

**Sujet** : ${post.subject}

**Description / Instructions** : 
${post.description || "Aucune description fournie."}

---

## Style d'écriture à reproduire

${style?.instructions || "Aucun style défini. Utilise un ton professionnel et engageant."}

---

## Template / Structure à suivre (optionnel)

${template?.template_text || "Aucun template fourni. Utilise une structure engageante adaptée au sujet."}

---

## Contenu de référence (optionnel)

${contenu?.summary || contenu?.content_raw || "Aucun contenu de référence fourni."}

---

## Signature

${settings?.signature || ""}

---

## Consignes

1. Génère exactement 3 versions du post, chacune avec un angle/hook différent
2. Chaque version doit :
   - Respecter le ton de voix décrit dans le style
   - Suivre la structure du template si fourni
   - Intégrer les informations clés de la description
   - Utiliser le contenu de référence si fourni
   - Se terminer par la signature
3. Les 3 versions doivent être distinctes dans leur approche :
   - V1 : Hook basé sur une question ou un problème
   - V2 : Hook basé sur une observation ou une analyse
   - V3 : Hook basé sur des chiffres, secrets ou une liste
4. Format LinkedIn : phrases courtes, sauts de ligne fréquents, emojis si le style le permet
5. Longueur : 600-900 caractères par version

Retourne le résultat dans ce format exact :

V1:
[contenu de la version 1]

V2:
[contenu de la version 2]

V3:
[contenu de la version 3]
```

Parser :
```typescript
function parseVersions(text: string): { v1: string; v2: string; v3: string } {
  const v1Match = text.match(/V1:\s*\n([\s\S]*?)(?=\nV2:)/);
  const v2Match = text.match(/V2:\s*\n([\s\S]*?)(?=\nV3:)/);
  const v3Match = text.match(/V3:\s*\n([\s\S]*?)$/);
  return {
    v1: v1Match?.[1]?.trim() || "",
    v2: v2Match?.[1]?.trim() || "",
    v3: v3Match?.[1]?.trim() || "",
  };
}
```

**Après cette tâche → git commit "feat: post generation route with OpenRouter"**

---

## TÂCHE 3 — Connecter le bouton Generate dans PostDetail.tsx

Dans `client/src/pages/PostDetail.tsx` :

1. Remplacer le bouton désactivé "Generate V1 / V2 / V3 (coming soon)" par un bouton fonctionnel
2. Au clic → appeler `POST /api/posts/${post.id}/generate`
3. Pendant l'appel → afficher "Generating..." + désactiver le bouton
4. Quand terminé → rafraîchir le post (re-fetch ou utiliser la réponse directe)
5. En cas d'erreur → afficher le message d'erreur

Ajouter un state `generating` dans le composant.

Le bouton ne doit être actif QUE si `post.subject` est rempli.

Aussi dans le store posts.ts, ajouter une méthode :
```typescript
generate: async (id: number) => {
  const res = await fetch(`/api/posts/${id}/generate`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error);
  const updated = await res.json();
  set({ posts: get().posts.map((p) => (p.id === id ? updated : p)) });
  return updated;
},
```

**Après cette tâche → git commit "feat: connect Generate button in PostDetail UI"**

---

## TÂCHE 4 — Route optimisation + bouton frontend

Ajouter dans `src/routes/posts.ts` :

```
POST /api/posts/:id/optimize
```

Logique :
1. Lire post.final_version + post.optimization_instructions + style.instructions
2. Appeler OpenRouter avec ce prompt :

```
Tu es un expert en optimisation de posts LinkedIn.

Optimise le post suivant en appliquant les instructions d'optimisation tout en préservant le ton de voix de l'auteur.

---

## Post actuel

${post.final_version}

---

## Instructions d'optimisation

${post.optimization_instructions}

---

## Style d'écriture à respecter

${style?.instructions || "Aucun style défini."}

---

## Consignes

1. Applique les instructions d'optimisation au post
2. Conserve le ton de voix et le style d'écriture
3. Maintiens la structure générale du post
4. Garde la même longueur approximative
5. Ne change pas la signature

Retourne uniquement le post optimisé, sans commentaire ni explication.
```

3. Écrire le résultat dans post.final_version
4. Logger token_usage
5. Retourner le post mis à jour

Frontend — dans PostDetail.tsx :
- Activer le bouton "Optimize (coming soon)" → appeler POST /api/posts/:id/optimize
- Actif seulement si post.final_version ET post.optimization_instructions sont remplis
- State "optimizing" pendant l'appel

Ajouter `optimize` dans le store posts.ts (même pattern que generate).

**Après cette tâche → git commit "feat: post optimization with OpenRouter"**

---

## TÂCHE 5 — Route ingestion contenu + bouton frontend

### Installer les dépendances nécessaires :
```bash
npm install cheerio youtube-transcript pdf-parse
npm install -D @types/pdf-parse
```

Note : `cheerio` pour parser le HTML des pages web, `youtube-transcript` pour les transcripts YouTube, `pdf-parse` pour les PDF.

### Créer `src/services/content-ingestion.ts` :

```typescript
export async function fetchWebContent(url: string): Promise<string>
// fetch URL → cheerio → extraire le texte principal (body text, sans nav/footer/scripts)

export async function fetchYouTubeTranscript(url: string): Promise<string>
// extraire video ID de l'URL → youtube-transcript → concaténer les segments

export async function fetchPdfContent(filePath: string): Promise<string>
// pdf-parse → retourner le texte
```

### Ajouter dans `src/routes/contenus.ts` :

```
POST /api/contenus/:id/ingest
```

Logique :
1. Lire le contenu (url, type)
2. Selon le type ou l'URL :
   - Si URL contient "youtube.com" ou "youtu.be" → fetchYouTubeTranscript
   - Si type === "PDF" ou pdf_path existe → fetchPdfContent
   - Sinon → fetchWebContent
3. Stocker le résultat dans content_raw
4. Envoyer à OpenRouter pour résumé avec ce prompt :

```
Tu es un expert en synthèse de contenu.

Analyse le contenu suivant et produis un résumé structuré qui servira de base pour la création de posts LinkedIn.

---

## Source

**Type** : ${contenu.type || "Web"}
**Nom** : ${contenu.name}
**Description** : ${contenu.description || ""}

## Contenu brut

${content_raw}

---

## Consignes

1. Résumé (~2000-3000 caractères) :
   - Les idées principales et arguments clés
   - Les chiffres et statistiques mentionnés
   - Les citations ou formulations marquantes
   - Les appels à l'action ou offres
   - Structuré en sections avec des bullet points
2. Le résumé doit être suffisamment riche pour permettre de générer plusieurs posts LinkedIn

Retourne uniquement le résumé structuré.
```

5. Écrire dans contenu.summary + status → "generated"
6. Logger token_usage
7. Retourner le contenu mis à jour

Frontend — dans ContenusList.tsx :
- Ajouter un bouton "Ingest" sur chaque contenu qui a une URL mais PAS de summary
- State "ingesting" avec l'id du contenu en cours
- Au clic → POST /api/contenus/:id/ingest → re-fetch la liste

**Après cette tâche → git commit "feat: content ingestion (web, YouTube, PDF) with summarization"**

---

## TÂCHE 6 — Route génération de style + bouton frontend

Ajouter dans `src/routes/styles.ts` :

```
POST /api/styles/:id/generate
```

Logique :
1. Lire style.examples (posts LinkedIn collés manuellement par le user)
2. Si pas d'examples → retourner erreur "Paste LinkedIn posts in the examples field first"
3. Appeler OpenRouter avec ce prompt :

```
Tu es un expert en analyse de communication écrite et en personal branding LinkedIn.

À partir des posts LinkedIn suivants, réalise une analyse complète du style d'écriture de l'auteur en 4 étapes.

---

## Posts de l'auteur

${style.examples}

---

## Étape 1 : Analyse des communications écrites

Analyse les exemples selon ces critères :
- **Niveau de formalité** : décontracté, professionnel, académique...
- **Jargon** : vocabulaire technique utilisé, termes récurrents
- **Ton émotionnel** : optimiste, provocateur, empathique, neutre...
- **Verbosité** : concis ou élaboré, longueur des phrases
- **Structure des phrases** : simples, complexes, alternance...
- **Autres caractéristiques notables** : appels à l'action, emojis, formats, etc.

## Étape 2 : Profil du ton de voix

Rédige une description narrative détaillée du ton de voix de l'auteur.
Inclus les thèmes récurrents identifiés dans ses posts.

## Étape 3 : Paragraphe narratif (Clé universelle)

Rédige un paragraphe d'environ 100-150 mots qui capture parfaitement le style de l'auteur.
Ce paragraphe doit pouvoir servir de référence pour reproduire ce ton à l'identique.
Il doit sonner comme si l'auteur l'avait écrit lui-même.

## Étape 4 : Guide du ton de voix

Résume le tout en un guide concis et actionnable :
- Description du ton de voix (bullet points)
- La clé universelle de l'Étape 3

Ce guide sera utilisé comme contexte pour la génération future de posts dans ce style.
```

4. Écrire le résultat dans style.instructions + status → "generated"
5. Logger token_usage
6. Retourner le style mis à jour

Frontend — dans StylesList.tsx :
- Ajouter un bouton "Generate" sur chaque style qui a des examples mais PAS d'instructions
- State "generating" avec l'id du style en cours
- Au clic → POST /api/styles/:id/generate → re-fetch la liste

**Après cette tâche → git commit "feat: style generation from LinkedIn post examples"**

---

## VÉRIFICATIONS FINALES

Quand toutes les tâches sont terminées (ou autant que le quota permet) :

1. Vérifier que `npm run dev` démarre sans erreur (npx tsx src/cli.ts)
2. Vérifier que le build fonctionne : `npm run build` (optionnel si le quota est serré)
3. Faire un commit final si des ajustements sont nécessaires

**NE PAS** :
- Pousser vers un remote (pas de git push)
- Modifier le onboarding, la DB schema, ou les routes CRUD existantes
- Ajouter du dark mode, des tests, ou toute fonctionnalité non listée ci-dessus
- Créer des fichiers README ou de documentation
