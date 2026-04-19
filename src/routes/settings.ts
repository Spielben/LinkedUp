import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { getDb, getDataDir } from "../db/index.js";

export const settingsRouter = Router();
const ALLOWED_LANGUAGES = new Set(["fr", "en", "es", "de", "pt", "it", "nl"]);

// ── Branding directory ────────────────────────────────────────────────────────

function getBrandingDir(): string {
  const dir = path.join(getDataDir(), "branding");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Multer — logo upload ──────────────────────────────────────────────────────

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getBrandingDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `logo${ext}`);
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.mimetype);
    if (ok) cb(null, true); else cb(new Error("Only PNG, JPEG, or WebP images are accepted"));
  },
});

// ── Multer — brand identity upload ───────────────────────────────────────────

const brandStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getBrandingDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".txt";
    cb(null, `brand_identity${ext}`);
  },
});

const brandUpload = multer({
  storage: brandStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
      "application/octet-stream", // some browsers send this for .md / .txt
    ].includes(file.mimetype);
    const extOk = [".pdf", ".docx", ".txt", ".md"].includes(
      path.extname(file.originalname).toLowerCase()
    );
    const accept = ok || extOk;
    if (accept) cb(null, true); else cb(new Error("Only PDF, DOCX, TXT, or MD files are accepted"));
  },
});

// ── Text extraction helper ────────────────────────────────────────────────────

async function extractText(filePath: string, mimetype: string, originalname: string): Promise<string> {
  const ext = path.extname(originalname).toLowerCase();

  if (ext === ".pdf" || mimetype === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text.trim();
  }

  if (
    ext === ".docx" ||
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  }

  // TXT / MD — plain text
  return fs.readFileSync(filePath, "utf-8").trim();
}

// ── GET settings ─────────────────────────────────────────────────────────────

settingsRouter.get("/", (_req, res) => {
  const db = getDb();
  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  res.json(settings || {});
});

// ── PUT settings ─────────────────────────────────────────────────────────────

settingsRouter.put("/", (req, res) => {
  const db = getDb();
  const {
    name,
    email,
    linkedin_url,
    signature,
    budget_limit,
    language,
    preferred_post_days,
    preferred_post_time,
    timezone,
  } = req.body;

  const existingRow = db.prepare("SELECT * FROM settings WHERE id = 1").get() as
    | { language?: string }
    | undefined;

  const normalizedLanguage =
    typeof language === "string" && ALLOWED_LANGUAGES.has(language)
      ? language
      : existingRow?.language && ALLOWED_LANGUAGES.has(existingRow.language)
        ? existingRow.language
        : "en";

  const normalizedDays =
    typeof preferred_post_days === "string"
      ? preferred_post_days
          .split(",")
          .map((d: string) => d.trim())
          .filter((d: string) => /^[0-6]$/.test(d))
          .join(",")
      : null;

  const normalizedTime =
    typeof preferred_post_time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(preferred_post_time)
      ? preferred_post_time
      : null;

  const normalizedTimezone =
    typeof timezone === "string" && timezone.trim().length > 0
      ? timezone.trim()
      : "Asia/Bangkok";

  if (existingRow) {
    db.prepare(`
      UPDATE settings
      SET name = ?, email = ?, linkedin_url = ?, signature = ?, budget_limit = ?,
          language = ?, preferred_post_days = ?, preferred_post_time = ?, timezone = ?
      WHERE id = 1
    `).run(
      name || null,
      email || null,
      linkedin_url || null,
      signature || null,
      budget_limit || null,
      normalizedLanguage,
      normalizedDays,
      normalizedTime,
      normalizedTimezone
    );
  } else {
    db.prepare(`
      INSERT INTO settings (id, name, email, linkedin_url, signature, budget_limit, language, preferred_post_days, preferred_post_time, timezone)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name || null,
      email || null,
      linkedin_url || null,
      signature || null,
      budget_limit || null,
      normalizedLanguage,
      normalizedDays,
      normalizedTime,
      normalizedTimezone
    );
  }

  const updated = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  res.json(updated);
});

// ── POST /api/settings/logo ───────────────────────────────────────────────────

settingsRouter.post("/logo", (req, res, next) => {
  logoUpload.single("logo")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const db = getDb();
  const logoPath = `/data/branding/${file.filename}`;

  const existing = db.prepare("SELECT id FROM settings WHERE id = 1").get();
  if (existing) {
    db.prepare("UPDATE settings SET logo_path = ? WHERE id = 1").run(logoPath);
  } else {
    db.prepare("INSERT INTO settings (id, logo_path) VALUES (1, ?)").run(logoPath);
  }

  res.json({ ok: true, logo_path: logoPath });
});

// ── DELETE /api/settings/logo ─────────────────────────────────────────────────

settingsRouter.delete("/logo", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT logo_path FROM settings WHERE id = 1").get() as
    | { logo_path: string | null }
    | undefined;

  if (row?.logo_path) {
    const abs = path.join(process.cwd(), "data", "branding", path.basename(row.logo_path));
    try { fs.unlinkSync(abs); } catch { /* already gone */ }
    db.prepare("UPDATE settings SET logo_path = NULL WHERE id = 1").run();
  }

  res.json({ ok: true });
});

// ── POST /api/settings/brand-identity ────────────────────────────────────────

settingsRouter.post("/brand-identity", (req, res, next) => {
  brandUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const extractedText = await extractText(file.path, file.mimetype, file.originalname);
    const filePath = `/data/branding/${file.filename}`;

    const db = getDb();
    const existing = db.prepare("SELECT id FROM settings WHERE id = 1").get();
    if (existing) {
      db.prepare(
        "UPDATE settings SET brand_identity_path = ?, brand_identity_text = ? WHERE id = 1"
      ).run(filePath, extractedText);
    } else {
      db.prepare(
        "INSERT INTO settings (id, brand_identity_path, brand_identity_text) VALUES (1, ?, ?)"
      ).run(filePath, extractedText);
    }

    res.json({
      ok: true,
      brand_identity_path: filePath,
      filename: file.originalname,
      chars: extractedText.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Text extraction failed";
    res.status(500).json({ error: msg });
  }
});

// ── DELETE /api/settings/brand-identity ──────────────────────────────────────

settingsRouter.delete("/brand-identity", (_req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT brand_identity_path FROM settings WHERE id = 1").get() as
    | { brand_identity_path: string | null }
    | undefined;

  if (row?.brand_identity_path) {
    const abs = path.join(process.cwd(), "data", "branding", path.basename(row.brand_identity_path));
    try { fs.unlinkSync(abs); } catch { /* already gone */ }
    db.prepare(
      "UPDATE settings SET brand_identity_path = NULL, brand_identity_text = NULL WHERE id = 1"
    ).run();
  }

  res.json({ ok: true });
});
