# CURSOR BRIEF — LinkedUp : Déploiement VPS Hostinger

> Date : 2026-04-18  
> Objectif : Déployer LinkedUp sur le VPS Hostinger existant, autonome 24h/24  
> Infrastructure existante : Docker + Docker Compose dans `/root/`, n8n actif (`root-n8n-1`), Nginx + SSL en place  
> Stratégie : branche Git dédiée `vps` — la branche `main` reste identique (Mac + Keychain)

---

## Stratégie de branches Git

```
main  →  usage Mac personnel (keytar/Keychain, inchangé)
vps   →  déploiement serveur (env variables, pas de keytar)
```

Les deux branches partagent 95% du code. La seule différence est `src/credentials.ts` et les fichiers de config Docker/n8n. Jamais de merge de `vps` vers `main`.

---

## PARTIE 1 — Créer la branche `vps`

### À faire : sur votre Mac, dans le Terminal de votre Mac

```bash
cd ~/Documents/LinkedUp   # ou votre chemin d'installation
git checkout -b vps
```

Toutes les modifications qui suivent sont faites sur cette branche uniquement.

---

## PARTIE 2 — Adapter `src/credentials.ts` pour Linux

### Problème
`keytar` accède au Trousseau macOS. Sur Linux (VPS), il ne fonctionne pas.

### Solution
Modifier `src/credentials.ts` pour détecter l'environnement et basculer sur les variables d'environnement quand `USE_ENV_CREDENTIALS=true` est défini (ce sera le cas sur le VPS).

Le comportement sur Mac reste **identique** — aucun changement pour l'usage local.

```typescript
// src/credentials.ts — version finale (branche vps)

const USE_ENV = process.env.USE_ENV_CREDENTIALS === "true";

const ENV_MAP: Record<string, string> = {
  openrouter:               "OPENROUTER_API_KEY",
  apify:                    "APIFY_API_KEY",
  linkedin_client_id:       "LINKEDIN_CLIENT_ID",
  linkedin_client_secret:   "LINKEDIN_CLIENT_SECRET",
  linkedin_access_token:    "LINKEDIN_ACCESS_TOKEN",
  linkedin_refresh_token:   "LINKEDIN_REFRESH_TOKEN",
  linkedin_person_urn:      "LINKEDIN_PERSON_URN",
};

export async function getCredential(key: string): Promise<string | null> {
  if (USE_ENV) {
    return process.env[ENV_MAP[key]] ?? null;
  }
  const keytar = await import("keytar");
  return keytar.default.getPassword("linkdup", key);
}

export async function setCredential(key: string, value: string): Promise<void> {
  if (USE_ENV) {
    // Sur VPS : les tokens LinkedIn OAuth sont persistés en base SQLite (voir Partie 3)
    return;
  }
  const keytar = await import("keytar");
  await keytar.default.setPassword("linkdup", key, value);
}

export async function deleteCredential(key: string): Promise<boolean> {
  if (USE_ENV) return false;
  const keytar = await import("keytar");
  return keytar.default.deletePassword("linkdup", key);
}

export async function hasCredential(key: string): Promise<boolean> {
  const value = await getCredential(key);
  return value !== null && value.length > 0;
}

export async function isOnboarded(): Promise<boolean> {
  return hasCredential("openrouter");
}
```

---

## PARTIE 3 — Persistance des tokens LinkedIn OAuth en base SQLite

### Problème
Après connexion LinkedIn OAuth, les tokens (access_token, refresh_token, person_urn) sont écrits via `setCredential()`. En mode ENV, cette écriture est ignorée → tokens perdus au redémarrage du conteneur.

### Solution
En mode `USE_ENV`, stocker ces trois tokens dans la table `settings` (colonne `linkedin_tokens` de type JSON).

Modifier `src/credentials.ts` — dans `setCredential()` en mode ENV, pour les clefs `linkedin_access_token`, `linkedin_refresh_token`, `linkedin_person_urn` uniquement :

```typescript
// Dans setCredential(), section USE_ENV :
if (USE_ENV) {
  const linkedinTokenKeys = ["linkedin_access_token", "linkedin_refresh_token", "linkedin_person_urn"];
  if (linkedinTokenKeys.includes(key)) {
    const { getDb } = await import("../db/index.js");
    const db = getDb();
    // Lire les tokens existants
    const row = db.prepare("SELECT linkedin_tokens FROM settings WHERE id = 1").get() as { linkedin_tokens?: string } | undefined;
    const tokens = JSON.parse(row?.linkedin_tokens || "{}");
    tokens[key] = value;
    db.prepare("UPDATE settings SET linkedin_tokens = ? WHERE id = 1").run(JSON.stringify(tokens));
  }
  return;
}
```

