# Déploiement VPS Hostinger (terminal web) — sans répétition

Ce document matérialise le plan d’exécution : commandes à lancer **sur le serveur uniquement**. Aucun accès distant possible depuis Cursor : tout se fait dans le **terminal Hostinger**.

## Limites

- Les secrets restent dans `/root/linkdup/.env.production` (permissions `600`).
- **Ne jamais** coller dans un chat : contenu de `.env`, sortie complète de `docker compose config`, ni logs contenant des tokens.

---

## 1. Vérifier l’état (ne rien refaire si déjà OK)

À exécuter dans le terminal Hostinger :

```bash
pwd
ls -la /root/linkdup
docker compose -f /root/docker-compose.yml ps
```

- Si `/root/linkdup` existe et le dépôt est présent : **ne pas** refaire `git clone`.
- Si `root-linkdup-1` est **Up** : ne pas relancer `up --build` sans raison (sauf après changement de config ou de code).
- Si `.env.production` existe déjà (`ls -la /root/linkdup/.env.production`) : **ne pas** refaire `cp` depuis l’exemple.

---

## 2. Fichier d’environnement (une fois, ou mise à jour)

```bash
cd /root/linkdup
cp -n .env.production.example .env.production
nano .env.production
chmod 600 .env.production
```

Remplir les variables sur le serveur uniquement (tableaux de bord OpenRouter, LinkedIn, Apify dans un autre onglet).

---

## 3. Compléter `docker-compose.yml` si le service linkdup est incomplet

Fichier : `/root/docker-compose.yml`.

Fragment complet à fusionner : voir [deploy/hostinger-linkdup.compose.snippet.yaml](../deploy/hostinger-linkdup.compose.snippet.yaml).

Points obligatoires :

- Sous `services:` : bloc `linkdup` avec `build`, `ports`, `volumes` (`linkdup_data:/app/data`), `env_file`, `environment`.
- Sous `volumes:` : `linkdup_data` avec `driver: local` (sauf si tu utilises un volume `external` déjà créé — adapte alors).

Édition :

```bash
cd /root
nano docker-compose.yml
```

---

## 4. Valider la syntaxe **sans afficher les secrets**

```bash
docker compose -f /root/docker-compose.yml config > /dev/null && echo OK
```

Si tu vois `OK`, le YAML est valide. **N’utilise pas** `docker compose config` sans redirection si tu dois copier le résultat : la sortie complète peut contenir des variables d’environnement résolues (autres services inclus).

---

## 5. Construire et démarrer Linkdup

```bash
cd /root
docker compose up -d --build linkdup
```

Vérification locale sur le serveur (sans coller les logs ailleurs si des secrets apparaissent) :

```bash
docker compose -f /root/docker-compose.yml ps
docker logs root-linkdup-1 --tail 30
```

---

## 6. HTTPS et nom de domaine — deux options

### Option A — Traefik (cohérent si n8n passe déjà par Traefik)

Ajouter des **labels** sur le service `linkdup` pour un sous-domaine dédié. Fragment d’exemple (à adapter : host, cert resolver) : [deploy/hostinger-linkdup.traefik.snippet.yaml](../deploy/hostinger-linkdup.traefik.snippet.yaml).

Après modification :

```bash
cd /root
docker compose up -d --build linkdup
```

### Option B — Nginx sur l’hôte

Suivre la section Nginx du brief projet (`CURSOR-BRIEF-VPS.md`) : proxy vers `127.0.0.1:3001`, Certbot pour TLS.

### DNS et LinkedIn

- **DNS Hostinger** : enregistrement **A** du sous-domaine vers l’IP du VPS.
- **LinkedIn Developers** : URL de callback **HTTPS** `https://TON_SOUS_DOMAINE/api/linkedin/callback`.

---

## 7. n8n (scheduler)

Aucun code supplémentaire dans le dépôt : workflow n8n comme décrit dans le brief (HTTP vers l’API Linkdup sur le réseau Docker). Vérifier le nom du conteneur et le port internes (`root-linkdup-1:3000` si le service expose 3000 dans le réseau compose).
