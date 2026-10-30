import { useRef, useState, type ReactNode } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

const LONG_PRESS_MS = 500;

/**
 * Shows a chat's ~2 sentence description and current agent on hover (mouse) or long-press (touch).
 * The wrapped row stays a normal link: a long-press only opens the card and swallows the tap that follows it.
 */
export function ChatHoverInfo({ agentName, description, children }: { agentName: string; description: string | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpen(true); }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") setOpen(false); }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            longPressed.current = false;
            clearTimer();
            timer.current = setTimeout(() => { longPressed.current = true; setOpen(true); }, LONG_PRESS_MS);
          }}
          onPointerUp={clearTimer}
          onPointerCancel={clearTimer}
          onPointerMove={(event) => { if (event.pointerType !== "mouse") clearTimer(); }}
          onContextMenu={(event) => { if (longPressed.current) event.preventDefault(); }}
          onClickCapture={(event) => {
            if (!longPressed.current) return;
            longPressed.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {children}
        </div>
      </PopoverAnchor>
      <PopoverContent side="right" align="start" className="w-64 text-sm" onOpenAutoFocus={(event) => event.preventDefault()}>
        <p className="text-xs text-muted-foreground">With {agentName}</p>
        <p className="mt-1">{description ?? "No description yet."}</p>
      </PopoverContent>
    </Popover>
  );
}
