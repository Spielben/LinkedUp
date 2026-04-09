import { Router } from "express";
import { getDb } from "../db/index.js";

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
