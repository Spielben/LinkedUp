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

  const prompt = `You are an expert in written communication and LinkedIn personal branding.

From the sample LinkedIn posts below, deliver a full analysis of the author's writing style in 4 steps. Write your entire response in English (even if the sample posts are in another language—analyze and describe in English).

---

## Author's posts

${style.examples}

---

## Step 1: Written communication analysis

Evaluate the examples on:
- **Formality** : casual, professional, academic, etc.
- **Jargon** : technical vocabulary, recurring terms
- **Emotional tone** : optimistic, provocative, empathetic, neutral, etc.
- **Verbosity** : concise vs elaborate, sentence length
- **Sentence structure** : simple, complex, mix, etc.
- **Other notes** : CTAs, emojis, formatting patterns, etc.

## Step 2: Voice profile

Write a detailed narrative description of the author's voice, including recurring themes in their posts.

## Step 3: Narrative paragraph (universal key)

Write a paragraph of about 100–150 words that captures the author's style. It should be a reference to reproduce the same voice; it should read as if the author could have written it.

## Step 4: Voice guide

Summarize in a concise, actionable guide:
- Voice description (bullet points)
- The universal key from Step 3

This guide will be used as context for future post generation in this style.`;

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
