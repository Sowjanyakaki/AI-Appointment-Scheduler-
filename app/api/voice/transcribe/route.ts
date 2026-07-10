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
