import { getDb } from "@/lib/db/client";
import { resolveSecureLink, markLinkUsed } from "@/lib/portal/secure-links";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token: string;
    phone?: string;
    email?: string;
    accountNumber?: string;
  };

  const resolved = resolveSecureLink(body.token);
  if (!resolved) {
    return Response.json({ error: "This link is invalid or has already been used." }, { status: 410 });
  }

  getDb()
    .prepare(
      `INSERT INTO portal_contacts (token, phone, email, account_number, submitted_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
    .run(body.token, body.phone ?? null, body.email ?? null, body.accountNumber ?? null);

  markLinkUsed(body.token);

  return Response.json({ status: "ok" });
}
