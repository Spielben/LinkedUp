import { Router } from "express";
import { getDb } from "../db/index.js";

export const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  const db = getDb();
  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  res.json(settings || {});
});

settingsRouter.put("/", (req, res) => {
  const db = getDb();
  const { name, email, linkedin_url, signature, budget_limit } = req.body;

  const existing = db.prepare("SELECT * FROM settings WHERE id = 1").get();

  if (existing) {
    db.prepare(`
      UPDATE settings SET name = ?, email = ?, linkedin_url = ?, signature = ?, budget_limit = ?
      WHERE id = 1
    `).run(name || null, email || null, linkedin_url || null, signature || null, budget_limit || null);
  } else {
    db.prepare(`
      INSERT INTO settings (id, name, email, linkedin_url, signature, budget_limit)
      VALUES (1, ?, ?, ?, ?, ?)
    `).run(name || null, email || null, linkedin_url || null, signature || null, budget_limit || null);
  }

  const updated = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  res.json(updated);
});
