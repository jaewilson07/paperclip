import type { Issue } from "@paperclipai/shared";
import { api } from "./client";
/** A chat issue as listed: with its ~2 sentence description when the chat's agent has written one. */
export type ChatIssue = Issue & { chatDescription?: string | null };

export const agentChatsApi = {
  /** `projectId`: a project's chats; "none": chats with no project; omitted: all of the user's chats. */
  list: (companyId: string, opts: { projectId?: string | "none" } = {}) =>
    api.get<ChatIssue[]>(`/companies/${companyId}/chats${opts.projectId ? `?projectId=${encodeURIComponent(opts.projectId)}` : ""}`),
  get: (companyId: string, agentRef: string) =>
    api.get<Issue | null>(
      `/companies/${companyId}/chats/${encodeURIComponent(agentRef)}`,
    ),
  ensure: (companyId: string, agentRef: string) =>
    api.post<Issue>(
      `/companies/${companyId}/chats/${encodeURIComponent(agentRef)}`,
      {},
    ),
  /** Resume the latest chat for the agent and project, or open an additional one with `new`. */
  open: (companyId: string, agentRef: string, opts: { projectId?: string; new?: boolean }) =>
    api.post<Issue>(
      `/companies/${companyId}/chats/${encodeURIComponent(agentRef)}`,
      opts,
    ),
  switchAgent: (issueId: string, agentId: string) =>
    api.post<Issue>(`/issues/${issueId}/chat-agent`, { agentId }),
};
