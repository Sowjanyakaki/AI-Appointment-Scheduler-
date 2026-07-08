export interface Slot {
  id: string;
  startIso: string;
  label: string;
}

async function mcpFetch<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = process.env.MCP_BASE_URL ?? "http://localhost:8000";
  const apiKey = process.env.MCP_API_KEY ?? "";

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MCP call ${path} failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function listSlots(dayPreference: string, timePreference: string) {
  return mcpFetch<{ slots: Slot[] }>("/list_slots", { dayPreference, timePreference });
}

export function createHold(topic: string, code: string, slot: Slot) {
  return mcpFetch<{ holdId: string; status: string }>("/create_hold", { topic, code, slot });
}

export function cancelHold(code: string) {
  return mcpFetch<{ status: string }>("/cancel_hold", { code });
}

export function rescheduleHold(code: string, newSlot: Slot) {
  return mcpFetch<{ status: string }>("/reschedule_hold", { code, newSlot });
}

export function appendEntry(docId: string, content: string) {
  return mcpFetch<{ status: string; result: { documentId: string; replies: unknown[] } }>(
    "/append_to_doc",
    { doc_id: docId, content }
  );
}

export function prepareDraft(to: string, subject: string, body: string) {
  return mcpFetch<{ status: string; result: { id: string; message: string } }>(
    "/create_email_draft",
    { to, subject, body }
  );
}
