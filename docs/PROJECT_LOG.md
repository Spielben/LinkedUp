# LinkedUp — project log

Chronological session handoffs (Cursor). Linear hub: [LIN-40](https://linear.app/linkdup/issue/LIN-40/session-log-linkedup-cursor).

---

## 2026-05-17 15:05 (Asia/Bangkok)

**Project:** linkdup (LinkedUp)  
**Scope:** Config session handoff (Linear + log local) + fix upload PDF brand identity

### Actions completed
- Skill globale `~/.cursor/skills/session-handoff/` pour log fin de session (tous projets Cursor)
- Création `.cursor/session-log.json` → projet Linear **LINKDUP**, issue **LIN-40**
- Issue Linear récurrente **Session log — LinkedUp (Cursor)** créée
- Fix extraction PDF : `pdf-parse` / `require` remplacé par `pdfjs-dist` dans `src/routes/settings.ts` (patch VPS sur `dist/` en attente de rebuild propre)

### Files touched
- `.cursor/session-log.json` — config Linear
- `docs/PROJECT_LOG.md` — ce fichier (créé)
- `src/routes/settings.ts` — extraction PDF via pdfjs-dist

### Bugs found
- Upload PDF Settings : `require is not defined` (ESM + ancien `dist/` sur VPS)
- Build Docker VPS : cache + `settings.ts` corrompu par tentative `cat` dans nano

### Fixes applied
- Code source : `pdfjs-dist` direct
- VPS : patch Python sur `dist/src/routes/settings.js` (temporaire jusqu’à rebuild)

### Blockers / open questions
- Rebuild Docker linkdup sur VPS avec code source à jour (`/root/linkdup`) sans recasser `settings.ts`

### Last stable state
- PDF brand identity upload OK après patch container
- Session logging configuré (local + LIN-40)

### Next recommended action
- `git pull` + `docker compose build --no-cache linkdup` sur VPS depuis `/root/linkdup` une fois le repo aligné

---

## 2026-05-17 15:15 (Asia/Bangkok)

**Project:** linkdup (LinkedUp)  
**Scope:** Clôture session — handoff + commit config logging

### Actions completed
- Log session demandé par Ben : entrée Linear sur LIN-40 + ce fichier
- Commit sur `main` : `.cursor/session-log.json`, `docs/PROJECT_LOG.md`

### Files touched
- `docs/PROJECT_LOG.md` — entrée de clôture
- `.cursor/session-log.json` — (commit)

### Bugs found
- (aucun nouveau dans cette micro-étape)

### Fixes applied
- —

### Blockers / open questions
- VPS : `settings.ts` source peut être corrompu si édité via nano ; préférer sync git depuis Mac

### Last stable state
- Upload PDF brand identity fonctionne (patch container)
- Logging Cursor → `docs/PROJECT_LOG.md` + commentaires LIN-40

### Next recommended action
- Sur VPS : récupérer `main` dans `/root/linkdup`, rebuild `linkdup` sans cache
