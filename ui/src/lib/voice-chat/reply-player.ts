import { voiceApi } from "../../api/voice";

export type ReplyPlayerState = { replyId: string | null; phase: "idle" | "preparing" | "playing" };

let state: ReplyPlayerState = { replyId: null, phase: "idle" };
let audio: HTMLAudioElement | null = null;
let abort: AbortController | null = null;
const listeners = new Set<() => void>();

function set(next: ReplyPlayerState) {
  state = next;
  listeners.forEach((l) => l());
}

export const replyPlayer = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  getState: () => state,
  stop() {
    abort?.abort();
    abort = null;
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
      audio = null;
    }
    set({ replyId: null, phase: "idle" });
  },
  /** Plays one reply; starting another (or the same one again) stops whatever is playing. Rejects if audio could not be produced. */
  async play(companyId: string, replyId: string, text: string) {
    const wasThis = state.replyId === replyId;
    replyPlayer.stop();
    if (wasThis) return;
    const controller = new AbortController();
    abort = controller;
    set({ replyId, phase: "preparing" });
    try {
      const blob = await voiceApi.speak(companyId, text, controller.signal);
      if (controller.signal.aborted) return;
      const el = new Audio(URL.createObjectURL(blob));
      audio = el;
      el.onended = () => {
        if (audio === el) replyPlayer.stop();
      };
      await el.play();
      set({ replyId, phase: "playing" });
    } catch (err) {
      if (controller.signal.aborted) return;
      replyPlayer.stop();
      throw err;
    }
  },
};
