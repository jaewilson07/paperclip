import { requestResponse } from "./client";

export const voiceApi = {
  async transcribe(companyId: string, clip: Blob, signal?: AbortSignal): Promise<string> {
    const res = await requestResponse(`/companies/${companyId}/voice/transcribe`, {
      method: "POST",
      body: clip,
      signal,
      headers: { "Content-Type": clip.type || "audio/webm" },
    });
    return ((await res.json()) as { text: string }).text;
  },
  async speak(companyId: string, text: string, signal?: AbortSignal): Promise<Blob> {
    const res = await requestResponse(`/companies/${companyId}/voice/speak`, {
      method: "POST",
      body: JSON.stringify({ text }),
      signal,
    });
    return res.blob();
  },
};
