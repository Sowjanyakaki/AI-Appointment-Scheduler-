import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, resetDbForTests } from "./client";

const TEST_DB_PATH = "./data/test.db";

beforeEach(() => {
  resetDbForTests();
  process.env.DATABASE_PATH = TEST_DB_PATH;
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (fs.existsSync(TEST_DB_PATH + "-shm")) fs.unlinkSync(TEST_DB_PATH + "-shm");
  if (fs.existsSync(TEST_DB_PATH + "-wal")) fs.unlinkSync(TEST_DB_PATH + "-wal");
});

describe("getDb", () => {
  it("creates the booking_sessions table", () => {
    const db = getDb();
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='booking_sessions'")
      .get();
    expect(row).toBeTruthy();
  });

  it("returns the same instance on repeated calls", () => {
    expect(getDb()).toBe(getDb());
  });
});
