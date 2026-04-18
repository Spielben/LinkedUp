# Brief — Déploiement Linkdup sur VPS (Hostinger / Docker)

**Runbook commande par commande** : [docs/VPS-HOSTINGER.md](docs/VPS-HOSTINGER.md)  
**Suivi (équipe)** : [Linear — projet Linkdup](https://linear.app/linkdup/project/linkdup-3ffcb4effe77/overview)

Ce fichier décrit l’**architecture**, les **choix** et les **éléments non triviaux** (credentials, OAuth, n8n). Il évite de dupliquer les snippets à jour du dépôt (`Dockerfile`, `deploy/*.yaml`, `.env.production.example`).

---

## Objectif

Exécuter Linkdup **24h/24** sur un VPS déjà en Docker (souvent avec Traefik, n8n, autres services), avec secrets en **variables d’environnement** et persistance SQLite sur un **volume Docker**.

---

## Branches Git (recommandation)

| Branche | Usage |
|--------|--------|
| `main` | Développement local (ex. macOS + trousseau / keytar si activé) |
| `vps` (ou équivalent) | Alignée sur le déploiement serveur (`USE_ENV_CREDENTIALS=true`, Docker) |

Adapter les noms de branches à votre flux ; l’important est de **ne pas mélanger** logique locale et secrets serveur dans le même commit si votre équipe sépare ces usages.

---

## Credentials sur le VPS (`USE_ENV_CREDENTIALS=true`)

- **Implémentation** : `src/credentials.ts` — lecture des clés API depuis l’environnement ; tokens LinkedIn OAuth **après login** lus/écrits dans SQLite (`settings.linkedin_tokens`) pour survivre aux redémarrages.
- **Ne pas versionner** : `.env.production` (voir `.env.production.example`).

---

## Docker

- **Image** : [Dockerfile](Dockerfile) — build client + serveur, `CMD` vers `dist/src/cli.js`, répertoire données `/app/data`.
- **Compose** : fragments dans [deploy/hostinger-linkdup.compose.snippet.yaml](deploy/hostinger-linkdup.compose.snippet.yaml) et labels Traefik dans [deploy/hostinger-linkdup.traefik.snippet.yaml](deploy/hostinger-linkdup.traefik.snippet.yaml).

Sur le serveur, le dépôt est en général cloné sous `/root/linkdup` ; le `docker-compose.yml` **racine** (`/root/docker-compose.yml`) agrège souvent plusieurs services — ne pas committer ce fichier s’il contient des secrets d’autres apps.

---

## HTTPS

1. **Traefik** (cas le plus fréquent si déjà présent) : labels sur `linkdup` + `certresolver` cohérent avec le reste du stack. Voir snippet Traefik ; **Basic Auth** : fichier mot de passe accessible **dans le conteneur Traefik** si le middleware utilise `usersfile`.

2. **Nginx sur l’hôte** (alternative) : vhost TLS qui proxy vers `127.0.0.1:3001` (port mappé depuis le conteneur). Exemple de structure (à adapter : domaine, chemins Certbot) :

```nginx
server {
    listen 80;
    server_name linkdup.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name linkdup.example.com;
    ssl_certificate     /etc/letsencrypt/live/linkdup.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/linkdup.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    client_max_body_size 20M;
    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

DNS : enregistrement **A** du sous-domaine vers l’IP du VPS. LinkedIn Developers : URL de callback **HTTPS** identique à `LINKEDIN_REDIRECT_URI`.

---

## Déploiement initial (résumé)

1. Cloner la branche déployée vers `/root/linkdup` (URL du dépôt **sans** token dans l’URL).
2. Créer `chmod 600` `.env.production` à partir de l’exemple.
3. Ajouter le service `linkdup` + volume `linkdup_data` dans `/root/docker-compose.yml`.
4. Configurer Traefik ou Nginx + TLS.
5. `docker compose up -d --build linkdup` (et recréer Traefik si labels modifiés).
6. Ouvrir l’app en HTTPS, **Connect LinkedIn** dans les réglages.

Détail : [docs/VPS-HOSTINGER.md](docs/VPS-HOSTINGER.md).

---

## n8n — publication planifiée

Le scheduler peut rester **hors code** : n8n appelle l’API Linkdup sur le réseau Docker.

Exemple de chaîne (à adapter : nom du conteneur, réseau Compose) :

1. **Schedule** : toutes les minutes.
2. **HTTP Request** `GET` `http://<conteneur-linkdup>:3000/api/posts?status=Programmé`
3. **Code** — ne garder que les posts programmés dont la date est passée et sans `linkedin_post_id` :

```javascript
const now = new Date().toISOString().replace("T", " ").slice(0, 19);
return $input
  .all()
  .flatMap((item) => item.json)
  .filter(
    (post) =>
      post.status === "Programmé" &&
      post.publication_date &&
      post.publication_date <= now &&
      !post.linkedin_post_id
  )
  .map((post) => ({ json: post }));
```

4. **HTTP Request** `POST` `http://<conteneur-linkdup>:3000/api/posts/{{ $json.id }}/publish`

Activer le workflow dans n8n.

---

## Opérations courantes

```bash
docker logs root-linkdup-1 -f

cd /root/linkdup && git pull && cd /root && docker compose up -d --build linkdup
```

Sauvegarde / import du volume : [docs/VPS-HOSTINGER.md](docs/VPS-HOSTINGER.md) §8 et §9.

---

## Tableau récapitulatif

| Zone | Rôle |
|------|------|
| Mac / CI | Code, tests, image Docker |
| `/root/linkdup` | Dépot sur le VPS |
| `/root/docker-compose.yml` | Orchestration (souvent multi-services) |
| Volume `linkdup_data` | `/app/data` — SQLite + fichiers uploadés / images locales |
| `.env.production` | Secrets (hors Git) |
| Traefik ou Nginx | HTTPS, optionnellement Basic Auth |
