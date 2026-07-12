import { describe, it, expect, vi, afterEach } from "vitest";
import { submitTurn } from "./use-voice-session";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("submitTurn", () => {
  it("chains transcribe -> chat -> synthesize and returns a playable audio URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transcript: "book a SIP call" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: "sess-1", reply: "Which day works?", state: "TIME_PREFERENCE_COLLECT" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode("fake-wav").buffer,
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:fake-url");

    const result = await submitTurn(new Blob(["fake-audio"]), null);

    expect(result.sessionId).toBe("sess-1");
    expect(result.state).toBe("TIME_PREFERENCE_COLLECT");
    expect(result.replyAudioUrl).toBe("blob:fake-url");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects and stops the chain when transcribe returns a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ error: "Audio file too large" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(submitTurn(new Blob(["fake-audio"]), null)).rejects.toThrow(/413/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects and stops the chain when the chat request returns a non-ok response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transcript: "book a SIP call" }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(submitTurn(new Blob(["fake-audio"]), null)).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects and stops the chain when synthesize returns a non-ok response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transcript: "book a SIP call" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: "sess-1", reply: "Which day works?", state: "TIME_PREFERENCE_COLLECT" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: "tts down" }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(submitTurn(new Blob(["fake-audio"]), null)).rejects.toThrow(/502/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
