import { useState, useSyncExternalStore } from "react";
import { Loader2, Mic, Square, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptionalToastActions } from "../context/ToastContext";
import type { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useVoiceStatus } from "../hooks/useVoiceStatus";
import { replyPlayer } from "../lib/voice-chat/reply-player";
import { getVoicePreference, setVoicePreference } from "../lib/voice-chat/voice-preference";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Mic for the composer: record, stop, transcribe into the reply box. Hidden where the browser can't record. */
export function VoiceMicButton({ recorder, disabled, companyId }: { recorder: ReturnType<typeof useVoiceRecorder>; disabled?: boolean; companyId?: string | null }) {
  const { voices, unavailableReason } = useVoiceStatus(companyId);
  const [voice, setVoice] = useState(getVoicePreference() ?? "");
  if (!recorder.supported) return null;
  const { phase } = recorder;
  return (
    <div className="flex items-center gap-1" data-testid="voice-mic">
      {phase === "recording" ? (
        <>
          <span className="flex items-center gap-1 text-xs text-destructive" role="status">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden />
            {clock(recorder.seconds)}
          </span>
          <Button type="button" size="icon-sm" variant="default" aria-label="Stop recording" title="Stop and transcribe" onClick={recorder.stop}>
            <Square className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel recording" title="Discard recording" onClick={recorder.cancel}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </>
      ) : phase === "transcribing" ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Transcribing…
        </span>
      ) : (
        <Button type="button" size="icon-sm" variant="ghost" disabled={disabled || !!unavailableReason} aria-label="Dictate a message" title={unavailableReason ?? "Dictate a message"} onClick={() => void recorder.start()}>
          <Mic className="h-4 w-4" aria-hidden />
        </Button>
      )}
      {voices.length > 1 && phase === "idle" ? (
        <select
          className="h-7 max-w-24 rounded-md border border-input bg-transparent px-1 text-xs text-muted-foreground"
          aria-label="Read-aloud voice"
          title="Read-aloud voice"
          value={voice}
          onChange={(e) => {
            setVoice(e.target.value);
            setVoicePreference(e.target.value || undefined);
          }}
        >
          <option value="">Default voice</option>
          {voices.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      ) : null}
      {recorder.error ? (
        <span className="max-w-64 text-xs text-destructive" role="alert" onClick={recorder.clearError}>{recorder.error}</span>
      ) : null}
    </div>
  );
}

/** Speaker for one agent reply; only one reply plays at a time. */
export function VoiceSpeakButton({ companyId, replyId, text }: { companyId: string | null | undefined; replyId: string; text: string }) {
  const toasts = useOptionalToastActions();
  const state = useSyncExternalStore(replyPlayer.subscribe, replyPlayer.getState);
  const { unavailableReason } = useVoiceStatus(companyId);
  if (!companyId || typeof Audio === "undefined" || !text.trim()) return null;
  const mine = state.replyId === replyId ? state.phase : "idle";
  const label = mine === "idle" ? (unavailableReason ?? "Read aloud") : mine === "preparing" ? "Preparing audio" : "Stop reading";
  return (
    <button
      type="button"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:hover:bg-transparent"
      title={label}
      aria-label={label}
      aria-pressed={mine !== "idle"}
      disabled={!!unavailableReason && mine === "idle"}
      onClick={() => {
        replyPlayer.play(companyId, replyId, text).catch((err: Error & { status?: number }) =>
          toasts?.pushToast({
            title: "Couldn't read aloud",
            body: err.status === 503 ? "Voice is unavailable right now." : err.message,
            tone: "error",
          }),
        );
      }}
    >
      {mine === "preparing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mine === "playing" ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
    </button>
  );
}
