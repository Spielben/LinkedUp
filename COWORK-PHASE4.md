# LINK'DUP — Phase 4: Data Import, UX Polish & LinkedIn History

> Prompt pour Claude Code Co-work. Session autonome.
> Working directory : ~/Projects/linkdup/

---

## RULES (same as Phase 3)

1. **COMMIT after EACH completed task** — not at the end.
2. **Priority order is strict** — if quota runs out, most important tasks are done.
3. **Economy of context** — targeted Edits, no full rewrites, short responses.
4. **If a task blocks** — commit what's done, leave TODO, move on.
5. **No proprietary names** — grep for "KONTENU" before each commit, remove any found.
6. **No keys in files** — credentials via `getCredential()` from Keychain only.
7. **Follow existing patterns** — Express routes, Zustand stores, Tailwind classes.

---

## CONTEXT

Phase 1-3 complete: Express backend, React/Vite frontend, SQLite DB, OpenRouter AI generation.
Phase 4 = import real data, polish UX, add LinkedIn post history.

### CSV data files (in ~/Downloads/)

**Styles CSV** — `🎨 Style-Mes styles.csv` (14 rows)
Columns: `Nom, URL Profil Linkedin, Générer style, Instructions, Exemples, 📝 Posts, 👤 Profil, Email`
Mapping to DB:
- Nom → name
- URL Profil Linkedin → linkedin_url
- Générer style → status (map "Généré" → "generated", else "pending")
- Instructions → instructions
- Exemples → examples
- Skip: 📝 Posts, 👤 Profil, Email (Airtable relational/lookup fields)

**Templates CSV** — `🗂️ Template-Grid view.csv` (58 rows)
Columns: `Nom, Description, Post Linkedin, Générer Template, Auteur, Catégorie, Image, Exemple, Template, Likes, Commentaires, Partages, Date de publication, 👤 Profil`
Mapping to DB:
- Nom → name
- Description → description
- Post Linkedin → linkedin_post_url
- Auteur → author
- Catégorie → category
- Image → image_url (Airtable attachment URL — may expire, store as-is for now)
- Exemple → example_text
- Template → template_text
- Likes → likes (parse integer)
- Commentaires → comments (parse integer)
- Partages → shares (parse integer)
- Date de publication → publication_date
- Skip: Générer Template, 👤 Profil (relational)
- NOTE: Row 1 after header appears to be the only real first row. There are some duplicates — deduplicate by linkedin_post_url.

**Contenus CSV** — `📚 Contenu-Toutes les ressources.csv` (53 rows)
Columns: `Nom, Description, URL (web ou youtube), PDF, Type, Générer Contenu, Contenu, Résumé, Instructions, # Utilisation, 📝 Posts, 👤 Profil`
Mapping to DB:
- Nom → name
- Description → description
- URL (web ou youtube) → url
- Type → type
- Contenu → content_raw
- Résumé → summary
- Générer Contenu → status (map "Généré" / has summary → "generated", else "pending")
- Skip: PDF (empty), Instructions (Airtable formula), # Utilisation, 📝 Posts, 👤 Profil
- NOTE: First data row is a header echo (Nom="Nom") — skip it.

### Assets

- Spielben & Co. logo: `client/public/spielben-logo.png` (already copied)
- LinkedIn profile: https://www.linkedin.com/in/ben-spielben/
- Apify key: stored in macOS Keychain under service "linkdup", account "apify"

---

## TASK 1 — Remove all proprietary name references (PRIORITY)

Grep for "KONTENU" in all source files (not COWORK-*.md plan docs).
- `client/src/lib/linkedin-chars.ts` — ALREADY DONE
- Any other occurrences → replace with neutral language
- Commit: `chore: remove all proprietary system references`

---

## TASK 2 — Schema migration: settings + linkedin_posts

