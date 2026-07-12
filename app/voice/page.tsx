"use client";

import { useEffect, useRef, useState } from "react";
import { submitTurn } from "./use-voice-session";
import styles from "./VoicePage.module.css";
import { MicIcon } from "../components/icons";

type VoiceState = "idle" | "recording" | "transcribing" | "thinking" | "speaking" | "error";

interface ChatLogEntry {
  sender: "user" | "agent";
  text: string;
}

function getSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
}

export default function VoicePage() {
  const [state, setState] = useState<VoiceState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcriptLog, setTranscriptLog] = useState<ChatLogEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeWarning, setTimeWarning] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Reusable compliance player to bypass browser autoplay gestural blocks
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Interaction tracking for tap-to-toggle vs hold-to-talk
  const pressStartTimeRef = useRef<number>(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll transcript log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [transcriptLog]);

  // Initialize and clean up audio player & stream
  useEffect(() => {
    const player = new Audio();
    audioPlayerRef.current = player;

    const handleEnded = () => {
      setState("idle");
    };
    player.addEventListener("ended", handleEnded);

    return () => {
      player.removeEventListener("ended", handleEnded);
      player.pause();
      player.src = "";
      stopMicStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCurrentAudio() {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = "";
    }
    if (state === "speaking") {
      setState("idle");
    }
  }

  function stopMicStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function startRecording() {
    stopCurrentAudio();
    setErrorMessage(null);
    setTimeWarning(null);

    // Track press duration for hybrid hold/click detection
    pressStartTimeRef.current = Date.now();

    // Browser gesture autoplay unlock: play empty/silent frame to register gesture
    if (audioPlayerRef.current) {
      audioPlayerRef.current.play().catch(() => {});
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const duration = Date.now() - pressStartTimeRef.current;
        stopMicStream();

        if (duration < 500) {
          setTimeWarning("Please hold the button longer to speak, or tap once to toggle recording.");
          setState("idle");
          return;
        }

        try {
          setState("transcribing");
          const mime = mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: mime });
          
          const result = await submitTurn(blob, sessionId);
          setSessionId(result.sessionId);

          // Add turns to visual log
          setTranscriptLog((prev) => [
            ...prev,
            { sender: "user", text: result.transcript },
            { sender: "agent", text: result.reply },
          ]);

          setState("speaking");
          
          if (audioPlayerRef.current) {
            audioPlayerRef.current.src = result.replyAudioUrl;
            await audioPlayerRef.current.play();
          }
        } catch (err: unknown) {
          console.error("Voice process error:", err);
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(msg || "Failed to process voice request. Please check your connection.");
          setState("error");
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");
    } catch (err: unknown) {
      console.error("Mic permission denied or error:", err);
      setErrorMessage("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
      setState("error");
    }
  }

  async function handleMouseDown(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
    }
    
    if (state === "recording") {
      // Tap-to-toggle: Stop recording on second click
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (state === "idle" || state === "error") {
      await startRecording();
    }
  }

  function handleMouseUp(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
    }
    
    // Hold-to-Talk: Only stop if the user held it longer than 400ms
    const duration = Date.now() - pressStartTimeRef.current;
    if (duration > 400) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    void handleMouseDown();
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.preventDefault();
    handleMouseUp();
  }

  function handleReset() {
    stopCurrentAudio();
    stopMicStream();
    setSessionId(null);
    setTranscriptLog([]);
    setState("idle");
    setErrorMessage(null);
    setTimeWarning(null);
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <a href="/" className={styles.backLink}>
          <svg className={styles.backIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </a>
      </header>

      <div className={styles.agentCard}>
        <h1 className={styles.title}>Advisor Connect Voice Agent</h1>
        <p className={styles.subtitle}>Secure advisor pre-booking via audio</p>

        <div className={styles.micWrapper}>
          {/* Animated visual ripples based on voice agent state */}
          <div className={`${styles.ripple} ${
            state === "recording" ? styles.rippleRecording : 
            state === "speaking" ? styles.rippleSpeaking : 
            state === "transcribing" || state === "thinking" ? styles.rippleProcessing : ""
          }`} />
          {state === "recording" && (
            <div className={`${styles.ripple} ${styles.rippleRecording}`} style={{ animationDelay: "0.6s" }} />
          )}
          {state === "speaking" && (
            <div className={`${styles.ripple} ${styles.rippleSpeaking}`} style={{ animationDelay: "0.5s" }} />
          )}

          <button
            type="button"
            className={`${styles.micBtn} ${
              state === "recording" ? styles.micBtnRecording :
              state === "transcribing" || state === "thinking" ? styles.micBtnProcessing :
              state === "speaking" ? styles.micBtnSpeaking : ""
            }`}
            onMouseDown={(e) => void handleMouseDown(e)}
            onMouseUp={(e) => handleMouseUp(e)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label="Microphone button"
            aria-pressed={state === "recording"}
          >
            <MicIcon className={styles.micIcon} />
          </button>
        </div>

        <div className={styles.statusContainer}>
          <h2 className={`${styles.statusTitle} ${
            state === "recording" ? styles.statusTitleRecording :
            state === "transcribing" || state === "thinking" ? styles.statusTitleProcessing :
            state === "speaking" ? styles.statusTitleSpeaking : styles.statusTitleIdle
          }`}>
            {state === "idle" && "Ready to Talk"}
            {state === "recording" && "Listening..."}
            {state === "transcribing" && "Processing speech..."}
            {state === "thinking" && "Advisor is thinking..."}
            {state === "speaking" && "Speaking..."}
            {state === "error" && "Something went wrong"}
          </h2>
          <p className={styles.statusDesc}>
            {state === "idle" && "Press & hold to speak, or click once to start/stop."}
            {state === "recording" && "Go ahead, I'm listening to your request."}
            {state === "transcribing" && "Transcribing your voice stream..."}
            {state === "thinking" && "Finding available slots and preparing details..."}
            {state === "speaking" && "Playing back the advisor's audio response."}
            {state === "error" && (errorMessage || "An error occurred.")}
          </p>
        </div>

        <div className={styles.controlsRow}>
          {state === "speaking" && (
            <button type="button" className={`${styles.btnAction} ${styles.btnStop}`} onClick={stopCurrentAudio}>
              Stop Playback
            </button>
          )}
          {(transcriptLog.length > 0 || sessionId) && (
            <button type="button" className={styles.btnAction} onClick={handleReset}>
              Reset Session
            </button>
          )}
        </div>

        {timeWarning && (
          <div className={styles.errorBox} style={{ background: "#fffbeb", border: "1px solid #fef3c7", color: "#b45309" }}>
            <span className={styles.errorBoxTitle}>Notice</span>
            <p>{timeWarning}</p>
          </div>
        )}

        {errorMessage && (
          <div className={styles.errorBox}>
            <span className={styles.errorBoxTitle}>Error</span>
            <p>{errorMessage}</p>
          </div>
        )}

        {transcriptLog.length > 0 && (
          <div className={styles.transcriptCard}>
            <span className={styles.transcriptHeader}>Call Transcript</span>
            <div className={styles.transcriptList} ref={logContainerRef}>
              {transcriptLog.map((turn, i) => (
                <div
                  key={i}
                  className={`${styles.bubble} ${
                    turn.sender === "user" ? styles.bubbleUser : styles.bubbleAgent
                  }`}
                >
                  {turn.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
