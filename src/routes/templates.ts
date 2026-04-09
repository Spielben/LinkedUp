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
  const { name, description, linkedin_post_url, category, author } = req.body;
  const result = db.prepare(
    "INSERT INTO templates (name, description, linkedin_post_url, category, author) VALUES (?, ?, ?, ?, ?)"
  ).run(name, description || null, linkedin_post_url || null, category || null, author || null);
  res.status(201).json({ id: result.lastInsertRowid });
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
