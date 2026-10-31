import { requestResponse } from "./client";

export type VoiceStatus = { available: boolean; voices: string[]; engines: { reachable: boolean }[] };

export const voiceApi = {
  async status(companyId: string): Promise<VoiceStatus> {
    const res = await requestResponse(`/companies/${companyId}/voice/status`);
    return (await res.json()) as VoiceStatus;
  },
  async transcribe(companyId: string, clip: Blob, signal?: AbortSignal): Promise<string> {
    const res = await requestResponse(`/companies/${companyId}/voice/transcribe`, {
      method: "POST",
      body: clip,
      signal,
      headers: { "Content-Type": clip.type || "audio/webm" },
    });
    return ((await res.json()) as { text: string }).text;
  },
  async speak(companyId: string, text: string, voice?: string, signal?: AbortSignal): Promise<Blob> {
    const res = await requestResponse(`/companies/${companyId}/voice/speak`, {
      method: "POST",
      body: JSON.stringify({ text, voice }),
      signal,
    });
    return res.blob();
  },
};
