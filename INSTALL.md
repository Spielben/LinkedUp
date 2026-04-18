# Guide d'installation — LINK'DUP sur Mac

> Ce guide est destiné à toute personne souhaitant installer LINK'DUP sur son propre Mac.  
> Aucune connaissance technique avancée n'est requise — chaque étape est expliquée.

---

## Ce dont vous aurez besoin

Avant de commencer, vérifiez que vous avez :

- Un **Mac** sous macOS 12 (Monterey) ou plus récent
- Une **connexion internet**
- Un compte **GitHub** (gratuit) → [github.com](https://github.com)
- Un compte **OpenRouter** (gratuit + crédits) → [openrouter.ai](https://openrouter.ai)
- Environ **15 minutes** pour l'installation complète

---

## Étape 1 — Installer les outils de base

### 1.1 — Homebrew (gestionnaire de paquets Mac)

Homebrew permet d'installer Node.js et Git facilement. Ouvrez **Terminal** (cherchez "Terminal" dans Spotlight avec `⌘ + Espace`) et collez cette commande :

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Suivez les instructions à l'écran. Cela peut prendre 2-3 minutes. À la fin, si le terminal vous demande d'exécuter des commandes supplémentaires (pour ajouter Homebrew au PATH), faites-le.

**Vérification :**
```bash
brew --version
```
→ Vous devriez voir quelque chose comme `Homebrew 4.x.x`

---

### 1.2 — Node.js (moteur JavaScript)

LINK'DUP tourne sur Node.js. Installez la version 20 (recommandée) :

```bash
brew install node@20
```

**Vérification :**
```bash
node --version
```
→ Vous devriez voir `v20.x.x` (ou supérieur)

```bash
npm --version
```
→ Vous devriez voir `10.x.x` ou supérieur

---

### 1.3 — Git (outil de téléchargement du code)

```bash
brew install git
```

**Vérification :**
```bash
git --version
```
→ `git version 2.x.x`

---

## Étape 2 — Créer votre clef OpenRouter

OpenRouter est le service d'intelligence artificielle qui alimente la génération de posts dans LINK'DUP. Il faut une clef API pour que l'app puisse communiquer avec les modèles AI.

### 2.1 — Créer un compte OpenRouter

1. Allez sur **[openrouter.ai](https://openrouter.ai)**
2. Cliquez sur **Sign In** (en haut à droite)
3. Connectez-vous via Google ou créez un compte avec votre email

### 2.2 — Ajouter des crédits

LINK'DUP utilise des modèles comme Claude Sonnet pour générer vos posts. Ces modèles consomment de petits crédits à chaque utilisation.

1. Une fois connecté, cliquez sur votre avatar en haut à droite → **Credits**
2. Cliquez sur **Add credits**
3. **Recommandation de départ : $5 USD** — cela représente environ 200 posts générés, largement suffisant pour commencer
4. Entrez votre carte bancaire et confirmez l'achat

> 💡 **Pour information** : générer un post (3 versions V1/V2/V3) coûte environ $0.02-0.04. Optimiser un post existant coûte $0.01.

### 2.3 — Créer la clef API

1. Dans votre tableau de bord OpenRouter, allez dans **Keys** (menu à gauche ou via [openrouter.ai/keys](https://openrouter.ai/keys))
2. Cliquez sur **Create Key**
3. Donnez-lui un nom : `LinkDup` ou `Mon Mac`
4. Laissez le **Credit limit** vide (pas de limite, vous gérez via le solde)
5. Cliquez sur **Create**
6. **⚠️ IMPORTANT** : La clef s'affiche UNE SEULE FOIS. Copiez-la immédiatement et gardez-la dans un endroit sûr (Notes, 1Password, etc.)

La clef ressemble à ceci : `sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

> 🔒 **Ne partagez jamais cette clef.** Elle est liée à votre compte et vos crédits. LINK'DUP la stocke de façon sécurisée dans le trousseau de votre Mac (Keychain), elle n'est jamais écrite dans un fichier texte.

---

## Étape 3 — Télécharger LINK'DUP depuis GitHub

### 3.1 — Choisir l'emplacement d'installation

Dans Terminal, naviguez là où vous voulez installer l'app. Par exemple, dans votre dossier Documents :

```bash
cd ~/Documents
```

Ou dans un dossier dédié à vos outils :

```bash
mkdir -p ~/Apps && cd ~/Apps
```

### 3.2 — Cloner le dépôt GitHub

```bash
git clone https://github.com/Spielben/LinkedUp.git
```

Cela va créer un dossier `LinkedUp` avec tout le code source.

```bash
cd LinkedUp
```

### 3.3 — Installer les dépendances

Cette commande télécharge toutes les bibliothèques nécessaires au fonctionnement de l'app :

```bash
npm install
```

> ⏳ Cette étape prend 1-2 minutes. C'est normal si vous voyez beaucoup de texte défiler.

---

## Étape 4 — Premier lancement et configuration

### 4.1 — Lancer le setup initial

```bash
npm run dev:onboard
```

Un assistant de configuration interactif va démarrer dans le Terminal. Il vous pose **3 questions** :

**Question 1/3 — Clef OpenRouter (obligatoire)**
```
→ Paste your key (hidden):
```
Collez votre clef OpenRouter créée à l'étape 2. Les caractères ne s'affichent pas (c'est normal, c'est sécurisé). Appuyez sur Entrée.

**Question 2/3 — Clef Apify (optionnel)**
```
→ Paste your key or press Enter to skip:
```
Apify est un service optionnel pour importer automatiquement votre profil LinkedIn. Appuyez simplement sur **Entrée** pour ignorer (vous pourrez configurer cela plus tard).

**Question 3/3 — Votre URL LinkedIn**
```
→
```
Entrez votre URL de profil LinkedIn, par exemple :
`https://www.linkedin.com/in/votre-nom/`

Une fois terminé, vous verrez :
```
✅ Setup complete! Run `npm run dev` to start the app.
```

### 4.2 — Lancer l'application

```bash
npm run dev
```

L'app démarre sur deux ports :
- **Interface web** : [http://localhost:5173](http://localhost:5173) ← à ouvrir dans votre navigateur
- **API** : http://localhost:3000 (en arrière-plan)

Ouvrez [http://localhost:5173](http://localhost:5173) dans Chrome ou Safari.

> 💡 **Pour fermer l'app** : revenez dans le Terminal et appuyez sur `Ctrl + C`

---

## Étape 5 — Configuration dans l'interface

### 5.1 — Compléter votre profil

1. Dans LINK'DUP, allez dans **Settings** (icône engrenage)
2. Remplissez :
   - **Name** : votre nom
   - **Email** : votre email
   - **LinkedIn URL** : votre URL de profil
   - **Signature** : le texte qui sera ajouté automatiquement à la fin de chaque post (ex: votre hashtag, votre slogan, votre CTA)
   - **Language** : la langue de génération des posts (fr, en, etc.)

3. Cliquez **Save settings**

### 5.2 — Connecter votre compte LinkedIn (optionnel, pour la publication directe)

Si vous souhaitez publier directement depuis LINK'DUP vers LinkedIn :

1. Dans **Settings**, section **LinkedIn**, cliquez sur **Connect LinkedIn**
2. Une fenêtre LinkedIn s'ouvre — autorisez l'accès
3. Une fois connecté, vous verrez votre nom LinkedIn affiché

> ℹ️ Pour activer cette fonctionnalité, vous avez besoin de créer une application LinkedIn Developer. Consultez la section **Connexion LinkedIn avancée** en bas de ce guide si vous souhaitez le faire.

---

## Utilisation quotidienne

Une fois installé, pour relancer l'app chaque jour :

```bash
cd ~/Documents/LinkedUp   # (ou le chemin où vous avez installé l'app)
npm run dev
```

Puis ouvrez [http://localhost:5173](http://localhost:5173) dans votre navigateur.

### Astuce — Créer un raccourci rapide

Vous pouvez créer un alias dans votre Terminal pour lancer l'app plus facilement. Ajoutez cette ligne dans votre fichier `~/.zshrc` :

```bash
echo 'alias linkdup="cd ~/Documents/LinkedUp && npm run dev"' >> ~/.zshrc
source ~/.zshrc
```

Ensuite, il suffira de taper `linkdup` dans n'importe quel Terminal pour lancer l'app.

---

## Mettre à jour LINK'DUP

Quand une nouvelle version est disponible sur GitHub :

```bash
cd ~/Documents/LinkedUp   # (ou votre chemin d'installation)
git pull origin main
npm install
```

Vos données (posts, styles, templates) sont dans le dossier `data/` qui est **local uniquement** — jamais envoyé sur GitHub. Elles sont préservées lors des mises à jour.

---

## Résolution de problèmes courants

### "command not found: node"
→ Node.js n'est pas dans votre PATH. Relancez un nouveau Terminal ou exécutez :
```bash
export PATH="/opt/homebrew/bin:$PATH"
```

### "npm install" échoue avec des erreurs de permission
→ Ne jamais utiliser `sudo npm install`. Vérifiez que vous êtes bien dans le dossier LinkedUp :
```bash
pwd   # doit afficher quelque chose comme /Users/votrenom/.../LinkedUp
```

### L'app s'ouvre mais affiche une erreur AI
→ Vérifiez votre clef OpenRouter et votre solde sur [openrouter.ai/credits](https://openrouter.ai/credits).

### Port déjà utilisé (erreur "EADDRINUSE")
→ Une autre instance de l'app tourne peut-être déjà. Fermez toutes les fenêtres Terminal et relancez :
```bash
npm run dev
```

### Réinitialiser la clef OpenRouter
Si vous avez entré une mauvaise clef ou souhaitez la changer, exécutez dans Terminal :
```bash
security delete-generic-password -s linkdup -a openrouter
npm run dev:onboard
```

---

## Connexion LinkedIn avancée (pour publier directement)

> Cette section est optionnelle. Elle est nécessaire uniquement si vous souhaitez publier des posts directement depuis LINK'DUP.

### Créer une application LinkedIn Developer

1. Allez sur [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)
2. Cliquez **Create app**
3. Remplissez :
   - **App name** : `LinkDup` (ou ce que vous voulez)
   - **LinkedIn Page** : choisissez votre page entreprise (ou créez-en une si nécessaire)
   - **App logo** : uploadez une image quelconque
4. Acceptez les conditions et cliquez **Create app**

### Configurer les permissions OAuth

1. Dans votre app LinkedIn, allez dans l'onglet **Auth**
2. Sous **OAuth 2.0 settings**, dans **Authorized redirect URLs**, ajoutez :
   ```
   http://localhost:3000/api/linkedin/callback
   ```
3. Dans l'onglet **Products**, demandez l'accès à :
   - **Share on LinkedIn**
   - **Sign In with LinkedIn using OpenID Connect**
4. Notez votre **Client ID** et **Client Secret** (onglet Auth)

### Configurer les clefs dans LINK'DUP

Dans votre dossier LinkedUp, créez un fichier `.env` :

```bash
nano .env
```

Ajoutez ces lignes (remplacez par vos vraies valeurs) :
```
LINKEDIN_CLIENT_ID=votre_client_id_ici
LINKEDIN_CLIENT_SECRET=votre_client_secret_ici
```

Sauvegardez avec `Ctrl+O`, puis `Ctrl+X` pour quitter.

Relancez l'app avec `npm run dev` et connectez LinkedIn depuis Settings.

---

## Résumé rapide

| Étape | Action | Durée |
|-------|--------|-------|
| 1 | Installer Homebrew, Node.js, Git | ~5 min |
| 2 | Créer compte + clef OpenRouter | ~5 min |
| 3 | Cloner le repo GitHub + npm install | ~3 min |
| 4 | npm run dev:onboard (setup wizard) | ~2 min |
| 5 | Configurer le profil dans Settings | ~2 min |

**Total : ~17 minutes**

---

> Pour toute question ou problème, ouvrez une issue sur GitHub : [github.com/Spielben/LinkedUp/issues](https://github.com/Spielben/LinkedUp/issues)