Et dans `getCredential()`, en mode ENV, pour ces mêmes clefs :

```typescript
if (USE_ENV) {
  const linkedinTokenKeys = ["linkedin_access_token", "linkedin_refresh_token", "linkedin_person_urn"];
  if (linkedinTokenKeys.includes(key)) {
    const { getDb } = await import("../db/index.js");
    const db = getDb();
    const row = db.prepare("SELECT linkedin_tokens FROM settings WHERE id = 1").get() as { linkedin_tokens?: string } | undefined;
    const tokens = JSON.parse(row?.linkedin_tokens || "{}");
    return tokens[key] ?? null;
  }
  return process.env[ENV_MAP[key]] ?? null;
}
```

Ajouter la migration dans `src/db/index.ts` :

```typescript
// Dans runMigrations() :
try {
  database.exec("ALTER TABLE settings ADD COLUMN linkedin_tokens TEXT");
} catch (e) { /* already exists */ }
```

---

## PARTIE 4 — Fichiers Docker pour LinkedUp

### Créer `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3000
ENV NODE_ENV=production
ENV USE_ENV_CREDENTIALS=true
CMD ["node", "dist/cli.js"]
```

### Créer `.env.production.example`

```bash
# Copier ce fichier en .env.production et remplir les valeurs
# Ce fichier est versionné — .env.production ne l'est PAS

OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx
LINKEDIN_CLIENT_ID=xxxxxxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# Laisser vide — remplis automatiquement après connexion OAuth dans l'interface
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_REFRESH_TOKEN=
LINKEDIN_PERSON_URN=

APIFY_API_KEY=
PORT=3000
USE_ENV_CREDENTIALS=true
```

### Mettre à jour `.gitignore`

Ajouter :
```
.env.production
```

---

## PARTIE 5 — Scheduler via n8n (pas de code custom)

Le scheduler n'est **pas implémenté dans le code Node.js**. C'est n8n (déjà sur le VPS) qui se charge de déclencher les publications planifiées, en appelant l'API LinkedUp toutes les minutes.

Le workflow n8n à créer est décrit dans la **Partie 7** de ce brief (section déploiement VPS) — il n'y a rien à coder dans LinkedUp pour ça.

---

## PARTIE 6 — Pousser la branche sur GitHub

### À faire : Terminal de votre Mac

```bash
git add -A
git commit -m "feat: VPS deployment — env credentials, Docker, SQLite token persistence"
git push origin vps
```

---

## PARTIE 7 — Déploiement sur le VPS Hostinger

> ⚠️ **Tout ce qui suit se passe dans le terminal SSH de votre VPS Hostinger**, pas sur votre Mac.
> Pour vous connecter au VPS : ouvrez un Terminal sur votre Mac et tapez `ssh root@VOTRE_IP`

---

### Étape 1 — Cloner la branche `vps` sur le serveur

> 📍 **Terminal VPS**

```bash
cd /root
git clone -b vps https://github.com/Spielben/LinkedUp.git linkdup
cd linkdup
```

---

### Étape 2 — Créer le fichier de secrets

> 📍 **Terminal VPS**

```bash
cp .env.production.example .env.production
nano .env.production
```

Remplissez `OPENROUTER_API_KEY`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.  
Sauvegardez : `Ctrl+O` → Entrée → `Ctrl+X`

```bash
# Sécuriser les permissions (lisible uniquement par root)
chmod 600 .env.production
```

---

### Étape 3 — Ajouter LinkedUp au docker-compose existant

> 📍 **Terminal VPS**

```bash
nano /root/docker-compose.yml
```

Ajouter ce bloc dans la section `services:` de votre `docker-compose.yml` existant :

```yaml
  linkdup:
    build: /root/linkdup
    container_name: root-linkdup-1
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3000"    # port 3001 en local pour ne pas confliciter avec n8n
    volumes:
      - linkdup_data:/app/data
    env_file:
      - /root/linkdup/.env.production
    environment:
      - NODE_ENV=production
      - USE_ENV_CREDENTIALS=true
```

Et dans la section `volumes:` (en bas du fichier) :

```yaml
  linkdup_data:
    driver: local
