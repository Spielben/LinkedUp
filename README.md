# LINK'DUP

Self-hosted **LinkedIn content** helper: SQLite, Express API, React UI, optional AI via [OpenRouter](https://openrouter.ai/), LinkedIn OAuth, optional Apify scraping.

## Quick start (development)

```bash
npm install
npm run dev:all
```

- **UI (hot reload):** http://localhost:5173  
- **API + OAuth callback:** http://localhost:3000  

See [client/.env.example](client/.env.example) if the UI cannot reach the API.

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

First-time setup without `DEV=1` runs onboarding; in dev you usually use `npm run dev:api` or `npm run dev:all` (see `package.json`).

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
