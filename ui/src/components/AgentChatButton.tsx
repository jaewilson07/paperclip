import { useState } from "react";
import { MessageCircle } from "lucide-react";
import type { Agent } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { useAgentChatNavigation, useOpenAgentChat } from "@/hooks/useAgentChatNavigation";
import { useToastActions } from "../context/ToastContext";

/**
 * Opens the signed-in user's chat with this agent. `useOpenAgentChat` goes
 * through the atomic one-per-agent resolver, so an existing chat is resumed
 * and a missing one is created exactly once.
 */
export function AgentChatButton({ agent, size = "sm" }: { agent: Agent; size?: "sm" | "default" }) {
  const { companyId, userId, enabled, session } = useAgentChatNavigation();
  const openChat = useOpenAgentChat(companyId, userId);
  const { pushToast } = useToastActions();
  const [opening, setOpening] = useState(false);
  if (!enabled) return null;
  async function open() {
    if (opening) return;
    setOpening(true);
    try {
      await openChat(agent);
    } catch (error) {
      pushToast({
        title: "Couldn’t open chat",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setOpening(false);
    }
  }
  return (
    <Button variant="outline" size={size} onClick={() => void open()} disabled={opening || !session.isSuccess}>
      <MessageCircle className="h-3.5 w-3.5 sm:mr-1" />
      <span className="hidden sm:inline">Chat</span>
    </Button>
  );
}
