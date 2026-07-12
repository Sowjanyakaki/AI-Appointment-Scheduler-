# AdvisorConnect Voice — AI Voice Agent for Advisor Appointments

An interactive, browser-based AI Voice Agent that allows account holders and investors to autonomously schedule, reschedule, or cancel tentative advisor appointments through a secure voice channel.

## Key Features

1. **Voice-Only Interface**: Uses Web Audio APIs (`MediaRecorder`) to capture microphone inputs and streams them to the server, playing back replies via synthesized audio.
2. **Speech-to-Text (STT)**: Transcribes caller utterances using the high-speed **Groq Whisper API** (`whisper-large-v3`).
3. **Text-to-Speech (TTS)**: Synthesizes natural, human-like voice responses locally using **Piper** (an open-source, fast text-to-speech engine).
4. **Dialogue State Machine**: Enforces a strict compliance script (Greeting → Disclaimer → Topic Selection → Slot Availability Selection → Confirmation → Unique Booking Code → Secure Link Handoff).
5. **PII Guardrail**: Intercepts sensitive data (emails, phone numbers, account details) from being spoken or stored during the call, redirecting callers to provide details off-call.
6. **Scope Guardrail**: Prevents the agent from offering investment advice, offering educational resource links instead.
7. **MCP Integrations**: Interacts with the Google MCP Server to:
   - Create tentative Holds on the advisor's Google Calendar.
   - Append booking records to the "Advisor Pre-Bookings" Google Doc.
   - Draft Gmail notification emails for the advisor.
8. **Secure Post-Call Portal**: A tokenized browser portal (`/booking/[token]`) where callers securely submit contact details off-call to update their calendar hold.

---

## Technical Stack

* **Frontend/Backend**: Next.js 15 (App Router, TypeScript)
* **LLM**: Groq Llama-3.3-70b-versatile (via the Vercel AI SDK `@ai-sdk/groq` and `ai` packages)
* **TTS Engine**: Piper (spawned locally via child process using absolute paths)
* **Database**: SQLite (managed with `better-sqlite3` for local session caching and portal tokens)
* **Testing**: Vitest unit and mock verification suite

---

## Getting Started

### 1. Configure Environment Variables
Create a `.env.local` file in the project root. Refer to `.env.local.example` for details:
```env
GROQ_API_KEY=your_groq_api_key
MCP_BASE_URL=https://your-mcp-server.up.railway.app
MCP_API_KEY=your_mcp_api_secret
DATABASE_PATH=./data/app.db
PIPER_BIN=./bin/piper/piper.exe
PIPER_MODEL=./bin/en_US-ryan-medium.onnx
NOTES_DOC_ID=your_google_doc_id
ADVISOR_EMAIL=advisor@example.com
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
Starts the Next.js application:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or the port shown in logs) to access the UI.

### 4. Run the Test Suite
Executes the Vitest unit and mock tests:
```bash
npm run test
```

---

## Managing Voices
You can easily switch the agent's speaker voice using the built-in downloader script. Run the command below from the project root:

```bash
# To use the Ryan voice (Male, smooth)
node bin/download_voice.js ryan

# To use the Joe voice (Male, natural)
node bin/download_voice.js joe

# To use the Amy voice (Female, natural)
node bin/download_voice.js amy

# To use the Lessac voice (Default)
node bin/download_voice.js lessac
```
*Note: The script automatically fetches the model files from Hugging Face, saves them to the `/bin` directory, and updates your `PIPER_MODEL` in `.env.local`.*
