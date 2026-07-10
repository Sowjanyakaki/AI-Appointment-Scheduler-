import { CalendarIcon, CheckIcon, MicIcon } from "./icons";
import styles from "./ChatDemo.module.css";

export type ChatTurn =
  | { kind: "agent"; text: string }
  | { kind: "user"; text: string }
  | { kind: "slots"; label: string; slots: { number: number; label: string }[] }
  | { kind: "confirmation"; title: string; code: string; note: string };

// Seed data mirrors the scripted demo conversation from the product mockup.
// Phase 4 replaces this with live turns from POST /api/chat — the turn
// shape (ChatTurn) is designed to be produced by that endpoint directly.
const DEMO_TURNS: ChatTurn[] = [
  {
    kind: "agent",
    text: "Hi! I'm your AI Voice Agent. I can help you book a tentative appointment with a human advisor.",
  },
  { kind: "user", text: "I'd like to discuss investment planning next week." },
  {
    kind: "slots",
    label: "Here are some available slots:",
    slots: [
      { number: 1, label: "Tue, 13 May 2025 – 10:00 AM" },
      { number: 2, label: "Tue, 13 May 2025 – 02:00 PM" },
      { number: 3, label: "Wed, 14 May 2025 – 11:30 AM" },
    ],
  },
  { kind: "agent", text: "Shall I book Tue, 13 May 2025 at 10:00 AM?" },
  { kind: "user", text: "Yes, please." },
  {
    kind: "confirmation",
    title: "You're all set!",
    code: "AC7X-9K2P",
    note: "A secure link to complete your details has been sent to your email.",
  },
];

export function ChatDemo() {
  return (
    <div className={styles.card} role="log" aria-label="Voice agent booking demo">
      {DEMO_TURNS.map((turn, index) => (
        <ChatTurnView key={index} turn={turn} />
      ))}
    </div>
  );
}

function ChatTurnView({ turn }: { turn: ChatTurn }) {
  switch (turn.kind) {
    case "agent":
      return (
        <div className={styles.agentRow}>
          <span className={styles.agentAvatar}>
            <MicIcon className={styles.agentAvatarIcon} />
          </span>
          <p className={styles.agentBubble}>{turn.text}</p>
        </div>
      );
    case "user":
      return (
        <div className={styles.userRow}>
          <p className={styles.userBubble}>{turn.text}</p>
        </div>
      );
    case "slots":
      return (
        <div className={styles.slotsBlock}>
          <p className={styles.slotsLabel}>{turn.label}</p>
          <ul className={styles.slotsList}>
            {turn.slots.map((slot) => (
              <li key={slot.number} className={styles.slotItem}>
                <CalendarIcon className={styles.slotIcon} />
                <span className={styles.slotLabel}>{slot.label}</span>
                <span className={styles.slotBadge}>{slot.number}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "confirmation":
      return (
        <div className={styles.confirmationCard}>
          <span className={styles.confirmationIcon}>
            <CheckIcon className={styles.confirmationIconGlyph} />
          </span>
          <div>
            <p className={styles.confirmationTitle}>{turn.title}</p>
            <p className={styles.confirmationCode}>
              Your booking code is{" "}
              <span className={styles.codeChip}>{turn.code}</span>
            </p>
            <p className={styles.confirmationNote}>{turn.note}</p>
          </div>
        </div>
      );
  }
}
