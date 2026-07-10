import { describe, it, expect, vi } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({ text: "I want to book an appointment" });
vi.mock("groq-sdk", () => ({
  // A regular function, not an arrow function: `new Groq(...)` requires a
  // constructable implementation, and arrow functions can never be `new`-ed.
  default: vi.fn().mockImplementation(function () {
    return { audio: { transcriptions: { create: mockCreate } } };
  }),
}));

import { transcribeAudio } from "./transcribe";

describe("transcribeAudio", () => {
  it("returns the transcript text from Groq Whisper", async () => {
    const result = await transcribeAudio(Buffer.from("fake-audio-bytes"), "utterance.webm");
    expect(result).toBe("I want to book an appointment");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "whisper-large-v3" })
    );
  });
});
