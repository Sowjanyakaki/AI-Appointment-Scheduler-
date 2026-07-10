"use client";

import { useEffect, useRef, useState } from "react";
import { turnsFromResponse, type ChatApiResponse, type ChatTurn } from "./chat-turns";
import { CalendarIcon, CheckIcon, MicIcon } from "./icons";
import styles from "./ChatDemo.module.css";

const GENERIC_ERROR_TEXT = "Sorry, something went wrong on my end. Please try again.";

export function ChatDemo() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const startedRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  async function sendMessage(message: string) {
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId ?? undefined, message }),
      });

      if (!res.ok) {
        setTurns((prev) => [...prev, { kind: "agent", text: GENERIC_ERROR_TEXT }]);
        return;
      }

      const data = (await res.json()) as ChatApiResponse;
      setSessionId(data.sessionId);
      setTurns((prev) => [...prev, ...turnsFromResponse(data)]);
    } catch {
      setTurns((prev) => [...prev, { kind: "agent", text: GENERIC_ERROR_TEXT }]);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void sendMessage("hi");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || pending) return;

    setTurns((prev) => [...prev, { kind: "user", text: message }]);
    setInput("");
    void sendMessage(message);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card} role="log" aria-label="Voice agent booking demo" ref={logRef}>
        {turns.map((turn, index) => (
          <ChatTurnView key={index} turn={turn} />
        ))}
        {pending && (
          <div className={styles.agentRow}>
            <span className={styles.agentAvatar}>
              <MicIcon className={styles.agentAvatarIcon} />
            </span>
            <p className={styles.agentBubble} aria-live="polite">
              …
            </p>
          </div>
        )}
      </div>

      <form className={styles.inputRow} onSubmit={handleSubmit}>
        <label htmlFor="chat-demo-input" className={styles.visuallyHidden}>
          Message the voice agent
        </label>
        <input
          id="chat-demo-input"
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type your reply…"
          disabled={pending}
          autoComplete="off"
        />
        <button type="submit" className={styles.sendButton} disabled={pending || !input.trim()}>
          Send
        </button>
      </form>
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
