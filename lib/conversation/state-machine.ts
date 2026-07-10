import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { containsPII } from "./pii-guard";
import { isInvestmentAdviceRequest, SCOPE_REFUSAL_MESSAGE } from "./scope-guardrail";
import { classifyIntent } from "./intent-classifier";
import { matchTopic } from "./topics";
import { listSlots, createHold, appendEntry, prepareDraft } from "@/lib/mcp/client";
import { generateBookingCode } from "@/lib/booking/code-generator";
import { saveSession, type Session } from "./session-store";
import type { Slot } from "@/lib/mcp/client";

const DISCLAIMER =
  "This call is informational only and not investment advice. What would you like help with today?";

const PII_REDIRECT =
  "For your security, please don't share phone numbers, emails, or account details on this call — " +
  "I'll give you a secure link at the end where you can provide that safely.";

const NOTES_DOC_ID = process.env.NOTES_DOC_ID ?? "advisor-pre-bookings";
const ADVISOR_EMAIL = process.env.ADVISOR_EMAIL ?? "advisor@example.com";
const SECURE_LINK_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function acceptsSlot(text: string): "first" | "second" | "neither" {
  const lower = text.toLowerCase();
  if (/first|1st|one\b/.test(lower)) return "first";
  if (/second|2nd|two\b/.test(lower)) return "second";
  if (/neither|none|no /.test(lower)) return "neither";
  return "neither";
}

// Generates a one-time portal link for the caller to submit contact details
// off-call (per architecture.md's no-PII-on-the-call constraint). The
// secure_links table already exists in the schema (Task 2); the portal
// page itself is built in a later phase.
function createSecureLink(bookingCode: string): string {
  const db = getDb();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SECURE_LINK_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO secure_links (token, booking_code, used, expires_at, created_at)
     VALUES (?, ?, 0, ?, datetime('now'))`
  ).run(token, bookingCode, expiresAt);

  return `/booking/${token}`;
}

export interface AdvanceResult {
  session: Session;
  reply: string;
  offeredSlots?: Slot[];
  secureLink?: string;
}

export async function advance(session: Session, callerText: string): Promise<AdvanceResult> {
  if (containsPII(callerText)) {
    return { session, reply: PII_REDIRECT };
  }

  if (session.state !== "GREETING" && isInvestmentAdviceRequest(callerText)) {
    return { session, reply: SCOPE_REFUSAL_MESSAGE };
  }

  switch (session.state) {
    case "GREETING": {
      session.state = "DISCLAIMER";
      saveSession(session);
      return { session, reply: DISCLAIMER };
    }

    case "DISCLAIMER": {
      session.state = "TOPIC_CONFIRM";
      saveSession(session);
      return {
        session,
        reply:
          "Which of these is this call about — KYC/Onboarding, SIP/Mandates, Statements/Tax Docs, " +
          "Withdrawals & Timelines, or Account Changes/Nominee?",
      };
    }

    case "TOPIC_CONFIRM": {
      const topic = matchTopic(callerText);
      if (!topic) {
        return {
          session,
          reply: "Sorry, I didn't catch a topic from that list — could you name one of the five options?",
        };
      }
      session.topic = topic;
      session.intent = await classifyIntent(callerText);
      session.state = "TIME_PREFERENCE_COLLECT";
      saveSession(session);
      return { session, reply: `Got it, ${topic}. What day and time works best for you?` };
    }

    case "TIME_PREFERENCE_COLLECT": {
      session.timePreference = callerText;
      const { slots } = await listSlots(callerText, callerText);
      session.offeredSlots = slots;
      session.state = "SLOT_OFFER";
      saveSession(session);
      session.state = "SLOT_CONFIRM";
      saveSession(session);
      return {
        session,
        reply: `I have two options: first, ${slots[0].label}; second, ${slots[1].label}. Which works, or neither?`,
        offeredSlots: slots,
      };
    }

    case "SLOT_CONFIRM": {
      const choice = acceptsSlot(callerText);
      const code =
        choice === "neither" ? generateBookingCode("waitlist") : generateBookingCode("booking");
      const link = createSecureLink(code);

      if (choice === "neither") {
        session.bookingCode = code;
        session.state = "WAITLIST_EXECUTE";
        saveSession(session);

        await appendEntry(
          NOTES_DOC_ID,
          `${new Date().toISOString()} | ${session.topic} | WAITLISTED | ${code}`
        );
        await prepareDraft(
          ADVISOR_EMAIL,
          `Waitlist: ${session.topic} (${code})`,
          `Caller requested ${session.topic}, no offered slot accepted. Waitlist code: ${code}.`
        );

        session.state = "WRAP_UP";
        saveSession(session);
        return {
          session,
          reply:
            `No problem — I've added you to the waitlist with code ${code}. ` +
            `An advisor will reach out once a slot opens up. Visit ${link} to share your contact details.`,
          secureLink: link,
        };
      }

      const slot = choice === "first" ? session.offeredSlots![0] : session.offeredSlots![1];
      session.chosenSlot = slot;
      session.bookingCode = code;
      session.state = "BOOKING_EXECUTE";
      saveSession(session);

      await createHold(session.topic!, code, slot);
      await appendEntry(
        NOTES_DOC_ID,
        `${new Date().toISOString()} | ${session.topic} | ${slot.label} | ${code}`
      );
      await prepareDraft(
        ADVISOR_EMAIL,
        `New booking: ${session.topic} (${code})`,
        `Caller booked ${session.topic} for ${slot.label}. Code: ${code}.`
      );

      session.state = "WRAP_UP";
      saveSession(session);
      return {
        session,
        reply:
          `You're booked for ${slot.label}. Your code is ${code}. ` +
          `Visit the secure link ${link} to share your contact details.`,
        secureLink: link,
      };
    }

    default:
      return {
        session,
        reply: "Your booking is complete. Is there anything else I can help with?",
      };
  }
}
