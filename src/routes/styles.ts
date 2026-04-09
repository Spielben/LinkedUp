import { Router } from "express";
import { getDb } from "../db/index.js";
import { callOpenRouter, estimateCost } from "../services/openrouter.js";

export const stylesRouter = Router();

stylesRouter.get("/", (_req, res) => {
  const db = getDb();
  const styles = db.prepare("SELECT * FROM styles ORDER BY created_at DESC").all();
  res.json(styles);
});

stylesRouter.get("/:id", (req, res) => {
  const db = getDb();
  const style = db.prepare("SELECT * FROM styles WHERE id = ?").get(req.params.id);
  if (!style) return res.status(404).json({ error: "Style not found" });
  res.json(style);
});

stylesRouter.post("/", (req, res) => {
  const db = getDb();
  const { name, linkedin_url } = req.body;
  const result = db.prepare("INSERT INTO styles (name, linkedin_url) VALUES (?, ?)").run(name, linkedin_url || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

stylesRouter.put("/:id", (req, res) => {
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
  db.prepare(`UPDATE styles SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM styles WHERE id = ?").get(req.params.id);
  res.json(updated);
});

stylesRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM styles WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── AI: Generate style instructions from examples ─────────────────────────
stylesRouter.post("/:id/generate", async (req, res) => {
  const db = getDb();
  const style = db.prepare("SELECT * FROM styles WHERE id = ?").get(req.params.id) as Record<string, string | null> | undefined;

  if (!style) return res.status(404).json({ error: "Style not found" });
  if (!style.examples || style.examples.trim().length === 0) {
    return res.status(400).json({ error: "Paste LinkedIn posts in the examples field first" });
  }

  const model = "anthropic/claude-sonnet-4";

  const prompt = `Tu es un expert en analyse de communication écrite et en personal branding LinkedIn.

À partir des posts LinkedIn suivants, réalise une analyse complète du style d'écriture de l'auteur en 4 étapes.

---

## Posts de l'auteur

${style.examples}

---

## Étape 1 : Analyse des communications écrites

Analyse les exemples selon ces critères :
- **Niveau de formalité** : décontracté, professionnel, académique...
- **Jargon** : vocabulaire technique utilisé, termes récurrents
- **Ton émotionnel** : optimiste, provocateur, empathique, neutre...
- **Verbosité** : concis ou élaboré, longueur des phrases
- **Structure des phrases** : simples, complexes, alternance...
- **Autres caractéristiques notables** : appels à l'action, emojis, formats, etc.

## Étape 2 : Profil du ton de voix

Rédige une description narrative détaillée du ton de voix de l'auteur.
Inclus les thèmes récurrents identifiés dans ses posts.

## Étape 3 : Paragraphe narratif (Clé universelle)

Rédige un paragraphe d'environ 100-150 mots qui capture parfaitement le style de l'auteur.
Ce paragraphe doit pouvoir servir de référence pour reproduire ce ton à l'identique.
Il doit sonner comme si l'auteur l'avait écrit lui-même.

## Étape 4 : Guide du ton de voix

Résume le tout en un guide concis et actionnable :
- Description du ton de voix (bullet points)
- La clé universelle de l'Étape 3

Ce guide sera utilisé comme contexte pour la génération future de posts dans ce style.`;

  try {
    const { content, usage } = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      model,
    });

    db.prepare("UPDATE styles SET instructions = ?, status = 'generated' WHERE id = ?")
      .run(content.trim(), req.params.id);

    const cost = estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
    db.prepare(`
      INSERT INTO token_usage (model, prompt_tokens, completion_tokens, cost_usd)
      VALUES (?, ?, ?, ?)
    `).run(model, usage.prompt_tokens, usage.completion_tokens, cost);

    const updated = db.prepare("SELECT * FROM styles WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
