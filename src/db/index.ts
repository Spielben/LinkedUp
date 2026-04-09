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

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
