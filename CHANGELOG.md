# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `dev:onboard` script: interactive onboarding + API only (previous default `dev` behavior).

### Changed
- `npm run dev` now starts API + Vite in one terminal (same as `dev:all`); `dev:all` kept as an alias.
### Fixed
### Removed

---

## [0.1.0] — 2026-04-13

First public release on GitHub ([Spielben/LinkedUp](https://github.com/Spielben/LinkedUp)).

### Added

- Express API (posts, styles, templates, contenus, settings, import, LinkedIn auth & posts).
- React + Vite + Tailwind client (dashboard, CRUD, LinkedIn history, settings).
- SQLite persistence with migrations (`linkedin_posts`, settings fields).
- OpenRouter integration for AI generation; credentials via OS keychain (`keytar`).
- LinkedIn OAuth (OpenID + `w_member_social`); Apify scrape for profile posts; repost flag.
- Dev workflow: `npm run dev:all`, API redirects to Vite in `DEV=1`; CORS for local UI.
- Docs: README, SECURITY, LICENSE (MIT), contributing & releasing guides.

[Unreleased]: https://github.com/Spielben/LinkedUp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Spielben/LinkedUp/releases/tag/v0.1.0
