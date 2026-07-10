import { describe, it, expect } from "vitest";
import { isInvestmentAdviceRequest, SCOPE_REFUSAL_MESSAGE } from "./scope-guardrail";

describe("isInvestmentAdviceRequest", () => {
  it("flags a direct stock-picking question", () => {
    expect(isInvestmentAdviceRequest("Should I invest in tech stocks right now?")).toBe(true);
  });

  it("flags a fund recommendation request", () => {
    expect(isInvestmentAdviceRequest("Which mutual fund should I put my money into?")).toBe(true);
  });

  it("does not flag a scheduling request", () => {
    expect(isInvestmentAdviceRequest("I want to book a call about my SIP mandate")).toBe(false);
  });

  it("exposes a fixed refusal message", () => {
    expect(SCOPE_REFUSAL_MESSAGE).toMatch(/not (able|licensed) to (give|provide) investment advice/i);
  });
});
