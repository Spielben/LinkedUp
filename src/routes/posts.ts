import { Router } from "express";
import { getDb } from "../db/index.js";
import { callOpenRouter, estimateCost } from "../services/openrouter.js";

export const postsRouter = Router();

postsRouter.get("/", (_req, res) => {
  const db = getDb();
  const posts = db.prepare(`
    SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(posts);
});

postsRouter.get("/:id", (req, res) => {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

postsRouter.post("/", (req, res) => {
  const db = getDb();
  const { subject, description, model, status, style_id, template_id, contenu_id, publication_date } = req.body;
  const result = db.prepare(`
    INSERT INTO posts (subject, description, model, status, style_id, template_id, contenu_id, publication_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subject || null,
    description || null,
    model || "anthropic/claude-sonnet-4",
    status || "Idée",
    style_id || null,
    template_id || null,
    contenu_id || null,
    publication_date || null
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

postsRouter.put("/:id", (req, res) => {
  const db = getDb();
  const fields = req.body;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === "id") continue;
    setClauses.push(`${key} = ?`);
    values.push(value);
  }

  if (setClauses.length === 0) return res.status(400).json({ error: "No fields to update" });

  values.push(req.params.id);
  db.prepare(`UPDATE posts SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  res.json(updated);
});

postsRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── AI: Generate V1 / V2 / V3 ─────────────────────────────────────────────
postsRouter.post("/:id/generate", async (req, res) => {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*, s.instructions as style_instructions,
           t.template_text, c.summary as contenu_summary, c.content_raw as contenu_raw
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    LEFT JOIN templates t ON p.template_id = t.id
    LEFT JOIN contenus c ON p.contenu_id = c.id
    WHERE p.id = ?
  `).get(req.params.id) as Record<string, string | null> | undefined;

  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!post.subject) return res.status(400).json({ error: "Post subject is required to generate content" });

  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Record<string, string | null> | undefined;

  const model = (post.model as string) || "anthropic/claude-sonnet-4";

  const prompt = `Tu es un expert en création de posts LinkedIn engageants et viraux.

Ton objectif est de rédiger 3 versions différentes d'un post LinkedIn en respectant le style d'écriture, la structure du template (si fourni), et en intégrant le contenu de référence (si fourni).

---

## Informations du post

**Sujet** : ${post.subject}

**Description / Instructions** :
${post.description || "Aucune description fournie."}

---

## Style d'écriture à reproduire

${post.style_instructions || "Aucun style défini. Utilise un ton professionnel et engageant."}

---

## Template / Structure à suivre (optionnel)

${post.template_text || "Aucun template fourni. Utilise une structure engageante adaptée au sujet."}

---

## Contenu de référence (optionnel)

${post.contenu_summary || post.contenu_raw || "Aucun contenu de référence fourni."}

---

## Signature

${settings?.signature || ""}

---

## Consignes

1. Génère exactement 3 versions du post, chacune avec un angle/hook différent
2. Chaque version doit :
   - Respecter le ton de voix décrit dans le style
   - Suivre la structure du template si fourni
   - Intégrer les informations clés de la description
   - Utiliser le contenu de référence si fourni
   - Se terminer par la signature
3. Les 3 versions doivent être distinctes dans leur approche :
   - V1 : Hook basé sur une question ou un problème
   - V2 : Hook basé sur une observation ou une analyse
   - V3 : Hook basé sur des chiffres, secrets ou une liste
4. Format LinkedIn : phrases courtes, sauts de ligne fréquents, emojis si le style le permet
5. Longueur : 600-900 caractères par version

Retourne le résultat dans ce format exact :

V1:
[contenu de la version 1]

V2:
[contenu de la version 2]

V3:
[contenu de la version 3]`;

  try {
    const { content, usage } = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      model,
    });

    const versions = parseVersions(content);

    db.prepare(`
      UPDATE posts SET v1 = ?, v2 = ?, v3 = ?, status = 'Brouillon' WHERE id = ?
    `).run(versions.v1 || null, versions.v2 || null, versions.v3 || null, req.params.id);

    const cost = estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
    db.prepare(`
      INSERT INTO token_usage (post_id, model, prompt_tokens, completion_tokens, cost_usd)
      VALUES (?, ?, ?, ?, ?)
    `).run(Number(req.params.id), model, usage.prompt_tokens, usage.completion_tokens, cost);

    const updated = db.prepare(`
      SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
      FROM posts p
      LEFT JOIN styles s ON p.style_id = s.id
      LEFT JOIN templates t ON p.template_id = t.id
      LEFT JOIN contenus c ON p.contenu_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── AI: Optimize final_version ─────────────────────────────────────────────
postsRouter.post("/:id/optimize", async (req, res) => {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*, s.instructions as style_instructions
    FROM posts p
    LEFT JOIN styles s ON p.style_id = s.id
    WHERE p.id = ?
  `).get(req.params.id) as Record<string, string | null> | undefined;

  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!post.final_version) return res.status(400).json({ error: "No final version to optimize" });
  if (!post.optimization_instructions) return res.status(400).json({ error: "No optimization instructions provided" });

  const model = (post.model as string) || "anthropic/claude-sonnet-4";

  const prompt = `Tu es un expert en optimisation de posts LinkedIn.

Optimise le post suivant en appliquant les instructions d'optimisation tout en préservant le ton de voix de l'auteur.

---

## Post actuel

${post.final_version}

---

## Instructions d'optimisation

${post.optimization_instructions}

---

## Style d'écriture à respecter

${post.style_instructions || "Aucun style défini."}

---

## Consignes

1. Applique les instructions d'optimisation au post
2. Conserve le ton de voix et le style d'écriture
3. Maintiens la structure générale du post
4. Garde la même longueur approximative
5. Ne change pas la signature

Retourne uniquement le post optimisé, sans commentaire ni explication.`;

  try {
    const { content, usage } = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      model,
    });

    db.prepare("UPDATE posts SET final_version = ? WHERE id = ?").run(content.trim(), req.params.id);

    const cost = estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
    db.prepare(`
      INSERT INTO token_usage (post_id, model, prompt_tokens, completion_tokens, cost_usd)
      VALUES (?, ?, ?, ?, ?)
    `).run(Number(req.params.id), model, usage.prompt_tokens, usage.completion_tokens, cost);

    const updated = db.prepare(`
      SELECT p.*, s.name as style_name, t.name as template_name, c.name as contenu_name
      FROM posts p
      LEFT JOIN styles s ON p.style_id = s.id
      LEFT JOIN templates t ON p.template_id = t.id
      LEFT JOIN contenus c ON p.contenu_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

function parseVersions(text: string): { v1: string; v2: string; v3: string } {
  const v1Match = text.match(/V1:\s*\n([\s\S]*?)(?=\nV2:)/);
  const v2Match = text.match(/V2:\s*\n([\s\S]*?)(?=\nV3:)/);
  const v3Match = text.match(/V3:\s*\n([\s\S]*?)$/);
  return {
    v1: v1Match?.[1]?.trim() || "",
    v2: v2Match?.[1]?.trim() || "",
    v3: v3Match?.[1]?.trim() || "",
  };
}
