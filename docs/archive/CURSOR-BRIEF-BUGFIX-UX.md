# CURSOR BRIEF — LinkedUp : Bug fixes & UX improvements

> Date : 2026-04-17  
> App : LinkedUp (Node/Express + SQLite + React/Vite + Tailwind)  
> Périmètre : `client/src/pages/PostDetail.tsx`, `client/src/pages/PostsList.tsx`, `client/src/stores/posts.ts`, `src/routes/posts.ts`

---

## Contexte général

LinkedUp est une app de gestion et publication de posts LinkedIn. L'interface principale de travail sur un post est `PostDetail.tsx`. Les routes serveur sont dans `src/routes/posts.ts`. Les settings utilisateur (dont la signature) sont en base SQLite, table `settings`.

Ce brief couvre **5 corrections** à faire dans l'ordre ci-dessous.

---

## FIX 1 — Signature : injection automatique et systématique

### Problème
La signature (champ `settings.signature`) est déjà injectée dans le prompt AI côté serveur lors du `generate`. Mais elle n'est **pas garantie** dans ces cas :
1. L'utilisateur écrit ou colle directement dans le champ **Final Version** (sans passer par Generate)
2. Après un **Optimize**, l'AI peut la retirer malgré l'instruction "Ne change pas la signature"
3. Quand l'utilisateur clique sur une version V1/V2/V3 pour la sélectionner, le texte copié dans `final_version` peut ne pas contenir la signature

### Solution demandée

**Côté serveur — `src/routes/posts.ts`**

Dans les routes `/generate` et `/optimize`, après avoir reçu la réponse de l'AI et AVANT de sauvegarder en base :
- Charger `settings.signature` depuis la DB
- Vérifier si la signature est déjà présente à la fin du texte (trim + endsWith ou includes)
- Si absente → l'ajouter avec deux sauts de ligne : `\n\n${signature}`

Pour `/generate`, appliquer cela à chacune des 3 versions (v1, v2, v3) ET à `final_version` si elle est définie.

```typescript
// Exemple de helper à ajouter dans src/routes/posts.ts
function ensureSignature(text: string, signature: string | null): string {
  if (!signature?.trim()) return text;
  const sig = signature.trim();
  if (text.trim().endsWith(sig)) return text;
  return `${text.trimEnd()}\n\n${sig}`;
}
```

**Côté client — `client/src/pages/PostDetail.tsx`**

Ajouter un nouveau hook `useSettings` ou un simple fetch au chargement du composant pour récupérer `settings.signature`.

Quand l'utilisateur clique sur une carte V1/V2/V3 pour sélectionner une version (le `onClick` qui appelle `save({ selected_version: v, final_version: text })`), vérifier si la signature est déjà dans `text` et l'ajouter si ce n'est pas le cas avant l'envoi.

```tsx
// Dans le onClick des cartes V1/V2/V3
const textWithSig = (signature && !text.includes(signature.trim()))
  ? `${text.trimEnd()}\n\n${signature.trim()}`
  : text;
save({ selected_version: v, final_version: textWithSig });
```

---

## FIX 2 — Gestion du statut / re-publication après suppression LinkedIn

### Problème
Scénario réel :
1. Un post est publié → `status = "Publié"`, `linkedin_post_url = "https://…"` sont enregistrés en DB
2. L'utilisateur supprime le post directement sur LinkedIn
3. Dans l'app, le bloc **"Published on LinkedIn"** est affiché (badge vert + lien) → **le bouton "Publish on LinkedIn" est masqué**
4. L'utilisateur reprogramme une date → le `status` passe à `"Programmé"` mais le `linkedin_post_url` reste non vide
5. Résultat : le badge vert et le lien cassé continuent d'apparaître ; le bouton de publication reste masqué

La logique actuelle dans `PostDetail.tsx` est :
```tsx
{post.linkedin_post_url ? (
  <div>Published on LinkedIn + lien</div>
) : (
  <button>Publish on LinkedIn</button>
)}
```

