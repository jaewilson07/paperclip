// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectChatButton } from "./ProjectChatsDialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const navigate = vi.fn();
const list = vi.fn();

vi.mock("@/lib/router", () => ({ useNavigate: () => navigate }));
vi.mock("@/hooks/useAgentChatEnabled", () => ({ useAgentChatEnabled: () => ({ enabled: true }) }));
vi.mock("@/api/agentChats", () => ({ agentChatsApi: { list: (...args: unknown[]) => list(...args), open: vi.fn() } }));
vi.mock("@/api/agents", () => ({ agentsApi: { list: vi.fn().mockResolvedValue([]) } }));

describe("ProjectChatButton", () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    navigate.mockReset();
    list.mockReset();
  });
  afterEach(() => container.remove());

  async function render() {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <ProjectChatButton companyId="c1" projectId="p1" projectName="Proj" />
        </QueryClientProvider>,
      );
    });
  }

  async function clickChat() {
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Chat")!;
    await act(async () => { button.click(); });
  }

  it("jumps straight into the latest chat when the project has chats", async () => {
    list.mockResolvedValue([{ id: "chat-new" }, { id: "chat-old" }]);
    await render();
    await clickChat();
    expect(list).toHaveBeenCalledWith("c1", { projectId: "p1" });
    expect(navigate).toHaveBeenCalledWith("/chats/c/chat-new");
  });

  it("opens the dialog instead when the project has no chats", async () => {
    list.mockResolvedValue([]);
    await render();
    await clickChat();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Chats about Proj");
  });
});