### Settings table — add columns:
```sql
ALTER TABLE settings ADD COLUMN language TEXT DEFAULT 'fr';
ALTER TABLE settings ADD COLUMN preferred_post_days TEXT;  -- comma-separated: "1,3,5" (0=Sun..6=Sat)
ALTER TABLE settings ADD COLUMN preferred_post_time TEXT;  -- "09:00" format
```
- Keep `budget_limit` but relabel in UI as "Monthly AI Budget (USD)" with helper text "OpenRouter monthly spend cap"

### New table — linkedin_posts:
```sql
CREATE TABLE IF NOT EXISTS linkedin_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT,
  published_date TEXT,
  linkedin_url TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  source TEXT DEFAULT 'import',  -- 'import', 'apify', 'manual'
  created_at TEXT DEFAULT (datetime('now'))
);
```

Run migrations on startup in `src/db/index.ts` (ALTER TABLE wrapped in try/catch for idempotency).

Commit: `feat: schema migration — settings fields, linkedin_posts table`

---

## TASK 3 — CSV import backend

### Create `src/routes/import.ts`

```
POST /api/import/csv
```

Accept multipart form data (use `multer` or parse raw body).
- Body: `{ table: "styles" | "templates" | "contenus", file: <CSV file> }`
- Parse CSV using a lightweight parser (split by comma with quote handling, or install `csv-parse` — but prefer no new dependency, use a simple parser)
- Apply the column mapping defined above for each table
- Insert rows with `INSERT OR IGNORE` (deduplicate by name for styles, by linkedin_post_url for templates, by name for contenus)
- Return: `{ imported: number, skipped: number, total: number }`

Mount in server.ts: `app.use("/api/import", importRouter)`

Alternative simpler approach: since CSVs are on disk, create a seed-like route:
```
POST /api/import/seed-csv
Body: { table: "styles" | "templates" | "contenus" }
```
Read directly from `~/Downloads/` — simpler for dev, but add file upload support too for the UI.

**Preferred approach: file upload via frontend** — install `multer` for Express multipart handling.

Commit: `feat: CSV import route with field mapping`

---

## TASK 4 — Settings page upgrade (frontend)

In `client/src/pages/Settings.tsx`:
1. **Language dropdown** — options: Français, English, Español, Deutsch, Português, Italiano, Nederlands
   - This is HIGH PRIORITY — used to set the AI prompt language
   - Store as ISO code: fr, en, es, de, pt, it, nl
2. **Monthly AI Budget** — keep the field, relabel with helper text "OpenRouter spend cap"
3. **Preferred posting days** — checkbox grid (Mon-Sun)
4. **Preferred posting time** — time input (HH:MM)
5. Update the SettingsData interface and save/load logic

Commit: `feat: settings — language, posting schedule, budget relabel`

---

## TASK 5 — Styles list UX: preview, delete, proper form

In `client/src/pages/StylesList.tsx`:
1. **Click on style card → expand** to show full instructions text (collapsible, not a modal)
2. **Delete button** on each card — confirm dialog → `DELETE /api/styles/:id`
3. **"+ New Style" button** → opens inline form (not `prompt()`) with fields:
   - Name (required)
   - LinkedIn URL (optional)
   - Examples (textarea — paste LinkedIn posts here)
4. Add `remove` to styles Zustand store if not already there

Commit: `feat: style preview, delete, and creation form`

---

## TASK 6 — Templates list UX: preview, delete, proper form, grid layout

In `client/src/pages/TemplatesList.tsx`:
1. **Grid layout** (like a card grid, not a list) — 2-3 columns
2. **Each card shows**: name (truncated), category badge, author, likes/comments count, image thumbnail if available
3. **Click on card → expand/modal** showing:
   - Full example_text (the actual LinkedIn post)
   - template_text (the structure)
   - Engagement stats
   - LinkedIn post link
4. **Delete button** on each card
5. **"+ New Template"** button → form with fields: Name, Description, Author, Category (dropdown), LinkedIn Post URL, Example text, Template text
6. Add `remove` and `create` to templates Zustand store

Commit: `feat: template grid, preview, delete, and creation form`

---

