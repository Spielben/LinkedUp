# Bug: Images LinkedIn ne s'affichent pas dans le frontend

## Probleme

93 images de posts LinkedIn ont ete telechargees localement dans `data/images/` (ex: `post-1.jpg`, `post-10.png`, etc.). La base SQLite (`data/linkdup.db`, table `linkedin_posts`) reference ces images avec des URLs locales comme `/data/images/post-1.jpg`.

**Les images ne s'affichent pas dans le frontend.** Quand on accede a `http://localhost:3000/data/images/post-1.jpg`, on recoit du HTML (le SPA index.html) au lieu de l'image.

## Cause identifiee

La route catch-all SPA dans `src/server.ts` (ligne 44) intercepte TOUTES les requetes GET, y compris `/data/images/*`, et retourne `index.html` :

```ts
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});
```

J'ai tente deux approches qui n'ont pas fonctionne :
1. `app.use("/data/images", express.static(...))` — place avant le catch-all, mais retourne quand meme du HTML
2. `app.get("/data/images/:file", ...)` avec `res.sendFile()` — meme resultat

## Ce qu'il faut faire

1. **Faire fonctionner le serving d'images statiques** dans `src/server.ts` pour que `GET /data/images/post-1.jpg` retourne le fichier JPEG depuis `data/images/post-1.jpg` (relatif a la racine du projet).

2. **S'assurer que le proxy Vite** dans `client/vite.config.ts` transmet `/data/*` au backend (deja ajoute: `"/data": "http://localhost:3000"`).

3. **Verifier** que `http://localhost:5173/data/images/post-1.jpg` (frontend Vite) et `http://localhost:3000/data/images/post-1.jpg` (backend direct) retournent bien l'image.

## Fichiers concernes

- `src/server.ts` — Express server, route catch-all SPA et static serving
- `client/vite.config.ts` — Proxy config Vite
- `client/src/pages/LinkedInHistory.tsx` — Affiche les posts avec `<img src={post.image_url}>` 
- `data/images/` — 93 fichiers images (JPG/PNG/WebP)
- `data/linkdup.db` — Table `linkedin_posts`, colonne `image_url` contient `/data/images/post-{id}.{ext}`

## Stack

- Express 5.2.1
- Vite 6.x (dev server port 5173, proxy vers backend port 3000)
- Node 22, TypeScript, lancé via `DEV=1 npx tsx src/cli.ts`

## Test rapide

```bash
# Backend direct — doit retourner Content-Type: image/jpeg, PAS text/html
curl -sI http://localhost:3000/data/images/post-1.jpg

# Via proxy Vite
curl -sI http://localhost:5173/data/images/post-1.jpg
```
