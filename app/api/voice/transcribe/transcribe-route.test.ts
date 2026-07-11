import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/voice/transcribe", () => ({
  transcribeAudio: vi.fn().mockResolvedValue("book a call about KYC"),
}));

import { POST } from "./route";

describe("POST /api/voice/transcribe", () => {
  it("transcribes an uploaded audio file", async () => {
    const form = new FormData();
    form.append("audio", new Blob([Buffer.from("fake")], { type: "audio/webm" }), "clip.webm");
    const request = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: form,
    });

    const res = await POST(request);
    const data = await res.json();
    expect(data.transcript).toBe("book a call about KYC");
  });

  it("returns 400 when no audio file is present", async () => {
    const request = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });

  it("returns 413 when the uploaded file exceeds the size limit", async () => {
    const oversized = new Uint8Array(25 * 1024 * 1024 + 1);
    const form = new FormData();
    form.append("audio", new Blob([oversized], { type: "audio/webm" }), "clip.webm");
    const request = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: form,
    });

    const res = await POST(request);
    expect(res.status).toBe(413);
  });

  it("rejects an oversized upload from Content-Length without ever parsing the body", async () => {
    const request = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      headers: { "content-length": String(25 * 1024 * 1024 + 1) },
      body: new FormData(),
    });
    const formDataSpy = vi.spyOn(request, "formData");

    const res = await POST(request);

    expect(res.status).toBe(413);
    expect(formDataSpy).not.toHaveBeenCalled();
  });
});
