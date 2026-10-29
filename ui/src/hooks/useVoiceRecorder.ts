import { useCallback, useEffect, useRef, useState } from "react";
import { voiceApi } from "../api/voice";

export const MAX_RECORDING_SECONDS = 120;
export type VoiceRecorderPhase = "idle" | "recording" | "transcribing";

export function voiceRecorderSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function describeError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is blocked. Allow it in your browser's site settings and try again.";
  if (name === "NotFoundError") return "No microphone was found.";
  if (name === "AbortError") return "";
  return (err as { status?: number })?.status === 503
    ? "Voice is unavailable right now. You can type instead."
    : err instanceof Error ? err.message : "Voice dictation failed.";
}

/** Record until stopped, transcribe once, hand the text to onTranscript. Nothing is sent or posted here. */
export function useVoiceRecorder(companyId: string | null | undefined, onTranscript: (text: string) => void) {
  const [phase, setPhase] = useState<VoiceRecorderPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recorder.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    abort.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
    else setPhase("idle");
  }, []);

  const start = useCallback(async () => {
    if (!companyId || phase !== "idle") return;
    setError(null);
    cancelled.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(describeError(err));
      return;
    }
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = async () => {
      cleanup();
      if (cancelled.current || chunks.length === 0) return setPhase("idle");
      setPhase("transcribing");
      const controller = new AbortController();
      abort.current = controller;
      try {
        const text = await voiceApi.transcribe(companyId, new Blob(chunks, { type: rec.mimeType || "audio/webm" }), controller.signal);
        if (text) onTranscriptRef.current(text);
        else setError("No speech was detected.");
      } catch (err) {
        if (!controller.signal.aborted) setError(describeError(err));
      } finally {
        setPhase("idle");
      }
    };
    recorder.current = rec;
    setSeconds(0);
    setPhase("recording");
    rec.start();
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }, [companyId, phase, cleanup, stop]);

  useEffect(() => () => {
    cancelled.current = true;
    abort.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
    cleanup();
  }, [cleanup]);

  return { phase, seconds, error, supported: voiceRecorderSupported() && !!companyId, start, stop, cancel, clearError: () => setError(null) };
}
