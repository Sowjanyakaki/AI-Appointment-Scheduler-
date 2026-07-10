import { describe, it, expect } from "vitest";
import { matchTopic, TOPICS } from "./topics";

describe("matchTopic", () => {
  it("matches SIP/Mandates from natural phrasing", () => {
    expect(matchTopic("I need to talk about my SIP mandate")).toBe("SIP/Mandates");
  });

  it("matches KYC/Onboarding", () => {
    expect(matchTopic("something about KYC onboarding")).toBe("KYC/Onboarding");
  });

  it("returns null when nothing matches", () => {
    expect(matchTopic("I want to talk about the weather")).toBeNull();
  });

  it("exposes exactly the five fixed topics", () => {
    expect(TOPICS).toEqual([
      "KYC/Onboarding",
      "SIP/Mandates",
      "Statements/Tax Docs",
      "Withdrawals & Timelines",
      "Account Changes/Nominee",
    ]);
  });
});
