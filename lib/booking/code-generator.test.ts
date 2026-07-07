import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests, getDb } from "@/lib/db/client";
import { generateBookingCode } from "./code-generator";

beforeEach(() => {
  resetDbForTests();
  process.env.DATABASE_PATH = "./data/test-codes.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
});

describe("generateBookingCode", () => {
  it("produces a booking code matching NL-<letter><3 digits>", () => {
    const code = generateBookingCode("booking");
    expect(code).toMatch(/^NL-[A-Z]\d{3}$/);
  });

  it("produces a waitlist code matching NL-W<3 digits>", () => {
    const code = generateBookingCode("waitlist");
    expect(code).toMatch(/^NL-W\d{3}$/);
  });

  it("never returns a code already used by an existing session", () => {
    const db = getDb();
    const taken = generateBookingCode("booking");
    db.prepare(
      "INSERT INTO booking_sessions (id, state, booking_code, created_at, updated_at) VALUES (?, 'WRAP_UP', ?, datetime('now'), datetime('now'))"
    ).run("session-1", taken);

    for (let i = 0; i < 20; i++) {
      expect(generateBookingCode("booking")).not.toBe(taken);
    }
  });
});
