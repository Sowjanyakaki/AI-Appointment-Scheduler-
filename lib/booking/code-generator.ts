import { randomInt } from "node:crypto";
import { getDb } from "@/lib/db/client";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_ATTEMPTS = 100;

export function generateBookingCode(kind: "booking" | "waitlist"): string {
  const db = getDb();
  const exists = db.prepare("SELECT 1 FROM booking_sessions WHERE booking_code = ?");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const digits = String(randomInt(0, 1000)).padStart(3, "0");
    const code =
      kind === "waitlist"
        ? `NL-W${digits}`
        : `NL-${LETTERS[randomInt(LETTERS.length)]}${digits}`;

    if (!exists.get(code)) return code;
  }

  throw new Error(`Unable to generate a unique ${kind} code after ${MAX_ATTEMPTS} attempts`);
}
