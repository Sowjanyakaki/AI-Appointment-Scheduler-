# Problem Statement: Voice Agent for Advisor Appointment Scheduling

## Background
Investors and account holders frequently need to speak with a human advisor for matters such as KYC/onboarding, SIP/mandates, statements/tax documents, withdrawals, or nominee/account changes. Today, booking such a consultation typically requires manual coordination — phone calls, emails, or support tickets — which is slow, inconsistent, and creates unnecessary handling of sensitive personal information (PII) over unsecured channels.

## Problem
There is no automated, compliant way for a caller to schedule a tentative advisor appointment through a voice interface. Existing processes:
- Require agents to manually check calendars and follow up via email, causing delays.
- Risk exposing PII (phone numbers, email addresses, account numbers) during the call itself.
- Lack a standardized intake flow, leading to incomplete or inconsistent booking information (topic, time preference, confirmation).
- Provide no clear audit trail linking a caller's request to a calendar hold, internal note, and advisor notification.
- Have no fallback when no time slots are available, leaving requests unresolved.

## Who Is Affected
- **End users/callers**: People who want a human consultation but have no fast, self-service way to book one without sharing sensitive data on the call.
- **PMs/Support teams**: Responsible for running a compliant, auditable pre-booking process without manually collecting and transcribing PII.
- **Advisors**: Need structured, reliable handoff information (topic, time, code) to prepare for calls, without receiving raw caller PII prematurely.

## Goal
Build a voice agent that can autonomously handle five core intents — **book new, reschedule, cancel, "what to prepare," and check availability** — guiding the caller through a compliant scripted flow:

1. Greet the caller and issue a disclaimer that the interaction is informational, not investment advice.
2. Confirm the topic from a fixed set (KYC/Onboarding, SIP/Mandates, Statements/Tax Docs, Withdrawals & Timelines, Account Changes/Nominee).
3. Collect a day/time preference and offer two mock-calendar slot options.
4. On confirmation, generate a unique booking code (e.g., `NL-A742`) and:
   - Create a tentative calendar hold via MCP ("Advisor Q&A — {Topic} — {Code}").
   - Append a structured entry (date, topic, slot, code) to an "Advisor Pre-Bookings" notes doc via MCP.
   - Prepare (not send) an advisor email draft via MCP, gated on approval.
5. Read back the booking code and provide a secure link where the caller can supply contact details *outside* the voice call.

## Constraints
- **No PII on the call**: phone numbers, emails, and account numbers must never be spoken or recorded during the conversation.
- **Time zone clarity**: all slot times must be stated in IST and repeated back at confirmation.
- **No-match fallback**: if no offered slot works for the caller, the agent must create a waitlist hold and a draft email instead of failing silently.
- **Scope discipline**: the agent must refuse to give investment advice, offering only educational links when asked.

## Success Criteria
- A caller can complete a booking (or reschedule/cancel/check availability) entirely by voice without disclosing PII.
- Every confirmed booking produces a matching calendar hold, notes entry, and gated email draft, all tagged with the same booking code.
- The caller always leaves the call with either a booking code + secure link, or a waitlist confirmation.
- The agent correctly refuses out-of-scope investment advice requests while still being helpful (educational links).
