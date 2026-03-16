/**
 * DMSession — The main DM view when a session is active.
 * Composes battle map, chat, combat tracker, dice roller, and token panel.
 */

import { useState } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useGameSocket } from "@/hooks/useGameSocket";
import BattleMap from "@/components/battlemap/BattleMap";
import TokenPanel from "@/components/battlemap/TokenPanel";
import ChatPanel from "@/components/chat/ChatPanel";
import CombatTracker from "@/components/combat/CombatTracker";
import DiceRoller from "@/components/dice/DiceRoller";
import { useMapStore } from "@/stores/mapStore";
import type { TokenState } from "@/types";

type SidePanel = "chat" | "combat" | "tokens";

export default function DMSession() {
  const { sessionCode, name, players, endSession, regenerateCode, toggleLock, locked } =
    useSessionStore();
  const { send } = useGameSocket();
  const [activePanel, setActivePanel] = useState<SidePanel>("chat");
  const [selectedToken, setSelectedToken] = useState<TokenState | null>(null);

  const addToken = useMapStore((s) => s.addToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const updateToken = useMapStore((s) => s.updateToken);

  const handleTokenMove = (tokenId: string, gridX: number, gridY: number) => {
    send({
      type: "token_move",
      data: { token_id: tokenId, x: gridX, y: gridY },
    });
  };

  const handleAddToken = (token: TokenState) => {
    addToken(token);
    send({ type: "token_add", data: { token } });
  };

  const handleRemoveToken = (id: string) => {
    removeToken(id);
    send({ type: "token_remove", data: { token_id: id } });
    setSelectedToken(null);
  };

  const handleUpdateToken = (id: string, updates: Partial<TokenState>) => {
    updateToken(id, updates);
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-[var(--color-surface-lighter)] px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-[var(--color-primary)]">
            Questboard
          </h1>
          <span className="text-sm text-[var(--color-text-muted)]">
            DM: {name}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {players.length} player{players.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Session code display */}
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-light)] px-3 py-1.5">
            <span className="text-xs text-[var(--color-text-muted)]">Code:</span>
            <span className="font-mono text-lg font-bold tracking-widest text-[var(--color-primary)]">
              {sessionCode}
            </span>
            <button
              onClick={() => regenerateCode()}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              title="Generate new code"
            >
              ↻
            </button>
          </div>

          <button
            onClick={() => toggleLock()}
            className={`rounded px-3 py-1.5 text-xs ${
              locked
                ? "bg-red-500/20 text-red-300"
                : "bg-green-500/20 text-green-300"
            }`}
          >
            {locked ? "Locked" : "Open"}
          </button>

          <button
            onClick={() => endSession()}
            className="rounded bg-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Battle Map (center) */}
        <div className="flex-1 relative">
          <BattleMap
            isDm={true}
            onTokenMove={handleTokenMove}
            onTokenSelect={setSelectedToken}
          />

          {/* Dice roller overlay (bottom) */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <DiceRoller send={send} />
          </div>
        </div>

        {/* Side Panel */}
        <div className="flex w-80 flex-col">
          {/* Panel tabs */}
          <div className="flex border-b border-[var(--color-surface-lighter)]">
            {(["chat", "combat", "tokens"] as SidePanel[]).map((panel) => (
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

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === "chat" && (
              <ChatPanel send={send} className="h-full" />
            )}
            {activePanel === "combat" && (
              <CombatTracker isDm={true} send={send} className="h-full" />
            )}
            {activePanel === "tokens" && (
              <TokenPanel
                selectedToken={selectedToken}
                onAddToken={handleAddToken}
                onRemoveToken={handleRemoveToken}
                onUpdateToken={handleUpdateToken}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
