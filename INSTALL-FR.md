# Guide d'installation — LINK'DUP pour Mac

**Temps estimé : 20 à 30 minutes**  
**Niveau requis : aucune compétence technique**  
**Système : macOS 12 (Monterey) ou plus récent**

---

## Avant de commencer — Ce que vous allez faire

LINK'DUP est une application qui tourne sur votre Mac, dans votre navigateur. Elle a besoin de deux clefs pour fonctionner :

- Une clef **OpenRouter** → pour que l'IA génère vos posts
- Une clef **LinkedIn** → pour publier directement sur votre profil (optionnel, mais recommandé)

Ce guide vous explique comment obtenir ces deux clefs, pas à pas.

---

## PARTIE 1 — Préparer votre Mac

### 1.1 — Ouvrir le Terminal

Le Terminal est l'outil qui vous permet d'installer des logiciels et de lancer LINK'DUP. C'est une fenêtre noire où vous tapez des commandes.

Pour l'ouvrir :
1. Appuyez sur `⌘ + Espace` (la touche Commande + la barre espace)
2. Tapez `Terminal`
3. Appuyez sur Entrée

Gardez cette fenêtre ouverte pendant toute l'installation.

---

### 1.2 — Installer Homebrew

Homebrew est un outil qui permet d'installer des logiciels sur Mac depuis le Terminal. Copiez-collez exactement cette commande dans le Terminal, puis appuyez sur Entrée :

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

L'installation demande votre **mot de passe Mac** (le même que pour déverrouiller votre session). Les caractères ne s'affichent pas en tapant — c'est normal. Tapez votre mot de passe et appuyez sur Entrée.

> ⏳ Cela prend 3 à 5 minutes. Attendez que le Terminal vous rende la main (une nouvelle ligne `%` ou `$` apparaît).

Si à la fin le Terminal affiche des instructions du type "Run these two commands...", exécutez-les une par une.

**Vérification — tapez cette commande pour confirmer que Homebrew est installé :**
```bash
brew --version
```
→ Vous devez voir `Homebrew 4.x.x`

---

### 1.3 — Installer Node.js

Node.js est le moteur qui fait tourner LINK'DUP :

```bash
brew install node@20
```

> ⏳ 2 à 4 minutes.

**Vérification :**
```bash
node --version
```
→ Vous devez voir `v20.x.x` (ou supérieur à 18)

---

### 1.4 — Installer Git

Git est l'outil qui permet de télécharger LINK'DUP depuis GitHub :

```bash
brew install git
```

**Vérification :**
```bash
git --version
```
→ Vous devez voir `git version 2.x.x`

---

## PARTIE 2 — Créer votre clef OpenRouter

OpenRouter est le service d'IA qui génère vos posts LinkedIn. Sans lui, l'app ne peut pas créer de contenu.

### 2.1 — Créer un compte

