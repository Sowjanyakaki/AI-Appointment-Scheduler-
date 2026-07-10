import type { Slot } from "@/lib/mcp/client";

export type ChatTurn =
  | { kind: "agent"; text: string }
  | { kind: "user"; text: string }
  | { kind: "slots"; label: string; slots: { number: number; label: string }[] }
  | { kind: "confirmation"; title: string; code: string; note: string };

export interface ChatApiResponse {
  sessionId: string;
  reply: string;
  state: string;
  offeredSlots?: Slot[];
  bookingCode?: string;
  secureLink?: string;
}

export function turnsFromResponse(response: ChatApiResponse): ChatTurn[] {
  if (response.bookingCode) {
    return [
      {
        kind: "confirmation",
        title: response.bookingCode.startsWith("NL-W") ? "You're on the waitlist!" : "You're all set!",
        code: response.bookingCode,
        note: response.reply,
      },
    ];
  }

  const turns: ChatTurn[] = [{ kind: "agent", text: response.reply }];

  if (response.offeredSlots?.length) {
    turns.push({
      kind: "slots",
      label: "Here are some available slots:",
      slots: response.offeredSlots.map((slot, index) => ({ number: index + 1, label: slot.label })),
    });
  }

  return turns;
}
