/**
 * Web Speech API wrapper (Feature 2 — Voice input).
 *
 * Graceful degradation: if SpeechRecognition isn't available (Safari iOS
 * < 14.5, Firefox, etc.), `isVoiceSupported()` returns false and the UI
 * can hide the mic button.
 */

/* --- Minimal ambient types for the Web Speech API (not in TS lib by default). --- */
interface SRAlternative { transcript: string; confidence: number }
interface SRResult { isFinal: boolean; 0: SRAlternative; length: number; [k: number]: SRAlternative }
interface SRResultList { length: number; [k: number]: SRResult }
interface SREvent { resultIndex: number; results: SRResultList }
interface SRErrorEvent { error: string; message?: string }
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SRInstance;

declare global {
  interface Window {
    webkitSpeechRecognition?: SRCtor;
    SpeechRecognition?: SRCtor;
  }
}

export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export type VoiceError =
  | "unsupported"
  | "no-speech"
  | "not-allowed"
  | "aborted"
  | "network"
  | "service-not-allowed"
  | "audio-capture"
  | "unknown";

export interface VoiceSession {
  stop(): void;
  abort(): void;
}

export type { SRInstance as SpeechRecognition };

export interface VoiceCallbacks {
  onResult(transcript: string, isFinal: boolean): void;
  onError?(err: VoiceError, detail?: string): void;
  onEnd?(): void;
  onStart?(): void;
}

/** Starts a one-shot recognition session and returns a controller. */
export function startVoiceRecognition(
  cb: VoiceCallbacks,
  opts: { lang?: string; interimResults?: boolean; continuous?: boolean } = {},
): VoiceSession | null {
  if (!isVoiceSupported()) {
    cb.onError?.("unsupported");
    return null;
  }
  const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition)!;
  const r = new Ctor();
  r.lang = opts.lang ?? "en-US";
  r.continuous = opts.continuous ?? false;
  r.interimResults = opts.interimResults ?? true;
  r.maxAlternatives = 1;

  r.onstart = () => cb.onStart?.();

  r.onresult = (ev) => {
    let transcript = "";
    let isFinal = false;
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (!res) continue;
      const alt = res[0];
      if (!alt) continue;
      transcript += alt.transcript;
      if (res.isFinal) isFinal = true;
    }
    cb.onResult(transcript, isFinal);
  };

  r.onerror = (ev: SRErrorEvent) => {
    const known: VoiceError[] = [
      "no-speech", "not-allowed", "aborted", "network",
      "service-not-allowed", "audio-capture",
    ];
    const err = (known as string[]).includes(ev.error)
      ? (ev.error as VoiceError)
      : "unknown";
    cb.onError?.(err, ev.message);
  };

  r.onend = () => cb.onEnd?.();

  try {
    r.start();
  } catch (e) {
    cb.onError?.("unknown", (e as Error).message);
    return null;
  }

  return {
    stop: () => r.stop(),
    abort: () => r.abort(),
  };
}
