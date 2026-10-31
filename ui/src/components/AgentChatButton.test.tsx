// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, Issue } from "@paperclipai/shared";
import { AgentChatButton } from "./AgentChatButton";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  ensure: vi.fn(),
  list: vi.fn(),
  enabled: true,
  pushToast: vi.fn(),
}));
vi.mock("@/context/CompanyContext", () => ({ useCompany: () => ({ selectedCompanyId: "company-a" }) }));
vi.mock("@/context/SidebarContext", () => ({ useSidebar: () => ({ isMobile: false, setSidebarOpen: vi.fn() }) }));
vi.mock("@/lib/router", () => ({ useNavigate: () => state.navigate }));
vi.mock("../context/ToastContext", () => ({ useToastActions: () => ({ pushToast: state.pushToast }) }));
vi.mock("@/api/agents", () => ({ agentsApi: { list: () => [] } }));
vi.mock("@/api/auth", () => ({ authApi: { getSession: () => ({ user: { id: "user-a" } }) } }));
vi.mock("@/api/agentChats", () => ({ agentChatsApi: { ensure: state.ensure, list: state.list } }));
vi.mock("@/hooks/useAgentChatEnabled", () => ({
  useAgentChatEnabled: () => ({ enabled: state.enabled, loaded: true }),
}));

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const agent = { id: "a1", companyId: "company-a", name: "Alice", urlKey: "alice", role: "engineer" } as Agent;
const chat = (id: string) => ({ id, updatedAt: new Date(0).toISOString() }) as unknown as Issue;

async function render() {
  await act(async () => {
    root.render(<QueryClientProvider client={client}><AgentChatButton agent={agent} /></QueryClientProvider>);
  });
  // Let the session query settle; the button stays disabled until the user is known.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
async function click() {
  await act(async () => { container.querySelector("button")!.click(); });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.navigate.mockClear();
  state.ensure.mockReset();
  state.list.mockReset().mockResolvedValue([]);
  state.pushToast.mockClear();
  state.enabled = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});

describe("AgentChatButton", () => {
  it("resumes the existing chat and navigates to it", async () => {
    state.ensure.mockResolvedValue(chat("existing-chat"));
    await render();
    await click();
    expect(state.ensure).toHaveBeenCalledTimes(1);
    expect(state.ensure).toHaveBeenCalledWith("company-a", "a1");
    expect(state.navigate).toHaveBeenCalledWith("/chats/alice");
  });

  it("delegates creation to the one-per-agent resolver when no chat exists", async () => {
    state.ensure.mockResolvedValue(chat("new-chat"));
    await render();
    await click();
    await click();
    // Each click asks the one-per-agent resolver; the client never creates issues itself.
    expect(state.ensure.mock.calls.every(([company, ref]) => company === "company-a" && ref === "a1")).toBe(true);
    expect(state.navigate).toHaveBeenCalledWith("/chats/alice");
  });

  it("toasts and stays put when the chat cannot be opened", async () => {
    state.ensure.mockRejectedValue(new Error("boom"));
    await render();
    await click();
    expect(state.navigate).not.toHaveBeenCalled();
    expect(state.pushToast).toHaveBeenCalledWith(expect.objectContaining({ body: "boom", tone: "error" }));
  });

  it("renders nothing when Agent Chat is disabled", async () => {
    state.enabled = false;
    await render();
    expect(container.querySelector("button")).toBeNull();
  });
});