### Solution demandée

**Modifier la condition d'affichage** pour prendre en compte le statut ET l'URL :

```tsx
const isActuallyPublished = !!post.linkedin_post_url && post.status === "Publié";
```

Puis remplacer la condition :
```tsx
{isActuallyPublished ? (
  // Badge vert + lien + bouton "Reset"
) : (
  // Bouton Publish on LinkedIn
)}
```

**Ajouter un bouton "Reset / Republier"** dans le bloc "Published on LinkedIn" pour permettre à l'utilisateur de remettre à zéro l'URL et republier :

```tsx
<button
  type="button"
  onClick={() => save({ linkedin_post_url: null, status: "Brouillon" })}
  className="text-xs text-gray-500 hover:text-red-600 underline"
>
  Réinitialiser et republier
</button>
```

**Côté serveur** (`src/routes/posts.ts`, route `PUT /:id`) : s'assurer que `linkedin_post_url: null` est bien accepté et enregistré (vérifier que `null` n'est pas filtré parmi les champs autorisés).

---

## FIX 3 — Bouton "Optimize" : taille et visibilité

### Problème
Le bouton **⚡ Optimize** est actuellement dans l'en-tête de la card "Optimization Instructions" avec les classes `px-3 py-1.5 text-xs`. Il est trop petit et visuellement proche du bouton **"Publish on LinkedIn"**, ce qui provoque des erreurs de clic.

### Solution demandée

