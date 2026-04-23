import { Router } from "express";
import { getDb } from "../db/index.js";

export const templatesRouter = Router();

templatesRouter.get("/", (_req, res) => {
  const db = getDb();
  const templates = db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all();
  res.json(templates);
});

templatesRouter.get("/:id", (req, res) => {
  const db = getDb();
  const template = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.json(template);
});

templatesRouter.post("/", (req, res) => {
  const db = getDb();
  const b = req.body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name : "";
  if (!name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const toNum = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : parseInt(String(v ?? "0"), 10)) || 0;
  const result = db
    .prepare(
      `INSERT INTO templates (name, description, linkedin_post_url, category, author, template_text, example_text, image_url,
         likes, comments, shares, impressions, publication_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      typeof b.description === "string" ? b.description : null,
      typeof b.linkedin_post_url === "string" ? b.linkedin_post_url : null,
      typeof b.category === "string" ? b.category : null,
      typeof b.author === "string" ? b.author : null,
      typeof b.template_text === "string" ? b.template_text : null,
      typeof b.example_text === "string" ? b.example_text : null,
      typeof b.image_url === "string" ? b.image_url : null,
      toNum(b.likes),
      toNum(b.comments),
      toNum(b.shares),
      toNum(b.impressions),
      typeof b.publication_date === "string" ? b.publication_date : null
    );
  const created = db.prepare("SELECT * FROM templates WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

templatesRouter.put("/:id", (req, res) => {
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
  db.prepare(`UPDATE templates SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM templates WHERE id = ?").get(req.params.id);
  res.json(updated);
});

templatesRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});
