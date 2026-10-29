import { useCallback, useState } from "react";

export type ChatSidebarMode = "classic" | "by-project";
const KEY = "paperclip:chat-sidebar-mode";

function read(): ChatSidebarMode {
  try {
    return localStorage.getItem(KEY) === "by-project" ? "by-project" : "classic";
  } catch {
    return "classic";
  }
}

/** Classic (per-agent list) vs By project (chats grouped by project); the choice is remembered. */
export function useChatSidebarMode(): [ChatSidebarMode, (mode: ChatSidebarMode) => void] {
  const [mode, setModeState] = useState<ChatSidebarMode>(read);
  const setMode = useCallback((next: ChatSidebarMode) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage may be unavailable; the toggle still works for this session.
    }
  }, []);
  return [mode, setMode];
}

/** Group chats by project id; chats with no project go under `null`. Most recently updated chat first within a group. */
export function groupChatsByProject<T extends { projectId?: string | null; updatedAt: Date | string }>(chats: readonly T[]) {
  const groups = new Map<string | null, T[]>();
  for (const chat of chats) {
    const key = chat.projectId ?? null;
    groups.set(key, [...(groups.get(key) ?? []), chat]);
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  return groups;
}
