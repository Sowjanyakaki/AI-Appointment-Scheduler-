# Architecture: Voice Agent — Advisor Appointment Scheduler

> Companion to [`problem-statement.md`](./problem-statement.md). Describes the system design needed to execute the milestone brief.

## 1. Design Assumptions

Since this is a milestone/pilot build, the architecture favors mocked/lightweight backends over deep integrations, with clean seams to swap in real systems later. Assumptions called out explicitly so they can be revisited:

- **Voice channel**: **browser-based**, not real telephony — no phone number, no SIP trunk, no carrier costs. Caller opens a web page, the browser captures mic audio (`MediaRecorder`/WebRTC) and streams it to the backend; the agent's spoken reply is played back through the browser speaker. This keeps the whole voice path free/open-source and matches pilot scope.
- **Speech-to-text**: **Groq-hosted Whisper** (`whisper-large-v3` via the Groq Audio API), reusing the same `GROQ_API_KEY` already used for the LLM — no separate account/infra.
- **Text-to-speech**: **Piper** (open-source, self-hosted TTS engine) — runs as its own small service/container; no API key, no per-call cost.
- **LLM access**: direct **Groq** integration via the AI SDK (`@ai-sdk/groq`), authenticated with a `GROQ_API_KEY` env var — not routed through Vercel AI Gateway, since this is a single-provider pilot. Chosen for Groq's low-latency inference, which matters for natural voice turn-taking.
- **Calendar**: a **mock calendar** (seeded time-slot table), not a real Google/Outlook calendar integration, exposed only through an MCP tool. No existing implementation yet — see §3.3.
- **Notes store & Email draft**: provided by the existing **[MCP-server](https://github.com/Sowjanyakaki/MCP-server)** repo (FastAPI, real Google Docs + Gmail integration via OAuth2) rather than being built from scratch — see §3.3 for how its two endpoints map onto our tool contracts.
- **Hosting**: **Railway**, as a single deployment target for the whole POC. Piper (self-hosted TTS) needs an always-on process with the model loaded in memory, which rules out Vercel's serverless functions — so rather than split hosting across two platforms, the Conversation Engine, Voice I/O Bridge/Piper, and Web Voice Client all run as one (or a couple of) Railway service(s), alongside MCP-server which already deploys there (see its `railway.toml`/`deployment.md`). Vercel remains an option later if parts of this move to serverless, but isn't needed for the POC.
- **Persistence**: **SQLite** (a single file on the Railway container), not a hosted Postgres/Marketplace database. This is a POC — no separate DB account/connection string to manage, and the schema below is small enough that SQLite is sufficient. Data is not guaranteed to survive a Railway redeploy (ephemeral filesystem on redeploy), which is an acceptable tradeoff for demo purposes; swap in a real Postgres later if persistence across deploys becomes important.

## 2. High-Level Architecture

```
                          ┌─────────────────────────┐
   Caller (browser) ────► │   Web Voice Client       │
   mic/speaker            │  (MediaRecorder/WebRTC)  │
                          └────────────┬─────────────┘
                                       │ audio chunks / TTS audio back
                                       ▼
                          ┌─────────────────────────┐
                          │   Voice I/O Bridge       │
                          │  STT: Groq Whisper API   │
                          │  TTS: Piper (self-hosted)│
                          └────────────┬─────────────┘
                                       │ transcript turns / audio events
                                       ▼
                          ┌─────────────────────────┐
                          │   Conversation Engine    │
                          │  (Next.js/Node process,  │
                          │   always-on on Railway)  │
                          │                          │
                          │  - Intent classifier      │
                          │  - Dialogue state machine │
                          │  - Slot/topic collector    │
                          │  - Disclaimer + guardrails │
                          └──────┬─────────┬──────────┘
                                 │         │
                     LLM calls  │         │  Tool calls (MCP)
                                 ▼         ▼
                    ┌─────────────────┐  ┌──────────────────────────┐
                    │  Groq (via AI SDK)│  │      MCP Tool Servers     │
                    │  @ai-sdk/groq     │  │                          │
                    │  GROQ_API_KEY     │  │  - Calendar MCP           │
                    └─────────────────┘  │  - Notes/Doc MCP          │
                                          │  - Email Draft MCP        │
                                          └───────────┬──────────────┘
                                                       │
                                                       ▼
                                          ┌──────────────────────────┐
                                          │  SQLite (local file, on   │
                                          │  the same Railway host)   │
                                          │  - slots / holds          │
                                          │  - advisor_pre_bookings   │
                                          │  - email_drafts           │
                                          │  - waitlist                │
                                          │  - booking_sessions        │
                                          └──────────────────────────┘
                                                       │
                                                       ▼
                                          ┌──────────────────────────┐
                                          │  Secure Post-Call Portal  │
                                          │  (Next.js page, token URL)│
                                          │  Caller submits contact   │
                                          │  details off-call         │
                                          └──────────────────────────┘
```

## 3. Core Components

### 3.1 Web Voice Client + Voice I/O Bridge
- **Web Voice Client**: a browser page (no native app, no phone number) that captures mic audio via `MediaRecorder`/WebRTC, streams it to the backend, and plays back the agent's synthesized speech.
- **Voice I/O Bridge**: a small server-side module the Conversation Engine calls into:
  - **STT**: sends captured audio to **Groq's Whisper API** (`whisper-large-v3`), using the existing `GROQ_API_KEY`. Returns a transcript per utterance/turn.
  - **TTS**: sends the agent's reply text to a **self-hosted Piper** instance (open-source, e.g. running as its own small container/service), gets back synthesized audio, streams it to the browser client.
- Adapter interface (`VoiceChannel`) around this bridge so STT/TTS providers can be swapped later without touching the Conversation Engine.
- Emits normalized events to the Conversation Engine: `call.started`, `turn.transcript`, `call.ended`.
- **Resolved**: Piper runs on **Railway**, alongside the rest of the backend (no separate host needed); browser-only (no real phone number) is confirmed for this milestone.

### 3.2 Conversation Engine
The core orchestrator, deployed as an always-on Node/Next.js process on Railway (no serverless cold starts to worry about, since the process stays warm — useful given Piper also needs to stay resident on the same host). LLM calls go directly to **Groq** via `@ai-sdk/groq`, authenticated with `GROQ_API_KEY` — chosen for fast inference to keep voice turn-taking snappy.

- **Intent classifier**: maps each turn to one of the 5 intents — `book_new`, `reschedule`, `cancel`, `what_to_prepare`, `check_availability`.
- **Dialogue state machine**: enforces the required flow order and cannot be skipped by the model:
  1. `GREETING`
  2. `DISCLAIMER` ("informational, not investment advice")
  3. `TOPIC_CONFIRM` (one of the 5 fixed topics)
  4. `TIME_PREFERENCE_COLLECT`
  5. `SLOT_OFFER` (exactly two options from mock calendar)
  6. `SLOT_CONFIRM` (repeats date/time + **IST** explicitly)
  7. `BOOKING_EXECUTE` (fires MCP calls)
  8. `WRAP_UP` (reads back booking code + secure link)
- **PII guard**: a pre-send filter that scans outbound and inbound transcript segments for phone numbers, emails, account numbers; if detected, the agent redirects the caller to the secure link instead of repeating/storing the value.
- **Waitlist fallback**: if no offered slot is accepted, engine transitions to `WAITLIST_EXECUTE` instead of `BOOKING_EXECUTE`.
- **Scope guardrail**: any request interpreted as investment advice is intercepted before reaching the LLM's free-form answer path and routed to a fixed refusal + educational-links response.

### 3.3 MCP Tool Servers
Three tool surfaces, mirroring the brief's "Calendar / Notes / Email" split. Two of the three are already implemented in **[MCP-server](https://github.com/Sowjanyakaki/MCP-server)** (a FastAPI service, API-key protected, with a built-in approval gate); the third (Calendar) still needs to be built.

| Tool | Status | Action | Input | Output |
|---|---|---|---|---|
| **Calendar MCP** | ⚠️ **To build** | `create_hold` | `{topic, code, slot}` | `{holdId, status: "tentative"}` |
| | | `list_slots` | `{dayPreference, timePreference}` | `{slots: [slot, slot]}` (mock calendar, IST) |
| | | `cancel_hold` / `reschedule_hold` | `{code, newSlot?}` | `{status}` |
| **Notes/Doc MCP** | ✅ Exists — `POST /append_to_doc` | `append_entry` | `{doc_id, content}` (content = formatted `{date, topic, slot, code}` line) | `{status, result: {documentId, replies}}` — appends to a real Google Doc via OAuth2 |
| **Email Draft MCP** | ✅ Exists — `POST /create_email_draft` | `prepare_draft` | `{to, subject, body}` (body built from topic/code/slot) | `{status, result: {id, message}}` — creates a real Gmail draft, **never sends** |

**Notes on reusing MCP-server as-is:**
- Both endpoints already gate on an `ask_for_approval()` step: locally it's a blocking console `y/n` prompt (not viable during a live call), but under `RAILWAY_ENVIRONMENT` it **auto-approves** and just logs. Since `create_email_draft` only produces a Gmail draft (a human still has to open Gmail and hit send), auto-approve-in-prod already satisfies the brief's "approval-gated" requirement without extra work.
- Requires one-time OAuth setup (`auth.py` → `token.json`, or `GOOGLE_TOKEN_JSON`/`GOOGLE_CREDENTIALS_JSON` env vars) against a single advisor/service Google account — fine for a pilot, not multi-tenant.
- The Conversation Engine calls `append_to_doc` with `doc_id` pointed at a dedicated "Advisor Pre-Bookings" Google Doc, and `create_email_draft` with `to` set to the advisor's mailbox.
- **Gap**: add a third endpoint/tool to this same server (e.g. `POST /create_calendar_hold`) backed by the mock slot store described in §3.5, following the same auth/approval pattern already established by `docs_tool.py` / `gmail_tool.py`.

### 3.4 Booking Code Generator
- Deterministic, collision-checked generator, format `NL-` + 1 letter + 3 digits (e.g. `NL-A742`).
- Generated once `SLOT_CONFIRM` succeeds (or once a waitlist hold is created — waitlist codes should be visually distinguishable, e.g. `NL-W123`).

### 3.5 Data Store
SQLite (single file on the Railway container), minimal schema:

- `booking_sessions` — ephemeral call state (intent, topic, time preference, offered slots), TTL-cleaned after call ends.
- `mock_slots` — seeded availability data used by Calendar MCP `list_slots`.
- `holds` — booking code, topic, slot, status (`tentative` / `waitlisted` / `cancelled` / `rescheduled`).
- `advisor_pre_bookings` — the notes entries (date, topic, slot, code).
- `email_drafts` — draft content, status (`pending_approval` / `sent`), linked booking code.
- `secure_links` — one-time/expiring token → booking code mapping, used by the post-call portal.

No PII fields exist anywhere in this schema by design — contact details are collected only through the secure portal, stored separately from the voice-flow tables.

### 3.6 Secure Post-Call Portal
- A Next.js page at a tokenized URL (`/booking/[token]`), generated at `WRAP_UP` and read aloud to the caller.
- Token is single-use or short-lived, resolves to the booking code, and lets the caller submit phone/email/account details *outside* the voice channel.
- This is the only place in the system where caller PII is captured.

## 4. Sequence: Book New Appointment

```
Caller          Conversation Engine        Calendar MCP     Notes MCP     Email MCP     Portal
  │  call start        │                        │              │             │            │
  ├───────────────────►│                        │              │             │            │
  │  greet+disclaimer   │                        │              │             │            │
  │◄───────────────────┤                        │              │             │            │
  │  "SIP/Mandates"     │                        │              │             │            │
  ├───────────────────►│                        │              │             │            │
  │  "Tue afternoon?"   │  list_slots()          │              │             │            │
  ├───────────────────►├───────────────────────►│              │             │            │
  │                     │◄───────────────────────┤              │             │            │
  │  offers 2 slots     │                        │              │             │            │
  │◄───────────────────┤                        │              │             │            │
  │  confirm slot 1     │                        │              │             │            │
  ├───────────────────►│  create_hold()          │              │             │            │
  │                     ├───────────────────────►│              │             │            │
  │                     │◄───────────────────────┤              │             │            │
  │                     │  append_entry()                        │             │            │
  │                     ├───────────────────────────────────────►│             │            │
  │                     │  prepare_draft()                                     │            │
  │                     ├────────────────────────────────────────────────────►│            │
  │  reads code + link  │                        │              │             │            │
  │◄───────────────────┤                        │              │             │            │
  │  (calls portal later)                                                                  │
  ├───────────────────────────────────────────────────────────────────────────────────────►│
```

## 5. Non-Functional Requirements

- **Latency**: STT → LLM → TTS round trip should stay low enough for natural turn-taking; running the Conversation Engine and Piper as always-on Railway processes (rather than serverless) avoids cold starts mid-call.
- **Idempotency**: MCP calls (`create_hold`, `append_entry`, `prepare_draft`) must be idempotent per booking code, since a flaky call/reconnect shouldn't duplicate holds or emails.
- **Auditability**: every state transition and MCP call logged with the booking code for traceability (compliance requirement given "informational, not investment advice" framing).
- **Observability**: structured logs per call session; error/timeout on any MCP call should still let the agent gracefully inform the caller and fall back to the waitlist path rather than fail silently.

## 6. Open Decisions

- **Notes destination** — using the real Google Doc via MCP-server's `append_to_doc` (per §3.3) rather than a DB table; confirm which Google Doc to target.
- **Email send mechanism** — MCP-server's auto-approve-in-Railway behavior covers "create the draft"; who actually opens Gmail and clicks send is still a manual advisor/PM step, not yet assigned.
- **SQLite → Postgres migration trigger** — if this POC needs to persist data across redeploys or move beyond single-instance hosting, swap SQLite for a real Postgres (e.g. Railway's own Postgres plugin, or a Marketplace option); not needed yet.
