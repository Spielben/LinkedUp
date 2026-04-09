import { Router } from "express";
import { getDb } from "../db/index.js";
import { callOpenRouter, estimateCost } from "../services/openrouter.js";
import { fetchWebContent, fetchYouTubeTranscript, fetchPdfContent } from "../services/content-ingestion.js";

export const contenusRouter = Router();

contenusRouter.get("/", (_req, res) => {
  const db = getDb();
  const contenus = db.prepare("SELECT * FROM contenus ORDER BY created_at DESC").all();
  res.json(contenus);
});

contenusRouter.get("/:id", (req, res) => {
  const db = getDb();
  const contenu = db.prepare("SELECT * FROM contenus WHERE id = ?").get(req.params.id);
  if (!contenu) return res.status(404).json({ error: "Contenu not found" });
  res.json(contenu);
});

contenusRouter.post("/", (req, res) => {
  const db = getDb();
  const { name, description, url, type } = req.body;
  const result = db.prepare(
    "INSERT INTO contenus (name, description, url, type) VALUES (?, ?, ?, ?)"
  ).run(name, description || null, url || null, type || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

contenusRouter.put("/:id", (req, res) => {
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
  db.prepare(`UPDATE contenus SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM contenus WHERE id = ?").get(req.params.id);
  res.json(updated);
});

contenusRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM contenus WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── AI: Ingest content + summarize ────────────────────────────────────────
contenusRouter.post("/:id/ingest", async (req, res) => {
  const db = getDb();
  const contenu = db.prepare("SELECT * FROM contenus WHERE id = ?").get(req.params.id) as Record<string, string | null> | undefined;

  if (!contenu) return res.status(404).json({ error: "Contenu not found" });

  const model = "anthropic/claude-sonnet-4";

  try {
    // 1. Fetch raw content
    let content_raw = "";
    const url = contenu.url as string | null;
    const type = contenu.type as string | null;
    const pdf_path = contenu.pdf_path as string | null;

    if (url && (url.includes("youtube.com") || url.includes("youtu.be"))) {
      content_raw = await fetchYouTubeTranscript(url);
    } else if (type === "PDF" || pdf_path) {
      content_raw = await fetchPdfContent(pdf_path || "");
    } else if (url) {
      content_raw = await fetchWebContent(url);
    } else {
      return res.status(400).json({ error: "No URL or PDF path to ingest" });
    }

    // 2. Summarize with OpenRouter
    const prompt = `Tu es un expert en synthèse de contenu.

Analyse le contenu suivant et produis un résumé structuré qui servira de base pour la création de posts LinkedIn.

---

## Source

**Type** : ${contenu.type || "Web"}
**Nom** : ${contenu.name}
**Description** : ${contenu.description || ""}

## Contenu brut

${content_raw.slice(0, 20_000)}

---

## Consignes

1. Résumé (~2000-3000 caractères) :
   - Les idées principales et arguments clés
   - Les chiffres et statistiques mentionnés
   - Les citations ou formulations marquantes
   - Les appels à l'action ou offres
   - Structuré en sections avec des bullet points
2. Le résumé doit être suffisamment riche pour permettre de générer plusieurs posts LinkedIn

Retourne uniquement le résumé structuré.`;

    const { content: summary, usage } = await callOpenRouter({
      messages: [{ role: "user", content: prompt }],
      model,
    });

    // 3. Save
    db.prepare("UPDATE contenus SET content_raw = ?, summary = ?, status = 'generated' WHERE id = ?")
      .run(content_raw, summary.trim(), req.params.id);

    const cost = estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
    db.prepare(`
      INSERT INTO token_usage (model, prompt_tokens, completion_tokens, cost_usd)
      VALUES (?, ?, ?, ?)
    `).run(model, usage.prompt_tokens, usage.completion_tokens, cost);

    const updated = db.prepare("SELECT * FROM contenus WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
