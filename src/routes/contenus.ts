import { Router } from "express";
import { getDb } from "../db/index.js";

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
