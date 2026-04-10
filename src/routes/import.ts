import { Router } from "express";
import multer from "multer";
import { getDb } from "../db/index.js";

export const importRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max CSV file size
});
type ImportTable = "styles" | "templates" | "contenus";

// Simple CSV parser — handles quoted fields with commas and newlines
function parseCSV(data: string): string[][] {
  // Remove BOM
  const clean = data.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (char === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(current.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  // Last row
  row.push(current.trim());
  if (row.some((cell) => cell)) rows.push(row);

  return rows;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
}

function isImportTable(value: string): value is ImportTable {
  return value === "styles" || value === "templates" || value === "contenus";
}

function runImport(table: ImportTable, headers: string[], dataRows: string[][]): ImportResult {
  switch (table) {
    case "styles":
      return importStyles(headers, dataRows);
    case "templates":
      return importTemplates(headers, dataRows);
    case "contenus":
      return importContenus(headers, dataRows);
  }
}

importRouter.post(
  "/csv",
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "File too large (max 5MB)" });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
      }
      next();
    });
  },
  (req, res) => {
    const table = String(req.body?.table ?? "");
    if (!isImportTable(table)) {
      return res.status(400).json({ error: "Invalid table name" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Missing CSV file" });
    }

    const filename = file.originalname?.toLowerCase() ?? "";
    const mime = file.mimetype?.toLowerCase() ?? "";
    const looksLikeCsv =
      filename.endsWith(".csv") ||
      mime.includes("csv") ||
      mime.includes("text/plain") ||
      mime.includes("application/vnd.ms-excel");

    if (!looksLikeCsv) {
      return res.status(400).json({ error: "Only CSV files are accepted" });
    }

    try {
      const content = file.buffer.toString("utf-8");
      const rows = parseCSV(content);
      if (rows.length < 2) {
        return res.json({ imported: 0, skipped: 0, total: 0 });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);
      const result = runImport(table, headers, dataRows);
      return res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: msg });
    }
  }
);

