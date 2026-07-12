import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests } from "@/lib/db/client";
import { createSession } from "./session-store";
import { advance } from "./state-machine";

vi.mock("./intent-classifier", () => ({
  classifyIntent: vi.fn().mockResolvedValue("book_new"),
}));
vi.mock("@/lib/mcp/client", () => ({
  listSlots: vi.fn().mockResolvedValue({
    slots: [
      { id: "s1", startIso: "2026-07-07T09:00:00+05:30", label: "Tue, 7 Jul – 9:00 AM IST" },
      { id: "s2", startIso: "2026-07-07T14:00:00+05:30", label: "Tue, 7 Jul – 2:00 PM IST" },
    ],
  }),
  createHold: vi.fn().mockResolvedValue({ holdId: "hold-1", status: "tentative" }),
  appendEntry: vi.fn().mockResolvedValue({ status: "ok", result: { documentId: "doc-1", replies: [] } }),
  prepareDraft: vi.fn().mockResolvedValue({ status: "ok", result: { id: "draft-1", message: "ok" } }),
}));

beforeEach(() => {
  resetDbForTests();
  process.env.DATABASE_PATH = "./data/test-state-machine.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
});

describe("advance", () => {
  it("greets and gives the disclaimer on the first turn", async () => {
    const session = createSession();
    const { session: next, reply } = await advance(session, "hi");
    expect(next.state).toBe("DISCLAIMER");
    expect(reply.toLowerCase()).toMatch(/informational.*not investment advice/);
  });

  it("intercepts investment-advice requests before touching intent/booking state", async () => {
    const session = createSession();
    session.state = "TOPIC_CONFIRM";
    const { session: next, reply } = await advance(session, "which stock should I buy");
    expect(reply).toMatch(/not able to give investment advice/i);
    expect(next.state).toBe("TOPIC_CONFIRM");
  });

  it("redirects to the secure link instead of repeating PII", async () => {
    const session = createSession();
    session.state = "TOPIC_CONFIRM";
    const { reply } = await advance(session, "my email is jane@example.com");
    expect(reply).toMatch(/secure link/i);
    expect(reply).not.toMatch(/jane@example\.com/);
  });

  it("returns the offered slots directly alongside the reply text", async () => {
    let session = createSession();
    ({ session } = await advance(session, "hi"));
    ({ session } = await advance(session, "yes I understand"));
    ({ session } = await advance(session, "I want to talk about my SIP mandate"));
    const result = await advance(session, "Tuesday afternoon works");

    expect(result.offeredSlots).toHaveLength(2);
    expect(result.offeredSlots?.[0].label).toMatch(/IST/);
  });

  it("runs the full happy path to a booking code", async () => {
    let session = createSession();
    ({ session } = await advance(session, "hi"));
    ({ session } = await advance(session, "yes I understand"));
    ({ session } = await advance(session, "I want to talk about my SIP mandate"));
    ({ session } = await advance(session, "Tuesday afternoon works"));

    expect(session.state).toBe("SLOT_CONFIRM");
    expect(session.offeredSlots).toHaveLength(2);

    const result = await advance(session, "the first one is fine");

    expect(result.session.state).toBe("WRAP_UP");
    expect(result.session.bookingCode).toMatch(/^NL-[A-Z]\d{3}$/);
    expect(result.reply).toMatch(/IST/);
    expect(result.reply).toContain(result.session.bookingCode);
    expect(result.reply).toMatch(/\/booking\//);
    expect(result.secureLink).toMatch(/^\/booking\//);
    expect(result.reply).toContain(result.secureLink);
  });

  it("falls back to a waitlist when neither offered slot is accepted", async () => {
    let session = createSession();
    ({ session } = await advance(session, "hi"));
    ({ session } = await advance(session, "yes"));
    ({ session } = await advance(session, "SIP mandate please"));
    ({ session } = await advance(session, "Tuesday"));

    const result = await advance(session, "neither of those works for me");

    expect(result.session.state).toBe("WRAP_UP");
    expect(result.session.bookingCode).toMatch(/^NL-W\d{3}$/);
    expect(result.reply).toMatch(/waitlist/i);
    expect(result.reply).toMatch(/\/booking\//);
    expect(result.secureLink).toMatch(/^\/booking\//);
  });

  it("successfully books when selecting by digit '2'", async () => {
    let session = createSession();
    ({ session } = await advance(session, "hi"));
    ({ session } = await advance(session, "yes"));
    ({ session } = await advance(session, "SIP mandate please"));
    ({ session } = await advance(session, "Tuesday"));

    const result = await advance(session, "2");

    expect(result.session.state).toBe("WRAP_UP");
    expect(result.session.bookingCode).toMatch(/^NL-[A-Z]\d{3}$/);
    expect(result.session.chosenSlot).toEqual({ id: "s2", startIso: "2026-07-07T14:00:00+05:30", label: "Tue, 7 Jul – 2:00 PM IST" });
  });

  it("prompts for clarification on ambiguous slot selection like 'yes'", async () => {
    let session = createSession();
    ({ session } = await advance(session, "hi"));
    ({ session } = await advance(session, "yes"));
    ({ session } = await advance(session, "SIP mandate please"));
    ({ session } = await advance(session, "Tuesday"));

    const result = await advance(session, "yes");

    expect(result.session.state).toBe("SLOT_CONFIRM");
    expect(result.reply).toMatch(/prefer the first option or the second option/i);
  });
});

