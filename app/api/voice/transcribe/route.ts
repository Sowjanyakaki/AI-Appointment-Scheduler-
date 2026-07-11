import { transcribeAudio } from "@/lib/voice/transcribe";

// Matches Groq's own Whisper API file size limit — rejecting oversized
// uploads here avoids buffering arbitrarily large request bodies into memory.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
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
