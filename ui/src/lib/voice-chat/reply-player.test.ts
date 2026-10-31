import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/voice", () => ({ voiceApi: { speak: vi.fn(async () => new Blob(["x"], { type: "audio/mpeg" })) } }));
import { voiceApi } from "../../api/voice";
import { replyPlayer } from "./reply-player";

class FakeAudio {
  static all: FakeAudio[] = [];
  onended: (() => void) | null = null;
  paused = false;
  constructor(public src: string) { FakeAudio.all.push(this); }
  play = vi.fn(async () => {});
  pause() { this.paused = true; }
}

describe("replyPlayer", () => {
  beforeEach(() => {
    FakeAudio.all = [];
    vi.stubGlobal("Audio", FakeAudio);
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { replyPlayer.stop(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("plays one reply at a time and toggles off on a second press", async () => {
    await replyPlayer.play("c", "a", "hello");
    expect(replyPlayer.getState()).toEqual({ replyId: "a", phase: "playing" });
    await replyPlayer.play("c", "b", "world");
    expect(FakeAudio.all[0]!.paused).toBe(true);
    expect(replyPlayer.getState()).toEqual({ replyId: "b", phase: "playing" });
    await replyPlayer.play("c", "b", "world");
    expect(replyPlayer.getState()).toEqual({ replyId: null, phase: "idle" });
  });

  it("returns to idle and rejects when audio cannot be produced", async () => {
    vi.mocked(voiceApi.speak).mockRejectedValueOnce(new Error("down"));
    await expect(replyPlayer.play("c", "a", "hi")).rejects.toThrow("down");
    expect(replyPlayer.getState().phase).toBe("idle");
  });
});
