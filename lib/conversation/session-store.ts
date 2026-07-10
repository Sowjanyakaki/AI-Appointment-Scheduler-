import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { Intent } from "./intent-classifier";
import type { Topic } from "./topics";
import type { Slot } from "@/lib/mcp/client";

export type SessionState =
  | "GREETING"
  | "DISCLAIMER"
  | "TOPIC_CONFIRM"
  | "TIME_PREFERENCE_COLLECT"
  | "SLOT_OFFER"
  | "SLOT_CONFIRM"
  | "BOOKING_EXECUTE"
  | "WAITLIST_EXECUTE"
  | "WRAP_UP";

export interface Session {
  id: string;
  state: SessionState;
  intent?: Intent;
  topic?: Topic;
  timePreference?: string;
  offeredSlots?: Slot[];
  chosenSlot?: Slot;
  bookingCode?: string;
}

interface SessionRow {
  id: string;
  state: SessionState;
  intent: string | null;
  topic: string | null;
  time_preference: string | null;
  offered_slots: string | null;
  chosen_slot: string | null;
  booking_code: string | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    state: row.state,
    intent: (row.intent as Intent) ?? undefined,
    topic: (row.topic as Topic) ?? undefined,
    timePreference: row.time_preference ?? undefined,
    offeredSlots: row.offered_slots ? JSON.parse(row.offered_slots) : undefined,
    chosenSlot: row.chosen_slot ? JSON.parse(row.chosen_slot) : undefined,
    bookingCode: row.booking_code ?? undefined,
  };
}

export function createSession(): Session {
  const db = getDb();
  const session: Session = { id: randomUUID(), state: "GREETING" };

  db.prepare(
    `INSERT INTO booking_sessions (id, state, created_at, updated_at)
     VALUES (?, ?, datetime('now'), datetime('now'))`
  ).run(session.id, session.state);

  return session;
}

export function getSession(id: string): Session | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM booking_sessions WHERE id = ?").get(id) as
    | SessionRow
    | undefined;
  return row ? rowToSession(row) : null;
}

export function saveSession(session: Session): void {
  const db = getDb();
  db.prepare(
    `UPDATE booking_sessions
     SET state = ?, intent = ?, topic = ?, time_preference = ?, offered_slots = ?, chosen_slot = ?, booking_code = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    session.state,
    session.intent ?? null,
    session.topic ?? null,
    session.timePreference ?? null,
    session.offeredSlots ? JSON.stringify(session.offeredSlots) : null,
    session.chosenSlot ? JSON.stringify(session.chosenSlot) : null,
    session.bookingCode ?? null,
    session.id
  );
}
