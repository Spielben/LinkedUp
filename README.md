# LINK'DUP

Self-hosted **LinkedIn content** helper: SQLite, Express API, React UI, optional AI via [OpenRouter](https://openrouter.ai/), LinkedIn OAuth, optional Apify scraping.

## Quick start (development)

```bash
npm install
npm run dev
```

- **UI (hot reload):** http://localhost:5173  
- **API + OAuth callback:** http://localhost:3000  

`npm run dev` is the same as `npm run dev:all` (one terminal, API + Vite). For **first-time interactive onboarding** without hot-reload UI, use `npm run dev:onboard` (API only on :3000, static UI after build).

See [client/.env.example](client/.env.example) if the UI cannot reach the API.

**Advanced / debugging:** `npm run dev:api` (API only, `DEV=1`) and `npm run dev:client` (Vite only) if you prefer two terminals.

Production-style run after build:

```bash
npm run build
npm start
```

(Open http://localhost:3000 — static UI from `dist/client`.)

## Credentials (important)

| Secret | Where it lives | Never commit |
|--------|----------------|--------------|
| OpenRouter, Apify, LinkedIn client id/secret, tokens | **OS credential store** (e.g. macOS Keychain via `keytar`) | Yes |
| `.env` / `client/.env` | Local files | Yes (see `.gitignore`) |
| SQLite database | `data/` | Yes (ignored) |

First-time setup: `npm run dev:onboard` runs onboarding (no `DEV=1`). Day-to-day dev: `npm run dev` (see `package.json`).

## Security model

- This app is meant to run **on your own machine** (or your own server). **Cloning the repo does not give anyone access to your computer** — only running the server on *your* host binds ports *you* choose.
- **Do not** expose port 3000 to the public internet without a reverse proxy, HTTPS, and your own access controls — there is no built-in multi-user auth for the API.
- LinkedIn OAuth redirect is documented for `http://localhost:3000/...`; for production, use your real HTTPS origin in the LinkedIn app settings and adjust env/config as needed.

More detail: [SECURITY.md](SECURITY.md).

## Smoke test before you push

```bash
npm run build
npm test   # passes even when no test files exist yet
```

## Contributing & releases

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — local setup, issues, pull requests.
- **[CHANGELOG.md](CHANGELOG.md)** — version history.
- **[RELEASING.md](RELEASING.md)** — tag + publish a **GitHub Release**.
- **Releases:** https://github.com/Spielben/LinkedUp/releases

## Documentation

- **[docs/README.md](docs/README.md)** — index: self-hosted / VPS runbook and architecture, security, contributing, optional feature briefs.

## Open source checklist

1. Create an empty **public** repository on GitHub (no README/license there if you already have them locally).
2. Add the remote and push (replace `YOUR_USER` / `YOUR_REPO`):

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git checkout main
git merge responsive-ui-api   # if your work is on that branch
git push -u origin main
```

Or push your feature branch first, then open a Pull Request into `main`.

## License

MIT — see [LICENSE](LICENSE).

## Repository note

This README may still say `linkdup` in paths on your machine — the public repo is **[Spielben/LinkedUp](https://github.com/Spielben/LinkedUp)**. Clone with:

```bash
git clone https://github.com/Spielben/LinkedUp.git
cd LinkedUp
```
