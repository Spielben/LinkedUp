import { Router } from "express";
import { getDb } from "../db/index.js";
import fs from "node:fs";
import path from "node:path";

export const seedRouter = Router();

const AUDIT_DIR = path.join(process.env.HOME || "~", "Documents/linkdup-audit");

seedRouter.post("/", (_req, res) => {
  const db = getDb();

  const results: Record<string, number | string> = {};

  // Import templates
  try {
    const templatesPath = path.join(AUDIT_DIR, "templates.json");
    if (fs.existsSync(templatesPath)) {
      const data = JSON.parse(fs.readFileSync(templatesPath, "utf-8"));
      const records = data.records || [];
      const insert = db.prepare(`
        INSERT OR IGNORE INTO templates (name, description, linkedin_post_url, category, author, template_text, example_text, likes, comments, shares, impressions, publication_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const tx = db.transaction(() => {
        let count = 0;
        for (const r of records) {
          const f = r.fields;
          insert.run(
            f["Nom"] || "Untitled",
            null,
            f["Post Linkedin"] || null,
            f["Catégorie"] || null,
            f["Auteur"] || null,
            f["Template"] || null,
            f["Exemple"] || null,
            f["Likes"] || 0,
            f["Commentaires"] || 0,
            f["Partages"] || 0,
            f["Impressions"] ?? 0,
            f["Date de publication"] || null
          );
          count++;
        }
        return count;
      });
      results.templates = tx();
    }
  } catch (e) {
    results.templates_error = String(e);
  }

  // Import styles
  try {
    const stylesPath = path.join(AUDIT_DIR, "styles.json");
    if (fs.existsSync(stylesPath)) {
      const data = JSON.parse(fs.readFileSync(stylesPath, "utf-8"));
      const records = data.records || [];
      const insert = db.prepare(`
        INSERT OR IGNORE INTO styles (name, linkedin_url, status, instructions, examples)
        VALUES (?, ?, ?, ?, ?)
      `);

      const tx = db.transaction(() => {
        let count = 0;
        for (const r of records) {
          const f = r.fields;
          insert.run(
            f["Nom"] || "Untitled",
            f["URL Profil Linkedin"] || null,
            "generated",
            f["Instructions"] || null,
            f["Exemples"] || null
          );
          count++;
        }
        return count;
      });
      results.styles = tx();
    }
  } catch (e) {
    results.styles_error = String(e);
  }

  // Import contenus
  try {
    const contenusPath = path.join(AUDIT_DIR, "contenus.json");
    if (fs.existsSync(contenusPath)) {
      const data = JSON.parse(fs.readFileSync(contenusPath, "utf-8"));
      const records = data.records || [];
      const insert = db.prepare(`
        INSERT OR IGNORE INTO contenus (name, description, url, type, content_raw, summary, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const tx = db.transaction(() => {
        let count = 0;
        for (const r of records) {
          const f = r.fields;
          insert.run(
            f["Nom"] || "Untitled",
            f["Description"] || null,
            f["URL (web ou youtube)"] || null,
            f["Type"] || null,
            f["Contenu"] || null,
            f["Résumé"] || null,
            "generated"
          );
          count++;
        }
        return count;
      });
      results.contenus = tx();
    }
  } catch (e) {
    results.contenus_error = String(e);
  }

  res.json({ ok: true, imported: results });
});
