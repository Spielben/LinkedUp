# Releasing LINK'DUP

Step-by-step for maintainers when publishing a new version (Git tag + GitHub Release).

## 1. Prepare the code

1. On `main` (or your release branch), merge what you want in this release.
2. Update **[CHANGELOG.md](CHANGELOG.md)**:
   - Move items from `[Unreleased]` into a new section `## [X.Y.Z] — YYYY-MM-DD`.
   - Leave `[Unreleased]` empty (or with placeholder subsections).
3. Bump **`version`** in [package.json](package.json) to match `X.Y.Z` (semver: `MAJOR.MINOR.PATCH`).
4. Commit, for example:

   ```bash
   git add CHANGELOG.md package.json package-lock.json
   git commit -m "chore: release v0.1.1"
   ```

5. Push:

   ```bash
   git push origin main
   ```

## 2. Create a Git tag

Replace `v0.1.1` with your real version (must match `package.json`).

```bash
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
```

To list tags: `git tag -l`

## 3. GitHub Release

1. Open **https://github.com/Spielben/LinkedUp/releases** (adjust if the repo moves).
2. **Draft a new release**.
3. **Choose a tag**: pick `v0.1.1` (create from tag if needed — prefer pushing the tag from step 2 first).
4. **Release title**: `v0.1.1` (or a short title, e.g. `v0.1.1 — Bugfix scrape`).
5. **Description**: copy the section for this version from `CHANGELOG.md` (you can use Markdown).
6. Publish the release.

Optional: attach **built assets** later (e.g. `dist/` zip) — not required for a source-only project.

## 4. First release only (`v0.1.0`)

If `v0.1.0` was never tagged after the initial push:

```bash
git tag -a v0.1.0 -m "v0.1.0 — first public release"
git push origin v0.1.0
```

Then create the GitHub Release from tag `v0.1.0` as in step 3.

## Semver quick reference

| Bump | When |
|------|------|
| **MAJOR** | Breaking changes for users (config, API, DB schema without migration path). |
| **MINOR** | New features, backward compatible. |
| **PATCH** | Bug fixes, small safe changes. |

---

If you automate this later (GitHub Actions), keep this file updated as the human-readable source of truth.
