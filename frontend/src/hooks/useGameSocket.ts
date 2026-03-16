/**
 * Questboard — Game-level WebSocket dispatcher
 * Routes incoming WS messages to the appropriate stores.
 * Uses Zustand's getState() to avoid stale closures.
 */

import { useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { useSessionStore } from "@/stores/sessionStore";
import { useChatStore, createChatMessage } from "@/stores/chatStore";
import { useCombatStore } from "@/stores/combatStore";
import { useMapStore } from "@/stores/mapStore";
import type { WSMessage, InitiativeEntry, TokenState, FogRegion } from "@/types";

export function useGameSocket() {
  // Stable — these selectors return the same function reference
  const addPlayer = useSessionStore((s) => s.addPlayer);
  const removePlayer = useSessionStore((s) => s.removePlayer);
  const addChatMessage = useChatStore((s) => s.addMessage);

  const handleMessage = useCallback(
    (msg: WSMessage) => {
      const { type, from, data } = msg;

      // Read latest store state via getState() — no stale closures
      const combat = useCombatStore.getState();
      const map = useMapStore.getState();

      switch (type) {
        // ─── Chat ──────────────────────
        case "chat":
          addChatMessage(
            createChatMessage("chat", from ?? "Unknown", data.message as string)
          );
          break;

        case "whisper":
          addChatMessage(
            createChatMessage(
              "whisper",
              from ?? "Unknown",
              data.message as string,
              data.to as string
            )
          );
          break;

        // ─── Dice ──────────────────────
        case "dice_result":
          addChatMessage(
            createChatMessage(
              "dice",
              from ?? "Unknown",
              `rolled ${data.notation} → [${(data.results as number[]).join(", ")}]${data.modifier ? ` + ${data.modifier}` : ""} = **${data.total}**${data.label ? ` (${data.label})` : ""}`
            )
          );
          break;

        // ─── Players ───────────────────
        case "player_join":
          addPlayer({
            name: data.name as string,
            joinedAt: new Date().toISOString(),
          });
          addChatMessage(
            createChatMessage("system", "System", `${data.name} joined the session`)
          );
          break;

        case "player_leave":
          removePlayer(data.name as string);
          addChatMessage(
            createChatMessage("system", "System", `${data.name} left the session`)
          );
          break;

        // ─── Combat ────────────────────
        case "combat_start":
          combat.startCombat(data.initiative as InitiativeEntry[]);
          addChatMessage(
            createChatMessage("system", "System", "Combat has started!")
          );
          break;

        case "combat_next_turn": {
          combat.nextTurn();
          // Re-read state after mutation
          const updated = useCombatStore.getState();
          const current = updated.initiative[updated.turnIndex];
          if (current) {
            addChatMessage(
              createChatMessage("system", "System", `It's ${current.name}'s turn`)
            );
          }
          break;
        }

        case "combat_damage":
          combat.applyDamage(
            data.target as string,
            data.damage as number
          );
          break;

        case "combat_end":
          combat.endCombat();
          addChatMessage(
            createChatMessage("system", "System", "Combat has ended")
          );
          break;

        // ─── Map & Tokens ──────────────
        case "token_move":
          map.moveToken(
            data.token_id as string,
            data.x as number,
            data.y as number
          );
          break;

        case "token_add":
          map.addToken(data.token as TokenState);
          break;

        case "token_remove":
          map.removeToken(data.token_id as string);
          break;

        case "fog_update":
          map.setFogRegions(data.regions as FogRegion[]);
          break;

        // ─── Errors ────────────────────
        case "error":
          addChatMessage(
            createChatMessage("system", "System", `Error: ${data.message}`)
          );
          break;

        default:
          console.log(`[GameSocket] Unhandled message type: ${type}`);
      }
    },
    [addPlayer, removePlayer, addChatMessage]
  );

  return useWebSocket(handleMessage);
}
