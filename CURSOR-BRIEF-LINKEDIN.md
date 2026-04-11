# Brief Cursor : Debug LinkedIn OAuth Integration

## Contexte

LINK'DUP est un outil self-hosted (Express + React + SQLite + Vite) de gestion de contenu LinkedIn.
Une integration LinkedIn API a ete ajoutee pour publier des posts directement depuis l'app.
Le code compile sans erreurs TypeScript mais **la connexion OAuth LinkedIn ne fonctionne pas**.

L'utilisateur clique "Connect LinkedIn" dans Settings, une popup devrait s'ouvrir vers LinkedIn OAuth, mais ca ne marche pas. Il faut diagnostiquer et corriger.

---

## Stack technique

- **Backend** : Express 5 (ESM, TypeScript, `tsx` pour le dev)
- **Frontend** : React + Vite + Tailwind (port 5173 en dev, proxy `/api` vers port 3000)
- **DB** : SQLite via `better-sqlite3`
- **Credentials** : `keytar` (macOS Keychain) — service name = `linkdup`
- **Run** : `npm run dev` (backend port 3000), `npm run dev:client` (Vite port 5173)

## Credentials deja stockes dans le Keychain

```bash
security find-generic-password -s linkdup -a linkedin_client_id -w
security find-generic-password -s linkdup -a linkedin_client_secret -w
```

Ces deux valeurs existent deja dans le Keychain macOS.

## LinkedIn Developer App

L'utilisateur a cree une app sur https://developer.linkedin.com/ avec :
- Produit "Share on LinkedIn" (scope `w_member_social`)
- Produit "Sign In with LinkedIn using OpenID Connect" (scopes `openid`, `profile`)
- Redirect URI configuree : `http://localhost:3000/api/linkedin/callback`

---

## Architecture des fichiers concernes

### 1. `src/credentials.ts` — Stockage Keychain

```typescript
import keytar from "keytar";
const SERVICE = "linkdup";

export type CredentialKey =
  | "openrouter" | "apify"
  | "linkedin_client_id" | "linkedin_client_secret"
  | "linkedin_access_token" | "linkedin_refresh_token"
  | "linkedin_person_urn";

export async function getCredential(key: CredentialKey): Promise<string | null> {
  return keytar.getPassword(SERVICE, key);
}
export async function setCredential(key: CredentialKey, value: string): Promise<void> {
  await keytar.setPassword(SERVICE, key, value);
}
export async function deleteCredential(key: CredentialKey): Promise<boolean> {
  return keytar.deletePassword(SERVICE, key);
}
```

### 2. `src/services/linkedin.ts` — Service LinkedIn API

Fonctions principales :
- `buildAuthUrl()` — lit `linkedin_client_id` depuis keytar, construit l'URL OAuth LinkedIn
- `exchangeCodeForToken(code)` — echange le code OAuth contre access/refresh tokens, les stocke dans keytar, recupere le person URN
- `refreshAccessToken()` — refresh le token avec le refresh_token
- `publishTextPost(text)` — POST vers `/v2/ugcPosts` pour un post texte
- `publishImagePost(text, imagePath)` — upload image en 3 etapes puis POST
- `publishComment(postUrn, text)` — ajoute un commentaire
- `getConnectionStatus()` — verifie si le token est valide en appelant `/v2/userinfo`

**Points d'attention** :
- `REDIRECT_URI` est hardcode a `http://localhost:3000/api/linkedin/callback`
- `SCOPES` = `"openid profile w_member_social"`
- La fonction `getAuthUrl(state)` (ligne 14) est inutilisee et a un `client_id: ""` hardcode — seule `buildAuthUrl()` est utilisee
- Le person URN est stocke brut (ex: `"abc123"`) mais utilise avec prefix `urn:li:person:${personUrn}` — verifier que LinkedIn retourne bien juste le `sub` sans prefix

### 3. `src/routes/linkedin-auth.ts` — Routes OAuth

- `GET /api/linkedin/auth` — retourne `{ url: "https://linkedin.com/oauth/v2/..." }` en JSON
- `GET /api/linkedin/callback` — recoit le code OAuth, appelle `exchangeCodeForToken`, retourne une page HTML avec `window.opener.postMessage("linkedin-connected")` + `window.close()`
- `GET /api/linkedin/status` — retourne `{ connected: boolean, name?: string }`
- `POST /api/linkedin/disconnect` — supprime les tokens du Keychain

### 4. `src/routes/posts.ts` — Endpoint publish

- `POST /api/posts/:id/publish` — prend le `final_version` ou `selected_version`, appelle `publishTextPost` ou `publishImagePost`, met a jour le post en DB avec `linkedin_post_id` et `linkedin_post_url`, log dans `publish_log`, poste le `first_comment` si present

