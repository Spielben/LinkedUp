# Déploiement VPS Hostinger — guide opérationnel

Runbook **sans données sensibles** : commandes à exécuter sur le serveur (terminal Hostinger, SSH ou SFTP). Pour le contexte produit (credentials env, n8n, alternatives Nginx), voir [CURSOR-BRIEF-VPS.md](../CURSOR-BRIEF-VPS.md).

**Suivi de projet (équipe)** : [Linear — projet Linkdup](https://linear.app/linkdup/project/linkdup-3ffcb4effe77/overview) (lien interne ; ne pas y coller de secrets).

---

## Limites et sécurité

- Secrets uniquement dans `/root/linkdup/.env.production` (fichier hors dépôt, `chmod 600`).
- **Ne jamais** coller dans un chat ou une issue : contenu de `.env`, sortie complète de `docker compose config`, logs avec tokens.
- Partage de `docker-compose.yml` pour support / IA : copier **uniquement** les services concernés (`traefik`, `linkdup`) ou redacter les valeurs (`REDACTED`). Le fichier racine peut contenir des clés d’autres services (ex. chiffrement d’outils tiers).
- Exposition accidentelle d’une clé : traiter comme **incident** ; rotation selon la doc du produit concerné (sans republier la clé).

---

## 1. Vérifier l’état

```bash
pwd
ls -la /root/linkdup
docker compose -f /root/docker-compose.yml ps
```

- Dépôt déjà présent sous `/root/linkdup` : ne pas refaire `git clone` sans raison.
- Conteneur Linkdup **Up** : ne pas relancer `up --build` sans changement de code ou de config.
- `.env.production` déjà présent : ne pas l’écraser avec l’exemple.

---

## 2. Fichier d’environnement

```bash
cd /root/linkdup
cp -n .env.production.example .env.production
nano .env.production
chmod 600 .env.production
```

Renseigner les clés (tableaux de bord des fournisseurs, hors terminal). **`LINKEDIN_REDIRECT_URI`** doit correspondre **exactement** à l’URL autorisée dans l’app LinkedIn Developers (HTTPS + chemin `/api/linkedin/callback`). Voir `.env.production.example` dans le dépôt.

### TLS / ingest web (HTTPS sortant)

- L’image charge `ca-certificates` ; l’app d’ingest lit explicitement le bundle système (ex. `/etc/ssl/certs/ca-certificates.crt` dans le conteneur) pour `undici`, **sans** dépendre d’un `NODE_OPTIONS` correct.
- Si tu ajoutes **`NODE_OPTIONS`** dans `.env.production`, tu **remplaces** entièrement la variable d’environnement du conteneur (y compris `--use-openssl-ca` défini dans le `Dockerfile`) : fusionne les flags si besoin, ou laisse `NODE_OPTIONS` absent pour garder le défaut image.
- **`NODE_EXTRA_CA_CERTS`** (chemin vers un PEM) : utile pour un **CA interne** ; le code l’**ajoute** au bundle principal quand celui-ci est trouvé. Monter le fichier PEM dans le conteneur (volume) si le chemin pointe hors `/app`.
- **Chaîne TLS incomplète côté site** (erreur *unable to verify the first certificate*) : l’ingest tente un **second appel** sans vérification du certificat tant que `LINKDUP_WEB_FETCH_TLS_RETRY_INSECURE` n’est pas `0`. Pour forcer le strict, définir `LINKDUP_WEB_FETCH_TLS_RETRY_INSECURE=0` dans `.env.production` ; en dernier recours, `LINKDUP_INSECURE_WEB_FETCH=1` sur tout l’ingest.
- Vérification rapide après déploiement : `docker exec root-linkdup-1 sh -c 'test -f /etc/ssl/certs/ca-certificates.crt && echo bundle OK; echo NODE_OPTIONS=$NODE_OPTIONS'` (adapter le nom du conteneur).

---

## 3. Service `linkdup` dans Compose

Fichier : `/root/docker-compose.yml`.

Fragments de référence (à fusionner manuellement) :

- [deploy/hostinger-linkdup.compose.snippet.yaml](../deploy/hostinger-linkdup.compose.snippet.yaml)

Inclure au minimum : `build`, `ports` (ex. `127.0.0.1:3001:3000`), `volumes` (`linkdup_data:/app/data`), `env_file`, `environment`.

```bash
cd /root
nano docker-compose.yml
```

---

## 4. Valider le YAML sans fuiter les secrets

```bash
docker compose -f /root/docker-compose.yml config > /dev/null && echo OK
```

Ne pas copier-coller la sortie de `docker compose config` sans redirection si d’autres services injectent des variables sensibles.

---

## 5. Build et démarrage

```bash
cd /root
docker compose up -d --build linkdup
docker compose -f /root/docker-compose.yml ps
docker logs root-linkdup-1 --tail 30
```

Adapter le nom du conteneur si `docker ps` affiche un autre identifiant.

---

## 6. HTTPS et domaine

### Option A — Traefik (recommandé si le stack utilise déjà Traefik)

Labels sur le service `linkdup` : [deploy/hostinger-linkdup.traefik.snippet.yaml](../deploy/hostinger-linkdup.traefik.snippet.yaml).

Après modification :

```bash
cd /root
docker compose up -d --force-recreate traefik linkdup
```

**Basic Auth (optionnel)** : si un middleware `basicauth` avec `usersfile` pointe vers un chemin **dans le conteneur Traefik**, le fichier `.htpasswd` doit être **monté en volume sur le service `traefik`**, pas seulement sur `linkdup`. Sinon Traefik journalise une erreur du type *no such file or directory* pour ce chemin.

### Option B — Nginx sur l’hôte

Reverse proxy TLS vers `127.0.0.1:3001` (Certbot, etc.). Esquisse dans [CURSOR-BRIEF-VPS.md](../CURSOR-BRIEF-VPS.md).

### DNS et LinkedIn

- Enregistrement **A** du sous-domaine vers l’**IPv4 du VPS** (chez le registrar / DNS du domaine).
- Application LinkedIn : URL de redirection HTTPS alignée avec `LINKEDIN_REDIRECT_URI`.

---

## 7. n8n (planification)

Aucun scheduler dans le code Node : un workflow n8n peut interroger l’API Linkdup sur le réseau Docker (ex. `http://<nom-conteneur-linkdup>:3000`). Détail des nœuds dans [CURSOR-BRIEF-VPS.md](../CURSOR-BRIEF-VPS.md).

---

## 8. Importer les données (`data/`)

Pour remplacer le contenu du volume **sans fusion** (ex. première mise en production avec une copie issue d’un autre environnement) :

1. Sur la machine source : arrêter l’app, puis créer une archive du dossier `data/` uniquement :

   ```bash
   sqlite3 data/linkdup.db "PRAGMA wal_checkpoint(FULL);" 2>/dev/null || true
   tar czf linkdup-data.tar.gz -C data .
   ```

2. Transférer `linkdup-data.tar.gz` vers le VPS (SFTP, `scp`, etc.) sous un chemin connu (ex. `/root/`).

3. Sur le VPS : arrêter Linkdup, vider le volume, extraire, redémarrer :

   ```bash
   docker volume ls   # repérer le nom du volume (ex. root_linkdup_data)
   docker compose -f /root/docker-compose.yml stop linkdup

   docker run --rm \
     -v NOM_DU_VOLUME:/data \
     -v /root:/backup \
     alpine sh -c 'rm -rf /data/* && tar xzf /backup/linkdup-data.tar.gz -C /data'

   docker compose -f /root/docker-compose.yml start linkdup
   rm -f /root/linkdup-data.tar.gz
   ```

Données concernées : `linkdup.db`, `images/`, `contenus/`, etc. Après import, vérifier la connexion LinkedIn OAuth si les tokens de l’ancien environnement ne sont pas valides sur ce domaine.

---

## 9. Sauvegarde ponctuelle du volume

```bash
docker run --rm \
  -v NOM_DU_VOLUME:/data \
  -v /root/backups:/backup \
  alpine tar czf /backup/linkdup-data-$(date +%Y%m%d).tar.gz -C /data .
```

Créer `/root/backups` si besoin. Stocker les archives hors du serveur selon votre politique de rétention.
