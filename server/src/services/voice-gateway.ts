import { badRequest } from "../errors.js";

export const VOICE_MAX_CLIP_BYTES = 10 * 1024 * 1024;
export const VOICE_MAX_TTS_CHARS = 4000;
const DEFAULT_GATEWAY_URL = "http://gateway:7630";
const REQUEST_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 3_000;

export interface VoiceEngineHealth {
  reachable: boolean;
  voices: string[];
}

export interface SpeechEngine {
  /** Cheap reachability probe; never rejects. */
  health(): Promise<VoiceEngineHealth>;
  transcribe(clip: Buffer, contentType: string): Promise<string>;
  synthesize(text: string, voice: string): Promise<{ audio: Buffer; contentType: string }>;
}

export class VoiceUnavailableError extends Error {}

/** Turns a markdown comment body into plain text that reads well aloud. */
export function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/~~~[\s\S]*?(~~~|$)/g, " ")
    .replace(/<[^>\n]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/^\s*([-*_]\s*){3,}$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim();
}

/** Engine speaking the voice-gateway's OpenAI-compatible audio API. */
export function createGatewayEngine(baseUrl: string, fetchImpl: typeof fetch = fetch): SpeechEngine {
  const base = baseUrl.replace(/\/+$/, "");
  async function call(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      throw new VoiceUnavailableError(`voice engine unreachable: ${(err as Error).message}`);
    }
    if (!res.ok) throw new VoiceUnavailableError(`voice engine returned HTTP ${res.status}`);
    return res;
  }
  return {
    async health() {
      try {
        const res = await fetchImpl(`${base}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
        if (!res.ok) return { reachable: false, voices: [] };
        const body = (await res.json().catch(() => null)) as { voices?: unknown } | null;
        const voices = Array.isArray(body?.voices) ? body.voices.filter((v): v is string => typeof v === "string") : [];
        return { reachable: true, voices };
      } catch {
        return { reachable: false, voices: [] };
      }
    },
    async transcribe(clip, contentType) {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(clip)], { type: contentType }), "clip.webm");
      form.append("model", "whisper-1");
      const res = await call("/v1/audio/transcriptions", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
      if (!body || typeof body.text !== "string") throw new VoiceUnavailableError("voice engine returned no transcript");
      return body.text.trim();
    },
    async synthesize(text, voice) {
      const res = await call("/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "mp3" }),
      });
      return {
        audio: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") ?? "audio/mpeg",
      };
    },
  };
}

/** Tries each engine in order; the first success wins. */
export function voiceService(engines: SpeechEngine[]) {
  async function firstOf<T>(run: (engine: SpeechEngine) => Promise<T>): Promise<T> {
    let last: unknown = new VoiceUnavailableError("no voice engine configured");
    for (const engine of engines) {
      try {
        return await run(engine);
      } catch (err) {
        if (!(err instanceof VoiceUnavailableError)) throw err;
        last = err;
      }
    }
    throw last;
  }
  return {
    /** Probes every engine; available when at least one answers. */
    async status() {
      const engines_ = await Promise.all(engines.map((e) => e.health()));
      const voices = [...new Set(engines_.flatMap((h) => h.voices))];
      return { available: engines_.some((h) => h.reachable), voices, engines: engines_.map((h) => ({ reachable: h.reachable })) };
    },
    transcribe: (clip: Buffer, contentType: string) => firstOf((e) => e.transcribe(clip, contentType)),
    async synthesize(markdown: string, voice: string) {
      const text = stripMarkdownForSpeech(markdown).slice(0, VOICE_MAX_TTS_CHARS);
      if (!text) throw badRequest("Nothing to read aloud");
      return firstOf((e) => e.synthesize(text, voice));
    },
  };
}

/** Engines from config: PAPERCLIP_VOICE_GATEWAY_URL (default bonker gateway, which already falls back to voice-cpu) then optional PAPERCLIP_VOICE_FALLBACK_URL. */
export function voiceEnginesFromEnv(env: NodeJS.ProcessEnv = process.env): SpeechEngine[] {
  const urls = [env.PAPERCLIP_VOICE_GATEWAY_URL?.trim() || DEFAULT_GATEWAY_URL, env.PAPERCLIP_VOICE_FALLBACK_URL?.trim()];
  return urls.filter((u): u is string => Boolean(u)).map((u) => createGatewayEngine(u));
}

/** Logs engine reachability once at startup so a networking gap shows up before users hit it. */
export async function logVoiceReachability(
  engines: SpeechEngine[],
  log: { info: (msg: string) => void; warn: (msg: string) => void },
): Promise<void> {
  const { available, engines: probed } = await voiceService(engines).status();
  const summary = probed.map((e, i) => `#${i + 1}=${e.reachable ? "up" : "down"}`).join(" ");
  (available ? log.info : log.warn)(`voice gateway reachability: ${summary || "no engines configured"}`);
}
