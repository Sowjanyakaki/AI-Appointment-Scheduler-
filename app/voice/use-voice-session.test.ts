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
});
