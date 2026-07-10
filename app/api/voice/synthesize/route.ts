import { synthesizeSpeech } from "@/lib/voice/synthesize";

export async function POST(request: Request) {
  const { text } = (await request.json()) as { text: string };
  const wav = await synthesizeSpeech(text);

  return new Response(new Uint8Array(wav), {
    headers: { "content-type": "audio/wav" },
  });
}
