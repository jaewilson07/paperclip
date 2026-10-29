import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import type { Agent } from "@paperclipai/shared";
import { agentChatsApi } from "@/api/agentChats";
import { agentsApi } from "@/api/agents";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAgentChatEnabled } from "@/hooks/useAgentChatEnabled";
import { useNavigate } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";

const DEFAULT_CHAT_AGENT = "projectmanager";

/** Chat button for a project header: lists the project's chats (latest first) and starts new ones. */
export function ProjectChatButton({ companyId, projectId, projectName }: { companyId: string; projectId: string; projectName: string }) {
  const { enabled } = useAgentChatEnabled();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageCircle aria-hidden="true" className="size-4" />
        Chat
      </Button>
      {open && <ProjectChatsDialog companyId={companyId} projectId={projectId} projectName={projectName} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProjectChatsDialog({ companyId, projectId, projectName, onClose }: { companyId: string; projectId: string; projectName: string; onClose: () => void }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const chats = useQuery({
    queryKey: [...queryKeys.agentChats.list(companyId), "project", projectId],
    queryFn: () => agentChatsApi.list(companyId, { projectId }),
  });
  const agents = useQuery({ queryKey: queryKeys.agents.list(companyId), queryFn: () => agentsApi.list(companyId) });
  const choices = (agents.data ?? []).filter((agent) => agent.status !== "terminated" && agent.status !== "pending_approval");
  const defaultAgent = choices.find((agent) => agent.name.toLowerCase().replace(/\s+/g, "") === DEFAULT_CHAT_AGENT) ?? choices[0];
  const [agentId, setAgentId] = useState<string | null>(null);
  const chosenId = agentId ?? defaultAgent?.id ?? "";
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agentName = (id: string | null | undefined) => agents.data?.find((agent: Agent) => agent.id === id)?.name ?? "Agent";

  async function startChat() {
    if (!chosenId || starting) return;
    setStarting(true);
    setError(null);
    try {
      const chat = await agentChatsApi.open(companyId, chosenId, { projectId, new: true });
      void client.invalidateQueries({ queryKey: queryKeys.agentChats.list(companyId) });
      navigate(`/chats/c/${chat.id}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t start chat. Try again.");
      setStarting(false);
    }
  }

  const latest = chats.data?.[0];
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="gap-4 sm:max-w-md">
        <DialogTitle>Chats about {projectName}</DialogTitle>
        {chats.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading chats…</p>
          : chats.error ? <p role="alert" className="text-sm text-destructive">Couldn’t load chats. {chats.error.message}</p>
          : chats.data.length === 0 ? <p className="text-sm text-muted-foreground">No chats for this project yet.</p>
          : <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {chats.data.map((chat) => (
              <li key={chat.id}>
                <button type="button" onClick={() => { navigate(`/chats/c/${chat.id}`); onClose(); }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="truncate">{chat.title}{chat.id === latest?.id ? " · latest" : ""}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{agentName(chat.conversationAgentId)}</span>
                </button>
              </li>
            ))}
          </ul>}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <label htmlFor="project-chat-agent" className="text-sm text-muted-foreground">New chat with</label>
          <select id="project-chat-agent" value={chosenId} onChange={(event) => setAgentId(event.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm">
            {choices.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <Button type="button" size="sm" className="ml-auto" disabled={!chosenId || starting} onClick={() => { void startChat(); }}>
            {starting ? "Starting…" : "New chat"}
          </Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
