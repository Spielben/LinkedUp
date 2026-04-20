# Brief Cursor : Bugs d'ingestion contenus (PDF + Article)

## Contexte projet

LINK'DUP est un outil self-hosted (Express 5 + React + Vite + SQLite) de generation de contenu LinkedIn. La page **Contenus** permet d'ajouter des sources (URL Web, YouTube, PDF, Article, Podcast) qui seront ensuite "ingerees" : le contenu brut est extrait puis resume par Claude (via OpenRouter) pour servir de base a la generation de posts.

**Stack** :
- Backend : `src/routes/contenus.ts`, `src/services/content-ingestion.ts`
- Frontend : `client/src/pages/ContenusList.tsx`
- DB : SQLite, table `contenus` (champs : `id, name, description, url, type, pdf_path, content_raw, summary, status`)
- Run : `npm run dev` (lance API + Vite)

---

## Symptomes rapportes par l'utilisateur

1. **Upload PDF** : erreur lors de l'upload d'un nouveau PDF
2. **PDF en attente** : un PDF est bloque en statut `pending` et l'ingest ne fonctionne pas
3. **Article depuis Google Drive** : l'ingest echoue
4. Question utilisateur : *"Est-ce que le modele sait quoi faire ?"*

**Reponse a la question** : non, le modele OpenRouter n'est jamais appele parce que l'extraction de contenu (etape 1 de l'ingest) echoue avant. Il faut corriger l'extraction.

---

## Diagnostic des bugs (deja fait, a ne pas re-investiguer)

### BUG 1 — Upload PDF cote frontend lit le binaire en texte UTF-8

**Fichier** : `client/src/pages/ContenusList.tsx` lignes 47-49

```tsx
if (formData.file) {
  const text = await formData.file.text();  // ❌ casse les PDF/docx
  await createContenu({ name: formData.name, description: formData.description, type: formData.type, content_raw: text });
}
```

`File.text()` lit le binaire en UTF-8. Pour un PDF, on obtient des caracteres corrompus stockes dans `content_raw`, jamais utilisables. Idem pour `.docx`. Seuls `.txt` / `.md` / `.html` fonctionnent vaguement.

### BUG 2 — Pas d'endpoint backend pour upload de fichier

**Fichier** : `src/routes/contenus.ts` ligne 21-28

```ts
contenusRouter.post("/", (req, res) => {
  const { name, description, url, type, content_raw } = req.body;
  // accepte uniquement du JSON, pas de multipart
});
```

Il n'y a aucun endpoint qui accepte `multipart/form-data` pour sauvegarder le fichier sur disque et remplir `pdf_path`. Donc meme si on uploadait correctement, le backend n'a aucun moyen de stocker le fichier.

Note : `multer` est deja installe (`package.json`), il est utilise ailleurs dans le code (verifier `src/routes/posts.ts` ou `src/services/post-media.ts` qui vient d'etre cree pour les images de posts LinkedIn — il y a peut-etre un pattern reutilisable).

### BUG 3 — Bouton "Ingest" cache pour les PDF

**Fichier** : `client/src/pages/ContenusList.tsx` ligne 237

```tsx
{c.url && !c.summary && (
  <button onClick={() => handleIngest(c.id)}>Ingest</button>
)}
```

Le bouton n'apparait que si `c.url` est present. Pour un PDF/Article uploade, il n'y a pas de URL → impossible de declencher l'ingest depuis l'UI. L'utilisateur est bloque.

### BUG 4 — `fetchPdfContent` crash si `pdf_path` est vide

**Fichier** : `src/routes/contenus.ts` ligne 75-76

```ts
} else if (type === "PDF" || pdf_path) {
  content_raw = await fetchPdfContent(pdf_path || "");  // ❌ readFileSync("")
}
```

**Fichier** : `src/services/content-ingestion.ts` ligne 64-70

```ts
export async function fetchPdfContent(filePath: string): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
  const buffer = readFileSync(filePath);  // ❌ ENOENT si filePath=""
  const data = await pdfParse(buffer);
  return data.text.replace(/\s+/g, " ").trim();
}
```

Comme le bug 2 fait que `pdf_path` n'est jamais rempli, ici on tombe sur `readFileSync("")` → ENOENT. C'est probablement l'erreur 500 que voit l'utilisateur sur le PDF en attente.

### BUG 5 — Google Drive : URL viewer au lieu du contenu

L'utilisateur a colle une URL Google Drive (`https://drive.google.com/file/d/.../view` ou `https://docs.google.com/document/d/.../edit`). `fetchWebContent` (`content-ingestion.ts:4-41`) recupere le HTML de la page viewer, qui ne contient pas le contenu du document. Il faut soit :
- Detecter les URLs Google Drive/Docs et les transformer en URLs d'export
  - Drive file : `https://drive.google.com/uc?export=download&id={ID}`
  - Google Doc : `https://docs.google.com/document/d/{ID}/export?format=txt`
  - Google Slides : `https://docs.google.com/presentation/d/{ID}/export/txt`
- Ou expliquer a l'utilisateur qu'il doit telecharger puis uploader

Approche recommandee : detection automatique + transformation en URL d'export `text/plain`, sans authentification (le doc doit etre partage publiquement).

### BUG 6 (mineur) — pdf-parse ESM compat

`pdf-parse` est une lib CommonJS qui ne joue pas toujours bien avec ESM. Le `(pdfParseModule as any).default ?? pdfParseModule` est un patch fragile. A tester : si le import dynamique echoue dans `tsx`, considerer remplacer par `pdfjs-dist` (officiel Mozilla, ESM natif). Mais commencer par essayer de faire marcher pdf-parse — c'est peut-etre OK.

---

## Etat actuel a verifier au demarrage

1. **Lire le PDF en pending** dans la DB :
   ```bash
   sqlite3 data/linkdup.db "SELECT id, name, type, pdf_path, length(content_raw), status FROM contenus WHERE status='pending';"
   ```
2. **Voir les logs serveur** quand on clique Ingest sur ce PDF (`npm run dev` puis declencher depuis l'UI)
3. **Verifier si `data/uploads/` ou `data/contenus/` existe deja** — sinon il faudra le creer dans le code

---

## Solution attendue (specifications detaillees)

### Etape 1 — Backend : endpoint d'upload de fichier

Creer un endpoint `POST /api/contenus/upload` qui :
- Accepte `multipart/form-data` avec champs : `name`, `description`, `type` (`PDF` | `Article`), `file`
- Sauvegarde le fichier dans `data/contenus/<id>/<filename>` (cree le dossier si besoin)
- Pour les PDF : stocke le path absolu/relatif dans `pdf_path`
- Pour les Articles (`.txt`, `.md`, `.html`, `.docx`) : stocke aussi dans `pdf_path` (renommer en `file_path` serait mieux mais ca casse la DB — garder `pdf_path` pour eviter une migration, OU ajouter une colonne `file_path TEXT` via migration dans `src/db/index.ts`)
- Retourne le record cree (avec `id`)

Utiliser `multer` (deja installe). Regarder `src/services/post-media.ts` (cree dans le commit precedent) pour le pattern d'upload local — il fait quelque chose de similaire pour les images LinkedIn.

**Limites** : taille max 20 MB, mime types whitelistes (`application/pdf`, `text/plain`, `text/html`, `text/markdown`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).

### Etape 2 — Backend : extraction multi-format

Dans `src/services/content-ingestion.ts`, ajouter une fonction `extractFileContent(filePath: string)` qui dispatch selon l'extension :
- `.pdf` → `fetchPdfContent` existant (mais avec garde-fou : verifier que le file existe avant `readFileSync`)
- `.txt`, `.md`, `.html` → `readFileSync(filePath, "utf-8")` (pour `.html`, passer dans cheerio comme `fetchWebContent` pour stripper les tags)
- `.docx` → utiliser `mammoth` (a installer : `npm i mammoth`) — c'est le standard pour extraire du texte de docx

Dans `src/routes/contenus.ts` ingest endpoint, remplacer la branche PDF par un appel a `extractFileContent(pdf_path)`.

**Garde-fou** : valider que `pdf_path` existe et est sous `data/` avant d'ouvrir (anti path traversal).

### Etape 3 — Backend : Google Drive / Docs URL handling

Dans `src/services/content-ingestion.ts`, avant `fetchWebContent`, ajouter une fonction `transformGoogleDriveUrl(url: string): string | null` qui :
- Detecte les patterns Google Drive / Docs / Slides / Sheets
- Extrait l'ID du document via regex
- Retourne l'URL d'export `text/plain` correspondante
- Retourne `null` si ce n'est pas une URL Google

Dans la fonction `fetchWebContent` (ou dans le routing du `ingest` endpoint), si `transformGoogleDriveUrl(url)` retourne une URL, l'utiliser a la place de l'URL originale.

**Patterns a detecter** :
```
docs.google.com/document/d/{ID}/...     → /export?format=txt
docs.google.com/presentation/d/{ID}/... → /export/txt
docs.google.com/spreadsheets/d/{ID}/... → /export?format=csv
drive.google.com/file/d/{ID}/...        → uc?export=download&id={ID}
```

Pour les fichiers Drive (PDF), apres download, detecter le content-type et soit parser le PDF soit retourner le texte brut.

**Limite connue** : ne fonctionne que si le document est partage publiquement ("Anyone with the link"). Si `403`, retourner une erreur claire a l'utilisateur : *"Document Google Drive non public. Partagez-le en lecture publique ou telechargez-le et uploadez le fichier."*

### Etape 4 — Frontend : utiliser FormData pour les uploads

Dans `client/src/pages/ContenusList.tsx`, refactorer `handleCreateSubmit` :

```tsx
const handleCreateSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!formData.name.trim()) return;

  if (formData.file) {
    // Upload via multipart
    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("description", formData.description);
    fd.append("type", formData.type);
    fd.append("file", formData.file);

    const res = await apiFetch("/api/contenus/upload", { method: "POST", body: fd });
    if (!res.ok) {
      // afficher l'erreur
      return;
    }
    await fetchContenus();
  } else {
    await createContenu({ name: formData.name, description: formData.description, url: formData.url, type: formData.type });
  }
  setFormData({ name: "", description: "", url: "", type: "Web", file: null });
  setShowForm(false);
};
```

**Important** : ne pas mettre de `Content-Type` header manuellement — le navigateur le fait avec le boundary multipart.

### Etape 5 — Frontend : afficher le bouton Ingest pour les PDF/Article

Dans `client/src/pages/ContenusList.tsx` ligne 237, changer la condition :

```tsx
{(c.url || c.pdf_path) && !c.summary && (
  <button ...>Ingest</button>
)}
```

Le store `client/src/stores/contenus.ts` doit exposer `pdf_path` dans le type `Contenu` — a verifier et ajouter si manquant.

### Etape 6 — UX : feedback d'erreur clair sur l'upload

L'erreur d'upload doit s'afficher comme `ingestError` (banniere rouge en haut de la liste), pas en silence. Reutiliser le pattern existant.

---

## Tests manuels a faire avant de declarer "fixe"

1. **Upload PDF** : creer un contenu type PDF avec un vrai PDF (1-3 pages), verifier que `pdf_path` est rempli en DB et que le fichier existe sous `data/contenus/<id>/`
2. **Ingest PDF** : cliquer "Ingest" sur le PDF, verifier que `content_raw` contient du texte lisible et que `summary` est genere par OpenRouter (status passe a `generated`)
3. **Upload .txt / .md** : meme test que PDF
4. **Upload .docx** : si mammoth est installe, meme test
5. **Google Doc public** : creer un contenu type Web avec une URL `docs.google.com/document/d/.../edit`, ingest, verifier que le contenu du doc est extrait
6. **Google Doc prive** : meme chose mais doc non partage → erreur claire
7. **PDF deja en pending** : nettoyer la DB de l'enregistrement casse au prealable :
   ```bash
   sqlite3 data/linkdup.db "DELETE FROM contenus WHERE status='pending' AND content_raw IS NOT NULL AND length(content_raw) > 0 AND pdf_path IS NULL;"
   ```

---

## Regles a respecter

- **Pas de breaking changes** sur le schema SQLite — utiliser le pattern de migration `try { ALTER TABLE ... } catch {}` deja en place dans `src/db/index.ts`
- **Pas de credentials en clair** — n/a pour cette feature mais regle generale du projet
- **Pas de path traversal** — toujours verifier que les paths uploades sont sous `data/`
- **Limites de taille** sur les uploads (20 MB max)
- **Whitelist de mime types** — refuser tout ce qui n'est pas dans la liste
- **Une nouvelle dependance maximum** (`mammoth` pour .docx) — sinon prefere garder le scope minimal
- **Tester chaque fix individuellement** avant de passer au suivant

---

## Fichiers que tu vas toucher

| Fichier | Action |
|---|---|
| `src/routes/contenus.ts` | Ajouter endpoint `/upload`, ameliorer `/ingest` |
| `src/services/content-ingestion.ts` | Ajouter `extractFileContent`, `transformGoogleDriveUrl`, garde-fous |
| `src/db/index.ts` | (optionnel) migration pour `file_path` si tu choisis d'ajouter une colonne |
| `client/src/pages/ContenusList.tsx` | Refacto upload avec FormData, condition bouton Ingest |
| `client/src/stores/contenus.ts` | Ajouter `pdf_path` au type si manquant |
| `package.json` | (peut-etre) ajouter `mammoth` |

---

## Reference : structure de la DB

```sql
CREATE TABLE contenus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  type TEXT,           -- "Web" | "YouTube" | "PDF" | "Article" | "Podcast"
  pdf_path TEXT,       -- chemin local du fichier uploade (PDF + Articles)
  content_raw TEXT,    -- texte extrait
  summary TEXT,        -- resume genere par Claude
  status TEXT DEFAULT 'pending',  -- "pending" | "generated"
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Reference : architecture du repo

```
linkdup/
├── src/
│   ├── routes/
│   │   ├── contenus.ts         ← bug ici
│   │   ├── posts.ts
│   │   └── ...
│   ├── services/
│   │   ├── content-ingestion.ts ← bug ici
│   │   ├── openrouter.ts
│   │   ├── post-media.ts        ← pattern d'upload a reutiliser
│   │   └── linkedin.ts
│   ├── db/
│   │   ├── index.ts             ← migrations SQL
│   │   └── schema.ts
│   └── server.ts
├── client/
│   └── src/
│       ├── pages/
│       │   └── ContenusList.tsx ← bug ici
│       ├── stores/
│       │   └── contenus.ts
│       └── lib/
│           ├── api.ts           ← apiFetch helper
│           └── post-media.ts
└── data/
    ├── linkdup.db
    ├── images/
    └── contenus/                ← a creer
```

---

## Resume executif

L'utilisateur ne peut pas ingerer de PDF ni d'article Google Drive parce que :
1. Le frontend lit les fichiers binaires en UTF-8 (corruption)
2. Le backend n'a pas d'endpoint d'upload multipart
3. Le bouton Ingest est cache pour les sources sans URL
4. Google Drive renvoie le HTML viewer au lieu du contenu

Les 6 bugs listes ci-dessus doivent etre corriges en suivant les etapes 1 a 6 dans l'ordre. Le modele OpenRouter est OK — il n'est juste jamais appele parce que l'extraction echoue avant.
