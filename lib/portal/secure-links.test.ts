import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests } from "@/lib/db/client";
import { createSecureLink, resolveSecureLink, markLinkUsed } from "./secure-links";

beforeEach(() => {
  resetDbForTests();
  process.env.DATABASE_PATH = "./data/test-secure-links.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
});

describe("secure links", () => {
  it("creates a token that resolves back to the booking code", () => {
    const { token } = createSecureLink("NL-A742");
    expect(resolveSecureLink(token)).toEqual({ bookingCode: "NL-A742" });
  });

  it("returns null for a used token", () => {
    const { token } = createSecureLink("NL-A742");
    markLinkUsed(token);
    expect(resolveSecureLink(token)).toBeNull();
  });

  it("returns null for an unknown token", () => {
    expect(resolveSecureLink("unknown-token")).toBeNull();
  });
});
