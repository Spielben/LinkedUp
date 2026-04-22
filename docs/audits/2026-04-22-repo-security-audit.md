# Repo Security Audit & Cleanup — Session Log

**Date:** 2026-04-22
**Linear:** [LIN-27](https://linear.app/linkdup/issue/LIN-27/security-audit-and-repo-cleanup-paused-before-git-history-rewrite)
**Status:** Paused before git history rewrite

---

## Scope
Full audit of `/Users/benoitricard/Projects/linkdup`:
1. Identify irrelevant files cluttering the repo
2. Identify security breaches / exposure risks

---

## Root causes identified

### 🔴 Critical — tarball with PII committed to public repo
Commit `f62e188` ("fix: correct environment variable handling…") accidentally included `linkdup-data.tar.gz` (14 MB). The file was later deleted from the working tree but remains in git history.

Remote is **public**: `github.com/Spielben/LinkedUp.git` → the data was publicly downloadable since 2026-04-18.

Tarball contents (verified):
- Full SQLite DB with PII (name, LinkedIn URL, signature, post content)
- 90+ post images
- `contenus/62/creative_producer_feature_film.pdf` (CV)
- `data/.claude/settings.local.json`

**Good:** DB schema at time of commit predated the `linkedin_tokens` column → no OAuth tokens leaked.

### 🟡 Medium — CORS middleware in prod
`src/server.ts` applied CORS on every request unconditionally. In production the UI is served by the same Express, so CORS is unnecessary and opened LAN-scoped cross-origin access. Fixed.

### 🟡 Medium — 50 MB JSON body limit globally
`src/server.ts:57` — `express.json({ limit: "50mb" })` is a DoS vector on non-upload routes. **Not yet fixed.**

### 🟡 Medium — no rate limiting
No middleware on public endpoints including `/api/linkedin/callback`. **Not yet fixed.**

### 🟢 Low — clutter
- 9 stale task briefs in repo root (`COWORK-*`, `CURSOR-BRIEF-*`)
- 3 overlapping install guides (`INSTALL.md`, `INSTALL-EN.md`, `INSTALL-FR.md`)
- Empty orphan `.secrets.baseline`

---

## Implementation so far

| # | Action | Commit | Verified |
|---|--------|--------|----------|
| 1 | `rm .secrets.baseline` | — | `git status` clean |
| 2 | `git mv` 9 briefs → `docs/archive/` | `3a323b1` | rename detection kept history |
| 3 | Wrap CORS middleware in `if (isDev)` | `8445880` | `npx tsc --noEmit` passes |
| 4 | Delete `linkdup-data.tar.gz` from working tree | `8445880` | — |

---

## Remaining steps (to resume)

### 1. Install git-filter-repo
```bash
brew install git-filter-repo
```

### 2. Backup the repo before rewriting
```bash
cd /Users/benoitricard/Projects
cp -R linkdup linkdup-backup-20260422
```

### 3. Delete stale `vps` branch
Verified: `vps` has **0 commits unique** to it (fully merged into `main`), points at the exact tarball commit `f62e188`.
```bash
git branch -D vps
git push origin --delete vps
```

### 4. Rewrite history
```bash
git filter-repo --path linkdup-data.tar.gz --invert-paths --force
```

### 5. Restore remote (filter-repo removes it)
```bash
git remote add origin https://github.com/Spielben/LinkedUp.git
git push --force --all
git push --force --tags
```

### 6. Post-rewrite hygiene
- Contact GitHub Support to purge cached views + dangling commits (SHA `f62e188` will remain reachable via direct URL for ~90 days otherwise)
- Consider making the repo **private** if public visibility isn't required
- Rotate any tokens that *could* have been in scope during the public window (defensive)
- Warn collaborators (Nawel) to re-clone — their local copies will be invalidated

### 7. Medium-priority fixes
- Tighten `express.json` global limit to 1 MB, override per-route for uploads
- Add rate limiting to public endpoints (`express-rate-limit`)
- Consolidate INSTALL docs

---

## Rollback plan

If `filter-repo` goes wrong or the force-push breaks something:

```bash
# Local recovery
cd /Users/benoitricard/Projects
rm -rf linkdup
mv linkdup-backup-20260422 linkdup
cd linkdup
# Remote already has old refs; nothing to do if you haven't pushed yet
```

If the force-push already landed and broke it, the backup can push old refs back:
```bash
cd linkdup-backup-20260422
git push --force --all
```

---

## Decisions made during session
- **2026-04-20** Authorized the audit scope
- **2026-04-22** Authorized the history rewrite, acknowledged public-exposure risk
- **2026-04-22** Session paused before destructive operation

## Evidence / references
- Audit commit range on `main`: `3a323b1..4385ce2`
- `vps` branch: local + remote point at `f62e188`
- Tarball size in history: 14,020,884 bytes (verified via `git cat-file -s f62e188:linkdup-data.tar.gz`)
