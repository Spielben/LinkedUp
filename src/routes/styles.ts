import { Router } from "express";
import { getDb } from "../db/index.js";

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
