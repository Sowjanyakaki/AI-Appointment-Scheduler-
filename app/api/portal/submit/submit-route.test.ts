import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests, getDb } from "@/lib/db/client";
import { createSecureLink } from "@/lib/portal/secure-links";
import { POST } from "./route";

beforeEach(() => {
  resetDbForTests();
  process.env.DATABASE_PATH = "./data/test-portal-submit.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
});

function submitRequest(body: unknown) {
  return new Request("http://localhost/api/portal/submit", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/portal/submit", () => {
  it("stores contact details for a valid token and marks it used", async () => {
    const { token } = createSecureLink("NL-A742");

    const res = await POST(submitRequest({ token, phone: "9876543210", email: "jane@example.com" }));
    expect(res.status).toBe(200);

    const row = getDb().prepare("SELECT * FROM portal_contacts WHERE token = ?").get(token) as
      | { phone: string }
      | undefined;
    expect(row?.phone).toBe("9876543210");
  });

  it("rejects a reused token with 410", async () => {
    const { token } = createSecureLink("NL-A742");
    await POST(submitRequest({ token, phone: "9876543210" }));

    const res = await POST(submitRequest({ token, phone: "9876543210" }));
    expect(res.status).toBe(410);
  });

  it("rejects a submission with blank phone and email with 400 and does not burn the token", async () => {
    const { token } = createSecureLink("NL-A742");

    const res = await POST(submitRequest({ token, phone: "  ", email: "" }));
    expect(res.status).toBe(400);

    const row = getDb().prepare("SELECT * FROM portal_contacts WHERE token = ?").get(token);
    expect(row).toBeUndefined();

    const retryRes = await POST(submitRequest({ token, phone: "9876543210" }));
    expect(retryRes.status).toBe(200);
  });

  it("rejects a submission with missing phone and email fields with 400", async () => {
    const { token } = createSecureLink("NL-A742");

    const res = await POST(submitRequest({ token }));
    expect(res.status).toBe(400);
  });
});
