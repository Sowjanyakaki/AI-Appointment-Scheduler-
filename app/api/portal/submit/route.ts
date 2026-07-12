import { getDb } from "@/lib/db/client";
import { resolveSecureLink, markLinkUsed } from "@/lib/portal/secure-links";
import { addAttendee } from "@/lib/mcp/client";

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

  const phone = body.phone?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  if (!phone && !email) {
    return Response.json({ error: "Please provide a phone number or email." }, { status: 400 });
  }

  getDb()
    .prepare(
      `INSERT INTO portal_contacts (token, phone, email, account_number, submitted_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    )
    .run(body.token, phone || null, email || null, body.accountNumber ?? null);

  markLinkUsed(body.token);

  if (email && !resolved.bookingCode.startsWith("NL-W")) {
    try {
      await addAttendee(resolved.bookingCode, email);
    } catch (error) {
      console.error(`Failed to add attendee to calendar hold for code ${resolved.bookingCode}:`, error);
    }
  }

  return Response.json({ status: "ok" });
}
