import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listSlots, createHold, cancelHold, rescheduleHold, appendEntry, prepareDraft } from "./client";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.MCP_BASE_URL = "http://test-mcp";
  process.env.MCP_API_KEY = "test-key";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("listSlots", () => {
  it("posts to /list_slots with an X-API-Key header and returns parsed slots", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ slots: [{ id: "s1", startIso: "2026-07-07T09:00:00+05:30", label: "Tue, 7 Jul – 9:00 AM IST" }] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await listSlots("Tuesday", "morning");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-mcp/list_slots",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-API-Key": "test-key" }),
        body: JSON.stringify({ dayPreference: "Tuesday", timePreference: "morning" }),
      })
    );
    expect(result.slots).toHaveLength(1);
  });
});

describe("createHold", () => {
  it("posts to /create_hold and returns the hold", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ holdId: "evt-1", status: "tentative" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const slot = { id: "s1", startIso: "2026-07-14T15:00:00+05:30", label: "Tue, 14 Jul – 3:00 PM IST" };
    const result = await createHold("SIP/Mandates", "NL-A742", slot);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-mcp/create_hold",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ topic: "SIP/Mandates", code: "NL-A742", slot }),
      })
    );
    expect(result).toEqual({ holdId: "evt-1", status: "tentative" });
  });

  it("throws when the MCP call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(
      createHold("SIP/Mandates", "NL-A742", { id: "s1", startIso: "x", label: "y" })
    ).rejects.toThrow("MCP call /create_hold failed: 500");
  });
});

describe("cancelHold", () => {
  it("posts to /cancel_hold with just the code", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "cancelled" }) });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await cancelHold("NL-A742");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-mcp/cancel_hold",
      expect.objectContaining({ body: JSON.stringify({ code: "NL-A742" }) })
    );
    expect(result).toEqual({ status: "cancelled" });
  });
});

describe("rescheduleHold", () => {
  it("posts to /reschedule_hold with the code and newSlot", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "rescheduled" }) });
    global.fetch = mockFetch as unknown as typeof fetch;

    const newSlot = { id: "s2", startIso: "2026-07-15T10:00:00+05:30", label: "Wed, 15 Jul – 10:00 AM IST" };
    const result = await rescheduleHold("NL-A742", newSlot);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-mcp/reschedule_hold",
      expect.objectContaining({ body: JSON.stringify({ code: "NL-A742", newSlot }) })
    );
    expect(result).toEqual({ status: "rescheduled" });
  });
});

describe("appendEntry", () => {
  it("posts to /append_to_doc with snake_case doc_id, matching the real server's field name", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", result: { documentId: "doc-1", replies: [] } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await appendEntry("doc-1", "2026-07-07 | SIP/Mandates | NL-A742");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-mcp/append_to_doc",
      expect.objectContaining({
        body: JSON.stringify({ doc_id: "doc-1", content: "2026-07-07 | SIP/Mandates | NL-A742" }),
      })
    );
    expect(result.result.documentId).toBe("doc-1");
  });
});

describe("prepareDraft", () => {
  it("posts to /create_email_draft", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", result: { id: "draft-1", message: "ok" } }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await prepareDraft("advisor@example.com", "New booking", "body text");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-mcp/create_email_draft",
      expect.objectContaining({
        body: JSON.stringify({ to: "advisor@example.com", subject: "New booking", body: "body text" }),
      })
    );
    expect(result.result.id).toBe("draft-1");
  });
});
