# Contributing to LINK'DUP

Thanks for helping. This document explains how to work on the project without surprises.

## Before you start

1. **Security** — Never commit API keys, tokens, `.env`, or the `data/` folder. Read [SECURITY.md](SECURITY.md).
2. **License** — By contributing, you agree your contributions are under the same license as the project ([LICENSE](LICENSE), MIT).

## How to report a problem or idea

- **Bug** → open an [issue](https://github.com/Spielben/LinkedUp/issues) with: what you did, what you expected, what happened, your OS / Node version if relevant.
- **Security issue** → do **not** open a public issue; follow [SECURITY.md](SECURITY.md).

## Local setup

```bash
git clone https://github.com/Spielben/LinkedUp.git
cd LinkedUp
npm install
npm run dev:all
```

- UI: http://localhost:5173  
- API: http://localhost:3000  

See [README.md](README.md) for credentials (Keychain / onboarding).

Check that your change still builds:

```bash
npm run build
npm test
```

## Pull requests (PR)

1. **Fork** the repo (or push a branch if you’re a maintainer with access).
2. Create a **branch** with a short name: `fix/…`, `feat/…`, `docs/…`.
3. Make **focused** changes — one topic per PR is easier to review.
4. In the PR description, say **what** changed and **why** (a few sentences is enough).
5. Link related issues with `Fixes #123` if applicable.

We’ll review when we can. Small PRs get merged faster.

## Code style

- **TypeScript** — match existing patterns (imports, naming, no unnecessary `any`).
- **No drive-by refactors** — don’t reformat unrelated files or rename things “while you’re there”.
- **Comments** — only when something is non-obvious; avoid noisy comments.
- **UI** — follow existing Tailwind / component style in `client/src`.

## What we’re not looking for (without discussion first)

- Large dependency upgrades or new frameworks.
- Features that require storing user data on our servers (this app is self-hosted).
- Commits that add secrets or personal machine paths.

## Questions?

Open an issue with the `question` label (if enabled) or ask in the PR — we’ll keep answers short and practical.

Thank you for contributing.
