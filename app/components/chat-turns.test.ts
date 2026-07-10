import { describe, it, expect } from "vitest";
import { turnsFromResponse, type ChatApiResponse } from "./chat-turns";

describe("turnsFromResponse", () => {
  it("returns a single agent turn for a plain reply", () => {
    const response: ChatApiResponse = {
      sessionId: "s1",
      reply: "Which of these is this call about?",
      state: "TOPIC_CONFIRM",
    };

    expect(turnsFromResponse(response)).toEqual([
      { kind: "agent", text: "Which of these is this call about?" },
    ]);
  });

  it("appends a slots turn when offeredSlots is present", () => {
    const response: ChatApiResponse = {
      sessionId: "s1",
      reply: "I have two options: first, X; second, Y. Which works, or neither?",
      state: "SLOT_CONFIRM",
      offeredSlots: [
        { id: "s1", startIso: "x", label: "Tue, 13 May 2025 – 10:00 AM" },
        { id: "s2", startIso: "y", label: "Tue, 13 May 2025 – 02:00 PM" },
      ],
    };

    expect(turnsFromResponse(response)).toEqual([
      { kind: "agent", text: response.reply },
      {
        kind: "slots",
        label: "Here are some available slots:",
        slots: [
          { number: 1, label: "Tue, 13 May 2025 – 10:00 AM" },
          { number: 2, label: "Tue, 13 May 2025 – 02:00 PM" },
        ],
      },
    ]);
  });

  it("returns only a confirmation turn when bookingCode is present", () => {
    const response: ChatApiResponse = {
      sessionId: "s1",
      reply: "You're booked for Tue 10:00 AM. Your code is NL-A742. Visit /booking/abc.",
      state: "WRAP_UP",
      bookingCode: "NL-A742",
      secureLink: "/booking/abc",
    };

    expect(turnsFromResponse(response)).toEqual([
      {
        kind: "confirmation",
        title: "You're all set!",
        code: "NL-A742",
        note: response.reply,
      },
    ]);
  });

  it("uses a waitlist title when the booking code is a waitlist code", () => {
    const response: ChatApiResponse = {
      sessionId: "s1",
      reply: "You've been waitlisted. Code NL-W123. Visit /booking/xyz.",
      state: "WRAP_UP",
      bookingCode: "NL-W123",
      secureLink: "/booking/xyz",
    };

    expect(turnsFromResponse(response)[0]).toMatchObject({ title: "You're on the waitlist!" });
  });
});
