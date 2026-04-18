import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { callOpenRouter, estimateCost } from "../services/openrouter.js";
import { extractFileContent, fetchWebContent, fetchYouTubeTranscript } from "../services/content-ingestion.js";

export const contenusRouter = Router();
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["PDF", "Article"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/html",
  "text/markdown",
  "application/markdown",
  "application/x-markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const contenuUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase()));
  },
});

function sanitizeUploadFilename(originalName: string): string {
  const base = path.basename(originalName).replace(/[^\w.-]+/g, "_");
  const trimmed = base.replace(/^_+|_+$/g, "");
  return trimmed || `upload-${Date.now()}`;
}

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
  const { name, description, url, type, content_raw } = req.body;
  const result = db.prepare(
    "INSERT INTO contenus (name, description, url, type, content_raw) VALUES (?, ?, ?, ?, ?)"
  ).run(name, description || null, url || null, type || null, content_raw || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

contenusRouter.post("/upload", (req, res, next) => {
  contenuUpload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    const msg =
      err instanceof multer.MulterError
        ? err.code === "LIMIT_FILE_SIZE"
          ? "File too large (max 20 MB)"
          : err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return res.status(400).json({ error: msg });
  });
}, (req, res) => {
  const db = getDb();
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  const type = typeof req.body.type === "string" ? req.body.type.trim() : "";

  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!ALLOWED_CONTENT_TYPES.has(type)) return res.status(400).json({ error: "Type must be PDF or Article" });
  if (!req.file) return res.status(400).json({ error: "No file (field name: file)" });

  const result = db.prepare(
    "INSERT INTO contenus (name, description, type, status) VALUES (?, ?, ?, 'pending')"
  ).run(name, description || null, type);
  const id = Number(result.lastInsertRowid);
  const uploadDir = path.join(process.cwd(), "data", "contenus", String(id));

  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    const safeName = sanitizeUploadFilename(req.file.originalname);
    const absolutePath = path.join(uploadDir, safeName);
    fs.writeFileSync(absolutePath, req.file.buffer);
    const relativePath = path.relative(process.cwd(), absolutePath).split(path.sep).join("/");

    db.prepare("UPDATE contenus SET pdf_path = ? WHERE id = ?").run(relativePath, id);
    const created = db.prepare("SELECT * FROM contenus WHERE id = ?").get(id);
    return res.status(201).json(created);
  } catch (err: unknown) {
    db.prepare("DELETE FROM contenus WHERE id = ?").run(id);
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
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
    } else if (pdf_path) {
      content_raw = await extractFileContent(pdf_path);
    } else if (type === "PDF" || type === "Article") {
      return res.status(400).json({ error: "No uploaded file found for this content" });
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