### 5. `src/server.ts` — Registration

```typescript
import { linkedinAuthRouter } from "./routes/linkedin-auth.js";
// ...
app.use("/api/linkedin", linkedinAuthRouter);
```

### 6. `client/src/pages/Settings.tsx` — UI connexion

Le bouton "Connect LinkedIn" :
1. Appelle `GET /api/linkedin/auth` pour obtenir l'URL
2. Ouvre un `window.open(url, "linkedin-auth", "width=600,height=700")`
3. Ecoute `window.addEventListener("message", handler)` pour le message `"linkedin-connected"`
4. Fallback : poll `popup.closed` toutes les secondes, puis appelle `GET /api/linkedin/status`

### 7. `client/src/pages/PostDetail.tsx` — Bouton publish

- Bouton bleu "Publish on LinkedIn" en bas de la page
- Appelle `POST /api/posts/:id/publish`
- Affiche une banniere verte avec lien si publie, ou erreur rouge si echec

---

## Probleme a diagnostiquer

L'utilisateur dit "impossible de se connecter a LinkedIn" au moment du click sur "Connect LinkedIn" dans Settings. Les causes possibles :

1. **Le `GET /api/linkedin/auth` echoue** — keytar ne trouve pas `linkedin_client_id` dans le Keychain. Verifier que la commande `security find-generic-password -s linkdup -a linkedin_client_id -w` retourne bien une valeur.

2. **La popup est bloquee** — `window.open()` peut etre bloque par le navigateur. Verifier dans la console du navigateur.

3. **L'URL OAuth est malformee** — verifier que le `client_id` dans l'URL est correct et que le `redirect_uri` encode correspond exactement a celui configure sur developer.linkedin.com.

4. **LinkedIn rejette le callback** — le redirect URI dans l'app LinkedIn doit etre EXACTEMENT `http://localhost:3000/api/linkedin/callback`. Attention : si le frontend tourne sur port 5173 et que la popup s'ouvre, LinkedIn redirigera vers port 3000 (le backend Express) — c'est correct car le callback est une route Express, pas une page React.

5. **Le token exchange echoue** — verifier les logs du serveur Express dans le terminal apres le redirect.

6. **keytar ne fonctionne pas** — sur certaines versions de macOS, keytar peut avoir des problemes. Tester : `node -e "import('keytar').then(k => k.default.getPassword('linkdup','linkedin_client_id').then(console.log))"`

---

## Etapes de debug recommandees

1. **Lancer le backend** : `cd /Users/benoitricard/Projects/linkdup && npm run dev`
2. **Lancer le frontend** : dans un autre terminal, `cd /Users/benoitricard/Projects/linkdup && npm run dev:client`
3. **Ouvrir http://localhost:5173 → Settings**
4. **Ouvrir la console du navigateur (DevTools)** avant de cliquer "Connect LinkedIn"
5. Cliquer "Connect LinkedIn" et observer :
   - La requete `GET /api/linkedin/auth` dans l'onglet Network — reponse 200 avec `{ url: "..." }` ?
   - La popup s'ouvre-t-elle ? Avec quelle URL ?
   - Erreur dans la console JS ?
   - Logs dans le terminal du serveur Express ?
6. Si la popup s'ouvre et redirige vers LinkedIn, se connecter et autoriser
7. Observer le callback : le navigateur arrive-t-il sur `/api/linkedin/callback?code=...` ?
8. Verifier les logs serveur pour le token exchange

---

## Schema DB pertinent (deja en place)

```sql
-- Table posts (champs LinkedIn)
linkedin_post_url TEXT,
linkedin_post_id TEXT,
publish_error TEXT,
first_comment_posted INTEGER DEFAULT 0,

-- Table publish_log
CREATE TABLE publish_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id),
  action TEXT NOT NULL,
  status TEXT,
  response_body TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Ce qui doit fonctionner a la fin

1. **Settings** : cliquer "Connect LinkedIn" → popup OAuth LinkedIn → autoriser → popup se ferme → statut passe a "Connected as [Nom]"
2. **PostDetail** : sur un post avec `final_version` rempli → cliquer "Publish on LinkedIn" → post publie → banniere verte avec lien vers le post LinkedIn
3. Le premier commentaire est poste automatiquement si le champ `first_comment` est rempli
4. Les images sont uploadees si `image_path` est rempli

---

## Regles

- Ne pas toucher aux fichiers qui ne sont pas lies a cette feature
- Ne pas ajouter de dependances npm sauf si absolument necessaire
- Les credentials ne doivent JAMAIS etre en clair dans le code — tout passe par keytar/Keychain
- Tester chaque fix avant de passer au suivant
