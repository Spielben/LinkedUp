import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { callOpenRouter, estimateCost } from "../services/openrouter.js";
import { extractFileContent, fetchWebContent, fetchYouTubeTranscript, fetchYouTubeTranscriptViaApify } from "../services/content-ingestion.js";
import { fetchVideoTranscriptAssembly, isThirdPartyVideoIngestUrl } from "../services/video-transcript.js";

/** Ingest: English by default; French when Settings → language is `fr`. */
function buildIngestSummaryPrompt(
  contenu: { type: string | null; name: string; description: string | null },
  contentRaw: string,
  useFrench: boolean
): string {
  const raw = contentRaw.slice(0, 20_000);
  const type = contenu.type || "Web";
  const name = contenu.name;
  const desc = contenu.description || "";
  if (useFrench) {
    return `Tu es un expert en synthèse de contenu.

Analyse le contenu suivant et produis un résumé structuré en français qui servira de base pour la création de posts LinkedIn.

---

## Source

**Type** : ${type}
**Nom** : ${name}
**Description** : ${desc}

## Contenu brut

${raw}

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
  }
  return `You are a content summarization expert.

Analyze the following and produce a structured summary to use as a basis for LinkedIn post creation. Write the entire summary in English (default for international LinkedIn use).

---

## Source

**Type:** ${type}
**Name:** ${name}
**Description:** ${desc}

## Raw content

${raw}

---

## Instructions

1. Summary (about 2,000–3,000 characters):
   - Main ideas and key arguments
   - Numbers and statistics mentioned
   - Notable quotes or phrasing
   - Calls to action or offers
   - Use sections with bullet points
2. The summary must be rich enough to support several distinct LinkedIn posts.

Return only the structured summary.`;
}

export const contenusRouter = Router();
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["PDF", "Article", "Video"]);
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
  try {
    const db = getDb();
    const { name, description, url, type, content_raw, category, title, source_notes } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const cat =
      typeof category === "string" && category.trim() ? category.trim() : null;
    const titleVal = typeof title === "string" && title.trim() ? title.trim() : null;
    const notesVal = typeof source_notes === "string" && source_notes.trim() ? source_notes.trim() : null;
    const result = db
      .prepare(
        "INSERT INTO contenus (name, description, category, url, type, content_raw, title, source_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(name.trim(), description || null, cat, url || null, type || null, content_raw || null, titleVal, notesVal);
    const created = db.prepare("SELECT * FROM contenus WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[contenus/create]", msg);
    return res.status(500).json({ error: msg });
  }
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
  const title = typeof req.body.title === "string" ? req.body.title.trim() || null : null;
  const sourceNotes = typeof req.body.source_notes === "string" ? req.body.source_notes.trim() || null : null;
  const type = typeof req.body.type === "string" ? req.body.type.trim() : "";
  const category =
    typeof req.body.category === "string" && req.body.category.trim() ? req.body.category.trim() : null;

  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!ALLOWED_CONTENT_TYPES.has(type)) return res.status(400).json({ error: "Type must be PDF, Article, or Video" });
  if (type === "Video") {
    return res.status(400).json({
      error: "Video sources use a URL only — create content with type Video (no file), paste the link, then Ingest.",
    });
  }
  if (!req.file) return res.status(400).json({ error: "No file (field name: file)" });

  const result = db.prepare(
    "INSERT INTO contenus (name, description, category, type, status, title, source_notes) VALUES (?, ?, ?, ?, 'pending', ?, ?)"
  ).run(name, description || null, category, type, title, sourceNotes);
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

contenusRouter.post("/:id/replace-upload", (req, res, next) => {
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
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM contenus WHERE id = ?").get(id) as
    | { type: string | null; pdf_path: string | null }
    | undefined;
  if (!row) return res.status(404).json({ error: "Contenu not found" });
  const t = row.type || "";
  if (t !== "PDF" && t !== "Article") {
    return res.status(400).json({ error: "Replace file is only for PDF or Article types" });
  }
  if (!req.file) return res.status(400).json({ error: "No file (field name: file)" });

  const oldPath = row.pdf_path;
  if (oldPath && !oldPath.includes("..")) {
    const absOld = path.isAbsolute(oldPath) ? oldPath : path.join(process.cwd(), oldPath);
    try {
      if (absOld.startsWith(path.join(process.cwd(), "data", "contenus"))) fs.unlinkSync(absOld);
    } catch {
      /* ignore */
    }
  }

  const uploadDir = path.join(process.cwd(), "data", "contenus", String(id));
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    const safeName = sanitizeUploadFilename(req.file.originalname);
    const absolutePath = path.join(uploadDir, safeName);
    fs.writeFileSync(absolutePath, req.file.buffer);
    const relativePath = path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
    db.prepare(
      "UPDATE contenus SET pdf_path = ?, summary = NULL, content_raw = NULL, status = 'pending' WHERE id = ?"
    ).run(relativePath, id);
    const updated = db.prepare("SELECT * FROM contenus WHERE id = ?").get(id);
    return res.json(updated);
  } catch (err: unknown) {
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
      // 1. Try youtube-transcript library (fast, no API cost)
      try {
        content_raw = await fetchYouTubeTranscript(url);
      } catch (ytErr) {
        const msg = ytErr instanceof Error ? ytErr.message : String(ytErr);
        console.warn("[ingest] youtube-transcript failed:", msg);
      }
      // 2. If blocked/empty, try Apify (runs on non-blocked cloud IPs)
      if (!content_raw.trim()) {
        console.log("[ingest] youtube-transcript returned empty, trying Apify...");
        try {
          content_raw = await fetchYouTubeTranscriptViaApify(url);
          console.log("[ingest] Apify transcript OK, length:", content_raw.length);
        } catch (apifyErr) {
          const msg = apifyErr instanceof Error ? apifyErr.message : String(apifyErr);
          console.warn("[ingest] Apify fallback failed:", msg);
        }
      }
      // 3. Last resort: AssemblyAI via yt-dlp audio download
      if (!content_raw.trim()) {
        console.log("[ingest] Apify failed, falling back to AssemblyAI...");
        content_raw = await fetchVideoTranscriptAssembly(url);
      }
    } else if (url && isThirdPartyVideoIngestUrl(url)) {
      content_raw = await fetchVideoTranscriptAssembly(url);
    } else if (pdf_path) {
      content_raw = await extractFileContent(pdf_path);
    } else if (type === "PDF" || type === "Article") {
      return res.status(400).json({ error: "No uploaded file found for this content" });
    } else if (type === "Video" && !url) {
      return res.status(400).json({ error: "Video content needs a URL (TikTok, Facebook, Instagram, Vimeo, X…)" });
    } else if (url) {
      content_raw = await fetchWebContent(url);
    } else {
      return res.status(400).json({ error: "No URL or PDF path to ingest" });
    }

    // 2. Summarize with OpenRouter (en default; fr when settings.language === 'fr')
    const settingsRow = db.prepare("SELECT language FROM settings WHERE id = 1").get() as { language?: string } | undefined;
    const useFrench = settingsRow?.language === "fr";
    const descCombined = [contenu.description, contenu.source_notes as string | null]
      .filter((x) => x && String(x).trim())
      .join("\n\n");
    const prompt = buildIngestSummaryPrompt(
      { type, name: String(contenu.name ?? ""), description: descCombined || null },
      content_raw,
      useFrench
    );

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
    console.error("[contenus/ingest]", msg);
    res.status(500).json({ error: msg });
  }
});
