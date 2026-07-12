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
  if (!transcribeRes.ok) {
    throw new Error(`Transcription failed with status ${transcribeRes.status}`);
  }
  const { transcript } = await transcribeRes.json();

  const chatRes = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ sessionId: sessionId ?? undefined, message: transcript }),
  });
  if (!chatRes.ok) {
    throw new Error(`Chat request failed with status ${chatRes.status}`);
  }
  const { sessionId: nextSessionId, reply, state } = await chatRes.json();

  const synthesizeRes = await fetch("/api/voice/synthesize", {
    method: "POST",
    body: JSON.stringify({ text: reply }),
  });
  if (!synthesizeRes.ok) {
    throw new Error(`Speech synthesis failed with status ${synthesizeRes.status}`);
  }
  const wavBytes = await synthesizeRes.arrayBuffer();
  const replyAudioUrl = URL.createObjectURL(new Blob([wavBytes], { type: "audio/wav" }));

  return { sessionId: nextSessionId, reply, state, replyAudioUrl };
}
