# Voice Agent — Advisor Appointment Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based voice agent that autonomously books/reschedules/cancels advisor appointments through a scripted, PII-free voice flow, ending in a booking code + secure post-call portal link.

**Architecture:** A Next.js (TypeScript, App Router) app is the single deployable: a browser Web Voice Client records mic audio and plays back replies; server routes bridge STT (Groq Whisper) and TTS (self-hosted Piper); a Conversation Engine enforces a fixed dialogue state machine and calls Groq for intent classification; three tool calls (Calendar/Notes/Email) go out over HTTP to the external MCP-server repo (built separately, in progress) — this project talks to it only through a swappable MCP client, developed first against a local mock. SQLite holds only this app's own session/portal state; MCP-server owns calendar/notes/email state itself.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, `ai` + `@ai-sdk/groq` (LLM), `groq-sdk` (Whisper STT), Piper via `child_process` (TTS), `better-sqlite3` (session/portal persistence), `zod` (schema validation), `vitest` (tests), deployed as one always-on service on Railway.

## Global Constraints

- **No PII on the call**: phone numbers, emails, account numbers must never be spoken, logged, or persisted by the voice-flow tables — enforced by a PII guard on every inbound/outbound transcript segment (from `problem-statement.md`).
- **IST time zone clarity**: every slot must be presented and re-confirmed in IST, explicitly labelled (from `problem-statement.md`).
- **No-match fallback**: if the caller rejects both offered slots, transition to a waitlist hold + draft email — never fail silently (from `problem-statement.md`).
- **Scope discipline**: any investment-advice request is intercepted before the free-form LLM path and answered with a fixed refusal + educational links, never routed to intent/booking logic (from `problem-statement.md`).
- **Single Groq key**: `GROQ_API_KEY` is the only credential for both LLM calls and STT (Whisper) — no separate STT API (from `architecture.md` §1).
- **Piper has no API key**: TTS is self-hosted; treat it as a local binary + model file, not a network credential (from `architecture.md` §1).
- **MCP-server is external and still in progress**: this project must never embed calendar/notes/email storage logic — it only calls MCP-server's HTTP endpoints via `MCP_BASE_URL`, defaulting to a local mock until the real deployment URL exists (per user decision, 2026-07-05).
- **Calendar contract is locked** to `architecture.md` §3.3: `list_slots{dayPreference, timePreference} -> {slots:[slot,slot]}`, `create_hold{topic, code, slot} -> {holdId, status}`, `cancel_hold|reschedule_hold{code, newSlot?} -> {status}` (per user decision, 2026-07-05).
- **Booking code format**: `NL-` + 1 letter + 3 digits (e.g. `NL-A742`); waitlist codes use `NL-W` + 3 digits (e.g. `NL-W123`) (from `architecture.md` §3.4).
- **No PII fields anywhere in the voice-flow schema** — contact details are captured only by the secure portal, in a table separate from session/booking tables (from `architecture.md` §3.5).

---

## Phase Overview

| Phase | Delivers | Depends on |
|---|---|---|
| 0 | Runnable Next.js + TS skeleton, test runner wired | — |
| 1 | SQLite schema, booking code generator | 0 |
| 2 | MCP client + local mock server for Calendar/Notes/Email | 0 |
| 3 | PII guard, scope guardrail, intent classifier (Groq) | 0 |
| 4 | Full dialogue state machine + `/api/chat` text-only booking flow | 1, 2, 3 |
| 5 | STT bridge: `/api/voice/transcribe` (Groq Whisper) | 0 |
| 6 | TTS bridge: `/api/voice/synthesize` (Piper) | 0 |
| 7 | Browser Web Voice Client wired end-to-end | 4, 5, 6 |
| 8 | Secure post-call portal (`/booking/[token]`) | 1, 4 |
| 9 | Railway deployment | 7, 8 |

Each phase produces independently testable, working software — Phase 4 is the first point the full booking flow can be demoed (via text), Phase 7 is the first point it can be demoed by voice.

---

## Phase 0: Project Scaffolding & Tooling

### Task 1: Initialize the Next.js + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`
- Create: `.env.local.example`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: a running `npm run dev` server on port 3000, and `npm test` running vitest.

- [ ] **Step 1: Scaffold the app**

Run:
```bash
npx create-next-app@15 . --typescript --app --eslint --no-tailwind --src-dir=false --import-alias "@/*"
```
Expected: project files created in the current directory (`D:\NextLeap\AI Appointment Scheduler`), no errors.

- [ ] **Step 2: Add runtime and dev dependencies**

Run:
```bash
npm install ai @ai-sdk/groq groq-sdk better-sqlite3 zod
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths @types/better-sqlite3
```
Expected: `package.json` `dependencies`/`devDependencies` updated, install completes with 0 vulnerabilities of high severity.

- [ ] **Step 3: Configure vitest**

Write `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

Add to `package.json` `scripts`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Add env template**

Write `.env.local.example`:
```
GROQ_API_KEY=
MCP_BASE_URL=http://localhost:3000/api/mock-mcp
MCP_API_KEY=
DATABASE_PATH=./data/app.db
PIPER_BIN=./bin/piper
PIPER_MODEL=./bin/en_US-lessac-medium.onnx
```

- [ ] **Step 5: Verify the skeleton runs**

Run: `npm run dev` (start), then in a second shell: `curl -s http://localhost:3000 -o /dev/null -w "%{http_code}\n"`
Expected: `200`. Stop the dev server after confirming.

- [ ] **Step 6: Write a trivial smoke test and confirm the runner works**

Write `app/smoke.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("toolchain smoke test", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: `1 passed`

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js + TypeScript project with vitest"
```

---

## Phase 1: Data Layer & Booking Code Generator

### Task 2: SQLite schema and connection module

**Files:**
- Create: `lib/db/schema.sql`
- Create: `lib/db/client.ts`
- Test: `lib/db/client.test.ts`

**Interfaces:**
- Produces: `getDb(): Database.Database` — a singleton `better-sqlite3` connection with the schema applied.

- [ ] **Step 1: Write the schema**

Write `lib/db/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS booking_sessions (
  id TEXT PRIMARY KEY,
  intent TEXT,
  topic TEXT,
  time_preference TEXT,
  offered_slots TEXT,
  state TEXT NOT NULL DEFAULT 'GREETING',
  chosen_slot TEXT,
  booking_code TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS secure_links (
  token TEXT PRIMARY KEY,
  booking_code TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_contacts (
  token TEXT PRIMARY KEY REFERENCES secure_links(token),
  phone TEXT,
  email TEXT,
  account_number TEXT,
  submitted_at TEXT NOT NULL
);
```

- [ ] **Step 2: Write the failing test**

Write `lib/db/client.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { getDb, resetDbForTests } from "./client";

const TEST_DB_PATH = "./data/test.db";

beforeEach(() => {
  process.env.DATABASE_PATH = TEST_DB_PATH;
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  resetDbForTests();
});

describe("getDb", () => {
  it("creates the booking_sessions table", () => {
    const db = getDb();
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='booking_sessions'")
      .get();
    expect(row).toBeTruthy();
  });

  it("returns the same instance on repeated calls", () => {
    expect(getDb()).toBe(getDb());
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- lib/db/client.test.ts`
Expected: FAIL with "Cannot find module './client'" or similar.

