# Security

## Reporting issues

If you find a security vulnerability, please **do not** open a public issue. Contact the maintainers privately (e.g. GitHub Security Advisories or email if published in the repo profile).

## What this project does **not** store in Git

- API keys (OpenRouter, Apify, LinkedIn, etc.) — use the OS credential store / Keychain.
- `.env` files with secrets — keep local; only `client/.env.example` is tracked as a template.
- `data/` (SQLite, uploads) — local only; listed in `.gitignore`.

## Self-hosting

- Anyone who clones the repo runs the app **on their own** hardware. Source code alone does not grant access to another person’s machine.
- If you deploy the API on a server, treat it like any backend: firewall, HTTPS, secrets management, and do not rely on “security through obscurity.”

## Before you `git push`

- Run `git status` and review every staged file.
- Search for accidental keys: `git grep -iE 'sk-|apikey|secret|password' -- ':!*.md'` (adjust as needed).
- Confirm `data/` and `.env` are **not** tracked: `git ls-files data .env 2>/dev/null` should list nothing.