```

Sauvegardez : `Ctrl+O` → Entrée → `Ctrl+X`

---

### Étape 4 — Ajouter le bloc Nginx pour LinkedUp

> 📍 **Terminal VPS**

```bash
nano /etc/nginx/sites-available/linkdup
```

Collez ce contenu (remplacez `VOTREDOMAINE.com` par votre vrai domaine) :

```nginx
server {
    listen 80;
    server_name linkdup.VOTREDOMAINE.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name linkdup.VOTREDOMAINE.com;

    ssl_certificate     /etc/letsencrypt/live/linkdup.VOTREDOMAINE.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/linkdup.VOTREDOMAINE.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
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

```bash
ln -s /etc/nginx/sites-available/linkdup /etc/nginx/sites-enabled/
nginx -t
```

---

### Étape 5 — Pointer le sous-domaine et obtenir le SSL

> 📍 **Panneau DNS Hostinger** (dans votre navigateur, pas le terminal)

Dans Hostinger → Domaines → DNS Zone, ajouter :
- Type : **A**
- Nom : `linkdup`
- Valeur : l'IP de votre VPS
- TTL : 3600

Attendez 5-10 minutes, puis :

> 📍 **Terminal VPS**

```bash
certbot --nginx -d linkdup.VOTREDOMAINE.com
systemctl reload nginx
```

---

### Étape 6 — Lancer LinkedUp

> 📍 **Terminal VPS**

```bash
cd /root
docker compose up -d --build linkdup

# Vérifier que ça tourne
docker compose ps
docker logs root-linkdup-1 -f   # Ctrl+C pour quitter
```

Ouvrez `https://linkdup.VOTREDOMAINE.com` dans votre navigateur.

---

### Étape 7 — Mettre à jour l'URL de callback LinkedIn

> 📍 **Navigateur** → linkedin.com/developers/apps → votre app → onglet Auth

Remplacer :
```
http://localhost:3000/api/linkedin/callback
```
Par :
```
https://linkdup.VOTREDOMAINE.com/api/linkedin/callback
```

---

### Étape 8 — Connecter LinkedIn depuis l'interface

Ouvrez `https://linkdup.VOTREDOMAINE.com` → Settings → **Connect LinkedIn** → autorisez.  
Les tokens sont automatiquement persistés en base SQLite (Partie 3).

---

### Étape 9 — Créer le workflow scheduler dans n8n

> 📍 **Navigateur** → votre interface n8n

Créer un nouveau workflow avec ces nœuds :

**Nœud 1 : Schedule Trigger**
- Interval : toutes les **1 minute**

**Nœud 2 : HTTP Request**
- Method : `GET`
- URL : `http://root-linkdup-1:3000/api/posts?status=Programmé`
  *(n8n et LinkedUp sont sur le même réseau Docker — communication interne directe)*

**Nœud 3 : Code** (filtrer les posts dont la date est dépassée)
```javascript
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
return $input.all()
  .flatMap(item => item.json)
  .filter(post =>
    post.status === 'Programmé' &&
    post.publication_date &&
    post.publication_date <= now &&
    !post.linkedin_post_id
  )
  .map(post => ({ json: post }));
```

**Nœud 4 : HTTP Request** (publier chaque post)
- Method : `POST`
- URL : `http://root-linkdup-1:3000/api/posts/{{ $json.id }}/publish`

**Activer le workflow** avec le toggle en haut à droite.

---

## Commandes utiles au quotidien

> 📍 **Terminal VPS** pour toutes ces commandes

```bash
# Voir les logs LinkedUp en temps réel
docker logs root-linkdup-1 -f

# Redémarrer après une mise à jour du code
cd /root/linkdup
git pull origin vps
cd /root
docker compose up -d --build linkdup

# Sauvegarder la base de données
docker run --rm \
  -v linkdup_data:/data \
  -v /root/backups:/backup \
  alpine tar czf /backup/linkdup-$(date +%Y%m%d).tar.gz /data

# Voir tous les conteneurs actifs
docker compose ps
```

---

## Résumé : qui fait quoi

| Étape | Où | Quoi |
|-------|----|------|
| 1-6 (Partie 1-6) | Cursor sur Mac | Code + fichiers Docker |
| Étape 1 | Terminal VPS | Clone la branche `vps` |
| Étape 2 | Terminal VPS | Crée `.env.production` avec vos clefs |
| Étape 3 | Terminal VPS | Ajoute LinkedUp au `docker-compose.yml` existant |
| Étape 4 | Terminal VPS | Configure Nginx |
| Étape 5 | Panneau Hostinger + Terminal VPS | DNS + SSL |
| Étape 6 | Terminal VPS | Lance le conteneur |
| Étape 7 | LinkedIn Developer Portal | Met à jour l'URL de callback |
| Étape 8 | Navigateur (LinkedUp) | Connecte LinkedIn |
| Étape 9 | Navigateur (n8n) | Crée le workflow scheduler |
