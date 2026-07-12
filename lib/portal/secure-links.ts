import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";

// One-time portal links let a caller submit contact details off-call, per
// architecture.md's no-PII-on-the-call constraint. 7 days keeps the link
// valid long enough for the caller to act on it after the call ends.
const LINK_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function createSecureLink(bookingCode: string): { token: string; url: string } {
  const db = getDb();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO secure_links (token, booking_code, used, expires_at, created_at)
     VALUES (?, ?, 0, ?, datetime('now'))`
  ).run(token, bookingCode, expiresAt);

  return { token, url: `/booking/${token}` };
}

export function resolveSecureLink(token: string): { bookingCode: string } | null {
  const db = getDb();
  const row = db
    .prepare("SELECT booking_code, used, expires_at FROM secure_links WHERE token = ?")
    .get(token) as { booking_code: string; used: number; expires_at: string } | undefined;

  if (!row || row.used || new Date(row.expires_at) < new Date()) return null;
  return { bookingCode: row.booking_code };
}

export function markLinkUsed(token: string): void {
  getDb().prepare("UPDATE secure_links SET used = 1 WHERE token = ?").run(token);
}
