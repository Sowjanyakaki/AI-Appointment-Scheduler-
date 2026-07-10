import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/voice/synthesize", () => ({
  synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from("fake-wav-bytes")),
}));

import { POST } from "./route";

describe("POST /api/voice/synthesize", () => {
  it("returns audio/wav bytes for the given text", async () => {
    const request = new Request("http://localhost/api/voice/synthesize", {
      method: "POST",
      body: JSON.stringify({ text: "You're booked for Tuesday." }),
    });

    const res = await POST(request);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.toString()).toBe("fake-wav-bytes");
  });
});
