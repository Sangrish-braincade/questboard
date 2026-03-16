/**
 * PlayerSession — The player view during an active session.
 * Shows battle map (view-only tokens they don't own), chat, dice, and combat tracker.
 */

import { useState } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useGameSocket } from "@/hooks/useGameSocket";
import BattleMap from "@/components/battlemap/BattleMap";
import ChatPanel from "@/components/chat/ChatPanel";
import CombatTracker from "@/components/combat/CombatTracker";
import DiceRoller from "@/components/dice/DiceRoller";

type SidePanel = "chat" | "combat";

export default function PlayerSession() {
  const { sessionCode, name } = useSessionStore();
  const { send } = useGameSocket();
  const [activePanel, setActivePanel] = useState<SidePanel>("chat");

  const handleTokenMove = (tokenId: string, gridX: number, gridY: number) => {
    send({
      type: "token_move",
      data: { token_id: tokenId, x: gridX, y: gridY },
    });
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-[var(--color-surface-lighter)] px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-[var(--color-primary)]">
            Questboard
          </h1>
          <span className="text-sm text-[var(--color-text)]">{name}</span>
        </div>
        <span className="rounded bg-[var(--color-surface-light)] px-3 py-1 font-mono text-xs text-[var(--color-text-muted)]">
          {sessionCode}
        </span>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Battle Map */}
        <div className="flex-1 relative">
          <BattleMap
            isDm={false}
            onTokenMove={handleTokenMove}
          />
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <DiceRoller send={send} />
          </div>
        </div>

        {/* Side Panel */}
        <div className="flex w-72 flex-col">
          <div className="flex border-b border-[var(--color-surface-lighter)]">
            {(["chat", "combat"] as SidePanel[]).map((panel) => (
              <button
                key={panel}
                onClick={() => setActivePanel(panel)}
                className={`flex-1 py-2 text-xs font-semibold uppercase transition-colors ${
                  activePanel === panel
                    ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {panel}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {activePanel === "chat" && (
              <ChatPanel send={send} className="h-full" />
            )}
            {activePanel === "combat" && (
              <CombatTracker isDm={false} send={send} className="h-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