## TASK 7 — Contenus list UX: preview, delete, proper form

In `client/src/pages/ContenusList.tsx`:
1. **Click on card → expand** to show full summary, content_raw (collapsible)
2. **Delete button** on each card
3. **"+ New Content"** button already exists but uses `prompt()` → replace with inline form:
   - Name (required)
   - Description (optional)
   - URL (optional)
   - Type dropdown: YouTube, Web, PDF, Article, Podcast
4. Add `remove` to contenus Zustand store if not already there

Commit: `feat: content preview, delete, and creation form`

---

## TASK 8 — Dashboard: clickable status links

In `client/src/pages/Dashboard.tsx`:
- Make each status count ("2 drafts", "1 published", etc.) a clickable link
- Navigate to `/posts?status=Brouillon` (or Publié, Programmé, Idée)

In `client/src/pages/PostsList.tsx`:
- Read `?status=` from URL params
- Filter displayed posts by status when param is present
- Show a "clear filter" button when filtered

Commit: `feat: dashboard status links filter posts list`

---

## TASK 9 — Spielben & Co. logo in sidebar

In `client/src/App.tsx`:
- Add logo image in sidebar header, above or replacing the "LINK'DUP" text
- `<img src="/spielben-logo.png" alt="Spielben & Co." className="h-10 w-auto" />`
- Keep "LINK'DUP" as subtitle or below the logo
- The logo is white text on dark circle — works well on white sidebar background

Commit: `feat: Spielben & Co. logo in sidebar`

---

## TASK 10 — LinkedIn post history (import + display)

### Option A — LinkedIn data export (CSV/JSON from LinkedIn)
- When user receives the export, parse the posts file
- Route: `POST /api/linkedin-posts/import` — accepts the LinkedIn export file
- Parse and insert into `linkedin_posts` table

### Option B — Apify scraper
- Route: `POST /api/linkedin-posts/scrape`
- Use Apify LinkedIn Profile Scraper actor (actor ID: `curious_coder/linkedin-profile-scraper` or `anchor/linkedin-scraper`)
- Read API key via `getCredential("apify")`
- Call Apify API: start actor run → wait for dataset → fetch results
- Parse posts from results → insert into `linkedin_posts` table
- LinkedIn profile URL: read from settings.linkedin_url

### Frontend — new page `client/src/pages/LinkedInHistory.tsx`
- Add to sidebar nav in App.tsx: "LinkedIn" with route `/linkedin`
- **Grid layout** (2-3 columns of cards)
- Each card: post text (truncated ~200 chars), published date, engagement stats (likes, comments)
- Click card → expand to full text
- Import button: "Import from file" (file picker) + "Scrape from LinkedIn" (calls Apify)
- Show import status/progress

### Zustand store: `client/src/stores/linkedin-posts.ts`
- fetch, importFile, scrape actions

Commit: `feat: LinkedIn post history page with import and Apify scraping`

---

## TASK 11 — CSV import UI on list pages

On Styles, Templates, and Contenus pages:
- Add an "Import CSV" button next to the "+ New" button
- Click → file input picker (accept .csv)
- On file select → upload to `POST /api/import/csv` with table name
- Show result toast: "Imported X rows, skipped Y"
- Re-fetch the list

Commit: `feat: CSV import buttons on styles, templates, contenus pages`

---

## TASK 12 — Test onboarding flow

Run `npx tsx src/onboarding.ts` (or however it's invoked).
- Verify it prompts for OpenRouter key
- Verify it prompts for Apify key (optional)
- Fix any issues found

Commit: `fix: onboarding flow` (if needed)

---

## FINAL CHECKS

1. `DEV=1 npx tsx src/cli.ts` starts without error
2. `npx vite --config client/vite.config.ts` starts without error
3. Import CSVs work (styles, templates, contenus)
4. All list pages show grid/cards with preview, delete, create
5. Settings save/load with new fields
6. Dashboard status links navigate correctly
7. Logo displays in sidebar
8. No "KONTENU" references remain in source code
