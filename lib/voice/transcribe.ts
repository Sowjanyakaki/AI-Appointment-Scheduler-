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
