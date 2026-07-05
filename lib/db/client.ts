import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;

  const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  instance = new Database(dbPath);
  instance.pragma("journal_mode = WAL");

  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  instance.exec(schema);

  return instance;
}

export function resetDbForTests(): void {
  instance?.close();
  instance = null;
}