1. Allez sur **[openrouter.ai](https://openrouter.ai)** dans votre navigateur
2. Cliquez sur le bouton **Sign in** en haut à droite
3. Choisissez **Continue with Google** (plus simple) ou créez un compte avec votre email

---

### 2.2 — Ajouter des crédits de paiement

Les modèles d'IA consomment de petits crédits à chaque utilisation. Voici les tarifs réels :

| Action | Coût estimé |
|--------|------------|
| Générer un post (3 versions) | ~$0.03 |
| Optimiser un post | ~$0.01 |
| **50 posts générés** | **~$1.50** |

**Pour ajouter des crédits :**
1. Une fois connecté, cliquez sur votre **avatar** en haut à droite
2. Cliquez sur **Credits**
3. Cliquez sur le bouton **Add credits**
4. Entrez le montant (recommandation : **$10** pour commencer — environ 300 posts)
5. Entrez votre numéro de carte bancaire et confirmez

---

### 2.3 — Créer la clef API

1. Dans le menu à gauche, cliquez sur **Keys**  
   *(ou allez directement sur [openrouter.ai/keys](https://openrouter.ai/keys))*
2. Cliquez sur le bouton **Create Key**
3. Dans le champ **Name**, tapez : `LinkDup`
4. Laissez le champ **Credit limit** vide
5. Cliquez sur **Create**

**Une clef s'affiche alors à l'écran.** Elle ressemble à :
```
sk-or-v1-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4
```

> ⚠️ **Cette clef ne s'affiche qu'une seule fois.** Copiez-la immédiatement et enregistrez-la dans un endroit sûr (Notes, 1Password, etc.). Si vous la perdez, il faudra en créer une nouvelle.

> 🔒 Ne partagez jamais cette clef. Elle est liée à votre compte et vos crédits.

---

## PARTIE 3 — Créer votre application LinkedIn

Cette partie vous permet de publier des posts directement depuis LINK'DUP vers votre profil LinkedIn.

> ℹ️ LinkedIn oblige les développeurs à créer une "application" pour obtenir les droits de publication. C'est une procédure standard — vous n'avez pas besoin d'être développeur pour le faire.

### 3.1 — Accéder au portail développeur LinkedIn

1. Connectez-vous à votre compte LinkedIn normal dans le navigateur
2. Allez sur **[linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)**
3. Cliquez sur le bouton **Create app** (en haut à droite)

---

### 3.2 — Remplir le formulaire de création

LinkedIn vous demande de remplir 4 champs :

**App name** (Nom de l'application)  
Tapez : `LinkDup` ou `Mon Outil LinkedIn` — peu importe, c'est juste un nom pour vous.

**LinkedIn Page** (Page entreprise liée)  
LinkedIn exige de lier l'app à une page entreprise. Si vous en avez une, sélectionnez-la dans la liste. Si vous n'en avez pas :
- Cliquez sur le lien **Create a new LinkedIn Page**
- Choisissez **Company** puis remplissez un nom (ex: votre nom ou le nom de votre activité)
- Revenez sur la page de création d'app et sélectionnez cette nouvelle page

**App logo**  
Uploadez n'importe quelle image (votre photo de profil ou un logo). LinkedIn l'exige mais ce n'est pas visible par vos abonnés.

**Legal agreement**  
Cochez la case **"I have read and agree..."**

Cliquez sur **Create app**.

---

### 3.3 — Activer les permissions de publication

Une fois l'app créée, vous arrivez sur son tableau de bord. Suivez ces étapes dans l'ordre :

**Étape A — Ajouter les produits nécessaires**

1. Cliquez sur l'onglet **Products** (dans les onglets en haut de la page)
2. Trouvez le produit **"Sign In with LinkedIn using OpenID Connect"**
3. Cliquez sur **Select** en face de ce produit
4. Une pop-up s'ouvre — cliquez sur **Add product** pour confirmer
5. Trouvez le produit **"Share on LinkedIn"**
6. Cliquez sur **Select** en face, puis **Add product**

> ⏳ LinkedIn valide ces produits automatiquement en quelques secondes à quelques minutes. La page affichera "Added" en vert une fois validé.

---

**Étape B — Configurer l'URL de retour OAuth**

1. Cliquez sur l'onglet **Auth** (dans les onglets en haut)
2. Cherchez la section **OAuth 2.0 settings**
3. Sous **Authorized redirect URLs for your app**, cliquez sur le bouton **Add redirect URL** (ou l'icône crayon)
4. Copiez-collez exactement cette URL :
   ```
   http://localhost:3000/api/linkedin/callback
   ```
5. Cliquez sur **Update** pour sauvegarder

> ⚠️ Cette URL doit être copiée-collée **exactement** comme indiquée — aucun espace, aucune majuscule, aucun `/` en trop. La moindre différence empêchera la connexion.

---

### 3.4 — Récupérer votre Client ID et Client Secret

Toujours dans l'onglet **Auth**, cherchez la section **Application credentials** (tout en haut de cet onglet).

Vous y voyez deux valeurs :

**Client ID**  
C'est un identifiant public qui ressemble à :
```
86abcdef12345678
```
Copiez-le et notez-le.

**Client Secret**  
C'est votre clef secrète. Pour l'afficher, cliquez sur l'icône œil 👁 à côté. Elle ressemble à :
```
AbCdEfGh1234567890IjKlMnOp
```
Copiez-la et notez-la dans un endroit sûr.

> ⚠️ Ne partagez jamais votre Client Secret. Traitez-le comme un mot de passe.

---

## PARTIE 4 — Télécharger et installer LINK'DUP

### 4.1 — Télécharger le code depuis GitHub

Dans votre Terminal, choisissez où vous voulez installer l'app. Par exemple dans votre dossier Documents :

```bash
cd ~/Documents
```

Puis téléchargez le code :

```bash
git clone https://github.com/Spielben/LinkedUp.git
```

Entrez dans le dossier :

```bash
cd LinkedUp
```

---

### 4.2 — Installer les dépendances

Cette commande installe tous les composants nécessaires au fonctionnement de l'app :

```bash
npm install
```

> ⏳ 1 à 2 minutes. Vous verrez du texte défiler — c'est normal.

---

## PARTIE 5 — Configurer les clefs dans LINK'DUP

Les clefs sont stockées de façon sécurisée dans le **Trousseau de votre Mac** (Keychain). Elles ne sont jamais écrites dans un fichier texte et ne sont jamais envoyées sur GitHub.

### 5.1 — Enregistrer la clef OpenRouter

Copiez-collez cette commande dans le Terminal, en remplaçant `VOTRE_CLEF_ICI` par votre vraie clef OpenRouter :

```bash
security add-generic-password -s linkdup -a openrouter -w "VOTRE_CLEF_ICI"
```

**Exemple :**
```bash
security add-generic-password -s linkdup -a openrouter -w "sk-or-v1-a1b2c3..."
```

---

### 5.2 — Enregistrer le Client ID LinkedIn

Remplacez `VOTRE_CLIENT_ID` par la valeur copiée à l'étape 3.4 :

```bash
security add-generic-password -s linkdup -a linkedin_client_id -w "VOTRE_CLIENT_ID"
```

---

### 5.3 — Enregistrer le Client Secret LinkedIn

Remplacez `VOTRE_CLIENT_SECRET` par la valeur copiée à l'étape 3.4 :

```bash
security add-generic-password -s linkdup -a linkedin_client_secret -w "VOTRE_CLIENT_SECRET"
```

---

### 5.4 — Vérifier que tout est bien enregistré

Cette commande liste les clefs enregistrées pour LINK'DUP :

```bash
security find-generic-password -s linkdup -a openrouter 2>/dev/null && echo "✅ OpenRouter OK" || echo "❌ OpenRouter manquant"
security find-generic-password -s linkdup -a linkedin_client_id 2>/dev/null && echo "✅ LinkedIn Client ID OK" || echo "❌ LinkedIn Client ID manquant"
security find-generic-password -s linkdup -a linkedin_client_secret 2>/dev/null && echo "✅ LinkedIn Client Secret OK" || echo "❌ LinkedIn Client Secret manquant"
```

Vous devez voir trois lignes `✅ ... OK`.

---

## PARTIE 6 — Premier lancement

### 6.1 — Lancer l'application

```bash
npm run dev
```

Vous verrez apparaître dans le Terminal :
```
[api] Server running on http://localhost:3000
[ui]  ➜  Local: http://localhost:5173
```

---

### 6.2 — Ouvrir l'interface

Ouvrez votre navigateur (Chrome ou Safari) et allez sur :  
**[http://localhost:5173](http://localhost:5173)**

---

### 6.3 — Configurer votre profil

1. Cliquez sur **Settings** (icône engrenage, menu à gauche)
2. Remplissez les champs :
   - **Name** : votre prénom et nom
   - **Email** : votre adresse email
   - **LinkedIn URL** : l'URL de votre profil LinkedIn (ex: `https://www.linkedin.com/in/votre-nom/`)
   - **Signature** : le texte ajouté automatiquement à la fin de chaque post (ex: votre hashtag ou votre CTA)
   - **Language** : choisissez `fr` pour générer des posts en français
3. Cliquez sur **Save settings**

---

### 6.4 — Connecter votre compte LinkedIn

1. Toujours dans Settings, trouvez la section **LinkedIn**
2. Cliquez sur **Connect LinkedIn**
3. Une fenêtre LinkedIn s'ouvre dans votre navigateur — connectez-vous et cliquez **Autoriser**
4. La fenêtre se ferme automatiquement et vous voyez votre nom LinkedIn apparaître dans Settings

> Si la connexion échoue, vérifiez que vous avez bien ajouté l'URL `http://localhost:3000/api/linkedin/callback` à l'étape 3.3 (Étape B).

---

## Utilisation quotidienne

Pour lancer LINK'DUP chaque jour :

```bash
cd ~/Documents/LinkedUp
npm run dev
```

Puis ouvrez [http://localhost:5173](http://localhost:5173) dans votre navigateur.

Pour fermer l'app : revenez dans le Terminal et appuyez sur `Ctrl + C`.

**Raccourci optionnel** — pour lancer l'app en tapant juste `linkdup` dans le Terminal :

```bash
echo 'alias linkdup="cd ~/Documents/LinkedUp && npm run dev"' >> ~/.zshrc && source ~/.zshrc
```

---

## Mettre à jour LINK'DUP

Quand une nouvelle version est disponible :

```bash
cd ~/Documents/LinkedUp
git pull origin main
npm install
```

Vos posts, styles et données restent intacts — ils sont dans le dossier `data/` qui n'est jamais touché par les mises à jour.

---

## Résolution de problèmes

**"command not found: brew"**  
Homebrew n'est pas dans votre PATH. Relancez un nouveau Terminal ou exécutez :
```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**"command not found: node"**  
Node.js n'est pas dans votre PATH :
```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
```

**L'app génère une erreur "OpenRouter key not found"**  
Vérifiez que vous avez bien exécuté la commande de l'étape 5.1, et relancez `npm run dev`.

**La connexion LinkedIn échoue avec "redirect_uri_mismatch"**  
L'URL de callback n'est pas exactement correcte dans votre app LinkedIn. Retournez dans le portail Developer LinkedIn → onglet Auth → copiez-collez à nouveau :
```
http://localhost:3000/api/linkedin/callback
```

**Modifier ou supprimer une clef du Trousseau**  
Pour remplacer une clef (par exemple si vous avez fait une erreur) :
```bash
# Supprimer l'ancienne
security delete-generic-password -s linkdup -a openrouter

# Enregistrer la nouvelle
security add-generic-password -s linkdup -a openrouter -w "VOTRE_NOUVELLE_CLEF"
```

---

## Récapitulatif

| Étape | Ce que vous faites | Durée |
|-------|--------------------|-------|
| 1 | Installer Homebrew, Node.js, Git | 5-8 min |
| 2 | Créer un compte OpenRouter + clef API | 5 min |
| 3 | Créer une app LinkedIn + récupérer Client ID/Secret | 8-10 min |
| 4 | Télécharger LINK'DUP depuis GitHub | 2 min |
| 5 | Enregistrer les clefs dans le Trousseau Mac | 2 min |
| 6 | Lancer l'app + configurer votre profil | 3 min |

---

> Pour toute question, ouvrez une issue sur GitHub : **[github.com/Spielben/LinkedUp/issues](https://github.com/Spielben/LinkedUp/issues)**