// Accept CSV/JSON as raw text in body — no multer needed
importRouter.post("/data", (req, res) => {
  const { table, format, content } = req.body;

  if (!isImportTable(table)) {
    return res.status(400).json({ error: "Invalid table name" });
  }
  if (!content) {
    return res.status(400).json({ error: "No content provided" });
  }

  try {
    let headers: string[];
    let dataRows: string[][];

    if (format === "json") {
      // JSON array of objects
      const jsonData = JSON.parse(content);
      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        return res.json({ imported: 0, skipped: 0, total: 0 });
      }
      headers = Object.keys(jsonData[0]);
      dataRows = jsonData.map((row: Record<string, unknown>) =>
        headers.map((h) => String(row[h] ?? ""))
      );
    } else {
      // CSV
      const rows = parseCSV(content);
      if (rows.length < 2) {
        return res.json({ imported: 0, skipped: 0, total: 0 });
      }
      headers = rows[0];
      dataRows = rows.slice(1);
    }

    const result = runImport(table, headers, dataRows);

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
  const selectByName = db.prepare("SELECT id FROM styles WHERE name = ?");
  const insert = db.prepare(
    `INSERT INTO styles (name, linkedin_url, status, instructions, examples)
     VALUES (?, ?, ?, ?, ?)`
  );

  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h] = i;
  });

  for (const row of rows) {
    if (row.every((cell) => !cell)) continue;

    const name = row[headerMap["Nom"]]?.trim() || row[headerMap["name"]]?.trim() || "";
    const linkedin_url =
      row[headerMap["URL Profil Linkedin"]]?.trim() ||
      row[headerMap["linkedin_url"]]?.trim() || null;
    const generatedStatus =
      row[headerMap["Générer style"]]?.trim() ||
      row[headerMap["status"]]?.trim() || "";
    const status =
      generatedStatus.toLowerCase() === "généré" || generatedStatus === "generated"
        ? "generated"
        : "pending";
    const instructions =
      row[headerMap["Instructions"]]?.trim() ||
      row[headerMap["instructions"]]?.trim() || null;
    const examples =
      row[headerMap["Exemples"]]?.trim() ||
      row[headerMap["examples"]]?.trim() || null;

    if (!name) {
      skipped++;
      continue;
    }

    try {
      const exists = selectByName.get(name);
      if (exists) {
        skipped++;
        continue;
      }
      insert.run(name, linkedin_url, status, instructions, examples);
      imported += 1;
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
  const selectByLinkedinUrl = db.prepare("SELECT id FROM templates WHERE linkedin_post_url = ?");
  const insert = db.prepare(
    `INSERT INTO templates (name, description, linkedin_post_url, author, category, image_url, example_text, template_text, likes, comments, shares, publication_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h] = i;
  });

  for (const row of rows) {
    if (row.every((cell) => !cell)) continue;

    const name = row[headerMap["Nom"]]?.trim() || row[headerMap["name"]]?.trim() || "";
    const description = row[headerMap["Description"]]?.trim() || row[headerMap["description"]]?.trim() || null;
    const linkedin_post_url = row[headerMap["Post Linkedin"]]?.trim() || row[headerMap["linkedin_post_url"]]?.trim() || null;
    const author = row[headerMap["Auteur"]]?.trim() || row[headerMap["author"]]?.trim() || null;
    const category = row[headerMap["Catégorie"]]?.trim() || row[headerMap["category"]]?.trim() || null;
    const image_url = row[headerMap["Image"]]?.trim() || row[headerMap["image_url"]]?.trim() || null;
    const example_text = row[headerMap["Exemple"]]?.trim() || row[headerMap["example_text"]]?.trim() || null;
    const template_text = row[headerMap["Template"]]?.trim() || row[headerMap["template_text"]]?.trim() || null;
    const likes = parseInt(row[headerMap["Likes"]]?.trim() || row[headerMap["likes"]]?.trim() || "0", 10) || 0;
    const comments = parseInt(row[headerMap["Commentaires"]]?.trim() || row[headerMap["comments"]]?.trim() || "0", 10) || 0;
    const shares = parseInt(row[headerMap["Partages"]]?.trim() || row[headerMap["shares"]]?.trim() || "0", 10) || 0;
    const publication_date = row[headerMap["Date de publication"]]?.trim() || row[headerMap["publication_date"]]?.trim() || null;

    if (!name || !linkedin_post_url) {
      skipped++;
      continue;
    }

    try {
      const exists = selectByLinkedinUrl.get(linkedin_post_url);
      if (exists) {
        skipped++;
        continue;
      }
      insert.run(
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
      imported += 1;
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
  const selectByName = db.prepare("SELECT id FROM contenus WHERE name = ?");
  const insert = db.prepare(
    `INSERT INTO contenus (name, description, url, type, content_raw, summary, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h] = i;
  });

  for (const row of rows) {
    if (row.every((cell) => !cell)) continue;

    let name = row[headerMap["Nom"]]?.trim() || row[headerMap["name"]]?.trim() || "";

    // Skip header echo row
    if (name === "Nom") continue;

    // Clean leading commas or special chars from name
    name = name.replace(/^[,\s]+/, "");

    const description = row[headerMap["Description"]]?.trim() || row[headerMap["description"]]?.trim() || null;
    const url =
      row[headerMap["URL (web ou youtube)"]]?.trim() ||
      row[headerMap["URL"]]?.trim() ||
      row[headerMap["url"]]?.trim() || null;
    const type = row[headerMap["Type"]]?.trim() || row[headerMap["type"]]?.trim() || null;
    const content_raw = row[headerMap["Contenu"]]?.trim() || row[headerMap["content_raw"]]?.trim() || null;
    const summary = row[headerMap["Résumé"]]?.trim() || row[headerMap["summary"]]?.trim() || null;
    const generateCol =
      row[headerMap["Générer Contenu"]]?.trim() ||
      row[headerMap["status"]]?.trim() ||
      "";
    const hasSummary = Boolean(summary && summary.length > 0);
    const status =
      generateCol.toLowerCase() === "généré" || generateCol === "generated" || hasSummary
        ? "generated"
        : "pending";

    if (!name) {
      skipped++;
      continue;
    }

    try {
      const exists = selectByName.get(name);
      if (exists) {
        skipped++;
        continue;
      }
      insert.run(name, description, url, type, content_raw, summary, status);
      imported += 1;
    } catch (e) {
      skipped++;
    }
  }

  return { imported, skipped, total: rows.length };
}
