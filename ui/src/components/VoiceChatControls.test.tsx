// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/voice", () => ({
  voiceApi: { status: vi.fn(), transcribe: vi.fn(), speak: vi.fn() },
}));
import { voiceApi } from "../api/voice";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { resetVoiceStatusCache } from "../hooks/useVoiceStatus";
import { VoiceMicButton, VoiceSpeakButton } from "./VoiceChatControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class FakeRecorder {
  static last: FakeRecorder;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  stream = { getTracks: () => [{ stop: vi.fn() }] };
  constructor() { FakeRecorder.last = this; }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["a"]) });
    this.onstop?.();
  }
}

function Harness({ onText }: { onText: (t: string) => void }) {
  const recorder = useVoiceRecorder("company-1", onText);
  return <VoiceMicButton recorder={recorder} companyId="company-1" />;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const click = (label: string) => act(async () => {
  (container.querySelector(`[aria-label="${label}"]`) as HTMLElement).click();
});
const mount = (ui: React.ReactNode) => act(async () => root.render(ui));

describe("voice mic and speaker controls", () => {
  beforeEach(() => {
    localStorage.clear();
    resetVoiceStatusCache();
    container = document.createElement("div");
    root = createRoot(container);
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [] })) },
    });
    vi.mocked(voiceApi.status).mockResolvedValue({ available: true, voices: ["jarvis", "alix"], engines: [{ reachable: true }] });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("records, shows transcribing, then hands the transcript over without sending", async () => {
    let finish!: (t: string) => void;
    vi.mocked(voiceApi.transcribe).mockReturnValue(new Promise((r) => { finish = r; }));
    const onText = vi.fn();
    await mount(<Harness onText={onText} />);
    await flush();
    await click("Dictate a message");
    await flush();
    expect(container.querySelector('[aria-label="Stop recording"]')).not.toBeNull();
    await click("Stop recording");
    expect(container.textContent).toContain("Transcribing");
    await act(async () => finish("hello there"));
    expect(onText).toHaveBeenCalledWith("hello there");
    expect(container.querySelector('[aria-label="Dictate a message"]')).not.toBeNull();
  });

  it("shows a non-destructive error when transcription fails", async () => {
    vi.mocked(voiceApi.transcribe).mockRejectedValue(Object.assign(new Error("boom"), { status: 503 }));
    const onText = vi.fn();
    await mount(<Harness onText={onText} />);
    await flush();
    await click("Dictate a message");
    await flush();
    await click("Stop recording");
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Voice is unavailable");
    expect(onText).not.toHaveBeenCalled();
  });

  it("cancel discards the recording without transcribing", async () => {
    await mount(<Harness onText={vi.fn()} />);
    await flush();
    await click("Dictate a message");
    await flush();
    await click("Cancel recording");
    await flush();
    expect(voiceApi.transcribe).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Dictate a message"]')).not.toBeNull();
  });

  it("disables mic and speaker with a reason when no engine is reachable", async () => {
    vi.mocked(voiceApi.status).mockResolvedValue({ available: false, voices: [], engines: [{ reachable: false }] });
    await mount(<><Harness onText={vi.fn()} /><VoiceSpeakButton companyId="company-1" replyId="r1" text="hi" /></>);
    await flush();
    const mic = container.querySelector('[aria-label="Dictate a message"]') as HTMLButtonElement;
    const speaker = container.querySelector('button[aria-pressed]') as HTMLButtonElement;
    expect(mic.disabled).toBe(true);
    expect(mic.title).toContain("unavailable");
    expect(speaker.disabled).toBe(true);
    expect(speaker.title).toContain("unavailable");
  });

  it("remembers the chosen voice and sends it when reading aloud", async () => {
    vi.mocked(voiceApi.speak).mockResolvedValue(new Blob(["x"]));
    vi.stubGlobal("Audio", class { src: string; constructor(s: string) { this.src = s; } play = vi.fn(async () => {}); pause() {} });
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    await mount(<><Harness onText={vi.fn()} /><VoiceSpeakButton companyId="company-1" replyId="r1" text="hi" /></>);
    await flush();
    const select = container.querySelector('select[aria-label="Read-aloud voice"]') as HTMLSelectElement;
    await act(async () => {
      select.value = "alix";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(localStorage.getItem("paperclip:voice-name")).toBe("alix");
    await act(async () => (container.querySelector('button[aria-pressed]') as HTMLButtonElement).click());
    await flush();
    expect(voiceApi.speak).toHaveBeenCalledWith("company-1", "hi", "alix", expect.anything());
  });
});
