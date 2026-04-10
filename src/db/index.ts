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
    database.exec("ALTER TABLE settings ADD COLUMN language TEXT DEFAULT 'fr'");
  } catch (e) {
    // Column already exists, ignore
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
        text TEXT,
        published_date TEXT,
        linkedin_url TEXT,
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
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
