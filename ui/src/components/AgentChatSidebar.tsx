import { useQuery } from "@tanstack/react-query";
import { Star, SquarePen } from "lucide-react";
import { agentChatsApi } from "@/api/agentChats";
import { projectsApi } from "@/api/projects";
import { useCompany } from "@/context/CompanyContext";
import { groupChatsByProject, useChatSidebarMode, type ChatSidebarMode } from "@/lib/chat-sidebar-mode";
import { queryKeys } from "@/lib/queryKeys";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import { AgentIcon } from "@/components/AgentIconPicker";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/context/SidebarContext";
import type { Agent } from "@paperclipai/shared";
import { agentRouteRef, cn } from "@/lib/utils";
import { orderChatAgents } from "@/lib/recent-agent-chats";
export function AgentChatSidebar({
  activeId,
  starredIds,
  recentIds,
  onToggleStar,
  onOpenChat,
  agents,
  href = (id: string) =>
    `/chats/${encodeURIComponent(agentRouteRef(agents.find((agent) => agent.id === id)!))}`,
}: {
  agents: Agent[];
  href?: (id: string) => string;
  activeId: string;
  starredIds: string[];
  recentIds: string[];
  onToggleStar: (id: string) => void;
  onOpenChat: () => void;
}) {
  const { collapsed, peeking } = useSidebar();
  const rail = collapsed && !peeking;
  const ordered = orderChatAgents(agents, starredIds, recentIds);
  const [mode, setMode] = useChatSidebarMode();
  const row = (agent: Agent) => {
    const pinned = starredIds.includes(agent.id);
    return (
      <div key={agent.id} className="group/agent-chat relative">
        <SidebarNavItem
          to={href(agent.id)}
          label={agent.name}
          active={activeId === agent.id}
          iconNode={
            <AgentIcon icon={agent.icon} className="h-4 w-4 shrink-0" />
          }
          className={rail ? undefined : "pr-9"}
        />
        {!rail && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`${pinned ? "Unstar" : "Star"} ${agent.name}`}
            aria-pressed={pinned}
            title={pinned ? "Unstar agent" : "Star agent to pin"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleStar(agent.id);
            }}
            className={cn("absolute right-2 top-(--pct-50) -translate-y-(--pct-50) text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/agent-chat:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100", pinned && "opacity-100")}
          >
            <Star
              aria-hidden="true"
              className={cn("size-3.5", pinned && "fill-current")}
            />
          </Button>
        )}
      </div>
    );
  };
  return (
    <section aria-label="Chats" className="group/chats flex flex-col gap-0.5">
      <div className="relative flex min-h-9 items-center px-4 py-1.5">
        <span className={cn("font-mono text-(length:--text-nano) font-medium uppercase tracking-widest text-muted-foreground/60", rail && "sr-only")}>Chats</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Chat with an agent"
          title="Chat with an agent"
          onClick={onOpenChat}
          className="absolute right-2 top-(--pct-50) -translate-y-(--pct-50) text-muted-foreground opacity-0 group-hover/chats:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        >
          <SquarePen aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
      {!rail && <ChatModeToggle mode={mode} onChange={setMode} />}
      {mode === "by-project" && !rail ? <ChatsByProject agents={agents} /> : ordered.map(row)}
    </section>
  );
}

function ChatModeToggle({ mode, onChange }: { mode: ChatSidebarMode; onChange: (mode: ChatSidebarMode) => void }) {
  return (
    <div role="group" aria-label="Chat list view" className="mx-4 mb-1 flex gap-1 text-xs">
      {([["classic", "Classic"], ["by-project", "By project"]] as const).map(([value, label]) => (
        <Button key={value} type="button" variant={mode === value ? "secondary" : "ghost"} size="xs" aria-pressed={mode === value} onClick={() => onChange(value)}>
          {label}
        </Button>
      ))}
    </div>
  );
}

/** Chats grouped by project, with a group for chats that belong to no project. Rows show only the title. */
function ChatsByProject({ agents }: { agents: Agent[] }) {
  const { selectedCompanyId: companyId } = useCompany();
  const chats = useQuery({
    queryKey: queryKeys.agentChats.list(companyId),
    queryFn: () => agentChatsApi.list(companyId!),
    enabled: !!companyId,
  });
  const projects = useQuery({
    queryKey: queryKeys.projects.list(companyId!),
    queryFn: () => projectsApi.list(companyId!),
    enabled: !!companyId,
  });
  if (chats.isPending) return <p role="status" className="px-4 py-2 text-xs text-muted-foreground">Loading chats…</p>;
  if (chats.error) return <p role="alert" className="px-4 py-2 text-xs text-destructive">Couldn’t load chats.</p>;
  if (chats.data.length === 0) return <p className="px-4 py-2 text-xs text-muted-foreground">No chats yet.</p>;
  const groups = groupChatsByProject(chats.data);
  const projectName = (id: string | null) => id === null ? "No project" : projects.data?.find((project) => project.id === id)?.name ?? "Project";
  const keys = [...groups.keys()].sort((a, b) => a === null ? 1 : b === null ? -1 : projectName(a).localeCompare(projectName(b)));
  return (
    <>
      {keys.map((key) => (
        <div key={key ?? "none"} className="flex flex-col gap-0.5">
          <span className="px-4 pt-2 font-mono text-(length:--text-nano) font-medium uppercase tracking-widest text-muted-foreground/60">{projectName(key)}</span>
          {groups.get(key)!.map((chat) => (
            <div key={chat.id} title={`With ${agents.find((agent) => agent.id === chat.conversationAgentId)?.name ?? "agent"}`}>
              <SidebarNavItem to={`/chats/c/${chat.id}`} label={chat.title} />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
