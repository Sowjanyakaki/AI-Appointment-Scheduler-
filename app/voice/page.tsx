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
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const result = await submitTurn(blob, sessionId);
        setSessionId(result.sessionId);
        setTranscriptLog((log) => [...log, `Agent: ${result.reply}`]);
        new Audio(result.replyAudioUrl).play();
      } finally {
        stream.getTracks().forEach((track) => track.stop());
      }
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
