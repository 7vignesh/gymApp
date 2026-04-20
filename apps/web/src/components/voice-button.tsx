"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@calai/ui";
import {
  isVoiceSupported,
  startVoiceRecognition,
  type VoiceError,
  type VoiceSession,
} from "@/lib/voice";

export interface VoiceButtonProps {
  /** Called with final transcript when recording ends successfully. */
  onTranscript: (text: string) => void;
  /** Live interim results while the user is speaking. */
  onInterim?: (text: string) => void;
  /** Preferred language — default "en-IN" works well for Indian food names. */
  lang?: string;
  className?: string;
}

const ERROR_LABEL: Record<VoiceError, string> = {
  unsupported: "Voice not supported on this browser.",
  "no-speech": "Didn't hear anything — try again.",
  "not-allowed": "Microphone permission denied.",
  aborted: "Recording was stopped.",
  network: "Network error while transcribing.",
  "service-not-allowed": "Voice service isn't allowed.",
  "audio-capture": "No microphone found.",
  unknown: "Voice recognition failed.",
};

export function VoiceButton({
  onTranscript,
  onInterim,
  lang = "en-IN",
  className,
}: VoiceButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const finalRef = useRef<string>("");

  useEffect(() => {
    setSupported(isVoiceSupported());
  }, []);

  function start() {
    if (!supported || listening) return;
    setError(null);
    finalRef.current = "";
    const s = startVoiceRecognition(
      {
        onStart: () => setListening(true),
        onResult: (text, isFinal) => {
          if (isFinal) finalRef.current += text;
          onInterim?.(finalRef.current + (isFinal ? "" : text));
        },
        onError: (err) => {
          setError(ERROR_LABEL[err]);
          setListening(false);
        },
        onEnd: () => {
          setListening(false);
          const out = finalRef.current.trim();
          if (out) onTranscript(out);
        },
      },
      { lang, interimResults: true, continuous: false },
    );
    sessionRef.current = s;
  }

  function stop() {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }

  if (!supported) return null;

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-all",
          listening
            ? "bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse"
            : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900",
        )}
      >
        <MicIcon />
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
