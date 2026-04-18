# Documentation index

## Self-hosted / VPS (Docker, Hostinger-style)

| Document | Purpose |
|----------|---------|
| [VPS-HOSTINGER.md](VPS-HOSTINGER.md) | Operational runbook: server commands, Compose, Traefik notes, data volume import/backup |
| [../CURSOR-BRIEF-VPS.md](../CURSOR-BRIEF-VPS.md) | Deployment architecture: credentials env mode, Docker, HTTPS options, n8n scheduler sketch |
| [../deploy/hostinger-linkdup.compose.snippet.yaml](../deploy/hostinger-linkdup.compose.snippet.yaml) | Compose fragment for the `linkdup` service |
| [../deploy/hostinger-linkdup.traefik.snippet.yaml](../deploy/hostinger-linkdup.traefik.snippet.yaml) | Traefik labels example |

## Security and contributing

| Document | Purpose |
|----------|---------|
| [../SECURITY.md](../SECURITY.md) | Threat model and reporting security issues |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Local setup, pull requests, code style |

## Installation (additional languages)

- [../INSTALL.md](../INSTALL.md), [../INSTALL-FR.md](../INSTALL-FR.md), [../INSTALL-EN.md](../INSTALL-EN.md)

## Developer / agent briefs (repository root)

`CURSOR-BRIEF*.md` and `COWORK-*.md` are task or phase notes for specific features (LinkedIn, content ingest, scheduler, UX). They are optional reading unless you work on those areas.
