# CURSOR BRIEF — Moteur de publication planifiée (Scheduled Publisher)

> Date : 2026-04-18  
> Priorité : Haute  
> App : LinkedUp (Node/Express + SQLite + React/Vite)

---

## Diagnostic

La `publication_date` est stockée en base SQLite mais **aucun code ne la surveille** pour déclencher une publication automatique. Le serveur (`src/server.ts`, `src/cli.ts`) ne contient aucun `setInterval`, cron, ou boucle de vérification. La publication n'est déclenchée que manuellement via `POST /api/posts/:id/publish`.

Les posts programmés ne se publient donc jamais automatiquement — c'est une fonctionnalité manquante, pas un bug de configuration.

---

## Ce qu'il faut construire

Un **scheduler interne** qui tourne en arrière-plan dans le processus Node existant et publie automatiquement les posts dont la `publication_date` est atteinte.

---

## Spécifications précises

### 1. Fichier à créer : `src/services/scheduler.ts`

Ce fichier contient une fonction `startScheduler()` qui démarre une boucle `setInterval` toutes les **60 secondes**.

À chaque tick, elle exécute cette logique :

```typescript
// Pseudocode de la logique du tick
const now = new Date().toISOString().replace("T", " ").slice(0, 19); // format SQLite: "2026-04-18 20:00:00"

const duePosts = db.prepare(`
  SELECT * FROM posts
  WHERE status = 'Programmé'
    AND publication_date IS NOT NULL
    AND publication_date <= ?
    AND linkedin_post_id IS NULL
`).all(now);

for (const post of duePosts) {
  // Appeler la logique de publication existante (voir section 2)
  // En cas de succès : status = 'Publié', linkedin_post_url, linkedin_post_id
  // En cas d'erreur : status = '❌ Erreur', publish_error = message d'erreur
}
```

**Conditions de sélection des posts à publier :**
- `status = 'Programmé'` — seulement les posts planifiés
- `publication_date <= now` — la date est atteinte ou dépassée
- `linkedin_post_id IS NULL` — pas déjà publié (évite les doublons)

**Gestion des erreurs :**
- Encapsuler chaque publication dans un `try/catch` individuel
- Un post en erreur ne doit pas bloquer les autres
- En cas d'erreur : mettre `status = '❌ Erreur'` et `publish_error = message` dans la DB

**Logging :**
- Ajouter une ligne dans la table `publish_log` pour chaque tentative (succès ou échec), comme le fait déjà la route manuelle `POST /api/posts/:id/publish`

---

### 2. Réutiliser la logique de publication existante

La logique de publication est déjà implémentée dans `src/routes/posts.ts` (route `POST /:id/publish`). **Ne pas la dupliquer.** La refactoriser en une fonction standalone dans `src/services/publisher.ts` :

```typescript
// src/services/publisher.ts
export async function publishPost(postId: number): Promise<{ success: boolean; error?: string }> {
  // Extraire ici le corps de la route POST /:id/publish existante :
  // - Vérification que le post existe et a un body publiable
  // - Résolution des médias (resolveAllMediaSources)
  // - Appel LinkedIn (publishTextPost ou publishPostWithImageBuffers)
  // - Mise à jour DB (linkedin_post_id, linkedin_post_url, status, publication_date)
  // - Publication du first_comment si présent
  // - Insertion dans publish_log
}
```

La route `POST /api/posts/:id/publish` dans `src/routes/posts.ts` doit ensuite simplement appeler `publishPost(id)` — elle ne change pas de comportement pour l'utilisateur.

---

### 3. Démarrer le scheduler au lancement du serveur

Dans `src/server.ts`, ajouter l'import et l'appel à `startScheduler()` après `getDb()` :

```typescript
// src/server.ts — dans la fonction createServer(), après getDb()
import { startScheduler } from "./services/scheduler.js";

// ...
getDb();
startScheduler(); // ← ajouter cette ligne
```

Le scheduler doit :
- Démarrer silencieusement (pas de log au lancement)
- Logger uniquement quand une publication est tentée : `[scheduler] Publishing post #42 "Mon sujet"...`
- Logger le résultat : `[scheduler] ✅ Post #42 published` ou `[scheduler] ❌ Post #42 failed: <message>`
- Se nettoyer proprement au `SIGINT` (appeler `clearInterval` dans le handler existant)

---

### 4. Modification de la route PUT /:id (changement de status)

Actuellement, quand l'utilisateur change le status d'un post "Publié" → "Programmé" manuellement, le `linkedin_post_id` reste renseigné dans la DB, ce qui empêche le scheduler de re-publier (condition `linkedin_post_id IS NULL`).

Ajouter cette logique dans la route `PUT /api/posts/:id` : si le champ `status` est modifié et passe à `'Programmé'`, remettre `linkedin_post_id = NULL` et `linkedin_post_url = NULL` automatiquement.

---

### 5. Indicateur visuel dans l'interface (client)

Dans `client/src/pages/PostDetail.tsx`, sous le champ "Publication date", ajouter un indicateur conditionnel quand le statut est "Programmé" et qu'une date est définie :

```tsx
{post.status === "Programmé" && post.publication_date && (
  <p className="text-xs text-teal-600 mt-1">
    ⏰ Publication automatique prévue le {new Date(post.publication_date).toLocaleString("fr-FR")}. 
    Le serveur doit être actif à cette heure.
  </p>
)}
```

Cet indicateur permet à l'utilisateur de savoir que la publication est planifiée ET de comprendre que le serveur doit tourner.

---

## Fichiers à modifier/créer

| Fichier | Action | Contenu |
|---------|--------|---------|
| `src/services/publisher.ts` | **Créer** | Logique de publication extraite de posts.ts |
| `src/services/scheduler.ts` | **Créer** | `startScheduler()` avec boucle 60s |
| `src/server.ts` | **Modifier** | Appel `startScheduler()` après `getDb()` |
| `src/routes/posts.ts` | **Modifier** | Route publish → appelle `publishPost()` ; route PUT → reset linkedin_post_id si status → Programmé |
| `client/src/pages/PostDetail.tsx` | **Modifier** | Indicateur visuel "publication prévue le..." |

---

## Tests à effectuer après implémentation

1. Créer un post avec `final_version` remplie, `status = 'Programmé'`, `publication_date` dans 2 minutes
2. Laisser le serveur tourner → vérifier dans les logs Terminal qu'à T+2min une ligne `[scheduler] Publishing post #X` apparaît
3. Vérifier dans l'interface que le status est passé à "Publié" et qu'un lien LinkedIn est affiché
4. Tester le cas d'erreur : couper la connexion LinkedIn (révoquer le token) → vérifier que status passe à "❌ Erreur" et que le message d'erreur est visible
5. Vérifier qu'un post déjà publié (`linkedin_post_id` renseigné) n'est pas republié même si `publication_date` est dépassée

---

## Note importante pour l'utilisateur

Même avec ce scheduler, **le serveur doit être actif** au moment de la publication planifiée. LINK'DUP est une application self-hosted qui tourne sur votre Mac. Si le Mac est éteint ou si l'app est fermée à l'heure prévue, la publication n'aura pas lieu.

Pour une publication planifiée non-surveillée (ex: publication à 7h du matin), envisager à terme un déploiement sur un serveur distant (VPS). Ce n'est pas l'objet de ce brief.
