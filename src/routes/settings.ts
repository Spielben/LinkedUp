import { Router } from "express";
import { getDb } from "../db/index.js";

export const settingsRouter = Router();
const ALLOWED_LANGUAGES = new Set(["fr", "en", "es", "de", "pt", "it", "nl"]);

settingsRouter.get("/", (_req, res) => {
  const db = getDb();
  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  res.json(settings || {});
});

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

  const existing = existingRow;

  // Basic IANA timezone validation
  const normalizedTimezone =
    typeof timezone === "string" && timezone.trim().length > 0
      ? timezone.trim()
      : "Asia/Bangkok";

  if (existing) {
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
