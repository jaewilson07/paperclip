import { useEffect, useState } from "react";
import { voiceApi, type VoiceStatus } from "../api/voice";

export const NO_VOICE_ENGINE_REASON = "Voice is unavailable: the speech service can't be reached right now.";
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; promise: Promise<VoiceStatus | null> }>();

function probe(companyId: string) {
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = voiceApi.status(companyId).catch(() => null);
  cache.set(companyId, { at: Date.now(), promise });
  return promise;
}

/** Test hook: forget cached probes. */
export function resetVoiceStatusCache() {
  cache.clear();
}

/** Whether any speech engine is reachable. Optimistic while loading or if the probe itself fails. */
export function useVoiceStatus(companyId: string | null | undefined) {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  useEffect(() => {
    if (!companyId) return;
    let live = true;
    void probe(companyId).then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [companyId]);
  return { voices: status?.voices ?? [], unavailableReason: status?.available === false ? NO_VOICE_ENGINE_REASON : null };
}
