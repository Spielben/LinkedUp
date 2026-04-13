import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA } from "./schema.js";

let db: Database.Database | null = null;

export function getDataDir(): string {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(getDataDir(), "linkdup.db");
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(SCHEMA);

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(database: Database.Database): void {
  // Migration: Add language column to settings
  try {
    database.exec("ALTER TABLE settings ADD COLUMN language TEXT DEFAULT 'en'");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    database.exec(
      "UPDATE settings SET language = 'en' WHERE id = 1 AND (language IS NULL OR TRIM(language) = '')"
    );
  } catch (e) {
    /* ignore */
  }

  // Migration: Add preferred_post_days column to settings
  try {
    database.exec("ALTER TABLE settings ADD COLUMN preferred_post_days TEXT");
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add preferred_post_time column to settings
  try {
    database.exec("ALTER TABLE settings ADD COLUMN preferred_post_time TEXT");
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Create linkedin_posts table
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS linkedin_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT,
        description TEXT,
        text TEXT,
        image_url TEXT,
        published_date TEXT,
        linkedin_url TEXT UNIQUE,
        first_comment TEXT,
        status TEXT DEFAULT 'published',
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        source TEXT DEFAULT 'import',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {
    // Table already exists, ignore
  }

  // Migration: Add new columns to linkedin_posts if they don't exist
  for (const col of [
    "subject TEXT",
    "description TEXT",
    "image_url TEXT",
    "first_comment TEXT",
    "status TEXT DEFAULT 'published'",
    "is_repost INTEGER DEFAULT 0",
  ]) {
    try {
      database.exec(`ALTER TABLE linkedin_posts ADD COLUMN ${col}`);
    } catch (e) {
      // Column already exists
    }
  }

  // Migration: Add UNIQUE constraint on linkedin_url (for dedup)
  try {
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_posts_url ON linkedin_posts(linkedin_url)");
  } catch (e) {
    // Index already exists
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
