const KEY = "paperclip:voice-name";

/** The voice the user last picked, or undefined to use the server default. Kept in client storage. */
export function getVoicePreference(): string | undefined {
  try {
    return localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setVoicePreference(voice: string | undefined) {
  try {
    if (voice) localStorage.setItem(KEY, voice);
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable (private mode): the choice just won't persist
  }
}
