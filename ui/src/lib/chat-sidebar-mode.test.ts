// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
import { groupChatsByProject, useChatSidebarMode, type ChatSidebarMode } from "./chat-sidebar-mode";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("groupChatsByProject", () => {
  it("groups by project, keeps a no-project group, and puts the latest chat first", () => {
    const groups = groupChatsByProject([
      { id: "a", projectId: "p1", updatedAt: "2026-10-01T00:00:00Z" },
      { id: "b", projectId: null, updatedAt: "2026-10-02T00:00:00Z" },
      { id: "c", projectId: "p1", updatedAt: "2026-10-03T00:00:00Z" },
    ]);
    expect(groups.get("p1")!.map((chat) => chat.id)).toEqual(["c", "a"]);
    expect(groups.get(null)!.map((chat) => chat.id)).toEqual(["b"]);
  });
});

describe("useChatSidebarMode", () => {
  beforeEach(() => localStorage.clear());

  function mount() {
    const seen: { mode?: ChatSidebarMode; set?: (mode: ChatSidebarMode) => void } = {};
    function Probe() {
      const [mode, set] = useChatSidebarMode();
      seen.mode = mode;
      seen.set = set;
      return null;
    }
    const root = createRoot(document.createElement("div"));
    act(() => root.render(createElement(Probe)));
    return { seen, unmount: () => act(() => root.unmount()) };
  }

  it("defaults to Classic and remembers By project across mounts", () => {
    const first = mount();
    expect(first.seen.mode).toBe("classic");
    act(() => first.seen.set!("by-project"));
    expect(first.seen.mode).toBe("by-project");
    first.unmount();
    expect(mount().seen.mode).toBe("by-project");
  });
});