- [ ] **Step 4: Implement the client**

Write `lib/db/client.ts`:
```typescript
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;

  const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  instance = new Database(dbPath);
  instance.pragma("journal_mode = WAL");

  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  instance.exec(schema);

  return instance;
}

export function resetDbForTests(): void {
  instance?.close();
  instance = null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lib/db/client.test.ts`
Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add lib/db
git commit -m "feat: add SQLite schema and connection client"
```

### Task 3: Booking code generator

**Files:**
- Create: `lib/booking/code-generator.ts`
- Test: `lib/booking/code-generator.test.ts`

**Interfaces:**
- Consumes: `getDb()` from Task 2.
- Produces: `generateBookingCode(kind: "booking" | "waitlist"): string`.

- [ ] **Step 1: Write the failing test**

Write `lib/booking/code-generator.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests, getDb } from "@/lib/db/client";
import { generateBookingCode } from "./code-generator";

beforeEach(() => {
  process.env.DATABASE_PATH = "./data/test-codes.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
  resetDbForTests();
});

describe("generateBookingCode", () => {
  it("produces a booking code matching NL-<letter><3 digits>", () => {
    const code = generateBookingCode("booking");
    expect(code).toMatch(/^NL-[A-Z]\d{3}$/);
  });

  it("produces a waitlist code matching NL-W<3 digits>", () => {
    const code = generateBookingCode("waitlist");
    expect(code).toMatch(/^NL-W\d{3}$/);
  });

  it("never returns a code already used by an existing session", () => {
    const db = getDb();
    const taken = generateBookingCode("booking");
    db.prepare(
      "INSERT INTO booking_sessions (id, state, booking_code, created_at, updated_at) VALUES (?, 'WRAP_UP', ?, datetime('now'), datetime('now'))"
    ).run("session-1", taken);

    for (let i = 0; i < 20; i++) {
      expect(generateBookingCode("booking")).not.toBe(taken);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/booking/code-generator.test.ts`
Expected: FAIL with "Cannot find module './code-generator'"

- [ ] **Step 3: Implement the generator**

Write `lib/booking/code-generator.ts`:
```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/booking/code-generator.test.ts`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/booking
git commit -m "feat: add collision-checked booking code generator"
```

---

## Phase 2: MCP Client & Local Mock Server

Since MCP-server (Calendar/Notes/Email) is being built separately and isn't deployed yet, this phase builds a same-contract mock inside this app (`app/api/mock-mcp/*`) so the Conversation Engine can be developed and tested now. Swapping to the real server later is a one-line env change (`MCP_BASE_URL`), touching no other code.

### Task 4: MCP client module

**Files:**
- Create: `lib/mcp/client.ts`
- Test: `lib/mcp/client.test.ts`

**Interfaces:**
- Produces: `Slot` type, and `listSlots`, `createHold`, `cancelHold`, `rescheduleHold`, `appendEntry`, `prepareDraft` functions — the only way any other module is allowed to talk to MCP-server.

- [ ] **Step 1: Write the failing test (against a fetch mock)**

Write `lib/mcp/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listSlots, createHold } from "./client";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.MCP_BASE_URL = "http://test-mcp";
  process.env.MCP_API_KEY = "test-key";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("listSlots", () => {
  it("posts to /list-slots and returns parsed slots", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ slots: [{ id: "s1", startIso: "2026-07-07T09:00:00+05:30", label: "Tue, 7 Jul – 9:00 AM IST" }] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await listSlots("Tuesday", "morning");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-mcp/list-slots",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
    expect(result.slots).toHaveLength(1);
  });
});

describe("createHold", () => {
  it("throws when the MCP call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(
      createHold("SIP/Mandates", "NL-A742", { id: "s1", startIso: "x", label: "y" })
    ).rejects.toThrow("MCP call /create-hold failed: 500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/mcp/client.test.ts`
Expected: FAIL with "Cannot find module './client'"

- [ ] **Step 3: Implement the client**

Write `lib/mcp/client.ts`:
```typescript
export interface Slot {
  id: string;
  startIso: string;
  label: string;
}

async function mcpFetch<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = process.env.MCP_BASE_URL ?? "http://localhost:3000/api/mock-mcp";
  const apiKey = process.env.MCP_API_KEY ?? "";

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MCP call ${path} failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function listSlots(dayPreference: string, timePreference: string) {
  return mcpFetch<{ slots: Slot[] }>("/list-slots", { dayPreference, timePreference });
}

export function createHold(topic: string, code: string, slot: Slot) {
  return mcpFetch<{ holdId: string; status: string }>("/create-hold", { topic, code, slot });
}

export function cancelHold(code: string) {
  return mcpFetch<{ status: string }>("/cancel-hold", { code });
}

export function rescheduleHold(code: string, newSlot: Slot) {
  return mcpFetch<{ status: string }>("/reschedule-hold", { code, newSlot });
}

export function appendEntry(docId: string, content: string) {
  return mcpFetch<{ status: string; result: { documentId: string; replies: unknown[] } }>(
    "/append-entry",
    { doc_id: docId, content }
  );
}

export function prepareDraft(to: string, subject: string, body: string) {
  return mcpFetch<{ status: string; result: { id: string; message: string } }>(
    "/prepare-draft",
    { to, subject, body }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/mcp/client.test.ts`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/mcp/client.ts lib/mcp/client.test.ts
git commit -m "feat: add MCP client for Calendar/Notes/Email tool calls"
```

### Task 5: Local mock MCP server (Calendar/Notes/Email)

**Files:**
- Create: `app/api/mock-mcp/list-slots/route.ts`
- Create: `app/api/mock-mcp/create-hold/route.ts`
- Create: `app/api/mock-mcp/cancel-hold/route.ts`
- Create: `app/api/mock-mcp/reschedule-hold/route.ts`
- Create: `app/api/mock-mcp/append-entry/route.ts`
- Create: `app/api/mock-mcp/prepare-draft/route.ts`
- Test: `app/api/mock-mcp/mock-mcp.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (self-contained mock).
- Produces: HTTP endpoints matching the exact contract `lib/mcp/client.ts` expects, so Phase 4's booking flow can run end-to-end today.

- [ ] **Step 1: Write the failing integration test**

Write `app/api/mock-mcp/mock-mcp.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { POST as listSlotsHandler } from "./list-slots/route";
import { POST as createHoldHandler } from "./create-hold/route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/mock-mcp/x", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("mock-mcp /list-slots", () => {
  it("returns exactly two mock IST slots", async () => {
    const res = await listSlotsHandler(jsonRequest({ dayPreference: "Tue", timePreference: "afternoon" }));
    const data = await res.json();
    expect(data.slots).toHaveLength(2);
    expect(data.slots[0].label).toMatch(/IST/);
  });
});

describe("mock-mcp /create-hold", () => {
  it("returns a tentative hold id", async () => {
    const res = await createHoldHandler(
      jsonRequest({ topic: "SIP/Mandates", code: "NL-A742", slot: { id: "s1", startIso: "x", label: "y" } })
    );
    const data = await res.json();
    expect(data.status).toBe("tentative");
    expect(data.holdId).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/mock-mcp/mock-mcp.test.ts`
Expected: FAIL with "Cannot find module './list-slots/route'"

- [ ] **Step 3: Implement the routes**

Write `app/api/mock-mcp/list-slots/route.ts`:
```typescript
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  await request.json();

  const base = new Date();
  base.setDate(base.getDate() + 1);

  const slots = [9, 14].map((hourIST) => {
    const start = new Date(base);
    start.setHours(hourIST - 5, 30, 0, 0); // store as UTC equivalent of IST hour
    return {
      id: randomUUID(),
      startIso: start.toISOString(),
      label: `${start.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} – ${hourIST}:00 IST`,
    };
  });

  return Response.json({ slots });
}
```

Write `app/api/mock-mcp/create-hold/route.ts`:
```typescript
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  await request.json();
  return Response.json({ holdId: randomUUID(), status: "tentative" });
}
```

Write `app/api/mock-mcp/cancel-hold/route.ts`:
```typescript
export async function POST(request: Request) {
  await request.json();
  return Response.json({ status: "cancelled" });
}
```

Write `app/api/mock-mcp/reschedule-hold/route.ts`:
```typescript
export async function POST(request: Request) {
  await request.json();
  return Response.json({ status: "rescheduled" });
}
```

Write `app/api/mock-mcp/append-entry/route.ts`:
```typescript
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  await request.json();
  return Response.json({
    status: "ok",
    result: { documentId: randomUUID(), replies: [] },
  });
}
```

Write `app/api/mock-mcp/prepare-draft/route.ts`:
```typescript
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  await request.json();
  return Response.json({
    status: "ok",
    result: { id: randomUUID(), message: "draft created (mock, not sent)" },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/mock-mcp/mock-mcp.test.ts`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/mock-mcp
git commit -m "feat: add local mock MCP server for Calendar/Notes/Email"
```

---

## Phase 3: Conversation Guardrails & Intent Classifier

### Task 6: PII guard

**Files:**
- Create: `lib/conversation/pii-guard.ts`
- Test: `lib/conversation/pii-guard.test.ts`

**Interfaces:**
- Produces: `containsPII(text: string): boolean`.

- [ ] **Step 1: Write the failing test**

Write `lib/conversation/pii-guard.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { containsPII } from "./pii-guard";

describe("containsPII", () => {
  it("flags a phone number", () => {
    expect(containsPII("call me at 987-654-3210")).toBe(true);
  });

  it("flags an email address", () => {
    expect(containsPII("reach me at jane.doe@example.com")).toBe(true);
  });

  it("flags a long account number", () => {
    expect(containsPII("my account is 123456789012")).toBe(true);
  });

  it("does not flag ordinary booking speech", () => {
    expect(containsPII("I'd like to book a SIP mandate call on Tuesday afternoon")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/conversation/pii-guard.test.ts`
Expected: FAIL with "Cannot find module './pii-guard'"

- [ ] **Step 3: Implement the guard**

Write `lib/conversation/pii-guard.ts`:
```typescript
const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;
const ACCOUNT_RE = /\b\d{9,18}\b/;

export function containsPII(text: string): boolean {
  return PHONE_RE.test(text) || EMAIL_RE.test(text) || ACCOUNT_RE.test(text);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/conversation/pii-guard.test.ts`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/conversation/pii-guard.ts lib/conversation/pii-guard.test.ts
git commit -m "feat: add PII guard for call transcripts"
```

### Task 7: Scope guardrail (investment-advice refusal)

**Files:**
- Create: `lib/conversation/scope-guardrail.ts`
- Test: `lib/conversation/scope-guardrail.test.ts`

**Interfaces:**
- Produces: `isInvestmentAdviceRequest(text: string): boolean` and `SCOPE_REFUSAL_MESSAGE: string`.

- [ ] **Step 1: Write the failing test**

Write `lib/conversation/scope-guardrail.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { isInvestmentAdviceRequest, SCOPE_REFUSAL_MESSAGE } from "./scope-guardrail";

describe("isInvestmentAdviceRequest", () => {
  it("flags a direct stock-picking question", () => {
    expect(isInvestmentAdviceRequest("Should I invest in tech stocks right now?")).toBe(true);
  });

  it("flags a fund recommendation request", () => {
    expect(isInvestmentAdviceRequest("Which mutual fund should I put my money into?")).toBe(true);
  });

  it("does not flag a scheduling request", () => {
    expect(isInvestmentAdviceRequest("I want to book a call about my SIP mandate")).toBe(false);
  });

  it("exposes a fixed refusal message", () => {
    expect(SCOPE_REFUSAL_MESSAGE).toMatch(/not (able|licensed) to (give|provide) investment advice/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/conversation/scope-guardrail.test.ts`
Expected: FAIL with "Cannot find module './scope-guardrail'"

- [ ] **Step 3: Implement the guardrail**

Write `lib/conversation/scope-guardrail.ts`:
```typescript
const ADVICE_PATTERNS = [
  /should i (invest|buy|sell)/i,
  /which (stock|fund|mutual fund|scheme) (should|do you recommend)/i,
  /(best|good) (stock|fund|investment) (to|for)/i,
  /how (should|do) i invest/i,
];

export function isInvestmentAdviceRequest(text: string): boolean {
  return ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

export const SCOPE_REFUSAL_MESSAGE =
  "I'm not able to give investment advice or recommend specific stocks or funds — I can only help you book time with an advisor for that. " +
  "For general education, our Learn Hub has articles on how SIPs, mandates, and fund types work.";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/conversation/scope-guardrail.test.ts`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/conversation/scope-guardrail.ts lib/conversation/scope-guardrail.test.ts
git commit -m "feat: add investment-advice scope guardrail"
```

### Task 8: Intent classifier (Groq)

**Files:**
- Create: `lib/conversation/intent-classifier.ts`
- Test: `lib/conversation/intent-classifier.test.ts`

**Interfaces:**
- Consumes: `GROQ_API_KEY` env var.
- Produces: `Intent` type (`"book_new" | "reschedule" | "cancel" | "what_to_prepare" | "check_availability"`) and `classifyIntent(utterance: string): Promise<Intent>`.

- [ ] **Step 1: Write the failing test (mocking the AI SDK call)**

Write `lib/conversation/intent-classifier.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({ object: { intent: "book_new" } }),
}));
vi.mock("@ai-sdk/groq", () => ({
  groq: vi.fn().mockReturnValue("mock-model"),
}));

import { classifyIntent } from "./intent-classifier";
import { generateObject } from "ai";

describe("classifyIntent", () => {
  it("returns the intent from the model's structured output", async () => {
    const intent = await classifyIntent("I want to book a new appointment about my SIP");
    expect(intent).toBe("book_new");
    expect(generateObject).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/conversation/intent-classifier.test.ts`
Expected: FAIL with "Cannot find module './intent-classifier'"

- [ ] **Step 3: Implement the classifier**

Write `lib/conversation/intent-classifier.ts`:
```typescript
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

export const IntentSchema = z.object({
  intent: z.enum(["book_new", "reschedule", "cancel", "what_to_prepare", "check_availability"]),
});

export type Intent = z.infer<typeof IntentSchema>["intent"];

export async function classifyIntent(utterance: string): Promise<Intent> {
  const { object } = await generateObject({
    model: groq("llama-3.3-70b-versatile"),
    schema: IntentSchema,
    prompt:
      "Classify the caller's utterance into exactly one intent: book_new, reschedule, cancel, " +
      "what_to_prepare, or check_availability.\n\n" +
      `Utterance: "${utterance}"`,
  });

  return object.intent;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/conversation/intent-classifier.test.ts`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/conversation/intent-classifier.ts lib/conversation/intent-classifier.test.ts
git commit -m "feat: add Groq-based intent classifier"
```

---

## Phase 4: Dialogue State Machine & Text Chat API

### Task 9: Topic set and fixed-topic matcher

**Files:**
- Create: `lib/conversation/topics.ts`
- Test: `lib/conversation/topics.test.ts`

**Interfaces:**
- Produces: `TOPICS` const array and `matchTopic(text: string): Topic | null`.

- [ ] **Step 1: Write the failing test**

Write `lib/conversation/topics.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { matchTopic, TOPICS } from "./topics";

describe("matchTopic", () => {
  it("matches SIP/Mandates from natural phrasing", () => {
    expect(matchTopic("I need to talk about my SIP mandate")).toBe("SIP/Mandates");
  });

  it("matches KYC/Onboarding", () => {
    expect(matchTopic("something about KYC onboarding")).toBe("KYC/Onboarding");
  });

  it("returns null when nothing matches", () => {
    expect(matchTopic("I want to talk about the weather")).toBeNull();
  });

  it("exposes exactly the five fixed topics", () => {
    expect(TOPICS).toEqual([
      "KYC/Onboarding",
      "SIP/Mandates",
      "Statements/Tax Docs",
      "Withdrawals & Timelines",
      "Account Changes/Nominee",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/conversation/topics.test.ts`
Expected: FAIL with "Cannot find module './topics'"

- [ ] **Step 3: Implement the matcher**

Write `lib/conversation/topics.ts`:
```typescript
export const TOPICS = [
  "KYC/Onboarding",
  "SIP/Mandates",
  "Statements/Tax Docs",
  "Withdrawals & Timelines",
  "Account Changes/Nominee",
] as const;

export type Topic = (typeof TOPICS)[number];

const TOPIC_KEYWORDS: Record<Topic, RegExp> = {
  "KYC/Onboarding": /\bkyc\b|onboard/i,
  "SIP/Mandates": /\bsip\b|mandate/i,
  "Statements/Tax Docs": /statement|tax doc|\bitr\b/i,
  "Withdrawals & Timelines": /withdraw|redemption timeline/i,
  "Account Changes/Nominee": /nominee|account change/i,
};

export function matchTopic(text: string): Topic | null {
  for (const topic of TOPICS) {
    if (TOPIC_KEYWORDS[topic].test(text)) return topic;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/conversation/topics.test.ts`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/conversation/topics.ts lib/conversation/topics.test.ts
git commit -m "feat: add fixed topic set and keyword matcher"
```

### Task 10: Session store

**Files:**
- Create: `lib/conversation/session-store.ts`
- Test: `lib/conversation/session-store.test.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 2).
- Produces: `Session` type, `createSession(): Session`, `getSession(id: string): Session | null`, `saveSession(session: Session): void`.

- [ ] **Step 1: Write the failing test**

Write `lib/conversation/session-store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests } from "@/lib/db/client";
import { createSession, getSession, saveSession } from "./session-store";

beforeEach(() => {
  process.env.DATABASE_PATH = "./data/test-sessions.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
  resetDbForTests();
});

describe("session store", () => {
  it("creates a session in GREETING state", () => {
    const session = createSession();
    expect(session.state).toBe("GREETING");
    expect(session.id).toBeTruthy();
  });

  it("persists and reloads updates", () => {
    const session = createSession();
    session.topic = "SIP/Mandates";
    session.state = "TIME_PREFERENCE_COLLECT";
    saveSession(session);

    const reloaded = getSession(session.id);
    expect(reloaded?.topic).toBe("SIP/Mandates");
    expect(reloaded?.state).toBe("TIME_PREFERENCE_COLLECT");
  });

  it("returns null for an unknown id", () => {
    expect(getSession("does-not-exist")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/conversation/session-store.test.ts`
Expected: FAIL with "Cannot find module './session-store'"

- [ ] **Step 3: Implement the store**

Write `lib/conversation/session-store.ts`:
```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/conversation/session-store.test.ts`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/conversation/session-store.ts lib/conversation/session-store.test.ts
git commit -m "feat: add SQLite-backed conversation session store"
```

### Task 11: Dialogue state machine

**Files:**
- Create: `lib/conversation/state-machine.ts`
- Test: `lib/conversation/state-machine.test.ts`

**Interfaces:**
- Consumes: `Session`/`SessionState` (Task 10), `matchTopic` (Task 9), `classifyIntent` (Task 8), `containsPII` (Task 6), `isInvestmentAdviceRequest`/`SCOPE_REFUSAL_MESSAGE` (Task 7), `listSlots`/`createHold` (Task 4), `generateBookingCode` (Task 3).
- Produces: `advance(session: Session, callerText: string): Promise<{ session: Session; reply: string }>` — the single entry point the chat/voice APIs call per turn.

- [ ] **Step 1: Write the failing tests**

Write `lib/conversation/state-machine.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests } from "@/lib/db/client";
import { createSession } from "./session-store";
import { advance } from "./state-machine";

vi.mock("./intent-classifier", () => ({
  classifyIntent: vi.fn().mockResolvedValue("book_new"),
}));
vi.mock("@/lib/mcp/client", () => ({
  listSlots: vi.fn().mockResolvedValue({
    slots: [
      { id: "s1", startIso: "2026-07-07T09:00:00+05:30", label: "Tue, 7 Jul – 9:00 AM IST" },
      { id: "s2", startIso: "2026-07-07T14:00:00+05:30", label: "Tue, 7 Jul – 2:00 PM IST" },
    ],
  }),
  createHold: vi.fn().mockResolvedValue({ holdId: "hold-1", status: "tentative" }),
  appendEntry: vi.fn().mockResolvedValue({ status: "ok", result: { documentId: "doc-1", replies: [] } }),
  prepareDraft: vi.fn().mockResolvedValue({ status: "ok", result: { id: "draft-1", message: "ok" } }),
}));

beforeEach(() => {
  process.env.DATABASE_PATH = "./data/test-state-machine.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
  resetDbForTests();
});

describe("advance", () => {
  it("greets and gives the disclaimer on the first turn", async () => {
    const session = createSession();
    const { session: next, reply } = await advance(session, "hi");
    expect(next.state).toBe("DISCLAIMER");
    expect(reply.toLowerCase()).toMatch(/informational.*not investment advice/);
  });

  it("intercepts investment-advice requests before touching intent/booking state", async () => {
    const session = createSession();
    session.state = "TOPIC_CONFIRM";
    const { session: next, reply } = await advance(session, "which stock should I buy");
    expect(reply).toMatch(/not able to give investment advice/i);
    expect(next.state).toBe("TOPIC_CONFIRM");
  });

  it("redirects to the secure link instead of repeating PII", async () => {
    const session = createSession();
    session.state = "TOPIC_CONFIRM";
    const { reply } = await advance(session, "my email is jane@example.com");
    expect(reply).toMatch(/secure link/i);
    expect(reply).not.toMatch(/jane@example\.com/);
  });

  it("runs the full happy path to a booking code", async () => {
    let session = createSession();
    ({ session } = await advance(session, "hi"));
    ({ session } = await advance(session, "yes I understand"));
    ({ session } = await advance(session, "I want to talk about my SIP mandate"));
    ({ session } = await advance(session, "Tuesday afternoon works"));

    expect(session.state).toBe("SLOT_CONFIRM");
    expect(session.offeredSlots).toHaveLength(2);

    const result = await advance(session, "the first one is fine");

    expect(result.session.state).toBe("WRAP_UP");
    expect(result.session.bookingCode).toMatch(/^NL-[A-Z]\d{3}$/);
    expect(result.reply).toMatch(/IST/);
    expect(result.reply).toContain(result.session.bookingCode);
    expect(result.reply).toMatch(/\/booking\//);
  });

  it("falls back to a waitlist when neither offered slot is accepted", async () => {
    let session = createSession();
    ({ session } = await advance(session, "hi"));
    ({ session } = await advance(session, "yes"));
    ({ session } = await advance(session, "SIP mandate please"));
    ({ session } = await advance(session, "Tuesday"));

    const result = await advance(session, "neither of those works for me");

    expect(result.session.state).toBe("WRAP_UP");
    expect(result.session.bookingCode).toMatch(/^NL-W\d{3}$/);
    expect(result.reply).toMatch(/waitlist/i);
    expect(result.reply).toMatch(/\/booking\//);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/conversation/state-machine.test.ts`
Expected: FAIL with "Cannot find module './state-machine'"

- [ ] **Step 3: Implement the state machine**

Write `lib/conversation/state-machine.ts`:
```typescript
import { containsPII } from "./pii-guard";
import { isInvestmentAdviceRequest, SCOPE_REFUSAL_MESSAGE } from "./scope-guardrail";
import { classifyIntent } from "./intent-classifier";
import { matchTopic } from "./topics";
import { listSlots, createHold, appendEntry, prepareDraft } from "@/lib/mcp/client";
import { generateBookingCode } from "@/lib/booking/code-generator";
import { saveSession, type Session } from "./session-store";

const DISCLAIMER =
  "This call is informational only and not investment advice. What would you like help with today?";

const PII_REDIRECT =
  "For your security, please don't share phone numbers, emails, or account details on this call — " +
  "I'll give you a secure link at the end where you can provide that safely.";

const NOTES_DOC_ID = process.env.NOTES_DOC_ID ?? "advisor-pre-bookings";
const ADVISOR_EMAIL = process.env.ADVISOR_EMAIL ?? "advisor@example.com";

function acceptsSlot(text: string): "first" | "second" | "neither" {
  const lower = text.toLowerCase();
  if (/first|1st|one\b/.test(lower)) return "first";
  if (/second|2nd|two\b/.test(lower)) return "second";
  if (/neither|none|no /.test(lower)) return "neither";
  return "neither";
}

export async function advance(
  session: Session,
  callerText: string
): Promise<{ session: Session; reply: string }> {
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
      };
    }

    case "SLOT_CONFIRM": {
      const choice = acceptsSlot(callerText);
      const code =
        choice === "neither" ? generateBookingCode("waitlist") : generateBookingCode("booking");

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
            "An advisor will reach out once a slot opens up.",
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
          `Visit the secure link I'll show on screen to share your contact details.`,
      };
    }

    default:
      return {
        session,
        reply: "Your booking is complete. Is there anything else I can help with?",
      };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/conversation/state-machine.test.ts`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/conversation/state-machine.ts lib/conversation/state-machine.test.ts
git commit -m "feat: implement dialogue state machine for booking flow"
```

### Task 12: Text chat API route

**Files:**
- Create: `app/api/chat/route.ts`
- Test: `app/api/chat/chat.test.ts`

**Interfaces:**
- Consumes: `createSession`/`getSession` (Task 10), `advance` (Task 11).
- Produces: `POST /api/chat` accepting `{ sessionId?: string; message: string }`, returning `{ sessionId: string; reply: string; state: string }`.

- [ ] **Step 1: Write the failing test**

Write `app/api/chat/chat.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { resetDbForTests } from "@/lib/db/client";

vi.mock("@/lib/conversation/intent-classifier", () => ({
  classifyIntent: vi.fn().mockResolvedValue("book_new"),
}));
vi.mock("@/lib/mcp/client", () => ({
  listSlots: vi.fn().mockResolvedValue({
    slots: [
      { id: "s1", startIso: "x", label: "Tue – 9:00 AM IST" },
      { id: "s2", startIso: "y", label: "Tue – 2:00 PM IST" },
    ],
  }),
  createHold: vi.fn().mockResolvedValue({ holdId: "h1", status: "tentative" }),
  appendEntry: vi.fn().mockResolvedValue({ status: "ok", result: { documentId: "d1", replies: [] } }),
  prepareDraft: vi.fn().mockResolvedValue({ status: "ok", result: { id: "e1", message: "ok" } }),
}));

import { POST } from "./route";

beforeEach(() => {
  process.env.DATABASE_PATH = "./data/test-chat-api.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
  resetDbForTests();
});

function chatRequest(body: unknown) {
  return new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/chat", () => {
  it("starts a new session when no sessionId is given", async () => {
    const res = await POST(chatRequest({ message: "hi" }));
    const data = await res.json();
    expect(data.sessionId).toBeTruthy();
    expect(data.state).toBe("DISCLAIMER");
  });

  it("continues an existing session by sessionId", async () => {
    const first = await (await POST(chatRequest({ message: "hi" }))).json();
    const second = await (
      await POST(chatRequest({ sessionId: first.sessionId, message: "yes I understand" }))
    ).json();
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.state).toBe("TOPIC_CONFIRM");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/chat/chat.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Implement the route**

Write `app/api/chat/route.ts`:
```typescript
import { createSession, getSession } from "@/lib/conversation/session-store";
import { advance } from "@/lib/conversation/state-machine";

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId?: string; message: string };

  const session = body.sessionId ? getSession(body.sessionId) : null;
  const activeSession = session ?? createSession();

  const { session: nextSession, reply } = await advance(activeSession, body.message);

  return Response.json({
    sessionId: nextSession.id,
    reply,
    state: nextSession.state,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/chat/chat.test.ts`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/chat
git commit -m "feat: add text chat API wiring the full booking flow end-to-end"
```

**Checkpoint:** at this point the entire booking/waitlist flow is demoable via `curl -X POST http://localhost:3000/api/chat -d '{"message":"hi"}'` chained turns — no voice yet, but functionally complete text-mode POC.

---

## Phase 5: Voice I/O Bridge — STT (Groq Whisper)

### Task 13: Whisper transcription wrapper

**Files:**
- Create: `lib/voice/transcribe.ts`
- Test: `lib/voice/transcribe.test.ts`

**Interfaces:**
- Consumes: `GROQ_API_KEY` env var.
- Produces: `transcribeAudio(audio: Buffer, filename: string): Promise<string>`.

- [ ] **Step 1: Write the failing test**

Write `lib/voice/transcribe.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({ text: "I want to book an appointment" });
vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: mockCreate } },
  })),
}));

import { transcribeAudio } from "./transcribe";

describe("transcribeAudio", () => {
  it("returns the transcript text from Groq Whisper", async () => {
    const result = await transcribeAudio(Buffer.from("fake-audio-bytes"), "utterance.webm");
    expect(result).toBe("I want to book an appointment");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "whisper-large-v3" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/voice/transcribe.test.ts`
Expected: FAIL with "Cannot find module './transcribe'"

- [ ] **Step 3: Implement the wrapper**

Write `lib/voice/transcribe.ts`:
```typescript
import Groq from "groq-sdk";
import { toFile } from "groq-sdk/uploads";

let client: Groq | null = null;

function getClient(): Groq {
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

export async function transcribeAudio(audio: Buffer, filename: string): Promise<string> {
  const response = await getClient().audio.transcriptions.create({
    file: await toFile(audio, filename),
    model: "whisper-large-v3",
  });
  return response.text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/voice/transcribe.test.ts`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/voice/transcribe.ts lib/voice/transcribe.test.ts
git commit -m "feat: add Groq Whisper transcription wrapper"
```

### Task 14: Transcribe API route

**Files:**
- Create: `app/api/voice/transcribe/route.ts`
- Test: `app/api/voice/transcribe/transcribe-route.test.ts`

**Interfaces:**
- Consumes: `transcribeAudio` (Task 13).
- Produces: `POST /api/voice/transcribe` accepting `multipart/form-data` with an `audio` file field, returning `{ transcript: string }`.

- [ ] **Step 1: Write the failing test**

Write `app/api/voice/transcribe/transcribe-route.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/voice/transcribe", () => ({
  transcribeAudio: vi.fn().mockResolvedValue("book a call about KYC"),
}));

import { POST } from "./route";

describe("POST /api/voice/transcribe", () => {
  it("transcribes an uploaded audio file", async () => {
    const form = new FormData();
    form.append("audio", new Blob([Buffer.from("fake")], { type: "audio/webm" }), "clip.webm");
    const request = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: form,
    });

    const res = await POST(request);
    const data = await res.json();
    expect(data.transcript).toBe("book a call about KYC");
  });

  it("returns 400 when no audio file is present", async () => {
    const request = new Request("http://localhost/api/voice/transcribe", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/voice/transcribe/transcribe-route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Implement the route**

Write `app/api/voice/transcribe/route.ts`:
```typescript
import { transcribeAudio } from "@/lib/voice/transcribe";

export async function POST(request: Request) {
  const form = await request.formData();
  const audio = form.get("audio");

  if (!(audio instanceof Blob)) {
    return Response.json({ error: "audio file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const filename = audio instanceof File ? audio.name : "utterance.webm";
  const transcript = await transcribeAudio(buffer, filename);

  return Response.json({ transcript });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/voice/transcribe/transcribe-route.test.ts`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/voice/transcribe
git commit -m "feat: add /api/voice/transcribe route"
```

---

## Phase 6: Voice I/O Bridge — TTS (Piper)

Piper is a self-hosted binary, not an npm package. Before this phase's tests can run for real (not mocked), download a build for your platform and a voice model, e.g.:
```bash
mkdir -p bin
curl -L -o bin/piper.tar.gz https://github.com/rhasspy/piper/releases/latest/download/piper_windows_amd64.zip
curl -L -o bin/en_US-lessac-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
curl -L -o bin/en_US-lessac-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
```
Set `PIPER_BIN` and `PIPER_MODEL` in `.env.local` to the extracted paths. The unit tests below mock `child_process` so they don't require the binary to be present.

### Task 15: Piper synthesis wrapper

**Files:**
- Create: `lib/voice/synthesize.ts`
- Test: `lib/voice/synthesize.test.ts`

**Interfaces:**
- Consumes: `PIPER_BIN`, `PIPER_MODEL` env vars.
- Produces: `synthesizeSpeech(text: string): Promise<Buffer>` (returns WAV bytes).

- [ ] **Step 1: Write the failing test**

Write `lib/voice/synthesize.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: PassThrough;
      stdout: PassThrough;
    };
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();

    process.nextTick(() => {
      child.stdout.end(Buffer.from("RIFF-fake-wav-bytes"));
      child.emit("close", 0);
    });

    return child;
  }),
}));

import { synthesizeSpeech } from "./synthesize";

describe("synthesizeSpeech", () => {
  it("pipes text to piper and returns the wav buffer", async () => {
    const result = await synthesizeSpeech("You're booked for Tuesday at 9 AM IST.");
    expect(result.toString()).toContain("RIFF-fake-wav-bytes");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/voice/synthesize.test.ts`
Expected: FAIL with "Cannot find module './synthesize'"

- [ ] **Step 3: Implement the wrapper**

Write `lib/voice/synthesize.ts`:
```typescript
import { spawn } from "node:child_process";

export function synthesizeSpeech(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const piperBin = process.env.PIPER_BIN ?? "./bin/piper";
    const piperModel = process.env.PIPER_MODEL ?? "./bin/en_US-lessac-medium.onnx";

    const child = spawn(piperBin, ["--model", piperModel, "--output_file", "-"]);
    const chunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`piper exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    child.stdin.write(text);
    child.stdin.end();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/voice/synthesize.test.ts`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/voice/synthesize.ts lib/voice/synthesize.test.ts
git commit -m "feat: add Piper TTS synthesis wrapper"
```

### Task 16: Synthesize API route

**Files:**
- Create: `app/api/voice/synthesize/route.ts`
- Test: `app/api/voice/synthesize/synthesize-route.test.ts`

**Interfaces:**
- Consumes: `synthesizeSpeech` (Task 15).
- Produces: `POST /api/voice/synthesize` accepting `{ text: string }`, returning `audio/wav` bytes.

- [ ] **Step 1: Write the failing test**

Write `app/api/voice/synthesize/synthesize-route.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/voice/synthesize", () => ({
  synthesizeSpeech: vi.fn().mockResolvedValue(Buffer.from("fake-wav-bytes")),
}));

import { POST } from "./route";

describe("POST /api/voice/synthesize", () => {
  it("returns audio/wav bytes for the given text", async () => {
    const request = new Request("http://localhost/api/voice/synthesize", {
      method: "POST",
      body: JSON.stringify({ text: "You're booked for Tuesday." }),
    });

    const res = await POST(request);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.toString()).toBe("fake-wav-bytes");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/voice/synthesize/synthesize-route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Implement the route**

Write `app/api/voice/synthesize/route.ts`:
```typescript
import { synthesizeSpeech } from "@/lib/voice/synthesize";

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text: string };
  const wav = await synthesizeSpeech(text);

  return new Response(wav, {
    headers: { "content-type": "audio/wav" },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/voice/synthesize/synthesize-route.test.ts`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/voice/synthesize
git commit -m "feat: add /api/voice/synthesize route"
```

---

## Phase 7: Web Voice Client

### Task 17: Push-to-talk voice page

For a POC, push-to-talk (hold a button to record, release to send) is far more reliable than voice-activity detection and needs no extra library — this is a deliberate simplification over always-on listening.

**Files:**
- Create: `app/voice/page.tsx`
- Create: `app/voice/use-voice-session.ts`
- Test: `app/voice/use-voice-session.test.ts`

**Interfaces:**
- Consumes: `POST /api/voice/transcribe`, `POST /api/chat`, `POST /api/voice/synthesize` (Tasks 5.2, 4.4, 6.2).
- Produces: `submitTurn(audioBlob: Blob, sessionId: string | null): Promise<{ sessionId: string; replyAudioUrl: string; state: string }>`, used by the page component.

- [ ] **Step 1: Write the failing test**

Write `app/voice/use-voice-session.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { submitTurn } from "./use-voice-session";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("submitTurn", () => {
  it("chains transcribe -> chat -> synthesize and returns a playable audio URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transcript: "book a SIP call" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: "sess-1", reply: "Which day works?", state: "TIME_PREFERENCE_COLLECT" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode("fake-wav").buffer,
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:fake-url");

    const result = await submitTurn(new Blob(["fake-audio"]), null);

    expect(result.sessionId).toBe("sess-1");
    expect(result.state).toBe("TIME_PREFERENCE_COLLECT");
    expect(result.replyAudioUrl).toBe("blob:fake-url");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/voice/use-voice-session.test.ts`
Expected: FAIL with "Cannot find module './use-voice-session'"

- [ ] **Step 3: Implement the hook module**

Write `app/voice/use-voice-session.ts`:
```typescript
export interface TurnResult {
  sessionId: string;
  reply: string;
  state: string;
  replyAudioUrl: string;
}

export async function submitTurn(audioBlob: Blob, sessionId: string | null): Promise<TurnResult> {
  const form = new FormData();
  form.append("audio", audioBlob, "utterance.webm");

  const transcribeRes = await fetch("/api/voice/transcribe", { method: "POST", body: form });
  const { transcript } = await transcribeRes.json();

  const chatRes = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ sessionId: sessionId ?? undefined, message: transcript }),
  });
  const { sessionId: nextSessionId, reply, state } = await chatRes.json();

  const synthesizeRes = await fetch("/api/voice/synthesize", {
    method: "POST",
    body: JSON.stringify({ text: reply }),
  });
  const wavBytes = await synthesizeRes.arrayBuffer();
  const replyAudioUrl = URL.createObjectURL(new Blob([wavBytes], { type: "audio/wav" }));

  return { sessionId: nextSessionId, reply, state, replyAudioUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/voice/use-voice-session.test.ts`
Expected: `1 passed`

- [ ] **Step 5: Implement the page (manual/browser verification only — no unit test for MediaRecorder)**

Write `app/voice/page.tsx`:
```typescript
"use client";

import { useRef, useState } from "react";
import { submitTurn } from "./use-voice-session";

export default function VoicePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcriptLog, setTranscriptLog] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const result = await submitTurn(blob, sessionId);
      setSessionId(result.sessionId);
      setTranscriptLog((log) => [...log, `Agent: ${result.reply}`]);
      new Audio(result.replyAudioUrl).play();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  return (
    <main>
      <h1>Advisor Appointment Voice Agent</h1>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        aria-pressed={isRecording}
      >
        {isRecording ? "Release to send" : "Hold to talk"}
      </button>
      <ul>
        {transcriptLog.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 6: Manual browser verification**

Run: `npm run dev`, open `http://localhost:3000/voice`, click and hold the button, say "Hi", release, and confirm a spoken reply plays back and the transcript list updates.
Expected: audio reply is audible; state progresses turn over turn.

- [ ] **Step 7: Commit**

```bash
git add app/voice
git commit -m "feat: add push-to-talk web voice client"
```

---

## Phase 8: Secure Post-Call Portal

### Task 18: Secure link generation

**Files:**
- Modify: `lib/conversation/state-machine.ts` (WRAP_UP branch, both booking and waitlist paths)
- Create: `lib/portal/secure-links.ts`
- Test: `lib/portal/secure-links.test.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 2).
- Produces: `createSecureLink(bookingCode: string): { token: string; url: string }`, `resolveSecureLink(token: string): { bookingCode: string } | null`, `markLinkUsed(token: string): void`.

- [ ] **Step 1: Write the failing test**

Write `lib/portal/secure-links.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests } from "@/lib/db/client";
import { createSecureLink, resolveSecureLink, markLinkUsed } from "./secure-links";

beforeEach(() => {
  process.env.DATABASE_PATH = "./data/test-secure-links.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
  resetDbForTests();
});

describe("secure links", () => {
  it("creates a token that resolves back to the booking code", () => {
    const { token } = createSecureLink("NL-A742");
    expect(resolveSecureLink(token)).toEqual({ bookingCode: "NL-A742" });
  });

  it("returns null for a used token", () => {
    const { token } = createSecureLink("NL-A742");
    markLinkUsed(token);
    expect(resolveSecureLink(token)).toBeNull();
  });

  it("returns null for an unknown token", () => {
    expect(resolveSecureLink("unknown-token")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/portal/secure-links.test.ts`
Expected: FAIL with "Cannot find module './secure-links'"

- [ ] **Step 3: Implement secure links**

Write `lib/portal/secure-links.ts`:
```typescript
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";

const LINK_TTL_HOURS = 48;

export function createSecureLink(bookingCode: string): { token: string; url: string } {
  const db = getDb();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + LINK_TTL_HOURS * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO secure_links (token, booking_code, used, expires_at, created_at)
     VALUES (?, ?, 0, ?, datetime('now'))`
  ).run(token, bookingCode, expiresAt);

  return { token, url: `/booking/${token}` };
}

export function resolveSecureLink(token: string): { bookingCode: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT booking_code, used, expires_at FROM secure_links WHERE token = ?"
    )
    .get(token) as { booking_code: string; used: number; expires_at: string } | undefined;

  if (!row || row.used || new Date(row.expires_at) < new Date()) return null;
  return { bookingCode: row.booking_code };
}

export function markLinkUsed(token: string): void {
  getDb().prepare("UPDATE secure_links SET used = 1 WHERE token = ?").run(token);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/portal/secure-links.test.ts`
Expected: `3 passed`

- [ ] **Step 5: Wire link creation into WRAP_UP**

In `lib/conversation/state-machine.ts`, add the import:
```typescript
import { createSecureLink } from "@/lib/portal/secure-links";
```

Replace the booking-path reply construction:
```typescript
      session.state = "WRAP_UP";
      saveSession(session);
      const { url } = createSecureLink(code);
      return {
        session,
        reply:
          `You're booked for ${slot.label}. Your code is ${code}. ` +
          `Visit ${url} to share your contact details securely.`,
      };
```

And the waitlist-path reply construction:
```typescript
        session.state = "WRAP_UP";
        saveSession(session);
        const { url } = createSecureLink(code);
        return {
          session,
          reply:
            `No problem — I've added you to the waitlist with code ${code}. ` +
            `An advisor will reach out once a slot opens up. Visit ${url} to leave your contact details.`,
        };
```

- [ ] **Step 6: Rerun state-machine tests**

`lib/conversation/state-machine.test.ts` (written in Task 11) already asserts `expect(result.reply).toMatch(/\/booking\//);` in both the "happy path" and "waitlist fallback" tests, anticipating this task's change — no test edits needed here.

Run: `npm test -- lib/conversation/state-machine.test.ts`
Expected: `5 passed`

- [ ] **Step 7: Commit**

```bash
git add lib/portal/secure-links.ts lib/portal/secure-links.test.ts lib/conversation/state-machine.ts lib/conversation/state-machine.test.ts
git commit -m "feat: generate secure post-call portal links at wrap-up"
```

### Task 19: Portal page and contact-submission route

**Files:**
- Create: `app/booking/[token]/page.tsx`
- Create: `app/api/portal/submit/route.ts`
- Test: `app/api/portal/submit/submit-route.test.ts`

**Interfaces:**
- Consumes: `resolveSecureLink`, `markLinkUsed` (Task 18).
- Produces: `POST /api/portal/submit` accepting `{ token, phone?, email?, accountNumber? }`, returning `{ status: "ok" }` or 410 for an invalid/used token.

- [ ] **Step 1: Write the failing test**

Write `app/api/portal/submit/submit-route.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetDbForTests, getDb } from "@/lib/db/client";
import { createSecureLink } from "@/lib/portal/secure-links";
import { POST } from "./route";

beforeEach(() => {
  process.env.DATABASE_PATH = "./data/test-portal-submit.db";
  if (fs.existsSync(process.env.DATABASE_PATH)) fs.unlinkSync(process.env.DATABASE_PATH);
  resetDbForTests();
});

function submitRequest(body: unknown) {
  return new Request("http://localhost/api/portal/submit", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/portal/submit", () => {
  it("stores contact details for a valid token and marks it used", async () => {
    const { token } = createSecureLink("NL-A742");

    const res = await POST(submitRequest({ token, phone: "9876543210", email: "jane@example.com" }));
    expect(res.status).toBe(200);

    const row = getDb().prepare("SELECT * FROM portal_contacts WHERE token = ?").get(token) as
      | { phone: string }
      | undefined;
    expect(row?.phone).toBe("9876543210");
  });

  it("rejects a reused token with 410", async () => {
    const { token } = createSecureLink("NL-A742");
    await POST(submitRequest({ token, phone: "9876543210" }));

    const res = await POST(submitRequest({ token, phone: "9876543210" }));
    expect(res.status).toBe(410);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/portal/submit/submit-route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Implement the route**

Write `app/api/portal/submit/route.ts`:
```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/portal/submit/submit-route.test.ts`
Expected: `2 passed`

- [ ] **Step 5: Implement the portal page (manual verification only)**

Write `app/booking/[token]/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

export default function BookingPortalPage() {
  const params = useParams<{ token: string }>();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/portal/submit", {
      method: "POST",
      body: JSON.stringify({ token: params.token, phone, email }),
    });

    if (!res.ok) {
      setError("This link is invalid or has already been used.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) return <p>Thanks — your details were submitted securely.</p>;

  return (
    <main>
      <h1>Confirm Your Contact Details</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit">Submit</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Manual browser verification**

Run: `npm run dev`, complete a booking at `/voice` or via `curl` on `/api/chat`, copy the resulting `/booking/<token>` path, open it, submit the form, and confirm the reused-token case returns the 410 error message on a second submit.

- [ ] **Step 7: Commit**

```bash
git add app/booking app/api/portal
git commit -m "feat: add secure post-call portal page and submission route"
```

---

## Phase 9: Deployment to Railway

### Task 20: Railway service configuration

**Files:**
- Create: `railway.toml`
- Create: `Dockerfile`
- Modify: `.env.local.example` (document production-only vars)

**Interfaces:**
- Produces: a deployable container bundling the Next.js app and the Piper binary/model together, matching the "Piper needs an always-on host" constraint from `architecture.md` §1.

- [ ] **Step 1: Write the Dockerfile**

Write `Dockerfile`:
```dockerfile
FROM node:20-slim AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Piper binary + model are fetched at build time so the image is self-contained
RUN mkdir -p bin \
  && apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/* \
  && curl -L -o /tmp/piper.tar.gz https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz \
  && tar -xzf /tmp/piper.tar.gz -C bin \
  && curl -L -o bin/en_US-lessac-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx \
  && curl -L -o bin/en_US-lessac-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

ENV PIPER_BIN=/app/bin/piper
ENV PIPER_MODEL=/app/bin/en_US-lessac-medium.onnx
ENV DATABASE_PATH=/app/data/app.db

EXPOSE 3000
CMD ["npm", "start"]
```

- [ ] **Step 2: Write the Railway config**

Write `railway.toml`:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
numReplicas = 1
```

- [ ] **Step 3: Document required production env vars**

Append to `.env.local.example`:
```
# --- Production-only (set in Railway dashboard, not committed) ---
MCP_BASE_URL=https://<your-mcp-server>.up.railway.app
MCP_API_KEY=<real MCP-server API key>
NOTES_DOC_ID=<real Advisor Pre-Bookings Google Doc id>
ADVISOR_EMAIL=<real advisor mailbox>
```

- [ ] **Step 4: Verify the Docker build locally**

Run: `docker build -t appointment-scheduler .`
Expected: build completes with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile railway.toml .env.local.example
git commit -m "chore: add Railway/Docker deployment configuration"
```

### Task 21: Deploy and smoke test

- [ ] **Step 1: Link and deploy**

Run:
```bash
railway login
railway init
railway up
```
Expected: deployment succeeds; Railway prints a public URL.

- [ ] **Step 2: Set production env vars in the Railway dashboard**

Set `GROQ_API_KEY`, `MCP_BASE_URL` (pointed at the real, by-then-deployed MCP-server), `MCP_API_KEY`, `NOTES_DOC_ID`, `ADVISOR_EMAIL` under the service's Variables tab.

- [ ] **Step 3: Smoke test the deployed chat flow**

Run (replacing the URL with the Railway-assigned one):
```bash
curl -X POST https://<your-app>.up.railway.app/api/chat -d '{"message":"hi"}' -H "Content-Type: application/json"
```
Expected: JSON response with `state: "DISCLAIMER"` and the disclaimer text.

- [ ] **Step 4: Smoke test the voice page manually**

Open `https://<your-app>.up.railway.app/voice` in a browser, hold the button, speak, and confirm a synthesized reply plays back.

---

## Self-Review Notes

- **Spec coverage**: all five intents (`book_new`, `reschedule`, `cancel`, `what_to_prepare`, `check_availability`) are classified in Phase 3; only `book_new`'s full state path is built out task-by-task in Phase 4 for time — **reschedule/cancel/what_to_prepare/check_availability branches in the state machine are a follow-up plan**, not yet covered here, since the brief's five core intents share the same guardrail/topic/slot machinery but diverge in their `SLOT_CONFIRM`-equivalent step. Flagging this explicitly rather than leaving a placeholder: extend `advance()`'s switch with `RESCHEDULE_LOOKUP`, `CANCEL_CONFIRM`, etc., reusing `matchTopic`, `containsPII`, and the MCP client as-is.
- **PII constraint**: enforced centrally in `advance()` (Task 11) before any other branch runs, plus no PII columns anywhere outside `portal_contacts` (Task 2, Task 19).
- **IST constraint**: slot labels are generated with an explicit `IST` suffix at the mock-MCP boundary (Task 5) and repeated verbatim through `SLOT_CONFIRM`/`WRAP_UP` replies (Task 11).
- **No-match fallback**: implemented as the `WAITLIST_EXECUTE` branch (Task 11), producing an `NL-W`-prefixed code and its own notes/email calls.
- **Scope discipline**: `isInvestmentAdviceRequest` runs ahead of state-specific logic on every turn except the very first (Task 11).