**Déplacer le bouton Optimize** sous le champ `optimization_instructions` (hors de l'en-tête de la card), en pleine largeur, avec un style visuellement distinct et "eye-catching" :

```tsx
{/* Dans la card Optimization */}
<div className="bg-white rounded-lg border border-gray-200 p-4">
  <label className="block text-sm font-medium mb-2">Instructions d'optimisation</label>
  <textarea
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
    rows={2}
    value={post.optimization_instructions || ""}
    onChange={(e) => setPost({ ...post, optimization_instructions: e.target.value })}
    onBlur={(e) => save({ optimization_instructions: e.target.value })}
    placeholder="ex. Raccourcis le post, ajoute plus d'emojis, change le CTA..."
  />
  {/* Nouveau bouton full-width, eye-catching */}
  <button
    className="mt-3 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
    disabled={!post.final_version || !post.optimization_instructions || optimizing}
    onClick={handleOptimize}
  >
    {optimizing ? "⏳ Optimisation en cours…" : "⚡ OPTIMISER CE POST"}
  </button>
</div>
```

**Séparer visuellement** la zone Optimize de la zone Publish en ajoutant un `<hr>` ou une marge claire entre les deux sections.

---

## FIX 4 — Delete : le bouton ne fonctionne pas (dialog confirm bloquée)

### Problème
Dans `PostDetail.tsx`, la fonction `handleDelete` utilise `window.confirm()` :

```tsx
const handleDelete = async () => {
  if (!confirm("Delete this post?")) return;  // ← peut être bloqué
  await remove(post.id);
  navigate("/posts");
};
```

`window.confirm()` est silencieusement bloqué dans certains environnements (Electron, iframes, navigateurs en mode strict). L'utilisateur clique sur Delete, rien ne se passe car le `confirm` renvoie `false` sans afficher de dialog.

### Solution demandée

Remplacer le `window.confirm()` par un **état de confirmation inline** dans le composant :

```tsx
// Ajouter dans les states
const [confirmDelete, setConfirmDelete] = useState(false);

// Remplacer handleDelete
const handleDelete = async () => {
  if (!confirmDelete) {
    setConfirmDelete(true);
    return;
  }
  await remove(post.id);
  navigate("/posts");
};
```

Et dans le JSX, remplacer le bouton Delete dans le header par :

```tsx
{confirmDelete ? (
  <div className="flex items-center gap-2">
    <span className="text-xs text-red-600 font-medium">Confirmer la suppression ?</span>
    <button
      onClick={handleDelete}
      className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
    >
      Oui, supprimer
    </button>
    <button
      onClick={() => setConfirmDelete(false)}
      className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      Annuler
    </button>
  </div>
) : (
  <button
    onClick={handleDelete}
    className="text-red-500 text-sm hover:text-red-700"
  >
    Supprimer
  </button>
)}
```

---

## FIX 5 — Feedback visuel après sauvegarde / optimisation / date

### Problème
Après les actions suivantes, l'utilisateur n'a aucun retour visuel clair que les modifications ont bien été enregistrées :
- Sauvegarde automatique (`onBlur`) des champs texte
- Clic sur "Save scheduled date"
- Fin de l'optimisation

Le seul indicateur actuel est le texte `saving ? "Saving..." : ""` dans le header, qui est minuscule et passe inaperçu.

### Solution demandée

**Ajouter un système de toast/notification** léger dans `PostDetail.tsx` (sans librairie externe, pur React state) :

```tsx
// Ajouter dans les states
const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

// Helper
const showToast = (message: string, type: "success" | "error" = "success") => {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3000);
};
```

Placer le composant toast en haut du return, juste sous le header :

```tsx
{toast && (
  <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-all
    ${toast.type === "success"
      ? "bg-green-50 border border-green-200 text-green-800"
      : "bg-red-50 border border-red-200 text-red-800"
    }`}
  >
    <span>{toast.type === "success" ? "✅" : "❌"}</span>
    {toast.message}
  </div>
)}
```

**Appeler `showToast`** dans les cas suivants :
- Après `applyPublicationDate()` réussie → `showToast("Date programmée enregistrée ✓")`
- Après `save()` réussie (uniquement pour les actions manuelles, pas les onBlur automatiques) → `showToast("Post mis à jour ✓")`
- Après `handleOptimize()` réussie → `showToast("Post optimisé et sauvegardé ✓")`
- En cas d'erreur dans `save()` → `showToast(err.message, "error")`

Pour les `onBlur` automatiques (subject, description, final_version, etc.) : ne pas afficher le toast pour éviter le spam, mais conserver le petit indicateur `"Saving..."` existant.

---

## Résumé des fichiers à modifier

| Fichier | Modifications |
|---|---|
| `src/routes/posts.ts` | FIX 1 (ensureSignature helper + appel dans /generate et /optimize), FIX 2 (vérifier que `linkedin_post_url: null` est accepté dans PUT) |
| `client/src/pages/PostDetail.tsx` | FIX 1 (fetch signature + injection lors sélection V1/V2/V3), FIX 2 (condition isActuallyPublished + bouton Reset), FIX 3 (bouton Optimize redesign), FIX 4 (confirmDelete state inline), FIX 5 (toast system) |

Aucune modification de schéma DB nécessaire. Aucune nouvelle dépendance NPM requise.

---

## Tests à effectuer après implémentation

1. **FIX 1** : Créer un post, générer les versions → vérifier que chaque V1/V2/V3 se termine par la signature. Cliquer sur V2 → vérifier que `final_version` contient la signature. Optimiser → vérifier que la signature est toujours là.
2. **FIX 2** : Publier un post, noter l'URL, vider l'URL manuellement via le bouton Reset → vérifier que le bouton "Publish on LinkedIn" réapparaît.
3. **FIX 3** : Vérifier visuellement que le bouton Optimize est grand, coloré et clairement séparé du bouton Publish.
4. **FIX 4** : Cliquer sur Supprimer → vérifier qu'un bouton de confirmation inline apparaît. Confirmer → vérifier que le post est bien supprimé et qu'on est redirigé vers `/posts`.
5. **FIX 5** : Modifier la date et cliquer "Save scheduled date" → vérifier que le toast vert apparaît 3 secondes. Même chose après Optimize.
