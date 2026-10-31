import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Agent, Issue } from "@paperclipai/shared";
import { agentChatsApi } from "@/api/agentChats";
import { queryKeys } from "@/lib/queryKeys";

/** Moves a chat to another agent. History is kept; later messages go to the new agent. */
export function ChatAgentSwitcher({ chat, agents }: { chat: Issue; agents: Agent[] }) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const choices = agents.filter((agent) => agent.status !== "terminated" && agent.status !== "pending_approval");
  const mutation = useMutation({
    mutationFn: (agentId: string) => agentChatsApi.switchAgent(chat.id, agentId),
    onSuccess: (updated) => {
      setError(null);
      client.setQueryData(queryKeys.issues.detail(chat.id), updated);
      void client.invalidateQueries({ queryKey: ["agent-chats", chat.companyId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Couldn’t switch agent."),
  });
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm">
      <label htmlFor="chat-agent-switcher" className="text-muted-foreground">Talking to</label>
      <select
        id="chat-agent-switcher"
        value={chat.conversationAgentId ?? ""}
        disabled={mutation.isPending}
        onChange={(event) => mutation.mutate(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1"
      >
        {choices.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      </select>
      {error && <span role="alert" className="text-destructive">{error}</span>}
    </div>
  );
}
