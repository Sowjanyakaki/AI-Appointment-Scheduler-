import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({ object: { intent: "book_new" } }),
}));
vi.mock("@ai-sdk/groq", () => ({
  groq: vi.fn().mockReturnValue("mock-model"),
}));

import { classifyIntent } from "./intent-classifier";
import { generateObject } from "ai";

describe("classifyIntent", () => {
  it("returns the intent from the model's structured output", async () => {
    const intent = await classifyIntent("I want to book a new appointment about my SIP");
    expect(intent).toBe("book_new");
    expect(generateObject).toHaveBeenCalled();
  });
});
