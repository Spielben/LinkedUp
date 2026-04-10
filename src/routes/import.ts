import { Router } from "express";
import multer from "multer";
import { getDb } from "../db/index.js";

const upload = multer({ storage: multer.memoryStorage() });
export const importRouter = Router();

// Simple CSV parser
function parseCSV(data: string): string[][] {
  const lines = data.split("\n");
  const rows: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
}

importRouter.post("/csv", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  const { table } = req.body;
  if (!["styles", "templates", "contenus"].includes(table)) {
    return res.status(400).json({ error: "Invalid table name" });
  }

  try {
    const csvText = req.file.buffer.toString("utf-8");
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return res.json({ imported: 0, skipped: 0, total: 0 });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    let result: ImportResult;

    switch (table) {
      case "styles":
        result = importStyles(headers, dataRows);
        break;
      case "templates":
        result = importTemplates(headers, dataRows);
        break;
      case "contenus":
        result = importContenus(headers, dataRows);
        break;
      default:
        return res.status(400).json({ error: "Invalid table" });
    }

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

function importStyles(headers: string[], rows: string[][]): ImportResult {
  const db = getDb();
  let imported = 0;
  let skipped = 0;

  // Map headers: "Nom" -> "name", "URL Profil Linkedin" -> "linkedin_url", etc.
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h] = i;
  });

  for (const row of rows) {
    if (row.every((cell) => !cell)) continue; // Skip empty rows

    const name = row[headerMap["Nom"]]?.trim() || "";
    const linkedin_url = row[headerMap["URL Profil Linkedin"]]?.trim() || null;
    const generatedStatus = row[headerMap["Générer style"]]?.trim() || "";
    const status = generatedStatus.toLowerCase() === "généré" ? "generated" : "pending";
    const instructions = row[headerMap["Instructions"]]?.trim() || null;
    const examples = row[headerMap["Exemples"]]?.trim() || null;

    if (!name) {
      skipped++;
      continue;
    }

    try {
      db.prepare(
        `INSERT OR IGNORE INTO styles (name, linkedin_url, status, instructions, examples)
         VALUES (?, ?, ?, ?, ?)`
      ).run(name, linkedin_url, status, instructions, examples);
      imported++;
    } catch (e) {
      skipped++;
    }
  }

  return { imported, skipped, total: rows.length };
}

function importTemplates(headers: string[], rows: string[][]): ImportResult {
  const db = getDb();
  let imported = 0;
  let skipped = 0;

  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h] = i;
  });

  for (const row of rows) {
    if (row.every((cell) => !cell)) continue;

    const name = row[headerMap["Nom"]]?.trim() || "";
    const description = row[headerMap["Description"]]?.trim() || null;
    const linkedin_post_url = row[headerMap["Post Linkedin"]]?.trim() || null;
    const author = row[headerMap["Auteur"]]?.trim() || null;
    const category = row[headerMap["Catégorie"]]?.trim() || null;
    const image_url = row[headerMap["Image"]]?.trim() || null;
    const example_text = row[headerMap["Exemple"]]?.trim() || null;
    const template_text = row[headerMap["Template"]]?.trim() || null;
    const likes = parseInt(row[headerMap["Likes"]]?.trim() || "0", 10) || 0;
    const comments = parseInt(row[headerMap["Commentaires"]]?.trim() || "0", 10) || 0;
    const shares = parseInt(row[headerMap["Partages"]]?.trim() || "0", 10) || 0;
    const publication_date = row[headerMap["Date de publication"]]?.trim() || null;

    if (!name || !linkedin_post_url) {
      skipped++;
      continue;
    }

    try {
      db.prepare(
        `INSERT OR IGNORE INTO templates (name, description, linkedin_post_url, author, category, image_url, example_text, template_text, likes, comments, shares, publication_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        name,
        description,
        linkedin_post_url,
        author,
        category,
        image_url,
        example_text,
        template_text,
        likes,
        comments,
        shares,
        publication_date
      );
      imported++;
    } catch (e) {
      skipped++;
    }
  }

  return { imported, skipped, total: rows.length };
}

function importContenus(headers: string[], rows: string[][]): ImportResult {
  const db = getDb();
  let imported = 0;
  let skipped = 0;

  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h] = i;
  });

  for (const row of rows) {
    if (row.every((cell) => !cell)) continue;

    const name = row[headerMap["Nom"]]?.trim() || "";

    // Skip header echo row
    if (name === "Nom") continue;

    const description = row[headerMap["Description"]]?.trim() || null;
    const url = row[headerMap["URL"]]?.trim() || null;
    const type = row[headerMap["Type"]]?.trim() || null;
    const content_raw = row[headerMap["Contenu"]]?.trim() || null;
    const summary = row[headerMap["Résumé"]]?.trim() || null;
    const hasSummary = summary && summary.length > 0;
    const status = hasSummary ? "generated" : "pending";

    if (!name) {
      skipped++;
      continue;
    }

    try {
      db.prepare(
        `INSERT OR IGNORE INTO contenus (name, description, url, type, content_raw, summary, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(name, description, url, type, content_raw, summary, status);
      imported++;
    } catch (e) {
      skipped++;
    }
  }

  return { imported, skipped, total: rows.length };
}
