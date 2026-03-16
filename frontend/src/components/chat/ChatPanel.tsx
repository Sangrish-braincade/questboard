/**
 * ChatPanel — Real-time chat with support for whispers, dice results, and system messages.
 */

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { ChatMessage, WSMessage } from "@/types";

interface ChatPanelProps {
  send: (msg: WSMessage) => void;
  className?: string;
}

export default function ChatPanel({ send, className = "" }: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages);
  const clearUnread = useChatStore((s) => s.clearUnread);
  const myName = useSessionStore((s) => s.name);
  const role = useSessionStore((s) => s.role);
  const players = useSessionStore((s) => s.players);

  const [input, setInput] = useState("");
  const [whisperTarget, setWhisperTarget] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    clearUnread();
  }, [messages.length, clearUnread]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    // Check for /commands
    if (text.startsWith("/w ") || text.startsWith("/whisper ")) {
      const parts = text.replace(/^\/w(hisper)?\s+/, "").split(" ");
      const target = parts[0];
      const message = parts.slice(1).join(" ");
      if (target && message) {
        send({
          type: "whisper",
          data: { to: target, message },
        });
      }
    } else if (text.startsWith("/r ") || text.startsWith("/roll ")) {
      const notation = text.replace(/^\/r(oll)?\s+/, "");
      send({
        type: "dice_roll",
        data: { notation, label: "" },
      });
    } else if (whisperTarget) {
      send({
        type: "whisper",
        data: { to: whisperTarget, message: text },
      });
    } else {
      send({
        type: "chat",
        data: { message: text },
      });
    }

    setInput("");
  };

  return (
    <div
      className={`flex flex-col border-l border-[var(--color-surface-lighter)] bg-[var(--color-surface-light)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-surface-lighter)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Chat</h3>
        {whisperTarget && (
          <button
            onClick={() => setWhisperTarget(null)}
            className="rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300"
          >
            Whispering to {whisperTarget} ×
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} myName={myName} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--color-surface-lighter)] p-2">
        {/* Quick whisper targets (DM only) */}
        {role === "dm" && players.length > 0 && (
          <div className="mb-1 flex gap-1 overflow-x-auto pb-1">
            {players.map((p) => (
              <button
                key={p.name}
                onClick={() =>
                  setWhisperTarget(
                    whisperTarget === p.name ? null : p.name
                  )
                }
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs transition-colors ${
                  whisperTarget === p.name
                    ? "bg-purple-500 text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              whisperTarget
                ? `Whisper to ${whisperTarget}...`
                : "Type a message... (/r 1d20, /w name msg)"
            }
            className="flex-1 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-surface-lighter)] outline-none ring-1 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
          />
          <button
            onClick={handleSend}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Bubble ─────────────────────────────────────────────────────

function ChatBubble({
  message,
  myName,
}: {
  message: ChatMessage;
  myName: string | null;
}) {
  const isMine = message.from === myName;

  const colorMap: Record<ChatMessage["type"], string> = {
    chat: "text-[var(--color-text)]",
    whisper: "text-purple-300",
    system: "text-[var(--color-text-muted)] italic",
    dice: "text-amber-300",
  };

  const bgMap: Record<ChatMessage["type"], string> = {
    chat: isMine
      ? "bg-[var(--color-primary)]/10"
      : "bg-[var(--color-surface)]",
    whisper: "bg-purple-500/10 border border-purple-500/20",
    system: "bg-transparent",
    dice: "bg-amber-500/10 border border-amber-500/20",
  };

  if (message.type === "system") {
    return (
      <div className="py-1 text-center text-xs text-[var(--color-text-muted)] italic">
        {message.content}
      </div>
    );
  }

  return (
    <div className={`mb-2 rounded-lg px-3 py-2 ${bgMap[message.type]}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-[var(--color-primary)]">
          {message.from}
        </span>
        {message.type === "whisper" && message.target && (
          <span className="text-xs text-purple-400">
            → {message.target}
          </span>
        )}
        <span className="ml-auto text-xs text-[var(--color-text-muted)]">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className={`mt-0.5 text-sm ${colorMap[message.type]}`}>
        {message.content}
      </p>
    </div>
  );
}
