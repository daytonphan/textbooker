import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "textbooker.db");
const schemaPath = path.join(process.cwd(), "db", "schema.sql");

// Next.js dev mode re-evaluates modules on every change; stash the connection
// on globalThis so hot-reload reuses it instead of opening the file again.
const globalForDb = globalThis as unknown as { textbookerDb?: Database.Database };

function createConnection() {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(schemaPath, "utf-8"));
  return db;
}

export const db = globalForDb.textbookerDb ?? createConnection();
globalForDb.textbookerDb = db;
