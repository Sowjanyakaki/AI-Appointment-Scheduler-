import { transcribeAudio } from "@/lib/voice/transcribe";

// Matches Groq's own Whisper API file size limit — rejecting oversized
// uploads here avoids buffering arbitrarily large request bodies into memory.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  // Reject declared-oversized uploads before consuming the body at all —
  // request.formData() buffers the entire multipart body into memory, so
  // checking Blob.size only after parsing is too late to bound anything.
  // Content-Length can be absent or understated by an adversarial client;
  // the post-parse audio.size check below remains as defense-in-depth for
  // well-behaved clients that omit the header.
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio file is too large" }, { status: 413 });
  }

  const form = await request.formData();
  const audio = form.get("audio");

  if (!(audio instanceof Blob)) {
    return Response.json({ error: "audio file is required" }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio file is too large" }, { status: 413 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const filename = audio instanceof File ? audio.name : "utterance.webm";
  const transcript = await transcribeAudio(buffer, filename);

  return Response.json({ transcript });
}
