import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests } from "@/lib/db/client";
import { createSession, getSession, saveSession } from "./session-store";

beforeEach(() => {
  resetDbForTests();
  process.env.DATABASE_PATH = "./data/test-sessions.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
});

describe("session store", () => {
  it("creates a session in GREETING state", () => {
    const session = createSession();
    expect(session.state).toBe("GREETING");
    expect(session.id).toBeTruthy();
  });

  it("persists and reloads updates", () => {
    const session = createSession();
    session.topic = "SIP/Mandates";
    session.state = "TIME_PREFERENCE_COLLECT";
    saveSession(session);

    const reloaded = getSession(session.id);
    expect(reloaded?.topic).toBe("SIP/Mandates");
    expect(reloaded?.state).toBe("TIME_PREFERENCE_COLLECT");
  });

  it("returns null for an unknown id", () => {
    expect(getSession("does-not-exist")).toBeNull();
  });
});
