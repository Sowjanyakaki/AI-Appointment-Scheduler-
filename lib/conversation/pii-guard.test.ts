import { describe, it, expect } from "vitest";
import { containsPII } from "./pii-guard";

describe("containsPII", () => {
  it("flags a phone number", () => {
    expect(containsPII("call me at 987-654-3210")).toBe(true);
  });

  it("flags an email address", () => {
    expect(containsPII("reach me at jane.doe@example.com")).toBe(true);
  });

  it("flags a long account number", () => {
    expect(containsPII("my account is 123456789012")).toBe(true);
  });

  it("does not flag ordinary booking speech", () => {
    expect(containsPII("I'd like to book a SIP mandate call on Tuesday afternoon")).toBe(false);
  });
});
