"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@caloriex/ui";
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
          "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-95",
          listening
            ? "bg-[linear-gradient(135deg,#f43f5e_0%,#f97316_100%)] text-white shadow-[0_10px_30px_-8px_rgba(244,63,94,0.65)]"
            : "border border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08]",
        )}
      >
        {listening && (
          <span className="absolute inset-0 animate-ping rounded-xl bg-rose-500/40" />
        )}
        <span className="relative">
          <MicIcon />
        </span>
      </button>
      {error && <span className="text-[11px] text-rose-400">{error}</span>}
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
