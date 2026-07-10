import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { resetDbForTests } from "@/lib/db/client";

vi.mock("@/lib/conversation/intent-classifier", () => ({
  classifyIntent: vi.fn().mockResolvedValue("book_new"),
}));
vi.mock("@/lib/mcp/client", () => ({
  listSlots: vi.fn().mockResolvedValue({
    slots: [
      { id: "s1", startIso: "x", label: "Tue – 9:00 AM IST" },
      { id: "s2", startIso: "y", label: "Tue – 2:00 PM IST" },
    ],
  }),
  createHold: vi.fn().mockResolvedValue({ holdId: "h1", status: "tentative" }),
  appendEntry: vi.fn().mockResolvedValue({ status: "ok", result: { documentId: "d1", replies: [] } }),
  prepareDraft: vi.fn().mockResolvedValue({ status: "ok", result: { id: "e1", message: "ok" } }),
}));

import { POST } from "./route";

beforeEach(() => {
  resetDbForTests();
  process.env.DATABASE_PATH = "./data/test-chat-api.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
});

function chatRequest(body: unknown) {
  return new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/chat", () => {
  it("starts a new session when no sessionId is given", async () => {
    const res = await POST(chatRequest({ message: "hi" }));
    const data = await res.json();
    expect(data.sessionId).toBeTruthy();
    expect(data.state).toBe("DISCLAIMER");
  });

  it("continues an existing session by sessionId", async () => {
    const first = await (await POST(chatRequest({ message: "hi" }))).json();
    const second = await (
      await POST(chatRequest({ sessionId: first.sessionId, message: "yes I understand" }))
    ).json();
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.state).toBe("TOPIC_CONFIRM");
  });
});
