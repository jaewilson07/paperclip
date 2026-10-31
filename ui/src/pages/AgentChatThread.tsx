import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "@/api/agents";
import { issuesApi } from "@/api/issues";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { useParams } from "@/lib/router";
import { ChatAgentSwitcher } from "@/components/ChatAgentSwitcher";
import { TaskDetailSurface } from "./IssueDetail";

/** One specific chat by issue id; unlike /chats/:agentRef, an agent may have several. */
export function AgentChatThread() {
  const { issueId = "" } = useParams<{ issueId: string }>();
  const { selectedCompanyId } = useCompany();
  const issue = useQuery({ queryKey: queryKeys.issues.detail(issueId), queryFn: () => issuesApi.get(issueId), enabled: !!issueId });
  const agents = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!), queryFn: () => agentsApi.list(selectedCompanyId!), enabled: !!selectedCompanyId,
  });
  if (issue.isPending || agents.isPending) return <p className="text-sm text-muted-foreground">Loading conversation…</p>;
  if (issue.error || agents.error) return <p className="text-sm text-destructive">{(issue.error ?? agents.error)?.message}</p>;
  const chat = issue.data;
  const agent = agents.data?.find((item) => item.id === chat?.conversationAgentId);
  if (!chat?.conversationAgentId) return <p className="text-sm text-destructive">Chat not found.</p>;
  if (!agent) return <p className="text-sm text-destructive">Agent not found.</p>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatAgentSwitcher chat={chat} agents={agents.data ?? []} />
      <TaskDetailSurface key={`${chat.id}:${agent.id}`} conversation={{ agent, issue: chat, ensureIssue: async () => chat }} />
    </div>
  );
}
